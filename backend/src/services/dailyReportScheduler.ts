import cron from "node-cron";
import { v2 as cloudinary } from "cloudinary";
import nodemailer from "nodemailer";
import { Readable } from "stream";
import puppeteer from "puppeteer";
import prisma from "../config/db.js";
import { generateDailyReport } from "./dailyReportService.js";
import { buildDailyReportHtml } from "./dailyReportTemplate.js";

const REPORT_RECIPIENT = "shirali@eectrade.com";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureCloudinaryConfig() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
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

// ── Upload PDF buffer to Cloudinary via upload_stream ─────────────────────────
async function uploadPdfToCloudinary(pdfBuffer: Buffer, isoDate: string): Promise<string> {
  ensureCloudinaryConfig();

  return new Promise((resolve, reject) => {
    const publicId = `vault_daily_report_${isoDate}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "elan-vault",
        resource_type: "raw",
        public_id: publicId,
        overwrite: true,
        format: "pdf",
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("No Cloudinary result"));
        resolve(result.secure_url);
      }
    );

    Readable.from(pdfBuffer).pipe(uploadStream);
  });
}

// ── Save vault entry ──────────────────────────────────────────────────────────
async function saveReportToVault(fileUrl: string, reportDate: string) {
  // Find or create the root "Daily Reports" folder
  let rootFolder = await prisma.vaultDocument.findFirst({
    where: { name: "Daily Reports", isFolder: true, parentId: null },
  });

  if (!rootFolder) {
    rootFolder = await prisma.vaultDocument.create({
      data: {
        name: "Daily Reports",
        category: "Internal Reports",
        region: "Global",
        isFolder: true,
      },
    });
    console.log("[DailyReport] Created vault folder: Daily Reports");
  }

  const docName = `CRM Daily Report — ${reportDate}`;

  const existing = await prisma.vaultDocument.findFirst({
    where: { name: docName, parentId: rootFolder.id, isFolder: false },
  });

  if (existing) {
    await prisma.vaultDocument.update({
      where: { id: existing.id },
      data: { fileUrl, updatedAt: new Date() },
    });
    console.log(`[DailyReport] Updated vault entry: ${docName}`);
  } else {
    await prisma.vaultDocument.create({
      data: {
        name: docName,
        category: "Internal Reports",
        region: "Global",
        isFolder: false,
        parentId: rootFolder.id,
        fileUrl,
        fileType: "pdf",
      },
    });
    console.log(`[DailyReport] Created vault entry: ${docName}`);
  }
}

// ── Send email ────────────────────────────────────────────────────────────────
async function sendReportEmail(html: string, pdfBuffer: Buffer, reportDate: string) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"Élan Exports CRM" <${process.env.SMTP_EMAIL}>`,
    to: REPORT_RECIPIENT,
    subject: `CRM Daily Digest — ${reportDate}`,
    html,
    attachments: [
      {
        filename: `CRM-Daily-Report-${reportDate.replace(/,\s*/g, "_").replace(/\s+/g, "_")}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  console.log(`[DailyReport] Email sent to ${REPORT_RECIPIENT}`);
}

// ── Main runner ───────────────────────────────────────────────────────────────
export async function runDailyReport() {
  console.log("[DailyReport] Starting report generation...");

  try {
    // 1. Collect data
    const data = await generateDailyReport();
    console.log(`[DailyReport] Data collected for ${data.reportDate}`);

    // 2. Build HTML
    const html = buildDailyReportHtml(data);

    // 3. Convert HTML → PDF
    console.log("[DailyReport] Rendering PDF via Puppeteer...");
    const pdfBuffer = await htmlToPdf(html);
    console.log(`[DailyReport] PDF generated (${Math.round(pdfBuffer.length / 1024)} KB)`);

    // 4. Send email (HTML body + PDF attachment)
    await sendReportEmail(html, pdfBuffer, data.reportDate);

    // 5. Upload to Cloudinary + save vault entry (non-blocking on failure)
    try {
      const fileUrl = await uploadPdfToCloudinary(pdfBuffer, data.isoDate);
      await saveReportToVault(fileUrl, data.reportDate);
      console.log(`[DailyReport] Vault entry saved for ${data.reportDate}`);
    } catch (vaultErr) {
      console.error("[DailyReport] Vault save failed (email still sent):", vaultErr);
    }

    console.log(`[DailyReport] Completed successfully for ${data.reportDate}`);
  } catch (err) {
    console.error("[DailyReport] Report generation failed:", err);
  }
}

// ── Scheduler — 9:00 AM IST = 03:30 UTC ──────────────────────────────────────
export function startDailyReportScheduler() {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_APP_PASSWORD) {
    console.warn("[DailyReport] SMTP not configured — scheduler skipped");
    return;
  }

  cron.schedule(
    "30 3 * * *",
    () => {
      console.log("[DailyReport] Cron triggered — 9:00 AM IST");
      runDailyReport();
    },
    { timezone: "UTC" }
  );

  console.log("[DailyReport] Scheduler active — fires daily at 9:00 AM IST (03:30 UTC)");
}
