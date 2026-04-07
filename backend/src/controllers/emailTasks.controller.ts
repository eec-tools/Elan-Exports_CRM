import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logActivity } from "../services/activityLogger.js";
import { AuthRequest } from "../types/index.js";
import { syncOutlookEmails, getLastSyncInfo } from "../services/outlookService.js";

const prisma = new PrismaClient();

export const getEmailTasks = async (req: AuthRequest, res: Response) => {
    try {
        const {
            page = "1",
            limit = "20",
            task,
            priority,
            status,
            respondent,
            search,
        } = req.query as Record<string, string>;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};
        if (task) where.task = task;
        if (priority) where.priority = priority;
        if (status) where.status = status;
        if (respondent) {
            if (respondent === "Unassigned") {
                where.OR = [
                    { respondent: null },
                    { respondent: "" }
                ];
            } else {
                where.respondent = { contains: respondent, mode: "insensitive" };
            }
        }
        if (search) {
            where.OR = [
                { subject: { contains: search, mode: "insensitive" } },
                { senderAddress: { contains: search, mode: "insensitive" } },
                { bodyPreview: { contains: search, mode: "insensitive" } },
            ];
        }

        const [tasks, total] = await Promise.all([
            prisma.emailTracker.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { dateReceived: "desc" },
            }),
            prisma.emailTracker.count({ where }),
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
        console.error("Error fetching email tasks:", error);
        res.status(500).json({ error: "Failed to fetch email tasks" });
    }
};

export const getEmailTaskStats = async (_req: AuthRequest, res: Response) => {
    try {
        const [total, newTasks, inProgress, completed] = await Promise.all([
            prisma.emailTracker.count(),
            prisma.emailTracker.count({ where: { status: "Not Started" } }),
            prisma.emailTracker.count({ where: { status: "In Progress" } }),
            prisma.emailTracker.count({ where: { status: "Completed" } }),
        ]);

        res.json({ total, newTasks, inProgress, completed });
    } catch (error) {
        console.error("Error fetching email task stats:", error);
        res.status(500).json({ error: "Failed to fetch email task stats" });
    }
};

export const updateEmailTask = async (req: AuthRequest, res: Response) => {
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

        await logActivity(req.user?.id, "update", "email_tasks", updatedTask.id, {
            status,
            respondent,
            priority,
            task,
            productCategory,
        });

        res.json(updatedTask);
    } catch (error) {
        console.error("Error updating email task:", error);
        res.status(500).json({ error: "Failed to update email task" });
    }
};

export const deleteEmailTask = async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;

    try {
        await prisma.emailTracker.delete({
            where: { id },
        });

        await logActivity(req.user?.id, "delete", "email_tasks", id, {});

        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting email task:", error);
        res.status(500).json({ error: "Failed to delete email task" });
    }
};

// ─── Outlook Sync ─────────────────────────────────────────────────────────────

export const triggerSync = async (_req: AuthRequest, res: Response) => {
    try {
        const result = await syncOutlookEmails();
        res.json({
            success: true,
            inserted: result.inserted,
            skipped: result.skipped,
            errors: result.errors,
            syncedAt: result.syncedAt,
        });
    } catch (err: any) {
        console.error("Manual sync failed:", err);
        res.status(500).json({ error: err?.message ?? "Sync failed" });
    }
};

export const getSyncStatus = async (_req: AuthRequest, res: Response) => {
    try {
        const info = await getLastSyncInfo();
        res.json(info);
    } catch (error) {
        console.error("Error getting sync status:", error);
        res.status(500).json({ error: "Failed to get sync status" });
    }
};
