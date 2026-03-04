import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getEmailTasks = async (req: Request, res: Response) => {
    try {
        const tasks = await prisma.emailTracker.findMany({
            orderBy: { dateReceived: "desc" },
        });
        res.json(tasks);
    } catch (error) {
        console.error("Error fetching email tasks:", error);
        res.status(500).json({ error: "Failed to fetch email tasks" });
    }
};

export const getEmailTaskStats = async (req: Request, res: Response) => {
    try {
        const total = await prisma.emailTracker.count();
        const newTasks = await prisma.emailTracker.count({ where: { status: "Not Started" } });
        const inProgress = await prisma.emailTracker.count({ where: { status: "In Progress" } });
        const completed = await prisma.emailTracker.count({ where: { status: "Completed" } });

        res.json({ total, newTasks, inProgress, completed });
    } catch (error) {
        console.error("Error fetching email task stats:", error);
        res.status(500).json({ error: "Failed to fetch email task stats" });
    }
};

export const updateEmailTask = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { status, respondent, priority, task, productCategory, notes } = req.body;

    try {
        const updatedTask = await prisma.emailTracker.update({
            where: { id },
            data: {
                status,
                respondent,
                priority,
                task,
                productCategory,
                notes,
            },
        });
        res.json(updatedTask);
    } catch (error) {
        console.error("Error updating email task:", error);
        res.status(500).json({ error: "Failed to update email task" });
    }
};

export const deleteEmailTask = async (req: Request, res: Response) => {
    const id = req.params.id as string;

    try {
        await prisma.emailTracker.delete({
            where: { id },
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting email task:", error);
        res.status(500).json({ error: "Failed to delete email task" });
    }
};
