import cron from "node-cron";
import { v2 as cloudinary } from "cloudinary";
import nodemailer from "nodemailer";
import { Readable } from "stream";
import puppeteer from "puppeteer";
import prisma from "../config/db.js";
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  type CRMReportData,
  type ReportType,
} from "./dailyReportService.js";
import { buildReportHtml } from "./dailyReportTemplate.js";

const REPORT_RECIPIENT = "shirali@eectrade.com";

// Vault folder names per report type
const VAULT_FOLDER: Record<ReportType, string> = {
  daily:   "Daily Reports",
  weekly:  "Weekly Reports",
  monthly: "Monthly Reports",
};

// Cloudinary public-ID prefix per report type
const CLOUDINARY_PREFIX: Record<ReportType, string> = {
  daily:   "vault_daily_report",
  weekly:  "vault_weekly_report",
  monthly: "vault_monthly_report",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureCloudinaryConfig() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

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
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
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

// ── Upload PDF to Cloudinary ──────────────────────────────────────────────────
async function uploadPdfToCloudinary(
  pdfBuffer: Buffer,
  reportType: ReportType,
  isoDate: string,
): Promise<string> {
  ensureCloudinaryConfig();

  return new Promise((resolve, reject) => {
    const publicId = `${CLOUDINARY_PREFIX[reportType]}_${isoDate}`;
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "elan-vault", resource_type: "raw", public_id: publicId, overwrite: true, format: "pdf" },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("No Cloudinary result"));
        resolve(result.secure_url);
      },
    );
    Readable.from(pdfBuffer).pipe(uploadStream);
  });
}

// ── Save to vault ─────────────────────────────────────────────────────────────
async function saveReportToVault(
  fileUrl: string,
  reportType: ReportType,
  periodLabel: string,
) {
  const folderName = VAULT_FOLDER[reportType];

  // Find or create the parent folder for this report type
  let parentFolder = await prisma.vaultDocument.findFirst({
    where: { name: folderName, isFolder: true, parentId: null },
  });

  if (!parentFolder) {
    parentFolder = await prisma.vaultDocument.create({
      data: {
        name: folderName,
        category: "Internal Reports",
        region: "Global",
        isFolder: true,
      },
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
      data: { fileUrl, updatedAt: new Date() },
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
        fileType: "pdf",
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
      ? [{
          filename: `CRM-${reportTypeLabel}-Report-${safeName}.pdf`,
          content:  pdfBuffer,
          contentType: "application/pdf",
        }]
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
  try {
    const data = await generateFn();
    console.log(`[Report] Data collected for ${data.periodLabel}`);

    const html = buildReportHtml(data);

    let pdfBuffer: Buffer | null = null;
    try {
      console.log("[Report] Rendering PDF via Puppeteer…");
      pdfBuffer = await htmlToPdf(html);
      console.log(`[Report] PDF generated (${Math.round(pdfBuffer.length / 1024)} KB)`);
    } catch (pdfErr) {
      console.error("[Report] PDF generation failed — sending email without attachment:", pdfErr);
    }

    await sendReportEmail(html, pdfBuffer, data);

    if (pdfBuffer) {
      try {
        const fileUrl = await uploadPdfToCloudinary(pdfBuffer, data.reportType, data.isoDate);
        await saveReportToVault(fileUrl, data.reportType, data.periodLabel);
        console.log(`[Report] Vault entry saved for ${data.periodLabel}`);
      } catch (vaultErr) {
        console.error("[Report] Vault save failed (email still sent):", vaultErr);
      }
    }

    console.log(`[Report] ${label} report completed successfully for ${data.periodLabel}`);
  } catch (err) {
    console.error(`[Report] ${label} report generation failed:`, err);
  }
}

// ── Public runners (exported for manual trigger) ──────────────────────────────

export async function runDailyReport() {
  return runReport(generateDailyReport, "daily");
}

export async function runWeeklyReport() {
  return runReport(generateWeeklyReport, "weekly");
}

export async function runMonthlyReport() {
  return runReport(generateMonthlyReport, "monthly");
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

  console.log("[Report] Schedulers active — Daily 9:00 AM · Weekly Mon 9:01 AM · Monthly 1st 9:02 AM (all IST)");
}
