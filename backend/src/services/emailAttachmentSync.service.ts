import { PutObjectCommand } from "@aws-sdk/client-s3";
import prisma from "../config/db.js";
import { s3, S3_BUCKET, s3FileUrl, buildS3Key } from "../lib/s3.js";
import { downloadGmailAttachment, EmailAttachmentMeta } from "./gmailService.js";

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
 * already persisted. Safe to call repeatedly — dedupes by gmailAttachmentId.
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
    select: { gmailAttachmentId: true },
  });
  const existingIds = new Set(existing.map((a: any) => a.gmailAttachmentId));
  const missing = attachments.filter((a) => !existingIds.has(a.attachmentId));

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
    } catch (err) {
      console.error(`[emailAttachmentSync] Failed to persist supplier attachment "${meta.filename}":`, err);
    }
  }
}

/**
 * Downloads and stores any attachments on a buyer email that aren't
 * already persisted. Safe to call repeatedly — dedupes by gmailAttachmentId.
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
    select: { gmailAttachmentId: true },
  });
  const existingIds = new Set(existing.map((a: any) => a.gmailAttachmentId));
  const missing = attachments.filter((a) => !existingIds.has(a.attachmentId));

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
    } catch (err) {
      console.error(`[emailAttachmentSync] Failed to persist buyer attachment "${meta.filename}":`, err);
    }
  }
}
