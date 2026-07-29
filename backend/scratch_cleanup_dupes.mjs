import { PrismaClient } from "@prisma/client";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();
const s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-south-1" });
const S3_BUCKET = process.env.S3_BUCKET_NAME;

const EXECUTE = process.argv.includes("--execute");
const DELETE_S3 = process.argv.includes("--delete-s3");

async function cleanupTable(model, tableLabel) {
  const rows = await prisma[model].findMany({
    select: { id: true, replyId: true, filename: true, s3Key: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map(); // key: replyId|||filename -> rows[]
  for (const r of rows) {
    const key = `${r.replyId}|||${r.filename}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  let keepCount = 0;
  let deleteRows = [];
  const keptS3Keys = new Set();

  for (const groupRows of groups.values()) {
    // already sorted by createdAt asc from the query
    const [keep, ...rest] = groupRows;
    keepCount++;
    keptS3Keys.add(keep.s3Key);
    for (const r of rest) {
      deleteRows.push(r);
    }
  }

  // Safety: never delete an s3Key that some kept row also uses
  const toDeleteRows = deleteRows.filter((r) => !keptS3Keys.has(r.s3Key));
  const skippedSharedKey = deleteRows.length - toDeleteRows.length;

  console.log(`\n=== ${tableLabel} ===`);
  console.log(`Total rows: ${rows.length}`);
  console.log(`Groups (unique reply+filename): ${groups.size}`);
  console.log(`Rows to keep: ${keepCount}`);
  console.log(`Rows to delete: ${toDeleteRows.length}`);
  if (skippedSharedKey > 0) console.log(`(skipped ${skippedSharedKey} rows sharing s3Key with a kept row — not deleting their file)`);

  if (!EXECUTE) {
    console.log("[dry run] no changes made");
    return;
  }

  // Delete DB rows in batches
  const ids = toDeleteRows.map((r) => r.id);
  const BATCH = 1000;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const res = await prisma[model].deleteMany({ where: { id: { in: batch } } });
    deleted += res.count;
  }
  console.log(`Deleted ${deleted} DB rows`);

  if (DELETE_S3) {
    const s3Keys = [...new Set(toDeleteRows.map((r) => r.s3Key).filter(Boolean))];
    let s3Deleted = 0;
    for (let i = 0; i < s3Keys.length; i += BATCH) {
      const batch = s3Keys.slice(i, i + BATCH);
      try {
        const res = await s3.send(new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }));
        s3Deleted += batch.length - (res.Errors?.length ?? 0);
        if (res.Errors?.length) console.error(`S3 delete errors:`, res.Errors.slice(0, 5));
      } catch (err) {
        console.error(`S3 batch delete failed:`, err.message);
      }
    }
    console.log(`Deleted ${s3Deleted} S3 objects`);
  }
}

await cleanupTable("buyerEmailAttachment", "BUYER");
await cleanupTable("supplierEmailAttachment", "SUPPLIER");

await prisma.$disconnect();
