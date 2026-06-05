/**
 * One-time migration: download every Cloudinary file and re-upload to S3.
 *
 * Uses cloudinary.utils.private_download_url() which downloads via api.cloudinary.com
 * (with your API credentials) instead of res.cloudinary.com — this bypasses expired
 * signed tokens and URL authentication settings on the account.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/migrate-cloudinary-to-s3.ts
 *
 * Safe to re-run — rows without "cloudinary" in fileUrl are skipped.
 */

import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";
import * as dotenv from "dotenv";
import * as https from "https";
import * as http from "http";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

const prisma = new PrismaClient();
const s3    = new S3Client({ region: process.env.AWS_REGION ?? "ap-south-1" });
const BUCKET = process.env.S3_BUCKET_NAME!;
const rawCdn = process.env.CLOUDFRONT_URL ?? "";
const CDN_BASE = rawCdn.startsWith("http")
  ? rawCdn.replace(/\/$/, "")
  : `https://${rawCdn.replace(/\/$/, "")}`;

const FOLDER_MAP: Record<string, string> = {
  "elan-vault":             "vault",
  "elan-suppliers":         "suppliers",
  "elan-new-suppliers":     "new-suppliers",
  "elan-buyers":            "buyers",
  "elan-attendance-proofs": "attendance-proofs",
  "elan-email-attachments": "email-attachments",
  "elan-supplier-forms":    "supplier-forms",
};

let succeeded = 0;
let failed    = 0;
let skipped   = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

function cloudinaryPublicIdToS3Key(publicId: string): string {
  const slashIdx = publicId.indexOf("/");
  if (slashIdx === -1) return `misc/${publicId}`;
  const folder   = publicId.slice(0, slashIdx);
  const filename = publicId.slice(slashIdx + 1);
  return `${FOLDER_MAP[folder] ?? "misc"}/${filename}`;
}

/**
 * Extract the publicId and resource_type from a Cloudinary delivery URL.
 * Works for signed and unsigned URLs, with or without version numbers.
 *
 * URL format:
 *   https://res.cloudinary.com/{cloud}/{resource_type}/upload[/s--SIG--][/v123456]/{public_id}
 */
function parseCloudinaryUrl(url: string): { publicId: string; resourceType: string } | null {
  try {
    const m = url.match(
      /res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+)$/i,
    );
    if (!m) return null;
    const resourceType = m[1].toLowerCase();
    let publicId = m[2];
    // For image/video resources, Cloudinary publicId does NOT include the file extension
    if (resourceType === "image" || resourceType === "video") {
      publicId = publicId.replace(/\.[a-zA-Z0-9]+$/, "");
    }
    return { resourceType, publicId };
  } catch {
    return null;
  }
}

/**
 * Manually construct a Cloudinary signed download URL.
 * Puts the correct resource_type in the URL path so raw/image/video all work.
 * Downloads via api.cloudinary.com — bypasses CDN auth and expired delivery tokens.
 */
function makeFreshDownloadUrl(publicId: string, resourceType: string): string {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey    = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const timestamp = Math.round(Date.now() / 1000);
  const expiresAt = timestamp + 3600;

  const signature = cloudinary.utils.api_sign_request(
    { public_id: publicId, expires_at: expiresAt, timestamp },
    apiSecret,
  );

  const qs = new URLSearchParams({
    public_id:  publicId,
    expires_at: String(expiresAt),
    timestamp:  String(timestamp),
    signature,
    api_key:    apiKey,
  });

  return `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/download?${qs}`;
}

function downloadBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadBuffer(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode} — ${url.slice(0, 80)}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end",  () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: res.headers["content-type"] ?? "application/octet-stream",
      }));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function migrateFile(
  recordId:  string,
  fileUrl:   string,
  publicId:  string | null | undefined,
  fileType:  string | null | undefined,
  label:     string,
): Promise<{ newUrl: string; newKey: string } | null> {
  if (!fileUrl.includes("cloudinary")) {
    skipped++;
    return null;
  }

  // ── Resolve publicId and resource_type ──────────────────────────────────
  let resolvedPublicId = publicId;
  let resourceType     = fileType === "image" ? "image" : "raw";

  if (!resolvedPublicId) {
    const parsed = parseCloudinaryUrl(fileUrl);
    if (parsed) {
      resolvedPublicId = parsed.publicId;
      resourceType     = parsed.resourceType;
    }
  }

  if (!resolvedPublicId) {
    console.error(`  ✗ [${label}] ${recordId}: Cannot determine publicId — skipping`);
    failed++;
    return null;
  }

  // ── Derive S3 key ────────────────────────────────────────────────────────
  const s3Key = cloudinaryPublicIdToS3Key(resolvedPublicId);

  // ── Download via fresh signed URL (bypasses expired CDN tokens) ──────────
  let buffer: Buffer;
  let contentType: string;

  const tryDownload = async (rt: string) => downloadBuffer(makeFreshDownloadUrl(resolvedPublicId!, rt));

  try {
    ({ buffer, contentType } = await tryDownload(resourceType));
  } catch (firstErr) {
    const firstMsg = (firstErr as Error).message ?? "";
    // 404 → try the other resource type before giving up
    if (firstMsg.includes("404")) {
      const altType = resourceType === "raw" ? "image" : "raw";
      try {
        ({ buffer, contentType } = await tryDownload(altType));
      } catch (altErr) {
        const altMsg = (altErr as Error).message ?? "";
        if (altMsg.includes("404")) {
          // File genuinely doesn't exist in Cloudinary (may have been deleted)
          console.warn(`  ⚠ [${label}] ${recordId}: Not found in Cloudinary — skipping`);
          skipped++;
        } else {
          console.error(`  ✗ [${label}] ${recordId}: ${altMsg}`);
          failed++;
        }
        return null;
      }
    } else {
      console.error(`  ✗ [${label}] ${recordId}: ${firstMsg}`);
      failed++;
      return null;
    }
  }

  // ── Upload to S3 ─────────────────────────────────────────────────────────
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    }));
    succeeded++;
    const newUrl = `${CDN_BASE}/${s3Key}`;
    console.log(`  ✓ [${label}] ${recordId} → ${s3Key}`);
    return { newUrl, newKey: s3Key };
  } catch (err) {
    console.error(`  ✗ [${label}] S3 upload failed for ${recordId}: ${(err as Error).message}`);
    failed++;
    return null;
  }
}

// ── Tables ───────────────────────────────────────────────────────────────────

async function main() {
  if (!BUCKET)      { console.error("S3_BUCKET_NAME not set.");    process.exit(1); }
  if (!CDN_BASE || CDN_BASE === "https://") { console.error("CLOUDFRONT_URL not set."); process.exit(1); }
  if (!process.env.CLOUDINARY_API_SECRET)  { console.error("CLOUDINARY_API_SECRET not set."); process.exit(1); }

  console.log(`\nMigrating Cloudinary → s3://${BUCKET} (CDN: ${CDN_BASE})\n`);

  // VaultDocument
  const vaultDocs = await prisma.vaultDocument.findMany({
    where: { isFolder: false, fileUrl: { contains: "cloudinary" } },
    select: { id: true, fileUrl: true, publicId: true, fileType: true },
  });
  console.log(`[VaultDocument] ${vaultDocs.length} records`);
  for (const row of vaultDocs) {
    if (!row.fileUrl) continue;
    const result = await migrateFile(row.id, row.fileUrl, row.publicId, row.fileType, "VaultDocument");
    if (result) await prisma.vaultDocument.update({ where: { id: row.id }, data: { fileUrl: result.newUrl, publicId: result.newKey } });
  }

  // VaultDocumentVersion
  const vaultVersions = await prisma.vaultDocumentVersion.findMany({
    where: { fileUrl: { contains: "cloudinary" } },
    select: { id: true, fileUrl: true, publicId: true, fileType: true },
  });
  console.log(`\n[VaultDocumentVersion] ${vaultVersions.length} records`);
  for (const row of vaultVersions) {
    const result = await migrateFile(row.id, row.fileUrl, row.publicId, row.fileType, "VaultVersion");
    if (result) await prisma.vaultDocumentVersion.update({ where: { id: row.id }, data: { fileUrl: result.newUrl, publicId: result.newKey } });
  }

  // Supplier productCatalogShared
  const suppliers = await (prisma as any).supplier.findMany({
    where: { productCatalogShared: { contains: "cloudinary" } },
    select: { id: true, productCatalogShared: true },
  });
  console.log(`\n[Supplier] ${suppliers.length} records`);
  for (const row of suppliers) {
    const result = await migrateFile(row.id, row.productCatalogShared, null, null, "Supplier");
    if (result) await (prisma as any).supplier.update({ where: { id: row.id }, data: { productCatalogShared: result.newUrl } });
  }

  // NewSupplier productCatalog
  const newSuppliers = await (prisma as any).newSupplier.findMany({
    where: { productCatalog: { contains: "cloudinary" } },
    select: { id: true, productCatalog: true },
  });
  console.log(`\n[NewSupplier] ${newSuppliers.length} records`);
  for (const row of newSuppliers) {
    const result = await migrateFile(row.id, row.productCatalog, null, null, "NewSupplier");
    if (result) await (prisma as any).newSupplier.update({ where: { id: row.id }, data: { productCatalog: result.newUrl } });
  }

  // Buyer productCatalog
  const buyers = await (prisma as any).buyer.findMany({
    where: { productCatalog: { contains: "cloudinary" } },
    select: { id: true, productCatalog: true },
  });
  console.log(`\n[Buyer] ${buyers.length} records`);
  for (const row of buyers) {
    const result = await migrateFile(row.id, row.productCatalog, null, null, "Buyer");
    if (result) await (prisma as any).buyer.update({ where: { id: row.id }, data: { productCatalog: result.newUrl } });
  }

  // Attendance proofFiles (JSON array of {url, name, ...})
  const attendances = await (prisma as any).attendance.findMany({
    where: { proofFiles: { not: null } },
    select: { id: true, proofFiles: true },
  });
  let attCount = 0;
  for (const row of attendances) {
    const proofs: { url: string; name: string; mimeType?: string; size?: number }[] =
      Array.isArray(row.proofFiles) ? row.proofFiles : [];
    if (!proofs.some((p) => p.url?.includes("cloudinary"))) continue;
    attCount++;
    const updated = await Promise.all(
      proofs.map(async (p) => {
        if (!p.url?.includes("cloudinary")) return p;
        const result = await migrateFile(row.id, p.url, null, null, "Attendance");
        return result ? { ...p, url: result.newUrl } : p;
      }),
    );
    await (prisma as any).attendance.update({ where: { id: row.id }, data: { proofFiles: updated } });
  }
  console.log(`\n[Attendance] ${attCount} records with Cloudinary URLs`);

  // AppSetting (email attachment URL)
  const attachmentSetting = await prisma.appSetting.findUnique({ where: { key: "email_campaign_attachment_url" } });
  if (attachmentSetting?.value?.includes("cloudinary")) {
    console.log(`\n[AppSetting] email_campaign_attachment_url`);
    const result = await migrateFile("app_setting", attachmentSetting.value, null, null, "EmailAttachment");
    if (result) await prisma.appSetting.update({ where: { key: "email_campaign_attachment_url" }, data: { value: result.newUrl } });
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Done: ${succeeded} migrated, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) console.log(`Re-run to retry failed files.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  await prisma.$disconnect();
  process.exit(1);
});
