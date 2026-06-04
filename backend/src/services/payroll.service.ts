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
 * Count the employee's scheduled days in the month (the salary denominator).
 * Sundays ARE included — they are official paid-off days counted in the denominator
 * so that perDaySalary stays proportionate and a fully-present employee earns
 * exactly their monthlySalary.
 * Saturdays are excluded only when saturdaySchedule === "off".
 * Declared holidays are NOT subtracted — their paid days are added to paidDays
 * (numerator) instead, which preserves the salary balance.
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
 * Count holidays that fall on scheduled working days (not Sundays, not off-Saturdays).
 * These days are automatically paid regardless of attendance.
 * Returns { count, paidDays, scheduledHolidayDates } where scheduledHolidayDates
 * are the dates used to exclude those days from regularPresentDays (prevents double-counting).
 */
async function countHolidaysInMonth(
  month: number,
  year: number,
  saturdaySchedule: string,
): Promise<{ count: number; paidDays: number; scheduledHolidayDates: Date[] }> {
  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lte: new Date(Date.UTC(year, month - 1, getDaysInMonth(month, year))),
      },
    },
    select: { date: true },
  });

  let paidDays = 0;
  const scheduledHolidayDates: Date[] = [];
  for (const h of holidays) {
    const dow = h.date.getUTCDay(); // 0=Sun, 6=Sat
    if (dow === 0) continue; // Sunday already paid via sundayPaidDays
    if (dow === 6 && saturdaySchedule === "off") continue; // Off Saturday, employee already has the day off
    paidDays++;
    scheduledHolidayDates.push(h.date);
  }

  return { count: holidays.length, paidDays, scheduledHolidayDates };
}

/**
 * Present days (all scheduled days including weekends worked).
 * HalfDay counts as 0.5. Holiday dates are excluded to prevent double-counting
 * with holidayPaidDays.
 */
async function countRegularPresentDays(
  userId: string,
  month: number,
  year: number,
  holidayDates: Date[] = [],
): Promise<number> {
  const holidayFilter = holidayDates.length > 0
    ? { NOT: { date: { in: holidayDates } } }
    : {};

  const records = await prisma.attendance.findMany({
    where: {
      userId,
      date: { gte: monthStartUTC(month, year), lte: monthEndUTC(month, year) },
      status: { in: [AttendanceStatus.Present, AttendanceStatus.HalfDay] },
      ...holidayFilter,
    },
    select: { status: true },
  });

  return records.reduce((sum, r) => {
    return sum + (r.status === AttendanceStatus.HalfDay ? 0.5 : 1);
  }, 0);
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
 *   sundayPaidDays       = Sundays in month (official paid days off)
 *   holidayPaidDays      = declared holidays falling on scheduled working days (paid days off)
 *   holidayCount         = total holidays declared in the month
 *   regularPresentDays   = days clocked in (all days, HalfDay = 0.5)
 *   approvedLeavesMonth  = approved leave days in this month (within quota = paid)
 *   paidDays             = regularPresentDays + sundayPaidDays
 *                          + approvedLeavesMonth + holidayPaidDays
 *   grossSalary          = perDaySalary × paidDays
 *   excessLeaveDays      = min(max(0, approvedLeavesYTD − 14), approvedLeavesThisMonth)
 *   leaveSalaryDeduction = perDaySalary × excessLeaveDays
 *   netSalary            = grossSalary − leaveSalaryDeduction − professionalTax
 *
 * Holiday note: holidays are always paid even if the employee was absent on that day.
 * If an employee works on a holiday, their Present record counts in regularPresentDays
 * AND holidayPaidDays still applies — effectively double pay for working on a holiday,
 * which is the standard practice for declared public holidays.
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
  const perDaySalary = user.monthlySalary / scheduledWorkingDays;

  // Step 3: Holiday counts (fetched before attendance so holiday dates can be excluded)
  const { count: holidayCount, paidDays: holidayPaidDays, scheduledHolidayDates } =
    await countHolidaysInMonth(month, year, user.saturdaySchedule);

  // Step 4: Attendance counts (holidays excluded from regularPresentDays to avoid double-counting)
  const weekdayPresentDays = await countRegularPresentDays(userId, month, year, scheduledHolidayDates);

  // Step 5: Leave counts
  const approvedLeavesMonth = await countApprovedLeavesInMonth(userId, month, year);
  const approvedLeavesYTD = await countApprovedLeavesYTD(userId, year, month);

  // Step 6: Excess leave calculation (annual quota = 14 days)
  const excessLeavesYTD = Math.max(0, approvedLeavesYTD - 14);
  const excessLeaveDays = Math.min(excessLeavesYTD, approvedLeavesMonth);

  // Step 7: Paid days — presence + Sundays + leaves + holidays
  const paidDays =
    weekdayPresentDays +
    sundayPaidDays +
    approvedLeavesMonth +
    holidayPaidDays;

  // Step 8: Salary calculation
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
      weekendWorkedDays: 0,
      holidayCount,
      holidayPaidDays,
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
      weekendWorkedDays: 0,
      holidayCount,
      holidayPaidDays,
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
