import { AttendanceStatus } from "@prisma/client";
import prisma from "../config/db.js";
import { calculatePT } from "../utils/professionalTax.js";

const ATTENDANCE_TZ_OFFSET_MINUTES = Number(
  process.env.ATTENDANCE_TZ_OFFSET_MINUTES ?? 330,
);

/** Returns the actual calendar days in a given month/year (28/29/30/31) */
function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/** Returns the UTC start of the first day of the month (IST midnight → UTC) */
function monthStartUTC(month: number, year: number): Date {
  const localMidnight = new Date(year, month - 1, 1, 0, 0, 0, 0);
  return new Date(localMidnight.getTime() - ATTENDANCE_TZ_OFFSET_MINUTES * 60 * 1000);
}

/** Returns the UTC end of the last day of the month (IST 23:59:59 → UTC) */
function monthEndUTC(month: number, year: number): Date {
  const daysInMonth = getDaysInMonth(month, year);
  const localEndOfDay = new Date(year, month - 1, daysInMonth, 23, 59, 59, 999);
  return new Date(localEndOfDay.getTime() - ATTENDANCE_TZ_OFFSET_MINUTES * 60 * 1000);
}

/** Count weekday (Mon-Fri) present days. HalfDay = 0.5 */
async function countWeekdayPresentDays(
  userId: string,
  month: number,
  year: number,
): Promise<number> {
  const records = await prisma.attendance.findMany({
    where: {
      userId,
      date: { gte: monthStartUTC(month, year), lte: monthEndUTC(month, year) },
      status: { in: [AttendanceStatus.Present, AttendanceStatus.HalfDay] },
      isWeekendWork: false,
    },
    select: { status: true },
  });

  return records.reduce((sum, r) => {
    return sum + (r.status === AttendanceStatus.HalfDay ? 0.5 : 1);
  }, 0);
}

/** Count Sat/Sun days where isWeekendWork = true */
async function countWeekendWorkedDays(
  userId: string,
  month: number,
  year: number,
): Promise<number> {
  const count = await prisma.attendance.count({
    where: {
      userId,
      date: { gte: monthStartUTC(month, year), lte: monthEndUTC(month, year) },
      isWeekendWork: true,
    },
  });
  return count;
}

/** Count approved leave days that fall within the given month */
async function countApprovedLeavesInMonth(
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
    const clippedStart = leave.startDate < firstDay ? firstDay : leave.startDate;
    const clippedEnd = leave.endDate > lastDay ? lastDay : leave.endDate;
    const days =
      Math.round((clippedEnd.getTime() - clippedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    total += days;
  }
  return total;
}

/**
 * Count total approved leaves from Jan 1 of the year through the end of throughMonth.
 * Used to compute YTD excess (leaves beyond the 14-day annual quota).
 */
async function countApprovedLeavesYTD(
  userId: string,
  year: number,
  throughMonth: number,
): Promise<number> {
  const yearStart = new Date(year, 0, 1);
  const monthEnd = new Date(year, throughMonth, 0);

  const leaves = await prisma.leave.findMany({
    where: {
      userId,
      status: "approved",
      startDate: { lte: monthEnd },
      endDate: { gte: yearStart },
    },
  });

  let total = 0;
  for (const leave of leaves) {
    const clippedStart = leave.startDate < yearStart ? yearStart : leave.startDate;
    const clippedEnd = leave.endDate > monthEnd ? monthEnd : leave.endDate;
    if (clippedEnd < clippedStart) continue;
    const days =
      Math.round((clippedEnd.getTime() - clippedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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

/**
 * Generate (or regenerate) payroll for a single user for the given month/year.
 *
 * Formula (Method B - explicit deduction, no double-counting):
 *   daysInMonth          = actual calendar days (28/29/30/31)
 *   perDaySalary         = monthlySalary / daysInMonth
 *   paidDays             = weekdayPresent + weekendWorked + approvedLeavesThisMonth
 *   grossSalary          = perDaySalary x paidDays
 *   excessInThisMonth    = min(max(0, approvedLeavesYTD - 14), approvedLeavesThisMonth)
 *   leaveSalaryDeduction = perDaySalary x excessInThisMonth  [deducted exactly once]
 *   netSalary            = grossSalary - leaveSalaryDeduction - professionalTax
 */
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

  // Step 1: Actual calendar days in the month (28/29/30/31)
  const daysInMonth = getDaysInMonth(month, year);
  const perDaySalary = user.monthlySalary / daysInMonth;

  // Step 2: Attendance counts
  const weekdayPresentDays = await countWeekdayPresentDays(userId, month, year);
  const weekendWorkedDays = await countWeekendWorkedDays(userId, month, year);

  // Step 3: Leave counts
  const approvedLeavesMonth = await countApprovedLeavesInMonth(userId, month, year);
  const approvedLeavesYTD = await countApprovedLeavesYTD(userId, year, month);

  // Step 4: Excess leave calculation (annual quota = 14 days)
  const excessLeavesYTD = Math.max(0, approvedLeavesYTD - 14);
  // Attribute excess to this month's leaves (latest leaves are unpaid first)
  const excessLeaveDays = Math.min(excessLeavesYTD, approvedLeavesMonth);

  // Step 5: paidDays includes ALL approved leaves (gross covers them, excess deducted below)
  const paidDays = weekdayPresentDays + weekendWorkedDays + approvedLeavesMonth;

  // Step 6: Salary calculation
  const grossSalary = perDaySalary * paidDays;
  const leaveSalaryDeduction = perDaySalary * excessLeaveDays; // deducted exactly once
  const professionalTax = calculatePT(user.monthlySalary, user.gender, month);
  const netSalary = grossSalary - leaveSalaryDeduction - professionalTax;

  return prisma.payroll.upsert({
    where: { userId_month_year: { userId, month, year } },
    create: {
      userId,
      month,
      year,
      daysInMonth,
      weekdayPresentDays,
      weekendWorkedDays,
      approvedLeavesMonth,
      excessLeaveDays,
      paidDays,
      perDaySalary,
      grossSalary,
      leaveSalaryDeduction,
      professionalTax,
      netSalary,
    },
    update: {
      daysInMonth,
      weekdayPresentDays,
      weekendWorkedDays,
      approvedLeavesMonth,
      excessLeaveDays,
      paidDays,
      perDaySalary,
      grossSalary,
      leaveSalaryDeduction,
      professionalTax,
      netSalary,
      generatedAt: new Date(),
    },
  });
}
