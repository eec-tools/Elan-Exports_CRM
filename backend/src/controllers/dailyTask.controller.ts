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

    const where: any = {};
    const andConditions: any[] = [];

    if (taskText) where.taskText = { contains: taskText, mode: "insensitive" };
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (company) where.company = { contains: company, mode: "insensitive" };

    // Non-admin users can see tasks for their assigned companies OR tasks with no company
    const isAdmin = req.user?.roles?.includes("admin");
    const assignedCompanies = req.user?.assignedCompanies || [];
    if (!isAdmin && assignedCompanies.length > 0) {
      andConditions.push({
        OR: [
          { company: { in: assignedCompanies } },
          { company: null },
          { company: "" },
        ],
      });
    }
    // If non-admin has no assigned companies, they can see all tasks (no filter)

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
        where.owner = { contains: owner, mode: "insensitive" };
      }
    }

    // Combine all AND conditions
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) {
        const endToDate = new Date(dateTo);
        endToDate.setHours(23, 59, 59, 999);
        where.date.lte = endToDate;
      }
    }

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
