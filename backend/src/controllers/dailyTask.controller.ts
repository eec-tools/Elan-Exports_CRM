import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logActivity } from "../services/activityLogger.js";
import { AuthRequest } from "../types/index.js";

const prisma = new PrismaClient();

export const getTasks = async (req: AuthRequest, res: Response) => {
    try {
        const { page = "1", limit = "20" } = req.query as Record<string, string>;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const [tasks, total] = await Promise.all([
            prisma.dailyTask.findMany({
                skip,
                take: limitNum,
                orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            }),
            prisma.dailyTask.count(),
        ]);

        res.json({
            data: tasks,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error("Error fetching daily tasks:", error);
        res.status(500).json({ error: "Failed to fetch daily tasks" });
    }
};

export const createTask = async (req: AuthRequest, res: Response) => {
    try {
        const { date, taskText, company, priority, owner, status, deadline, notes } = req.body;

        const task = await prisma.dailyTask.create({
            data: {
                date: new Date(date),
                taskText,
                company,
                priority,
                owner,
                status: status || "not started",
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
