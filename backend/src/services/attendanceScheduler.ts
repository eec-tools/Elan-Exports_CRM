import cron from "node-cron";
import { AttendanceStatus } from "@prisma/client";
import prisma from "../config/db.js";
import { logActivity } from "./activityLogger.js";
import {
  buildWorkDateTime,
  calculateAttendanceSummary,
  isValidWorkWindow,
  startOfLocalDay,
} from "../utils/attendance.js";

// ─── Auto-End Open Attendances ────────────────────────
// If a user checked in but forgot to check out by their work end time,
// mark them as ABSENT (strict rule per requirement).
async function autoEndOpenAttendances(): Promise<void> {
  try {
    const openAttendances = await prisma.attendance.findMany({
      where: {
        startTime: { not: null },
        endTime: null,
      },
      include: {
        user: {
          select: {
            workStartTime: true,
            workEndTime: true,
            minHoursPresent: true,
          },
        },
        heartbeats: {
          select: { timestamp: true },
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (openAttendances.length === 0) return;

    const now = new Date();

    for (const attendance of openAttendances) {
      if (!attendance.startTime) continue;

      const ruleError = isValidWorkWindow(
        attendance.user.workStartTime,
        attendance.user.workEndTime,
        attendance.user.minHoursPresent,
      );
      if (ruleError) continue;

      const day = startOfLocalDay(attendance.date);
      const workEnd = buildWorkDateTime(day, attendance.user.workEndTime);
      if (!workEnd) continue;
      if (now < workEnd) continue;

      const safeEnd = workEnd < attendance.startTime ? attendance.startTime : workEnd;
      const summary = calculateAttendanceSummary(
        attendance.startTime,
        safeEnd,
        attendance.heartbeats,
      );

      // STRICT RULE: Forgot to check out = ALWAYS Absent
      await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          endTime: safeEnd,
          totalTimeMinutes: summary.totalTimeMinutes,
          idleTimeMinutes: summary.idleTimeMinutes,
          realTimeMinutes: summary.realTimeMinutes,
          status: AttendanceStatus.Absent,
          earlyLogout: false,
          autoEnded: true,
        },
      });

      await logActivity(attendance.userId, "attendance_auto_end_absent", "attendance", attendance.id, {
        endTime: safeEnd.toISOString(),
        totalTimeMinutes: summary.totalTimeMinutes,
        idleTimeMinutes: summary.idleTimeMinutes,
        realTimeMinutes: summary.realTimeMinutes,
        status: AttendanceStatus.Absent,
        reason: "Forgot to check out — auto-ended and marked Absent",
      });
    }
  } catch (err) {
    console.error("[AttendanceScheduler] Failed auto end:", err);
  }
}

// ─── Mark No-Show Users as Absent ─────────────────────
// For users who never checked in at all today,
// create an Absent record so there's a record for every working day.
async function markNoShowAbsent(): Promise<void> {
  try {
    const today = startOfLocalDay();

    // Get all active users
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        workEndTime: true,
      },
    });

    const now = new Date();

    for (const user of activeUsers) {
      // Only mark absent after their work end time has passed
      const workEnd = buildWorkDateTime(today, user.workEndTime);
      if (!workEnd || now < workEnd) continue;

      // Check if they already have a record for today
      const existing = await prisma.attendance.findUnique({
        where: {
          userId_date: {
            userId: user.id,
            date: today,
          },
        },
      });

      // If no record exists, create an Absent record (no-show)
      if (!existing) {
        const record = await prisma.attendance.create({
          data: {
            userId: user.id,
            date: today,
            startTime: null,
            endTime: null,
            totalTimeMinutes: 0,
            idleTimeMinutes: 0,
            realTimeMinutes: 0,
            status: AttendanceStatus.Absent,
            lateLogin: false,
            earlyLogout: false,
            autoEnded: false,
          },
        });

        await logActivity(user.id, "attendance_no_show", "attendance", record.id, {
          reason: "No check-in today — marked Absent",
        });
      }
    }
  } catch (err) {
    console.error("[AttendanceScheduler] Failed no-show marking:", err);
  }
}

// ─── Close Previous Day Open Attendances ──────────────
async function closePreviousDayOpenAttendances(): Promise<void> {
  try {
    const today = startOfLocalDay();

    const stale = await prisma.attendance.findMany({
      where: {
        date: { lt: today },
        startTime: { not: null },
        endTime: null,
      },
      include: {
        user: {
          select: {
            workStartTime: true,
            workEndTime: true,
            minHoursPresent: true,
          },
        },
        heartbeats: {
          select: { timestamp: true },
          orderBy: { timestamp: "asc" },
        },
      },
    });

    for (const attendance of stale) {
      if (!attendance.startTime) continue;

      const day = startOfLocalDay(attendance.date);
      const workEnd = buildWorkDateTime(day, attendance.user.workEndTime);
      if (!workEnd) continue;

      const safeEnd = workEnd < attendance.startTime ? attendance.startTime : workEnd;
      const summary = calculateAttendanceSummary(
        attendance.startTime,
        safeEnd,
        attendance.heartbeats,
      );

      // STRICT: stale open sessions = Absent
      await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          endTime: safeEnd,
          totalTimeMinutes: summary.totalTimeMinutes,
          idleTimeMinutes: summary.idleTimeMinutes,
          realTimeMinutes: summary.realTimeMinutes,
          status: AttendanceStatus.Absent,
          earlyLogout: false,
          autoEnded: true,
        },
      });
    }
  } catch (err) {
    console.error("[AttendanceScheduler] Failed stale close:", err);
  }
}

export function startAttendanceScheduler(): void {
  // Every minute: auto-end active sessions at work_end_time.
  cron.schedule("* * * * *", autoEndOpenAttendances);

  // Every 5 minutes between 17:00–23:59: mark no-show users as absent
  cron.schedule("*/5 17-23 * * *", markNoShowAbsent);

  // Daily cleanup shortly after midnight.
  cron.schedule("5 0 * * *", closePreviousDayOpenAttendances);

  // Also mark no-shows right after midnight for any stragglers
  cron.schedule("10 0 * * *", markNoShowAbsent);

  console.log("[AttendanceScheduler] Jobs scheduled (minute auto-end, no-show check, 00:05 cleanup).");
}
