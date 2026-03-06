import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getTasks = async (req: Request, res: Response) => {
    try {
        const tasks = await prisma.dailyTask.findMany({
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        });
        res.json(tasks);
    } catch (error) {
        console.error("Error fetching daily tasks:", error);
        res.status(500).json({ error: "Failed to fetch daily tasks" });
    }
};

export const createTask = async (req: Request, res: Response) => {
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

        res.status(201).json(task);
    } catch (error) {
        console.error("Error creating daily task:", error);
        res.status(500).json({ error: "Failed to create daily task" });
    }
};

export const updateTask = async (req: Request, res: Response) => {
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

        res.json(task);
    } catch (error) {
        console.error("Error updating daily task:", error);
        res.status(500).json({ error: "Failed to update daily task" });
    }
};

export const deleteTask = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.dailyTask.delete({
            where: { id: id as string },
        });
        res.json({ message: "Task deleted successfully" });
    } catch (error) {
        console.error("Error deleting daily task:", error);
        res.status(500).json({ error: "Failed to delete daily task" });
    }
};
