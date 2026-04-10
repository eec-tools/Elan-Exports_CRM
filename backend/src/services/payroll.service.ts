import { AttendanceStatus } from "@prisma/client";
import prisma from "../config/db.js";
import { calculatePT } from "../utils/professionalTax.js";

const ATTENDANCE_TZ_OFFSET_MINUTES = Number(
  process.env.ATTENDANCE_TZ_OFFSET_MINUTES ?? 330,
);

/** Returns the number of working days in the given month/year based on settings */
export function getWorkingDaysInMonth(
  month: number,
  year: number,
  saturdayOff: boolean,
  sundayOff: boolean,
): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay(); // 0=Sun, 6=Sat
    if (dow === 0 && sundayOff) continue;
    if (dow === 6 && saturdayOff) continue;
    workingDays++;
  }
  return workingDays;
}

/** Returns the first date of a month in UTC (start of day in IST) */
function monthStartUTC(month: number, year: number): Date {
  // Create the first day of the month in IST and convert to UTC
  const localMidnight = new Date(year, month - 1, 1, 0, 0, 0, 0);
  return new Date(localMidnight.getTime() - ATTENDANCE_TZ_OFFSET_MINUTES * 60 * 1000);
}

/** Returns the last date of a month in UTC (end of day in IST) */
function monthEndUTC(month: number, year: number): Date {
  const daysInMonth = new Date(year, month, 0).getDate();
  const localEndOfDay = new Date(year, month - 1, daysInMonth, 23, 59, 59, 999);
  return new Date(localEndOfDay.getTime() - ATTENDANCE_TZ_OFFSET_MINUTES * 60 * 1000);
}

async function countPresentDays(
  userId: string,
  month: number,
  year: number,
): Promise<number> {
  const records = await prisma.attendance.findMany({
    where: {
      userId,
      date: {
        gte: monthStartUTC(month, year),
        lte: monthEndUTC(month, year),
      },
      status: { in: [AttendanceStatus.Present, AttendanceStatus.HalfDay] },
    },
    select: { status: true },
  });

  return records.reduce((sum, r) => {
    return sum + (r.status === AttendanceStatus.HalfDay ? 0.5 : 1);
  }, 0);
}

async function countApprovedLeaves(
  userId: string,
  month: number,
  year: number,
): Promise<number> {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const leaves = await prisma.leave.findMany({
    where: {
      userId,
      status: "approved",
      startDate: { lte: lastDay },
      endDate: { gte: firstDay },
    },
  });

  let total = 0;
  for (const leave of leaves) {
    // Clip the leave to the current month
    const clippedStart = leave.startDate < firstDay ? firstDay : leave.startDate;
    const clippedEnd = leave.endDate > lastDay ? lastDay : leave.endDate;
    const days =
      Math.round(
        (clippedEnd.getTime() - clippedStart.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;
    total += days;
  }
  return total;
}

async function getOrCreateSettings() {
  let settings = await prisma.attendanceSettings.findFirst();
  if (!settings) {
    settings = await prisma.attendanceSettings.create({
      data: { saturdayOff: true, sundayOff: true },
    });
  }
  return settings;
}

export async function generatePayroll(
  userId: string,
  month: number,
  year: number,
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      monthlySalary: true,
      gender: true,
      employeeStatus: true,
      designation: true,
    },
  });

  if (!user.monthlySalary) {
    throw new Error(`User ${user.fullName} has no monthly salary set`);
  }

  const settings = await getOrCreateSettings();

  const workingDays = getWorkingDaysInMonth(
    month,
    year,
    settings.saturdayOff,
    settings.sundayOff,
  );

  const presentDays = await countPresentDays(userId, month, year);
  const approvedLeaves = await countApprovedLeaves(userId, month, year);

  const perDaySalary = user.monthlySalary / workingDays;
  const paidDays = presentDays + approvedLeaves;
  const grossSalary = perDaySalary * paidDays;
  const absentDays = workingDays - paidDays;

  const professionalTax = calculatePT(user.monthlySalary, user.gender, month);
  const netSalary = grossSalary - professionalTax;

  return prisma.payroll.upsert({
    where: { userId_month_year: { userId, month, year } },
    create: {
      userId,
      month,
      year,
      workingDays,
      presentDays,
      approvedLeaves,
      absentDays,
      grossSalary,
      professionalTax,
      netSalary,
    },
    update: {
      workingDays,
      presentDays,
      approvedLeaves,
      absentDays,
      grossSalary,
      professionalTax,
      netSalary,
      generatedAt: new Date(),
    },
  });
}
