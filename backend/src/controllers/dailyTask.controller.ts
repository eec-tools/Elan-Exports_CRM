import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logActivity } from "../services/activityLogger.js";
import { AuthRequest } from "../types/index.js";

const prisma = new PrismaClient();

export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      taskText,
      priority,
      status,
      owner,
      company,
      dateFrom,
      dateTo,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Base filters shared by the task list and the priority stat tiles.
    // Deliberately excludes `priority` so the stat tiles show the full
    // breakdown across all priorities for the current owner/status/date/
    // company scope, even while one priority tile is selected as a filter.
    const baseWhere: any = {};
    const andConditions: any[] = [];

    if (taskText) baseWhere.taskText = { contains: taskText, mode: "insensitive" };
    if (status) baseWhere.status = status;
    if (company) baseWhere.company = { contains: company, mode: "insensitive" };

    const isAdmin = req.user?.roles?.includes("admin");

    // Non-admin users see only their own tasks (owner filter below).
    // Company filter is NOT applied for non-admin since owner filter already
    // restricts visibility -- a member should see ALL tasks they own regardless
    // of company value.

    if (!isAdmin) {
      const fullName = req.user?.fullName ?? "";
      const firstName = fullName.split(" ")[0] || fullName;
      andConditions.push({
        OR: [
          { owner: { equals: fullName, mode: "insensitive" } },
          { owner: { equals: firstName, mode: "insensitive" } },
        ],
      });
    } else if (owner) {
      if (owner === "Unassigned") {
        andConditions.push({ OR: [{ owner: null }, { owner: "" }] });
      } else {
        baseWhere.owner = { contains: owner, mode: "insensitive" };
      }
    }

    // Combine all AND conditions
    if (andConditions.length > 0) {
      baseWhere.AND = andConditions;
    }
    if (dateFrom || dateTo) {
      baseWhere.date = {};
      if (dateFrom) baseWhere.date.gte = new Date(dateFrom);
      if (dateTo) {
        const endToDate = new Date(dateTo);
        endToDate.setHours(23, 59, 59, 999);
        baseWhere.date.lte = endToDate;
      }
    }

    const where: any = { ...baseWhere };
    if (priority) where.priority = priority;

    const [tasks, total, priorityCounts] = await Promise.all([
      prisma.dailyTask.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.dailyTask.count({ where }),
      prisma.dailyTask.groupBy({
        by: ["priority"],
        // Completed/closed tasks don't count toward the priority stat tiles --
        // priority reflects outstanding work, not resolved history.
        where: { ...baseWhere, status: { notIn: ["completed", "closed"] } },
        _count: {
          id: true,
        },
      }),
    ]);

    // Format priority counts
    const priorityStats = {
      Urgent: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      None: 0,
    };

    priorityCounts.forEach((item) => {
      const priority = item.priority || "None";
      if (priority in priorityStats) {
        // @ts-ignore
        priorityStats[priority] = item._count.id;
      }
    });

    res.json({
      data: tasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      priorityStats,
    });
  } catch (error) {
    console.error("Error fetching daily tasks:", error);
    res.status(500).json({ error: "Failed to fetch daily tasks" });
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const {
      date,
      taskText,
      company,
      priority,
      owner,
      status,
      deadline,
      notes,
    } = req.body;

    const task = await prisma.dailyTask.create({
      data: {
        date: new Date(date),
        taskText,
        company,
        priority,
        owner,
        status: status || "Pending",
        deadline: deadline ? new Date(deadline) : null,
        notes,
      },
    });

    await logActivity(req.user?.id, "create", "daily_tasks", task.id, {
      taskText: task.taskText,
      status: task.status,
      owner: task.owner,
    });

    res.status(201).json(task);
  } catch (error) {
    console.error("Error creating daily task:", error);
    res.status(500).json({ error: "Failed to create daily task" });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { date, deadline, ...otherData } = req.body;

    const dataToUpdate: any = { ...otherData };
    if (date !== undefined) dataToUpdate.date = new Date(date);
    if (deadline !== undefined) {
      dataToUpdate.deadline = deadline ? new Date(deadline) : null;
    }

    const task = await prisma.dailyTask.update({
      where: { id: id as string },
      data: dataToUpdate,
    });

    await logActivity(req.user?.id, "update", "daily_tasks", task.id, {
      updatedFields: Object.keys(dataToUpdate),
    });

    res.json(task);
  } catch (error) {
    console.error("Error updating daily task:", error);
    res.status(500).json({ error: "Failed to update daily task" });
  }
};

/**
 * Lightweight, unfiltered-by-permission list of supplier/buyer company names
 * for the @mention autocomplete in daily tasks. Daily tasks itself has no
 * per-module permission gate, so this intentionally does not require
 * suppliers/buyers permissions -- it exposes only id/company, no contact
 * details. Pulls from every supplier/buyer pipeline table so mentions cover
 * leads that aren't yet in the "signed" directory. `source` tells the
 * frontend which pipeline the record came from, so it can link to the right
 * detail page (some pipelines -- old suppliers, vault contacts -- have no
 * standalone detail route and are rendered as plain, non-linked mentions).
 */
type MentionRow = { id: string; company: string; source: string };

const dedupeByCompany = (rows: MentionRow[]) => {
  const seen = new Map<string, MentionRow>();
  for (const row of rows) {
    const label = row.company?.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (!seen.has(key)) seen.set(key, { id: row.id, company: label, source: row.source });
  }
  return [...seen.values()];
};

export const getMentionOptions = async (_req: AuthRequest, res: Response) => {
  try {
    const [
      suppliers,
      oldSuppliers,
      newSuppliers,
      sourcingSuppliers,
      vaultSuppliers,
      buyers,
      sourcingBuyers,
      vaultBuyers,
    ] = await Promise.all([
      prisma.supplier.findMany({ where: { isArchived: false }, select: { id: true, company: true } }),
      prisma.oldSupplier.findMany({ select: { id: true, company: true } }),
      prisma.newSupplier.findMany({ where: { isArchived: false }, select: { id: true, company: true } }),
      prisma.sourcingSupplier.findMany({ select: { id: true, company: true } }),
      prisma.sourcingVaultSupplier.findMany({ select: { id: true, company: true } }),
      prisma.buyer.findMany({ where: { isArchived: false }, select: { id: true, company: true } }),
      prisma.sourcingBuyer.findMany({ where: { isArchived: false }, select: { id: true, company: true } }),
      prisma.buyerVaultContact.findMany({ select: { id: true, company: true } }),
    ]);

    // Order matters: dedupeByCompany keeps the first row it sees per company
    // name, so pipelines with a real detail page are listed first -- a
    // company that exists in both "signed" and "sourcing" tables should
    // resolve/link to the signed record.
    const supplierOptions = dedupeByCompany([
      ...suppliers.map((r) => ({ ...r, source: "supplier" })),
      ...newSuppliers.map((r) => ({ ...r, source: "newSupplier" })),
      ...sourcingSuppliers.map((r) => ({ ...r, source: "sourcingSupplier" })),
      ...oldSuppliers.map((r) => ({ ...r, source: "oldSupplier" })),
      ...vaultSuppliers.map((r) => ({ ...r, source: "sourcingVaultSupplier" })),
    ]).map((r) => ({ id: r.id, label: r.company, type: "supplier" as const, source: r.source }));

    const buyerOptions = dedupeByCompany([
      ...buyers.map((r) => ({ ...r, source: "buyer" })),
      ...sourcingBuyers.map((r) => ({ ...r, source: "sourcingBuyer" })),
      ...vaultBuyers.map((r) => ({ ...r, source: "buyerVaultContact" })),
    ]).map((r) => ({ id: r.id, label: r.company, type: "buyer" as const, source: r.source }));

    res.json({ suppliers: supplierOptions, buyers: buyerOptions });
  } catch (error) {
    console.error("Error fetching mention options:", error);
    res.status(500).json({ error: "Failed to fetch mention options" });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.dailyTask.delete({
      where: { id: id as string },
    });

    await logActivity(req.user?.id, "delete", "daily_tasks", id as string, {});

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting daily task:", error);
    res.status(500).json({ error: "Failed to delete daily task" });
  }
};
