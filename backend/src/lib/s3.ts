import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-south-1",
});

export const S3_BUCKET = process.env.S3_BUCKET_NAME!;

const rawCdn = process.env.CLOUDFRONT_URL ?? "";
export const CDN_BASE = rawCdn.startsWith("http")
  ? rawCdn.replace(/\/$/, "")
  : `https://${rawCdn.replace(/\/$/, "")}`;

export function s3FileUrl(key: string): string {
  return `${CDN_BASE}/${key}`;
}

export function buildS3Key(prefix: string, originalName: string): string {
  const baseName = originalName
    .replace(/\.[^/.]+$/, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
  const extMatch = originalName.match(/\.[^/.]+$/);
  const ext = extMatch ? extMatch[0] : "";
  return `${prefix}/${prefix.split("/").pop()}_${Date.now()}_${baseName}${ext}`;
}
