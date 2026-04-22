import { AttendanceStatus } from "@prisma/client";
import prisma from "../config/db.js";
import { calculatePT } from "../utils/professionalTax.js";

const ATTENDANCE_TZ_OFFSET_MINUTES = Number(
  process.env.ATTENDANCE_TZ_OFFSET_MINUTES ?? 330,
);

/** Actual calendar days in a given month/year (28/29/30/31) */
function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/** UTC start of first day of month (IST midnight → UTC) */
function monthStartUTC(month: number, year: number): Date {
  const localMidnight = new Date(year, month - 1, 1, 0, 0, 0, 0);
  return new Date(localMidnight.getTime() - ATTENDANCE_TZ_OFFSET_MINUTES * 60 * 1000);
}

/** UTC end of last day of month (IST 23:59:59 → UTC) */
function monthEndUTC(month: number, year: number): Date {
  const daysInMonth = getDaysInMonth(month, year);
  const localEndOfDay = new Date(year, month - 1, daysInMonth, 23, 59, 59, 999);
  return new Date(localEndOfDay.getTime() - ATTENDANCE_TZ_OFFSET_MINUTES * 60 * 1000);
}

function countDaysExcludingSundays(start: Date, end: Date): number {
  if (end < start) return 0;
  let total = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (cursor <= endDate) {
    if (cursor.getDay() !== 0) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

/**
 * Count the employee's scheduled working days in the month.
 * - Sunday is treated as an official paid day.
 * - Saturday is off only when saturdaySchedule === "off".
 * - Full and half Saturday schedules count Saturday as a working day.
 *
 * This is the denominator for perDaySalary so that an employee who
 * works every scheduled day receives exactly their monthlySalary.
 */
function countScheduledWorkingDays(month: number, year: number, saturdaySchedule: string): number {
  const daysInMonth = getDaysInMonth(month, year);
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay(); // 0=Sun, 6=Sat
    if (dow === 6 && saturdaySchedule === "off") continue; // Saturday off
    count++;
  }
  return count;
}

/** Count Sundays in month (official paid days). */
function countSundaysInMonth(month: number, year: number): number {
  const daysInMonth = getDaysInMonth(month, year);
  let total = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === 0) total++;
  }
  return total;
}

/**
 * Regular present days: days where isWeekendWork=false and status Present/HalfDay.
 * - For "off" schedule: these are Mon–Fri days.
 * - For "full"/"half" schedule: Mon–Fri + Saturdays (since Saturdays have isWeekendWork=false).
 * HalfDay counts as 0.5 — but note that Saturday half-day employees always get
 * Present (not HalfDay) status since they check out at 2 PM on a normal checkout flow.
 */
async function countRegularPresentDays(
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

/**
 * Bonus days worked on off days (isWeekendWork=true).
 * - Sundays are official paid days, so they are not treated as bonus days.
 * - For "off" schedule: only Saturdays voluntarily worked are bonus.
 * - For "full"/"half" schedule: Saturdays are regular workdays, so no weekend bonus.
 */
async function countBonusDaysWorked(
  userId: string,
  month: number,
  year: number,
): Promise<number> {
  const records = await prisma.attendance.findMany({
    where: {
      userId,
      date: { gte: monthStartUTC(month, year), lte: monthEndUTC(month, year) },
      isWeekendWork: true,
      status: { in: [AttendanceStatus.Present, AttendanceStatus.HalfDay] },
    },
    select: { date: true },
  });

  return records.filter((record) => {
    const localDate = new Date(
      record.date.getTime() + ATTENDANCE_TZ_OFFSET_MINUTES * 60 * 1000,
    );
    return localDate.getUTCDay() !== 0;
  }).length;
}

/** Approved leave days falling within the given month */
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
    const days = countDaysExcludingSundays(clippedStart, clippedEnd);
    total += days;
  }
  return total;
}

/**
 * Total approved leaves from Jan 1 of the year through end of throughMonth.
 * Used to compute YTD excess beyond the 14-day annual quota.
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
    const days = countDaysExcludingSundays(clippedStart, clippedEnd);
    total += days;
  }
  return total;
}

/**
 * Generate (or regenerate) payroll for a single user for the given month/year.
 *
 * Formula:
 *   scheduledWorkingDays = Mon–Fri + Saturdays (if full/half schedule) in the month
 *   perDaySalary         = monthlySalary / scheduledWorkingDays
 *   sundayPaidDays       = Sundays in month (official paid days)
 *   regularPresentDays   = days clocked in on scheduled working days (isWeekendWork=false)
 *                          HalfDay = 0.5; Saturday half-day employees always get Present = 1.0
 *   bonusDaysWorked      = days worked on off days (isWeekendWork=true) — paid at same perDaySalary
 *   paidDays             = regularPresentDays + sundayPaidDays + bonusDaysWorked + approvedLeavesThisMonth
 *   grossSalary          = perDaySalary × paidDays
 *   excessLeaveDays      = min(max(0, approvedLeavesYTD − 14), approvedLeavesThisMonth)
 *   leaveSalaryDeduction = perDaySalary × excessLeaveDays
 *   netSalary            = grossSalary − leaveSalaryDeduction − professionalTax
 *
 * Note: if an employee works ALL their scheduled days, paidDays = scheduledWorkingDays
 * and grossSalary ≈ monthlySalary (leaves may push it above if within quota).
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
      saturdaySchedule: true,
    },
  });

  if (user.monthlySalary == null || user.monthlySalary <= 0) {
    throw new Error(`User ${user.fullName} has invalid monthly salary`);
  }

  // Step 1: Days reference
  const daysInMonth = getDaysInMonth(month, year);
  const scheduledWorkingDays = countScheduledWorkingDays(month, year, user.saturdaySchedule);
  const sundayPaidDays = countSundaysInMonth(month, year);

  // Step 2: Per-day rate based on employee's actual work schedule
  // Employees who work every scheduled day receive exactly their monthlySalary
  const perDaySalary = user.monthlySalary / scheduledWorkingDays;

  // Step 3: Attendance counts
  const weekdayPresentDays = await countRegularPresentDays(userId, month, year);
  const weekendWorkedDays = await countBonusDaysWorked(userId, month, year);

  // Step 4: Leave counts
  const approvedLeavesMonth = await countApprovedLeavesInMonth(userId, month, year);
  const approvedLeavesYTD = await countApprovedLeavesYTD(userId, year, month);

  // Step 5: Excess leave calculation (annual quota = 14 days)
  const excessLeavesYTD = Math.max(0, approvedLeavesYTD - 14);
  const excessLeaveDays = Math.min(excessLeavesYTD, approvedLeavesMonth);

  // Step 6: Paid days — presence + bonus days + approved leaves (excess deducted below)
  const paidDays = weekdayPresentDays + sundayPaidDays + weekendWorkedDays + approvedLeavesMonth;

  // Step 7: Salary calculation
  const grossSalary = perDaySalary * paidDays;
  const leaveSalaryDeduction = perDaySalary * excessLeaveDays;
  const professionalTax = calculatePT(user.monthlySalary, user.gender, month);
  const netSalary = grossSalary - leaveSalaryDeduction - professionalTax;

  return prisma.payroll.upsert({
    where: { userId_month_year: { userId, month, year } },
    create: {
      userId,
      month,
      year,
      daysInMonth,
      scheduledWorkingDays,
      saturdaySchedule: user.saturdaySchedule,
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
      scheduledWorkingDays,
      saturdaySchedule: user.saturdaySchedule,
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
