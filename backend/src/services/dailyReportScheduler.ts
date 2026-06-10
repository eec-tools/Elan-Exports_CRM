import cron from "node-cron";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import nodemailer from "nodemailer";
import puppeteer from "puppeteer";
import prisma from "../config/db.js";
import { s3, S3_BUCKET, s3FileUrl } from "../lib/s3.js";
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  type CRMReportData,
  type ReportType,
} from "./dailyReportService.js";
import { buildReportHtml } from "./dailyReportTemplate.js";

const REPORT_RECIPIENT = "shirali@eectrade.com";
const IST_OFFSET_MS    = 5.5 * 60 * 60 * 1000;

const VAULT_FOLDER: Record<ReportType, string> = {
  daily:   "Daily Reports",
  weekly:  "Weekly Reports",
  monthly: "Monthly Reports",
};

const S3_KEY_PREFIX: Record<ReportType, string> = {
  daily:   "vault_daily_report",
  weekly:  "vault_weekly_report",
  monthly: "vault_monthly_report",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || "smtp.gmail.com",
    port:   Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_APP_PASSWORD,
    },
  });
}

// ── HTML → PDF via Puppeteer ──────────────────────────────────────────────────
async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--single-process",
      "--no-first-run",
      "--no-zygote",
    ],
    timeout: 60_000,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    await page.emulateMediaType("screen");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16px", bottom: "16px", left: "0px", right: "0px" },
      scale: 0.82,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

// ── Upload PDF to S3 / CloudFront ─────────────────────────────────────────────
async function uploadPdfToS3(
  pdfBuffer: Buffer,
  reportType: ReportType,
  isoDate: string,
): Promise<string> {
  const s3Key = `vault/reports/${S3_KEY_PREFIX[reportType]}_${isoDate}.pdf`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  }));
  return s3FileUrl(s3Key);
}

// ── Save to vault (always runs, fileUrl can be null if PDF failed) ────────────
async function saveReportToVault(
  fileUrl: string | null,
  reportType: ReportType,
  periodLabel: string,
) {
  const folderName = VAULT_FOLDER[reportType];

  let parentFolder = await prisma.vaultDocument.findFirst({
    where: { name: folderName, isFolder: true, parentId: null },
  });

  if (!parentFolder) {
    parentFolder = await prisma.vaultDocument.create({
      data: { name: folderName, category: "Internal Reports", region: "Global", isFolder: true },
    });
    console.log(`[Report] Created vault folder: ${folderName}`);
  }

  const reportTypeLabel = reportType.charAt(0).toUpperCase() + reportType.slice(1);
  const docName = `CRM ${reportTypeLabel} Report — ${periodLabel}`;

  const existing = await prisma.vaultDocument.findFirst({
    where: { name: docName, parentId: parentFolder.id, isFolder: false },
  });

  if (existing) {
    await prisma.vaultDocument.update({
      where: { id: existing.id },
      data: {
        fileUrl: fileUrl ?? existing.fileUrl,
        fileType: fileUrl ? "pdf" : existing.fileType,
        updatedAt: new Date(),
      },
    });
    console.log(`[Report] Updated vault entry: ${docName}`);
  } else {
    await prisma.vaultDocument.create({
      data: {
        name: docName,
        category: "Internal Reports",
        region: "Global",
        isFolder: false,
        parentId: parentFolder.id,
        fileUrl,
        fileType: fileUrl ? "pdf" : undefined,
      },
    });
    console.log(`[Report] Created vault entry: ${docName}`);
  }
}

// ── Send email ────────────────────────────────────────────────────────────────
async function sendReportEmail(
  html: string,
  pdfBuffer: Buffer | null,
  data: CRMReportData,
) {
  const transporter = getTransporter();
  const reportTypeLabel = data.reportType.charAt(0).toUpperCase() + data.reportType.slice(1);
  const safeName = data.periodLabel.replace(/,\s*/g, "_").replace(/\s+/g, "_").replace(/[–—]/g, "-");

  await transporter.sendMail({
    from: `"Élan Exports CRM" <${process.env.SMTP_EMAIL}>`,
    to:   REPORT_RECIPIENT,
    subject: `CRM ${reportTypeLabel} Digest — ${data.periodLabel}`,
    html,
    attachments: pdfBuffer
      ? [{ filename: `CRM-${reportTypeLabel}-Report-${safeName}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
      : [],
  });

  console.log(`[Report] ${reportTypeLabel} email sent to ${REPORT_RECIPIENT}`);
}

// ── Core runner ───────────────────────────────────────────────────────────────
async function runReport(
  generateFn: () => Promise<CRMReportData>,
  label: string,
) {
  console.log(`[Report] Starting ${label} report generation…`);

  const data = await generateFn();
  console.log(`[Report] Data collected for ${data.periodLabel}`);

  const html = buildReportHtml(data);

  // PDF — failure is non-fatal; email and vault still proceed
  let pdfBuffer: Buffer | null = null;
  try {
    console.log("[Report] Rendering PDF via Puppeteer…");
    pdfBuffer = await htmlToPdf(html);
    console.log(`[Report] PDF generated (${Math.round(pdfBuffer.length / 1024)} KB)`);
  } catch (pdfErr) {
    console.error("[Report] PDF generation failed — continuing without attachment:", pdfErr);
  }

  // Email — always send regardless of PDF
  await sendReportEmail(html, pdfBuffer, data);

  // Vault — always save, even without PDF
  try {
    let fileUrl: string | null = null;
    if (pdfBuffer) {
      try {
        fileUrl = await uploadPdfToS3(pdfBuffer, data.reportType, data.isoDate);
      } catch (s3Err) {
        console.error("[Report] S3 upload failed — vault entry saved without file:", s3Err);
      }
    }
    await saveReportToVault(fileUrl, data.reportType, data.periodLabel);
    console.log(`[Report] Vault entry saved for ${data.periodLabel}`);
  } catch (vaultErr) {
    console.error("[Report] Vault save failed:", vaultErr);
  }

  console.log(`[Report] ${label} report completed for ${data.periodLabel}`);
}

// Retry wrapper — attempts the report up to 3 times with increasing delays
async function runReportWithRetry(
  generateFn: () => Promise<CRMReportData>,
  label: string,
  maxAttempts = 3,
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await runReport(generateFn, label);
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error(`[Report] ${label} failed after ${maxAttempts} attempts — giving up:`, err);
        return;
      }
      const delayMin = attempt * 3; // 3min, 6min between attempts
      console.warn(`[Report] ${label} attempt ${attempt} failed — retrying in ${delayMin}min…`, (err as Error).message);
      await new Promise(r => setTimeout(r, delayMin * 60_000));
    }
  }
}

// ── Public runners ────────────────────────────────────────────────────────────

export async function runDailyReport() {
  return runReportWithRetry(generateDailyReport, "daily");
}

export async function runWeeklyReport() {
  return runReportWithRetry(generateWeeklyReport, "weekly");
}

export async function runMonthlyReport() {
  return runReportWithRetry(generateMonthlyReport, "monthly");
}

// ── Missed-report catch-up ────────────────────────────────────────────────────
// Checks whether each scheduled report already exists in the vault for the
// current period. If not — and the scheduled time has passed — runs it now.
// Called on server startup so a crashed/restarted server never skips a report.

async function reportExistsInVault(folderName: string, since: Date): Promise<boolean> {
  const folder = await prisma.vaultDocument.findFirst({
    where: { name: folderName, isFolder: true, parentId: null },
  });
  if (!folder) return false;

  const doc = await prisma.vaultDocument.findFirst({
    where: { parentId: folder.id, isFolder: false, updatedAt: { gte: since }, fileUrl: { not: null } },
  });
  return doc !== null;
}

function istMidnight(y: number, m: number, d: number): Date {
  // Returns the UTC instant that equals midnight IST on the given Y/M/D
  return new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
}

export async function runMissedReports(opts: { force?: boolean } = {}): Promise<void> {
  const now    = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
  const istHr  = nowIST.getUTCHours();
  const istMin = nowIST.getUTCMinutes();
  const y = nowIST.getUTCFullYear(), m = nowIST.getUTCMonth(), d = nowIST.getUTCDate();

  // Only check after 9:05 AM IST (gives the cron a 5-min window to fire first)
  // force=true bypasses this check (used by manual trigger endpoint)
  if (!opts.force && (istHr < 9 || (istHr === 9 && istMin < 5))) return;

  console.log("[Report] Running missed-report catch-up check…");

  // ── Daily — always check (report covers yesterday)
  const todayMidnightUTC = istMidnight(y, m, d);
  if (!(await reportExistsInVault("Daily Reports", todayMidnightUTC))) {
    console.log("[Report] Daily report missing for today — generating catch-up…");
    await runDailyReport();
  }

  // ── Weekly — only on Monday
  if (nowIST.getUTCDay() === 1) {
    const mondayMidnightUTC = istMidnight(y, m, d);
    if (!(await reportExistsInVault("Weekly Reports", mondayMidnightUTC))) {
      console.log("[Report] Weekly report missing for this week — generating catch-up…");
      await runWeeklyReport();
    }
  }

  // ── Monthly — only on the 1st
  if (d === 1) {
    const firstMidnightUTC = istMidnight(y, m, 1);
    if (!(await reportExistsInVault("Monthly Reports", firstMidnightUTC))) {
      console.log("[Report] Monthly report missing for this month — generating catch-up…");
      await runMonthlyReport();
    }
  }

  console.log("[Report] Catch-up check complete.");
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
export function startDailyReportScheduler() {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_APP_PASSWORD) {
    console.warn("[Report] SMTP not configured — all report schedulers skipped");
    return;
  }

  // Daily: every day at 9:00 AM IST (03:30 UTC)
  cron.schedule("30 3 * * *", () => {
    console.log("[Report] Cron triggered — Daily 9:00 AM IST");
    runDailyReport();
  }, { timezone: "UTC" });

  // Weekly: every Monday at 9:01 AM IST (03:31 UTC)
  cron.schedule("31 3 * * 1", () => {
    console.log("[Report] Cron triggered — Weekly 9:01 AM IST (Monday)");
    runWeeklyReport();
  }, { timezone: "UTC" });

  // Monthly: 1st of every month at 9:02 AM IST (03:32 UTC)
  cron.schedule("32 3 1 * *", () => {
    console.log("[Report] Cron triggered — Monthly 9:02 AM IST (1st of month)");
    runMonthlyReport();
  }, { timezone: "UTC" });

  // Catch-up: runs 30s after startup in case the server was down at schedule time
  setTimeout(() => {
    runMissedReports().catch(e => console.error("[Report] Catch-up check failed:", e));
  }, 30_000);

  console.log("[Report] Schedulers active — Daily 9:00 AM · Weekly Mon 9:01 AM · Monthly 1st 9:02 AM (all IST)");
  console.log("[Report] Missed-report catch-up will run 30s after startup.");
}
