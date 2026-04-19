import { Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { isValidWorkWindow } from "../utils/attendance.js";

/** GET /api/employees/me — current user's own employee profile */
export async function getMyEmployeeProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        designation: true,
        employeeStatus: true,
        gender: true,
        monthlySalary: true,
        bankAccountNumber: true,
        bankName: true,
        bankIfsc: true,
      },
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch employee profile" });
  }
}

/** GET /api/admin/employees — list all users with payroll fields */
export async function listEmployees(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        designation: true,
        employeeStatus: true,
        gender: true,
        monthlySalary: true,
        bankAccountNumber: true,
        bankName: true,
        bankIfsc: true,
        workStartTime: true,
        workEndTime: true,
        saturdaySchedule: true,
        isActive: true,
        createdAt: true,
        roles: { select: { role: true } },
      },
      orderBy: { fullName: "asc" },
    });
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list employees" });
  }
}

/** POST /api/admin/employees — create employee */
export async function createEmployee(req: AuthRequest, res: Response): Promise<void> {
  try {
    const {
      fullName,
      email,
      password,
      designation,
      employeeStatus,
      gender,
      monthlySalary,
      bankAccountNumber,
      bankName,
      bankIfsc,
      workStartTime = "09:00",
      workEndTime = "18:00",
      saturdaySchedule = "off",
      role = "member",
    } = req.body;

    if (!fullName || !email || !password) {
      res.status(400).json({ error: "fullName, email, and password are required" });
      return;
    }

    const timeError = isValidWorkWindow(workStartTime, workEndTime);
    if (timeError) {
      res.status(400).json({ error: timeError });
      return;
    }

    if (!["off", "full", "half"].includes(saturdaySchedule)) {
      res.status(400).json({ error: "saturdaySchedule must be off, full, or half" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        designation: designation ?? null,
        employeeStatus: employeeStatus ?? "probation",
        gender: gender ?? null,
        monthlySalary: monthlySalary ? Number(monthlySalary) : null,
        bankAccountNumber: bankAccountNumber ?? null,
        bankName: bankName ?? null,
        bankIfsc: bankIfsc ?? null,
        workStartTime,
        workEndTime,
        saturdaySchedule,
        roles: { create: { role } },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        designation: true,
        employeeStatus: true,
        gender: true,
        monthlySalary: true,
        bankAccountNumber: true,
        bankName: true,
        bankIfsc: true,
        workStartTime: true,
        workEndTime: true,
        saturdaySchedule: true,
        isActive: true,
      },
    });

    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create employee" });
  }
}

/** PATCH /api/admin/employees/:id — update employee payroll/profile fields */
export async function updateEmployee(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      fullName,
      designation,
      employeeStatus,
      gender,
      monthlySalary,
      bankAccountNumber,
      bankName,
      bankIfsc,
      workStartTime,
      workEndTime,
      saturdaySchedule,
      isActive,
    } = req.body;

    if (workStartTime !== undefined && workEndTime !== undefined) {
      const timeError = isValidWorkWindow(workStartTime, workEndTime);
      if (timeError) {
        res.status(400).json({ error: timeError });
        return;
      }
    }

    if (saturdaySchedule !== undefined && !["off", "full", "half"].includes(saturdaySchedule)) {
      res.status(400).json({ error: "saturdaySchedule must be off, full, or half" });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(designation !== undefined && { designation }),
        ...(employeeStatus !== undefined && { employeeStatus }),
        ...(gender !== undefined && { gender }),
        ...(monthlySalary !== undefined && { monthlySalary: monthlySalary === null ? null : Number(monthlySalary) }),
        ...(bankAccountNumber !== undefined && { bankAccountNumber }),
        ...(bankName !== undefined && { bankName }),
        ...(bankIfsc !== undefined && { bankIfsc }),
        ...(workStartTime !== undefined && { workStartTime }),
        ...(workEndTime !== undefined && { workEndTime }),
        ...(saturdaySchedule !== undefined && { saturdaySchedule }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        designation: true,
        employeeStatus: true,
        gender: true,
        monthlySalary: true,
        bankAccountNumber: true,
        bankName: true,
        bankIfsc: true,
        workStartTime: true,
        workEndTime: true,
        saturdaySchedule: true,
        isActive: true,
      },
    });

    res.json(user);
  } catch (err: any) {
    if (err?.code === "P2025") {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update employee" });
  }
}
