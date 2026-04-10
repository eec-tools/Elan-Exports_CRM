import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

const ANNUAL_LEAVE_QUOTA = 14;

async function getUsedLeaves(userId: string, year: number): Promise<number> {
  const leaves = await prisma.leave.findMany({
    where: {
      userId,
      status: "approved",
      startDate: { gte: new Date(year, 0, 1) },
      endDate: { lte: new Date(year, 11, 31) },
    },
  });
  return leaves.reduce((sum, l) => sum + l.numberOfDays, 0);
}

/** POST /api/leaves — employee applies for leave */
export async function applyLeave(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { startDate, endDate, reason } = req.body;

    if (!startDate || !endDate) {
      res.status(400).json({ error: "startDate and endDate are required" });
      return;
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { employeeStatus: true },
    });

    if (user.employeeStatus !== "confirmed") {
      res.status(403).json({
        error: "Only confirmed employees can apply for paid leave",
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      res.status(400).json({ error: "endDate must be on or after startDate" });
      return;
    }

    const numberOfDays =
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Check for overlapping leave
    const overlap = await prisma.leave.findFirst({
      where: {
        userId,
        status: { in: ["pending", "approved"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    if (overlap) {
      res.status(409).json({
        error: "You already have a pending or approved leave overlapping these dates",
      });
      return;
    }

    // Check annual balance
    const year = start.getFullYear();
    const used = await getUsedLeaves(userId, year);
    if (used + numberOfDays > ANNUAL_LEAVE_QUOTA) {
      res.status(400).json({
        error: `Insufficient leave balance. Used: ${used}, Requested: ${numberOfDays}, Quota: ${ANNUAL_LEAVE_QUOTA}`,
      });
      return;
    }

    const leave = await prisma.leave.create({
      data: { userId, startDate: start, endDate: end, numberOfDays, reason },
    });

    res.status(201).json(leave);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to apply for leave" });
  }
}

/** GET /api/leaves — employee views own leave history */
export async function getMyLeaves(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const leaves = await prisma.leave.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(leaves);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leaves" });
  }
}

/** GET /api/leaves/balance — employee views leave balance */
export async function getLeaveBalance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const year = new Date().getFullYear();
    const used = await getUsedLeaves(userId, year);
    res.json({
      quota: ANNUAL_LEAVE_QUOTA,
      used,
      remaining: ANNUAL_LEAVE_QUOTA - used,
      year,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leave balance" });
  }
}

/** GET /api/admin/leaves — admin views all leave requests */
export async function adminGetLeaves(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status } = req.query;
    const leaves = await prisma.leave.findMany({
      where: status ? { status: status as any } : {},
      include: {
        user: { select: { id: true, fullName: true, email: true, designation: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(leaves);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leave requests" });
  }
}

/** PATCH /api/admin/leaves/:id/approve */
export async function approveLeave(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const leave = await prisma.leave.update({
      where: { id },
      data: {
        status: "approved",
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      },
    });
    res.json(leave);
  } catch (err: any) {
    if (err?.code === "P2025") {
      res.status(404).json({ error: "Leave not found" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to approve leave" });
  }
}

/** PATCH /api/admin/leaves/:id/reject */
export async function rejectLeave(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const leave = await prisma.leave.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      },
    });
    res.json(leave);
  } catch (err: any) {
    if (err?.code === "P2025") {
      res.status(404).json({ error: "Leave not found" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to reject leave" });
  }
}
