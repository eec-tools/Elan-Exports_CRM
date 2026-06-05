/**
 * One-time migration: download every Cloudinary file and re-upload to S3.
 *
 * Uses cloudinary.utils.api_sign_request() to build a fresh authenticated download
 * URL via api.cloudinary.com — this bypasses expired signed tokens and CDN auth.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/migrate-cloudinary-to-s3.ts
 *
 * Safe to re-run — rows/items without "cloudinary" in the URL are skipped.
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

function parseCloudinaryUrl(url: string): { publicId: string; resourceType: string } | null {
  try {
    const m = url.match(
      /res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+)$/i,
    );
    if (!m) return null;
    const resourceType = m[1].toLowerCase();
    let publicId = m[2];
    if (resourceType === "image" || resourceType === "video") {
      publicId = publicId.replace(/\.[a-zA-Z0-9]+$/, "");
    }
    return { resourceType, publicId };
  } catch {
    return null;
  }
}

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

  const s3Key = cloudinaryPublicIdToS3Key(resolvedPublicId);

  let buffer: Buffer;
  let contentType: string;

  const tryDownload = async (rt: string) => downloadBuffer(makeFreshDownloadUrl(resolvedPublicId!, rt));

  try {
    ({ buffer, contentType } = await tryDownload(resourceType));
  } catch (firstErr) {
    const firstMsg = (firstErr as Error).message ?? "";
    if (firstMsg.includes("404")) {
      const altType = resourceType === "raw" ? "image" : "raw";
      try {
        ({ buffer, contentType } = await tryDownload(altType));
      } catch (altErr) {
        const altMsg = (altErr as Error).message ?? "";
        if (altMsg.includes("404")) {
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

/** Migrate a JSON array field where each item has a .url string property. */
async function migrateJsonArray(
  recordId: string,
  items: { url: string; [key: string]: any }[],
  label: string,
): Promise<{ changed: boolean; result: { url: string; [key: string]: any }[] }> {
  let changed = false;
  const result = await Promise.all(
    items.map(async (item) => {
      if (!item.url?.includes("cloudinary")) return item;
      const migrated = await migrateFile(recordId, item.url, null, null, label);
      if (migrated) {
        changed = true;
        return { ...item, url: migrated.newUrl };
      }
      return item;
    }),
  );
  return { changed, result };
}

// ── Tables ───────────────────────────────────────────────────────────────────

async function main() {
  if (!BUCKET)      { console.error("S3_BUCKET_NAME not set.");    process.exit(1); }
  if (!CDN_BASE || CDN_BASE === "https://") { console.error("CLOUDFRONT_URL not set."); process.exit(1); }
  if (!process.env.CLOUDINARY_API_SECRET)  { console.error("CLOUDINARY_API_SECRET not set."); process.exit(1); }

  console.log(`\nMigrating Cloudinary → s3://${BUCKET} (CDN: ${CDN_BASE})\n`);

  // ── VaultDocument ──────────────────────────────────────────────────────────
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

  // ── VaultDocumentVersion ───────────────────────────────────────────────────
  const vaultVersions = await prisma.vaultDocumentVersion.findMany({
    where: { fileUrl: { contains: "cloudinary" } },
    select: { id: true, fileUrl: true, publicId: true, fileType: true },
  });
  console.log(`\n[VaultDocumentVersion] ${vaultVersions.length} records`);
  for (const row of vaultVersions) {
    const result = await migrateFile(row.id, row.fileUrl, row.publicId, row.fileType, "VaultVersion");
    if (result) await prisma.vaultDocumentVersion.update({ where: { id: row.id }, data: { fileUrl: result.newUrl, publicId: result.newKey } });
  }

  // ── Supplier ───────────────────────────────────────────────────────────────
  const allSuppliers = await (prisma as any).supplier.findMany({
    select: {
      id: true,
      productCatalogShared: true,
      documents: true,
      contractDocument: true,
      productCatalogs: true,
      productCatalogImages: true,
      warehousePhotos: true,
    },
  });
  let supplierCount = 0;
  for (const row of allSuppliers) {
    let touched = false;
    const update: Record<string, any> = {};

    // single string field
    if (row.productCatalogShared?.includes("cloudinary")) {
      const r = await migrateFile(row.id, row.productCatalogShared, null, null, "Supplier.catalog");
      if (r) { update.productCatalogShared = r.newUrl; touched = true; }
    }

    // JSON array fields
    for (const field of ["documents", "contractDocument", "productCatalogs", "productCatalogImages", "warehousePhotos"] as const) {
      const raw = row[field];
      const items: { url: string; [k: string]: any }[] = Array.isArray(raw) ? raw : (raw?.url ? [raw] : []);
      if (!items.some((i: any) => i.url?.includes("cloudinary"))) continue;
      const { changed, result } = await migrateJsonArray(row.id, items, `Supplier.${field}`);
      if (changed) {
        // contractDocument may have been stored as a single object originally — keep as array
        update[field] = field === "contractDocument" ? result : result;
        touched = true;
      }
    }

    if (touched) {
      supplierCount++;
      await (prisma as any).supplier.update({ where: { id: row.id }, data: update });
    }
  }
  console.log(`\n[Supplier] ${supplierCount} records updated`);

  // ── NewSupplier ────────────────────────────────────────────────────────────
  const allNewSuppliers = await (prisma as any).newSupplier.findMany({
    select: {
      id: true,
      productCatalog: true,
      certificates: true,
      productCatalogs: true,
      productCatalogImages: true,
      warehousePhotos: true,
    },
  });
  let newSupplierCount = 0;
  for (const row of allNewSuppliers) {
    let touched = false;
    const update: Record<string, any> = {};

    if (row.productCatalog?.includes("cloudinary")) {
      const r = await migrateFile(row.id, row.productCatalog, null, null, "NewSupplier.catalog");
      if (r) { update.productCatalog = r.newUrl; touched = true; }
    }

    for (const field of ["certificates", "productCatalogs", "productCatalogImages", "warehousePhotos"] as const) {
      const items: { url: string; [k: string]: any }[] = Array.isArray(row[field]) ? row[field] : [];
      if (!items.some((i: any) => i.url?.includes("cloudinary"))) continue;
      const { changed, result } = await migrateJsonArray(row.id, items, `NewSupplier.${field}`);
      if (changed) { update[field] = result; touched = true; }
    }

    if (touched) {
      newSupplierCount++;
      await (prisma as any).newSupplier.update({ where: { id: row.id }, data: update });
    }
  }
  console.log(`\n[NewSupplier] ${newSupplierCount} records updated`);

  // ── SourcingSupplier ───────────────────────────────────────────────────────
  const allSourcing = await (prisma as any).sourcingSupplier.findMany({
    select: {
      id: true,
      productCatalog: true,
      certificates: true,
      productCatalogs: true,
      productCatalogImages: true,
      warehousePhotos: true,
    },
  });
  let sourcingCount = 0;
  for (const row of allSourcing) {
    let touched = false;
    const update: Record<string, any> = {};

    if (row.productCatalog?.includes("cloudinary")) {
      const r = await migrateFile(row.id, row.productCatalog, null, null, "SourcingSupplier.catalog");
      if (r) { update.productCatalog = r.newUrl; touched = true; }
    }

    for (const field of ["certificates", "productCatalogs", "productCatalogImages", "warehousePhotos"] as const) {
      const items: { url: string; [k: string]: any }[] = Array.isArray(row[field]) ? row[field] : [];
      if (!items.some((i: any) => i.url?.includes("cloudinary"))) continue;
      const { changed, result } = await migrateJsonArray(row.id, items, `SourcingSupplier.${field}`);
      if (changed) { update[field] = result; touched = true; }
    }

    if (touched) {
      sourcingCount++;
      await (prisma as any).sourcingSupplier.update({ where: { id: row.id }, data: update });
    }
  }
  console.log(`\n[SourcingSupplier] ${sourcingCount} records updated`);

  // ── Buyer ──────────────────────────────────────────────────────────────────
  const allBuyers = await (prisma as any).buyer.findMany({
    select: { id: true, productCatalog: true, documents: true },
  });
  let buyerCount = 0;
  for (const row of allBuyers) {
    let touched = false;
    const update: Record<string, any> = {};

    if (row.productCatalog?.includes("cloudinary")) {
      const r = await migrateFile(row.id, row.productCatalog, null, null, "Buyer.catalog");
      if (r) { update.productCatalog = r.newUrl; touched = true; }
    }

    const docs: { url: string; [k: string]: any }[] = Array.isArray(row.documents) ? row.documents : [];
    if (docs.some((d: any) => d.url?.includes("cloudinary"))) {
      const { changed, result } = await migrateJsonArray(row.id, docs, "Buyer.documents");
      if (changed) { update.documents = result; touched = true; }
    }

    if (touched) {
      buyerCount++;
      await (prisma as any).buyer.update({ where: { id: row.id }, data: update });
    }
  }
  console.log(`\n[Buyer] ${buyerCount} records updated`);

  // ── Attendance proofFiles ──────────────────────────────────────────────────
  const attendances = await (prisma as any).attendance.findMany({
    where: { proofFiles: { not: null } },
    select: { id: true, proofFiles: true },
  });
  let attCount = 0;
  for (const row of attendances) {
    const proofs: { url: string; [k: string]: any }[] = Array.isArray(row.proofFiles) ? row.proofFiles : [];
    if (!proofs.some((p) => p.url?.includes("cloudinary"))) continue;
    attCount++;
    const { result } = await migrateJsonArray(row.id, proofs, "Attendance");
    await (prisma as any).attendance.update({ where: { id: row.id }, data: { proofFiles: result } });
  }
  console.log(`\n[Attendance] ${attCount} records updated`);

  // ── AppSetting email attachment ────────────────────────────────────────────
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
