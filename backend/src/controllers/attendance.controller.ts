import { AttendanceStatus, Prisma } from "@prisma/client";
import { Response } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import prisma from "../config/db.js";
import { logActivity } from "../services/activityLogger.js";
import { AuthRequest } from "../types/index.js";
import {
  calculateAttendanceSummary,
  formatMinutes,
  isValidWorkWindow,
  parseHHMM,
  startOfLocalDay,
} from "../utils/attendance.js";

interface CheckoutProofFile {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
}

const MAX_CHECKOUT_PROOFS = 10;
const CHECKOUT_EARLY_WINDOW_MINUTES = 60;
const ATTENDANCE_TZ_OFFSET_MINUTES = Number(
  process.env.ATTENDANCE_TZ_OFFSET_MINUTES ?? 330,
);

function buildScheduleDateTime(referenceDate: Date, hhmm: string): Date | null {
  const parsed = parseHHMM(hhmm);
  if (!parsed) return null;

  const shifted = new Date(
    referenceDate.getTime() + ATTENDANCE_TZ_OFFSET_MINUTES * 60 * 1000,
  );
  shifted.setHours(parsed.hours, parsed.minutes, 0, 0);

  return new Date(shifted.getTime() - ATTENDANCE_TZ_OFFSET_MINUTES * 60 * 1000);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const attendanceProofStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: Express.Request, file: Express.Multer.File) => {
    const lowerName = file.originalname.toLowerCase();
    const isRaw =
      file.mimetype === "application/pdf" ||
      lowerName.endsWith(".pdf") ||
      lowerName.endsWith(".doc") ||
      lowerName.endsWith(".docx");
    const resource_type = isRaw ? "raw" : "image";
    const extMatch = file.originalname.match(/\.[^/.]+$/);
    const ext = isRaw && extMatch ? extMatch[0] : "";
    const baseName = file.originalname
      .replace(/\.[^/.]+$/, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");

    return {
      folder: "elan-attendance-proofs",
      resource_type,
      public_id: `attendance_proof_${Date.now()}_${baseName}${ext}`,
    };
  },
} as any);

export const uploadAttendanceProofFile = multer({
  storage: attendanceProofStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

function normalizeCheckoutProofs(value: unknown): CheckoutProofFile[] {
  if (!Array.isArray(value)) return [];

  const result: CheckoutProofFile[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    if (!url) continue;

    const name = typeof record.name === "string" && record.name.trim().length > 0
      ? record.name.trim()
      : "Work Proof";
    const mimeType = typeof record.mimeType === "string" ? record.mimeType : undefined;
    const size = typeof record.size === "number" ? record.size : undefined;

    result.push({ url, name, mimeType, size });
  }

  return result;
}

type AttendanceWithBeats = Prisma.AttendanceGetPayload<{
  include: {
    heartbeats: {
      orderBy: { timestamp: "asc" };
      select: { timestamp: true };
    };
  };
}>;

function serializeAttendance(
  attendance: AttendanceWithBeats,
  minHoursPresent: number,
  workStartTime: string,
  workEndTime: string,
) {
  const checkoutProofs = normalizeCheckoutProofs(attendance.checkoutProofs);

  return {
    id: attendance.id,
    userId: attendance.userId,
    date: attendance.date,
    startTime: attendance.startTime,
    endTime: attendance.endTime,
    totalTimeMinutes: attendance.totalTimeMinutes,
    idleTimeMinutes: attendance.idleTimeMinutes,
    realTimeMinutes: attendance.realTimeMinutes,
    status: attendance.status,
    lateLogin: attendance.lateLogin,
    earlyLogout: attendance.earlyLogout,
    autoEnded: attendance.autoEnded,
    isWeekendWork: attendance.isWeekendWork,
    checkoutProofs,
    checkoutProofCount: checkoutProofs.length,
    minHoursPresent,
    workStartTime,
    workEndTime,
    totalTimeLabel: formatMinutes(attendance.totalTimeMinutes),
    idleTimeLabel: formatMinutes(attendance.idleTimeMinutes),
    realTimeLabel: formatMinutes(attendance.realTimeMinutes),
  };
}

async function getTodayAttendanceWithSchedule(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      workStartTime: true,
      workEndTime: true,
      minHoursPresent: true,
    },
  });

  if (!user) return null;

  const today = startOfLocalDay();
  const attendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    include: {
      heartbeats: {
        select: { timestamp: true },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  return { user, attendance, today };
}

export async function uploadAttendanceProof(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const today = startOfLocalDay();
    const activeAttendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      select: { startTime: true, endTime: true },
    });

    if (!activeAttendance?.startTime || activeAttendance.endTime) {
      res.status(400).json({ error: "Please check in first to upload work documents." });
      return;
    }

    const file = req.file as any;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const fileUrl: string = file.path || file.secure_url || file.url;
    const fileName = file.originalname || "Work Proof";
    const mimeType = file.mimetype || null;
    const size = typeof file.size === "number" ? file.size : null;

    res.json({
      url: fileUrl,
      name: fileName,
      mimeType,
      size,
    });
  } catch (err) {
    console.error("Upload attendance proof error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Check In (Start) ─────────────────────────────────
export async function startAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        workStartTime: true,
        workEndTime: true,
        minHoursPresent: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const validationError = isValidWorkWindow(user.workStartTime, user.workEndTime);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const now = new Date();
    const today = startOfLocalDay(now);
    const workStart = buildScheduleDateTime(now, user.workStartTime);

    const existing = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    // Already checked in and session active.
    // Repair legacy records where startTime was accidentally saved in the future.
    if (existing?.startTime && !existing.endTime) {
      if (existing.startTime > now) {
        const repaired = await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            startTime: now,
            lateLogin: false,
          },
          include: {
            heartbeats: {
              select: { timestamp: true },
              orderBy: { timestamp: "asc" },
            },
          },
        });

        await logActivity(userId, "attendance_check_in_repaired", "attendance", repaired.id, {
          previousStartTime: existing.startTime.toISOString(),
          newStartTime: now.toISOString(),
        });

        res.status(200).json({
          message: "Active session repaired with correct check-in time.",
          attendance: serializeAttendance(
            repaired,
            user.minHoursPresent,
            user.workStartTime,
            user.workEndTime,
          ),
          isWorking: true,
        });
        return;
      }

      res.status(400).json({ error: "You've already checked in today. Your session is active." });
      return;
    }

    // Already completed for today (checked in + checked out)
    if (existing?.endTime) {
      res.status(400).json({ error: "Attendance already completed for today. You cannot check in again." });
      return;
    }

    // If there's an absent record (no-show), but user is now checking in, we update it
    const effectiveStart = now;

    // isWeekendWork: opt-in flag for voluntarily working on Sat/Sun
    const isWeekendWork = req.body?.isWeekendWork === true;

    const attendance = await prisma.attendance.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        startTime: effectiveStart,
        endTime: null,
        checkoutProofs: [] as Prisma.InputJsonValue,
        checkoutReminderSentAt: null,
        totalTimeMinutes: 0,
        idleTimeMinutes: 0,
        realTimeMinutes: 0,
        status: AttendanceStatus.Present,
        lateLogin: false,
        earlyLogout: false,
        autoEnded: false,
        isWeekendWork,
      },
      create: {
        userId,
        date: today,
        startTime: effectiveStart,
        status: AttendanceStatus.Present,
        lateLogin: false,
        isWeekendWork,
      },
      include: {
        heartbeats: {
          select: { timestamp: true },
          orderBy: { timestamp: "asc" },
        },
      },
    });

    await logActivity(userId, "attendance_check_in", "attendance", attendance.id, {
      startTime: effectiveStart.toISOString(),
    });

    res.status(201).json({
      message: "Checked in successfully",
      attendance: serializeAttendance(
        attendance,
        user.minHoursPresent,
        user.workStartTime,
        user.workEndTime,
      ),
      isWorking: true,
    });
  } catch (err) {
    console.error("Start attendance error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Check Out (End) ──────────────────────────────────
export async function endAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const context = await getTodayAttendanceWithSchedule(userId);
    if (!context?.attendance || !context.attendance.startTime) {
      res.status(400).json({ error: "You haven't checked in today. Please check in first." });
      return;
    }

    if (context.attendance.endTime) {
      res.status(400).json({ error: "You've already checked out today." });
      return;
    }

    const proofFiles = normalizeCheckoutProofs(req.body?.proofFiles);
    if (proofFiles.length < 1) {
      res.status(400).json({ error: "Please upload at least one work proof file before check-out." });
      return;
    }
    if (proofFiles.length > MAX_CHECKOUT_PROOFS) {
      res.status(400).json({ error: `Maximum ${MAX_CHECKOUT_PROOFS} work proof files are allowed.` });
      return;
    }

    const now = new Date();

    const summary = calculateAttendanceSummary(
      context.attendance.startTime,
      now,
      context.attendance.heartbeats,
    );

    const scheduleEnd = buildScheduleDateTime(now, context.user.workEndTime);
    if (!scheduleEnd) {
      res.status(400).json({ error: "Invalid work schedule for user" });
      return;
    }

    const earliestCheckout = new Date(
      scheduleEnd.getTime() - CHECKOUT_EARLY_WINDOW_MINUTES * 60 * 1000,
    );
    if (now < earliestCheckout) {
      res.status(400).json({
        error: `Checkout is allowed only in the last ${CHECKOUT_EARLY_WINDOW_MINUTES} minutes of your shift.`,
        earliestCheckoutTime: earliestCheckout.toISOString(),
      });
      return;
    }

    const updated = await prisma.attendance.update({
      where: { id: context.attendance.id },
      data: {
        endTime: now,
        totalTimeMinutes: summary.totalTimeMinutes,
        idleTimeMinutes: 0,
        realTimeMinutes: summary.totalTimeMinutes,
        checkoutProofs: proofFiles as unknown as Prisma.InputJsonValue,
        checkoutReminderSentAt: null,
        status: AttendanceStatus.Present,
        earlyLogout: now < scheduleEnd,
        autoEnded: false,
      },
      include: {
        heartbeats: {
          select: { timestamp: true },
          orderBy: { timestamp: "asc" },
        },
      },
    });

    await logActivity(userId, "attendance_check_out", "attendance", updated.id, {
      endTime: now.toISOString(),
      totalTimeMinutes: summary.totalTimeMinutes,
      idleTimeMinutes: 0,
      realTimeMinutes: summary.totalTimeMinutes,
      proofCount: proofFiles.length,
      status: updated.status,
    });

    res.json({
      message: "Checked out successfully",
      attendance: serializeAttendance(
        updated,
        context.user.minHoursPresent,
        context.user.workStartTime,
        context.user.workEndTime,
      ),
      isWorking: false,
    });
  } catch (err) {
    console.error("End attendance error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Heartbeat ────────────────────────────────────────
export async function heartbeatAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const today = startOfLocalDay();
    const attendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (!attendance?.startTime || attendance.endTime) {
      res.status(400).json({ error: "No active work session to record heartbeat" });
      return;
    }

    const now = new Date();

    await prisma.attendanceHeartbeat.create({
      data: {
        attendanceId: attendance.id,
        userId,
        timestamp: now,
      },
    });

    res.json({ message: "Heartbeat recorded", timestamp: now.toISOString() });
  } catch (err) {
    console.error("Attendance heartbeat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Today's Attendance (Self) ────────────────────────
export async function getTodayAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const context = await getTodayAttendanceWithSchedule(userId);
    if (!context) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const now = new Date();
    const workStart = buildScheduleDateTime(now, context.user.workStartTime);
    const workEnd = buildScheduleDateTime(now, context.user.workEndTime);

    if (!workStart || !workEnd) {
      res.status(400).json({ error: "Invalid work schedule for user" });
      return;
    }

    let liveAttendance = context.attendance;

    if (liveAttendance?.startTime && !liveAttendance.endTime) {
      const now = new Date();

      if (liveAttendance.startTime > now) {
        liveAttendance = await prisma.attendance.update({
          where: { id: liveAttendance.id },
          data: {
            startTime: now,
            lateLogin: false,
          },
          include: {
            heartbeats: {
              select: { timestamp: true },
              orderBy: { timestamp: "asc" },
            },
          },
        });
      }

      const activeStart = liveAttendance.startTime ?? now;
      const summary = calculateAttendanceSummary(
        activeStart,
        now,
        liveAttendance.heartbeats,
      );

      liveAttendance = {
        ...liveAttendance,
        heartbeats: liveAttendance.heartbeats,
        totalTimeMinutes: summary.totalTimeMinutes,
        idleTimeMinutes: 0,
        realTimeMinutes: summary.totalTimeMinutes,
        status: AttendanceStatus.Present,
      };
    }

    res.json({
      date: context.today,
      workStartTime: context.user.workStartTime,
      workEndTime: context.user.workEndTime,
      earliestCheckoutTime: new Date(
        workEnd.getTime() - CHECKOUT_EARLY_WINDOW_MINUTES * 60 * 1000,
      ).toISOString(),
      minHoursPresent: context.user.minHoursPresent,
      attendance: liveAttendance
        ? serializeAttendance(
            liveAttendance,
            context.user.minHoursPresent,
            context.user.workStartTime,
            context.user.workEndTime,
          )
        : null,
      isWorking: Boolean(liveAttendance?.startTime && !liveAttendance.endTime),
    });
  } catch (err) {
    console.error("Get today attendance error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Attendance History (Self) ────────────────────────
export async function getAttendanceHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { from, to } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        workStartTime: true,
        workEndTime: true,
        minHoursPresent: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Default: last 30 days
    const endDate = to ? new Date(to as string) : new Date();
    const startDate = from ? new Date(from as string) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const records = await prisma.attendance.findMany({
      where: {
        userId,
        date: {
          gte: startOfLocalDay(startDate),
          lte: startOfLocalDay(endDate),
        },
      },
      include: {
        heartbeats: {
          select: { timestamp: true },
          orderBy: { timestamp: "asc" },
        },
      },
      orderBy: { date: "desc" },
    });

    const history = records.map((r) => serializeAttendance(r, user.minHoursPresent, user.workStartTime, user.workEndTime));

    // Summary stats
    const totalDays = history.length;
    const presentDays = history.filter((h) => h.status === "Present").length;
    const absentDays = history.filter((h) => h.status === "Absent").length;
    const autoEndedDays = history.filter((h) => h.autoEnded).length;
    const lateLoginDays = history.filter((h) => h.lateLogin).length;
    const earlyLogoutDays = history.filter((h) => h.earlyLogout).length;

    res.json({
      from: startDate,
      to: endDate,
      summary: {
        totalDays,
        presentDays,
        absentDays,
        autoEndedDays,
        lateLoginDays,
        earlyLogoutDays,
      },
      records: history,
    });
  } catch (err) {
    console.error("Get attendance history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Admin: Today's All Users ─────────────────────────
export async function getAdminTodayAttendance(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const today = startOfLocalDay();

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        workStartTime: true,
        workEndTime: true,
        minHoursPresent: true,
        attendances: {
          where: { date: today },
          take: 1,
          include: {
            heartbeats: {
              select: { timestamp: true },
              orderBy: { timestamp: "asc" },
            },
          },
        },
      },
      orderBy: { fullName: "asc" },
    });

    const now = new Date();

    const rows = users.map((user) => {
      const attendance = user.attendances[0] ?? null;
      if (!attendance?.startTime) {
        return {
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
          workStartTime: user.workStartTime,
          workEndTime: user.workEndTime,
          minHoursPresent: user.minHoursPresent,
          startTime: null,
          endTime: null,
          totalTimeMinutes: 0,
          idleTimeMinutes: 0,
          realTimeMinutes: 0,
          status: AttendanceStatus.Absent,
          lateLogin: false,
          earlyLogout: false,
          autoEnded: false,
          isWorking: false,
          totalTimeLabel: formatMinutes(0),
          idleTimeLabel: formatMinutes(0),
          realTimeLabel: formatMinutes(0),
        };
      }

      const calculatedEnd = attendance.endTime ? attendance.endTime : now;
      const safeEnd = calculatedEnd < attendance.startTime ? attendance.startTime : calculatedEnd;
      const summary = calculateAttendanceSummary(attendance.startTime, safeEnd, attendance.heartbeats);
      const status = attendance.endTime ? attendance.status : AttendanceStatus.Present;

      return {
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        workStartTime: user.workStartTime,
        workEndTime: user.workEndTime,
        minHoursPresent: user.minHoursPresent,
        startTime: attendance.startTime,
        endTime: attendance.endTime,
        totalTimeMinutes: attendance.endTime ? attendance.totalTimeMinutes : summary.totalTimeMinutes,
        idleTimeMinutes: attendance.endTime ? attendance.idleTimeMinutes : 0,
        realTimeMinutes: attendance.endTime ? attendance.realTimeMinutes : summary.totalTimeMinutes,
        status,
        lateLogin: attendance.lateLogin,
        earlyLogout: attendance.earlyLogout,
        autoEnded: attendance.autoEnded,
        isWorking: Boolean(attendance.startTime && !attendance.endTime),
        totalTimeLabel: formatMinutes(attendance.endTime ? attendance.totalTimeMinutes : summary.totalTimeMinutes),
        idleTimeLabel: formatMinutes(attendance.endTime ? attendance.idleTimeMinutes : 0),
        realTimeLabel: formatMinutes(attendance.endTime ? attendance.realTimeMinutes : summary.totalTimeMinutes),
      };
    });

    res.json({ date: today, rows });
  } catch (err) {
    console.error("Get admin today attendance error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Admin: Attendance History (All Users) ────────────
export async function getAdminAttendanceHistory(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { from, to, userId } = req.query;

    // Default: last 30 days
    const endDate = to ? new Date(to as string) : new Date();
    const startDate = from ? new Date(from as string) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const whereClause: any = {
      date: {
        gte: startOfLocalDay(startDate),
        lte: startOfLocalDay(endDate),
      },
    };

    if (userId) {
      whereClause.userId = userId as string;
    }

    const records = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
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
      orderBy: [{ date: "desc" }, { user: { fullName: "asc" } }],
    });

    const history = records.map((r) => ({
      ...serializeAttendance(r, r.user.minHoursPresent, r.user.workStartTime, r.user.workEndTime),
      fullName: r.user.fullName,
      email: r.user.email,
    }));

    // Per-user summary
    const userMap = new Map<string, {
      userId: string;
      fullName: string;
      email: string;
      totalDays: number;
      presentDays: number;
      absentDays: number;
      autoEndedDays: number;
      lateLoginDays: number;
      earlyLogoutDays: number;
      totalRealMinutes: number;
    }>();

    for (const r of history) {
      let entry = userMap.get(r.userId);
      if (!entry) {
        entry = {
          userId: r.userId,
          fullName: r.fullName,
          email: r.email,
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          autoEndedDays: 0,
          lateLoginDays: 0,
          earlyLogoutDays: 0,
          totalRealMinutes: 0,
        };
        userMap.set(r.userId, entry);
      }
      entry.totalDays++;
      if (r.status === "Present") entry.presentDays++;
      if (r.status === "Absent") entry.absentDays++;
      if (r.autoEnded) entry.autoEndedDays++;
      if (r.lateLogin) entry.lateLoginDays++;
      if (r.earlyLogout) entry.earlyLogoutDays++;
      entry.totalRealMinutes += r.realTimeMinutes;
    }

    res.json({
      from: startDate,
      to: endDate,
      userSummaries: Array.from(userMap.values()),
      records: history,
    });
  } catch (err) {
    console.error("Get admin attendance history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
