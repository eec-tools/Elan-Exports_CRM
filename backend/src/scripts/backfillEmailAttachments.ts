import "dotenv/config";
import prisma from "../config/db.js";
import { startBackfill, getBackfillStatus } from "../services/emailAttachmentBackfill.service.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const initial = await startBackfill();
  if (initial.supplierChecked === 0 && initial.status === "running") {
    console.log("[Backfill] Started.");
  } else {
    console.log("[Backfill] A run was already in progress — attaching to it.");
  }

  while (true) {
    await sleep(5000);
    const status = await getBackfillStatus();
    console.log(
      `[Backfill] suppliers ${status.supplierChecked ?? 0}/${status.supplierTotal ?? "?"}, ` +
      `buyers ${status.buyerChecked ?? 0}/${status.buyerTotal ?? "?"}, errors ${status.errors ?? 0}`
    );
    if (status.status === "completed" || status.status === "error") {
      console.log("[Backfill] Final status:", status);
      break;
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[Backfill] Fatal error:", err);
  process.exit(1);
});
