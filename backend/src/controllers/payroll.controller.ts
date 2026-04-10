import { Response, Request } from "express";
import prisma from "../config/db.js";
import { AuthUser } from "../types/index.js";
import { generatePayroll } from "../services/payroll.service.js";

type AuthReq<P extends Record<string, string> = Record<string, never>> = Request<P> & {
  user?: AuthUser;
};

/** POST /api/admin/payroll/generate — generate payroll for all active employees */
export async function generateMonthlyPayroll(
  req: AuthReq,
  res: Response,
): Promise<void> {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      res.status(400).json({ error: "month and year are required" });
      return;
    }

    const employees = await prisma.user.findMany({
      where: { isActive: true, monthlySalary: { not: null } },
      select: { id: true, fullName: true },
    });

    const results: { userId: string; fullName: string; status: string; error?: string }[] =
      [];

    for (const emp of employees) {
      try {
        await generatePayroll(emp.id, Number(month), Number(year));
        results.push({ userId: emp.id, fullName: emp.fullName, status: "generated" });
      } catch (err: any) {
        results.push({
          userId: emp.id,
          fullName: emp.fullName,
          status: "failed",
          error: err?.message ?? "Unknown error",
        });
      }
    }

    res.json({ month, year, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate payroll" });
  }
}

/** GET /api/admin/payroll?month=&year= — monthly payroll summary */
export async function getMonthlyPayrollSummary(
  req: AuthReq,
  res: Response,
): Promise<void> {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      res.status(400).json({ error: "month and year query params are required" });
      return;
    }

    const payrolls = await prisma.payroll.findMany({
      where: { month: Number(month), year: Number(year) },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            designation: true,
            bankAccountNumber: true,
            bankName: true,
            bankIfsc: true,
            monthlySalary: true,
          },
        },
      },
      orderBy: { user: { fullName: "asc" } },
    });

    res.json(payrolls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payroll summary" });
  }
}

/** GET /api/admin/payroll/:userId — payroll history for one employee */
export async function getEmployeePayrollHistory(
  req: AuthReq<{ userId: string }>,
  res: Response,
): Promise<void> {
  try {
    const { userId } = req.params;
    const payrolls = await prisma.payroll.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            fullName: true,
            designation: true,
            monthlySalary: true,
            bankAccountNumber: true,
            bankName: true,
            bankIfsc: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    res.json(payrolls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch employee payroll history" });
  }
}

/** GET /api/admin/payroll/:userId/slip?month=&year= — payroll slip for one employee */
export async function getPayrollSlip(
  req: AuthReq<{ userId: string }>,
  res: Response,
): Promise<void> {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      res.status(400).json({ error: "month and year query params are required" });
      return;
    }

    const payroll = await prisma.payroll.findUnique({
      where: { userId_month_year: { userId, month: Number(month), year: Number(year) } },
      include: {
        user: {
          select: {
            fullName: true,
            designation: true,
            monthlySalary: true,
            bankAccountNumber: true,
            bankName: true,
            bankIfsc: true,
          },
        },
      },
    });

    if (!payroll) {
      res.status(404).json({ error: "Payroll slip not found" });
      return;
    }

    res.json(payroll);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payroll slip" });
  }
}

/** GET /api/payroll/me — employee views own payroll */
export async function getMyPayroll(req: AuthReq, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { month, year } = req.query;

    if (month && year) {
      const payroll = await prisma.payroll.findUnique({
        where: {
          userId_month_year: { userId, month: Number(month), year: Number(year) },
        },
        include: {
          user: {
            select: {
              fullName: true,
              designation: true,
              monthlySalary: true,
              bankAccountNumber: true,
              bankName: true,
              bankIfsc: true,
            },
          },
        },
      });
      res.json(payroll ?? null);
      return;
    }

    const payrolls = await prisma.payroll.findMany({
      where: { userId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    res.json(payrolls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payroll" });
  }
}
