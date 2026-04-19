import cron from "node-cron";
import { AttendanceStatus } from "@prisma/client";
import prisma from "../config/db.js";
import { logActivity } from "./activityLogger.js";
import { sendAttendanceCheckoutWarningEmail } from "./mailer.js";
import { broadcastToUser } from "./sse.js";
import {
  buildWorkDateTime,
  calculateAttendanceSummary,
  isValidWorkWindow,
  startOfLocalDay,
} from "../utils/attendance.js";

const CHECKOUT_GRACE_MINUTES = 10;

function getReminderDeadline(workEnd: Date): Date {
  return new Date(workEnd.getTime() + CHECKOUT_GRACE_MINUTES * 60 * 1000);
}

async function createUserCheckoutReminder(params: {
  userId: string;
  fullName: string;
  attendanceId: string;
}): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: {
        type: "attendance_checkout_warning",
        title: "Checkout Reminder",
        message: "Hurry up! Please check out in the next 10 minutes, otherwise you will be marked absent.",
        entityType: "attendance",
        entityId: params.attendanceId,
        entityName: `${params.fullName} Attendance`,
        entityLink: "/attendance",
      },
    });

    const otherUsers = await prisma.user.findMany({
      where: { isActive: true, id: { not: params.userId } },
      select: { id: true },
    });

    if (otherUsers.length > 0) {
      await prisma.notificationRead.createMany({
        data: otherUsers.map((u) => ({
          notificationId: notification.id,
          userId: u.id,
        })),
        skipDuplicates: true,
      });
    }

    broadcastToUser(params.userId, "notification", notification);
  } catch (err) {
    console.error("[AttendanceScheduler] Failed checkout reminder notification:", err);
  }
}

// ─── Remind + Auto-End Open Attendances ───────────────
async function processOpenAttendances(): Promise<void> {
  try {
    const openAttendances = await prisma.attendance.findMany({
      where: {
        startTime: { not: null },
        endTime: null,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            workStartTime: true,
            workEndTime: true,
            saturdaySchedule: true,
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
      );
      if (ruleError) continue;

      const day = startOfLocalDay(attendance.startTime);
      const dow = day.getDay();
      const endTimeStr = dow === 6 && attendance.user.saturdaySchedule === "half" ? "14:00" : attendance.user.workEndTime;
      const workEnd = buildWorkDateTime(day, endTimeStr);
      if (!workEnd) continue;
      if (now < workEnd) continue;

      const reminderDeadline = getReminderDeadline(workEnd);

      // Phase 1: remind user once, then wait up to 10 minutes.
      if (now < reminderDeadline) {
        if (!attendance.checkoutReminderSentAt) {
          await Promise.allSettled([
            createUserCheckoutReminder({
              userId: attendance.userId,
              fullName: attendance.user.fullName,
              attendanceId: attendance.id,
            }),
            attendance.user.email
              ? sendAttendanceCheckoutWarningEmail({
                  to: attendance.user.email,
                  fullName: attendance.user.fullName,
                  graceMinutes: CHECKOUT_GRACE_MINUTES,
                })
              : Promise.resolve(),
          ]);

          await prisma.attendance.update({
            where: { id: attendance.id },
            data: { checkoutReminderSentAt: now },
          });

          await logActivity(attendance.userId, "attendance_checkout_warning", "attendance", attendance.id, {
            reminderAt: now.toISOString(),
            deadline: reminderDeadline.toISOString(),
          });
        }
        continue;
      }

      // Phase 2: still not checked out after grace period => auto-absent.
      const safeEnd = reminderDeadline < attendance.startTime ? attendance.startTime : reminderDeadline;
      const summary = calculateAttendanceSummary(
        attendance.startTime,
        safeEnd,
        attendance.heartbeats,
      );

      await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          endTime: safeEnd,
          totalTimeMinutes: summary.totalTimeMinutes,
          idleTimeMinutes: 0,
          realTimeMinutes: summary.totalTimeMinutes,
          status: AttendanceStatus.Absent,
          earlyLogout: false,
          autoEnded: true,
          checkoutReminderSentAt: attendance.checkoutReminderSentAt ?? now,
        },
      });

      await logActivity(attendance.userId, "attendance_auto_end_absent", "attendance", attendance.id, {
        endTime: safeEnd.toISOString(),
        totalTimeMinutes: summary.totalTimeMinutes,
        idleTimeMinutes: 0,
        realTimeMinutes: summary.totalTimeMinutes,
        status: AttendanceStatus.Absent,
        reason: `Forgot to check out within ${CHECKOUT_GRACE_MINUTES} minutes after work end — auto-ended and marked Absent`,
      });
    }
  } catch (err) {
    console.error("[AttendanceScheduler] Failed open attendance processing:", err);
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
        saturdaySchedule: true,
      },
    });

    const now = new Date();
    const todayDow = today.getDay(); // 0=Sunday, 6=Saturday

    for (const user of activeUsers) {
      // Sunday always off; Saturday off if schedule is "off"
      if (todayDow === 0) continue;
      if (todayDow === 6 && user.saturdaySchedule === "off") continue;

      // Saturday half-day: work ends at 14:00
      const endTimeStr = todayDow === 6 && user.saturdaySchedule === "half" ? "14:00" : user.workEndTime;
      const workEnd = buildWorkDateTime(today, endTimeStr);
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
            checkoutProofs: [],
            checkoutReminderSentAt: null,
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
            saturdaySchedule: true,
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
      const dow = day.getDay();
      const endTimeStr = dow === 6 && attendance.user.saturdaySchedule === "half" ? "14:00" : attendance.user.workEndTime;
      const workEnd = buildWorkDateTime(day, endTimeStr);
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
          idleTimeMinutes: 0,
          realTimeMinutes: summary.totalTimeMinutes,
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
  // Every minute: send checkout reminders and auto-end after grace period.
  cron.schedule("* * * * *", processOpenAttendances);

  // Every 5 minutes between 17:00–23:59: mark no-show users as absent
  cron.schedule("*/5 17-23 * * *", markNoShowAbsent);

  // Daily cleanup shortly after midnight.
  cron.schedule("5 0 * * *", closePreviousDayOpenAttendances);

  // Also mark no-shows right after midnight for any stragglers
  cron.schedule("10 0 * * *", markNoShowAbsent);

  console.log("[AttendanceScheduler] Jobs scheduled (reminder+auto-end, no-show check, 00:05 cleanup).");
}
