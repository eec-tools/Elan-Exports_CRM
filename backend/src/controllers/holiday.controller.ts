import { Request, Response } from "express";
import { AttendanceStatus } from "@prisma/client";
import prisma from "../config/db.js";
import { AuthUser } from "../types/index.js";
import { generatePayroll } from "../services/payroll.service.js";

type AuthReq = Request & { user?: AuthUser };

async function regenPayrollForMonth(year: number, month: number): Promise<void> {
  const users = await prisma.user.findMany({
    where: { isActive: true, monthlySalary: { gt: 0 } },
    select: { id: true },
  });
  await Promise.allSettled(users.map((u) => generatePayroll(u.id, month, year)));
}

/** POST /api/holidays — create a holiday (admin only) */
export async function createHoliday(req: AuthReq, res: Response): Promise<void> {
  try {
    const { date, name } = req.body as { date?: string; name?: string };

    if (!date || !name?.trim()) {
      res.status(400).json({ error: "date and name are required" });
      return;
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    // Normalise to date-only (midnight UTC) so @db.Date stores correctly
    const dateOnly = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));

    const holiday = await prisma.holiday.create({
      data: { date: dateOnly, name: name.trim() },
    });

    // Retroactively remove any no-show Absent records already created for this date
    await prisma.attendance.deleteMany({
      where: {
        date: dateOnly,
        startTime: null,
        status: AttendanceStatus.Absent,
      },
    });

    // Auto-regenerate payroll for this month so holiday count updates immediately
    regenPayrollForMonth(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth() + 1).catch(
      (e) => console.error("regenPayrollForMonth error:", e),
    );

    res.status(201).json(holiday);
  } catch (err: any) {
    if (err?.code === "P2002") {
      res.status(409).json({ error: "A holiday already exists for that date" });
      return;
    }
    console.error("createHoliday error:", err);
    res.status(500).json({ error: "Failed to create holiday" });
  }
}

/** GET /api/holidays — list holidays, optional ?year= filter */
export async function listHolidays(req: AuthReq, res: Response): Promise<void> {
  try {
    const year = typeof req.query.year === "string" ? Number(req.query.year) : null;

    const where = year
      ? {
          date: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lte: new Date(Date.UTC(year, 11, 31)),
          },
        }
      : {};

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: "asc" },
    });

    res.json(holidays);
  } catch (err) {
    console.error("listHolidays error:", err);
    res.status(500).json({ error: "Failed to fetch holidays" });
  }
}

/** DELETE /api/holidays/:id — remove a holiday (admin only) */
export async function deleteHoliday(req: AuthReq, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const deleted = await prisma.holiday.delete({ where: { id }, select: { date: true } });

    // Auto-regenerate payroll for this month so holiday count updates immediately
    regenPayrollForMonth(deleted.date.getUTCFullYear(), deleted.date.getUTCMonth() + 1).catch(
      (e) => console.error("regenPayrollForMonth error:", e),
    );

    res.json({ success: true });
  } catch (err: any) {
    if (err?.code === "P2025") {
      res.status(404).json({ error: "Holiday not found" });
      return;
    }
    console.error("deleteHoliday error:", err);
    res.status(500).json({ error: "Failed to delete holiday" });
  }
}
