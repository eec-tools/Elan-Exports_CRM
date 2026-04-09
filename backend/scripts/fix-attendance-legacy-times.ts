import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type RepairCounts = {
  futureOpenStartFixed: number;
  endBeforeStartFixed: number;
};

async function run(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const now = new Date();
  const counts: RepairCounts = {
    futureOpenStartFixed: 0,
    endBeforeStartFixed: 0,
  };

  const openFuture = await prisma.attendance.findMany({
    where: {
      startTime: { not: null, gt: now },
      endTime: null,
    },
    select: { id: true, startTime: true },
  });

  counts.futureOpenStartFixed = openFuture.length;

  if (apply && openFuture.length > 0) {
    await Promise.all(
      openFuture.map((row) =>
        prisma.attendance.update({
          where: { id: row.id },
          data: { startTime: now },
        }),
      ),
    );
  }

  const endBeforeStart = await prisma.attendance.findMany({
    where: {
      startTime: { not: null },
      endTime: { not: null },
    },
    select: { id: true, startTime: true, endTime: true },
  });

  const invalidRows = endBeforeStart.filter((row) => {
    if (!row.startTime || !row.endTime) return false;
    return row.endTime.getTime() < row.startTime.getTime();
  });

  counts.endBeforeStartFixed = invalidRows.length;

  if (apply && invalidRows.length > 0) {
    await Promise.all(
      invalidRows.map((row) =>
        prisma.attendance.update({
          where: { id: row.id },
          data: { endTime: row.startTime! },
        }),
      ),
    );
  }

  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Future open startTime repaired: ${counts.futureOpenStartFixed}`);
  console.log(`endTime < startTime repaired: ${counts.endBeforeStartFixed}`);

  if (!apply) {
    console.log("Run with --apply to persist these fixes.");
  }
}

run()
  .catch((err) => {
    console.error("Failed to repair attendance legacy times:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
