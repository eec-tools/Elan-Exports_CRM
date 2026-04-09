import "dotenv/config";
import { PrismaClient, AttendanceStatus } from "@prisma/client";

const prisma = new PrismaClient();

function startOfLocalDay(input: Date = new Date()): Date {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function run(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const today = startOfLocalDay();

  const candidates = await prisma.attendance.findMany({
    where: {
      date: today,
      autoEnded: true,
      startTime: { not: null },
      endTime: { not: null },
      totalTimeMinutes: 0,
      realTimeMinutes: 0,
    },
    select: {
      id: true,
      userId: true,
      startTime: true,
      endTime: true,
      status: true,
      autoEnded: true,
    },
  });

  const falseAutoEnded = candidates.filter((row) => {
    if (!row.startTime || !row.endTime) return false;
    return row.startTime.getTime() === row.endTime.getTime();
  });

  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`False auto-ended today records found: ${falseAutoEnded.length}`);

  if (apply && falseAutoEnded.length > 0) {
    await Promise.all(
      falseAutoEnded.map((row) =>
        prisma.attendance.update({
          where: { id: row.id },
          data: {
            endTime: null,
            autoEnded: false,
            status: AttendanceStatus.Present,
            earlyLogout: false,
          },
        }),
      ),
    );

    console.log(`Reopened records: ${falseAutoEnded.length}`);
  } else if (!apply) {
    console.log("Run with --apply to reopen these records.");
  }
}

run()
  .catch((err) => {
    console.error("Failed to reopen false auto-ended records:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
