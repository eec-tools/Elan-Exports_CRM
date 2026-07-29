import { PutObjectCommand } from "@aws-sdk/client-s3";
import prisma from "../config/db.js";
import { s3, S3_BUCKET, s3FileUrl, buildS3Key } from "../lib/s3.js";
import { downloadGmailAttachment, EmailAttachmentMeta, InlineImageMeta } from "./gmailService.js";

async function storeAttachment(params: {
  accountEmail: string;
  gmailMessageId: string;
  meta: EmailAttachmentMeta;
  keyPrefix: string;
}): Promise<{ s3Key: string; url: string }> {
  const { accountEmail, gmailMessageId, meta, keyPrefix } = params;
  const buffer = await downloadGmailAttachment({
    accountEmail,
    gmailMessageId,
    attachmentId: meta.attachmentId,
  });
  const s3Key = buildS3Key(keyPrefix, meta.filename);
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: meta.mimeType,
  }));
  return { s3Key, url: s3FileUrl(s3Key) };
}

/**
 * Downloads and stores any attachments on a supplier email that aren't
 * already persisted. Safe to call repeatedly — dedupes by filename, not
 * gmailAttachmentId (Gmail hands out a different attachmentId for the same
 * physical attachment on every re-fetch, so keying on it re-inserts a
 * "new" copy on every poll).
 */
export async function persistSupplierAttachments(params: {
  accountEmail: string;
  sourcingId: string;
  replyId: string;
  gmailMessageId: string;
  attachments: EmailAttachmentMeta[];
}): Promise<void> {
  const { accountEmail, sourcingId, replyId, gmailMessageId, attachments } = params;
  if (attachments.length === 0) return;

  const existing = await (prisma as any).supplierEmailAttachment.findMany({
    where: { replyId },
    select: { filename: true },
  });
  const existingFilenames = new Set(existing.map((a: any) => a.filename));
  const missing = attachments.filter((a) => !existingFilenames.has(a.filename));

  for (const meta of missing) {
    try {
      const { s3Key, url } = await storeAttachment({
        accountEmail,
        gmailMessageId,
        meta,
        keyPrefix: `inbound-email-attachments/suppliers/${sourcingId}`,
      });
      await (prisma as any).supplierEmailAttachment.create({
        data: {
          replyId,
          gmailAttachmentId: meta.attachmentId,
          filename: meta.filename,
          mimeType: meta.mimeType,
          size: meta.size,
          s3Key,
          url,
        },
      });
    } catch (err: any) {
      // P2002 = unique constraint violation on (replyId, filename) — another
      // call already persisted this attachment; not a real error.
      if (err?.code !== "P2002") {
        console.error(`[emailAttachmentSync] Failed to persist supplier attachment "${meta.filename}":`, err);
      }
    }
  }
}

/**
 * Downloads and stores any attachments on a buyer email that aren't
 * already persisted. Safe to call repeatedly — dedupes by filename, not
 * gmailAttachmentId (Gmail hands out a different attachmentId for the same
 * physical attachment on every re-fetch, so keying on it re-inserts a
 * "new" copy on every poll).
 */
export async function persistBuyerAttachments(params: {
  accountEmail: string;
  sourcingBuyerId: string;
  replyId: string;
  gmailMessageId: string;
  attachments: EmailAttachmentMeta[];
}): Promise<void> {
  const { accountEmail, sourcingBuyerId, replyId, gmailMessageId, attachments } = params;
  if (attachments.length === 0) return;

  const existing = await (prisma as any).buyerEmailAttachment.findMany({
    where: { replyId },
    select: { filename: true },
  });
  const existingFilenames = new Set(existing.map((a: any) => a.filename));
  const missing = attachments.filter((a) => !existingFilenames.has(a.filename));

  for (const meta of missing) {
    try {
      const { s3Key, url } = await storeAttachment({
        accountEmail,
        gmailMessageId,
        meta,
        keyPrefix: `inbound-email-attachments/buyers/${sourcingBuyerId}`,
      });
      await (prisma as any).buyerEmailAttachment.create({
        data: {
          replyId,
          gmailAttachmentId: meta.attachmentId,
          filename: meta.filename,
          mimeType: meta.mimeType,
          size: meta.size,
          s3Key,
          url,
        },
      });
    } catch (err: any) {
      if (err?.code !== "P2002") {
        console.error(`[emailAttachmentSync] Failed to persist buyer attachment "${meta.filename}":`, err);
      }
    }
  }
}

/**
 * Downloads any inline signature/logo images (referenced via cid: in the HTML
 * body) and uploads them to S3, returning a map of contentId -> public URL.
 */
export async function resolveInlineImages(params: {
  accountEmail: string;
  gmailMessageId: string;
  keyPrefix: string;
  inlineImages: InlineImageMeta[];
}): Promise<Record<string, string>> {
  const { accountEmail, gmailMessageId, keyPrefix, inlineImages } = params;
  const map: Record<string, string> = {};

  for (const img of inlineImages) {
    try {
      const buffer = await downloadGmailAttachment({
        accountEmail,
        gmailMessageId,
        attachmentId: img.attachmentId,
      });
      const s3Key = buildS3Key(keyPrefix, img.filename);
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: img.mimeType,
      }));
      map[img.contentId] = s3FileUrl(s3Key);
    } catch (err) {
      console.error(`[emailAttachmentSync] Failed to resolve inline image "${img.filename}":`, err);
    }
  }

  return map;
}

/** Replaces cid:xxx references in an HTML email body with resolved public URLs. */
export function rewriteCidReferences(html: string, cidMap: Record<string, string>): string {
  if (!html || Object.keys(cidMap).length === 0) return html;
  return html.replace(/cid:([^"'()\s>]+)/gi, (full, cid) => cidMap[cid] ?? full);
}
