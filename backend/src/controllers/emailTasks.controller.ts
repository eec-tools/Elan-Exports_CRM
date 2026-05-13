import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logActivity } from "../services/activityLogger.js";
import { AuthRequest } from "../types/index.js";
import { syncAllGmailAccounts, syncGmailInbox, getAccountSyncStatuses } from "../services/gmailInboxService.js";

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
      gmailAccount,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (gmailAccount) where.gmailAccount = gmailAccount;
    if (task) where.task = task;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (respondent) {
      if (respondent === "Unassigned") {
        where.OR = [{ respondent: null }, { respondent: "" }];
      } else {
        where.respondent = { contains: respondent, mode: "insensitive" };
      }
    }
    if (search) {
      const searchConditions = [
        { subject: { contains: search, mode: "insensitive" } },
        { senderAddress: { contains: search, mode: "insensitive" } },
        { bodyPreview: { contains: search, mode: "insensitive" } },
      ];
      // Merge with existing OR if respondent=Unassigned was set
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
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

export const getEmailTaskStats = async (req: AuthRequest, res: Response) => {
  try {
    const { gmailAccount } = req.query as Record<string, string>;
    const where: any = {};
    if (gmailAccount) where.gmailAccount = gmailAccount;

    const [total, newTasks, inProgress, completed, urgentHigh] = await Promise.all([
      prisma.emailTracker.count({ where }),
      prisma.emailTracker.count({ where: { ...where, status: "Not Started" } }),
      prisma.emailTracker.count({ where: { ...where, status: "In Progress" } }),
      prisma.emailTracker.count({ where: { ...where, status: "Completed" } }),
      prisma.emailTracker.count({ where: { ...where, priority: { in: ["Urgent", "High"] } } }),
    ]);

    res.json({ total, newTasks, inProgress, completed, urgentHigh });
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
      data: { status, respondent, priority, task, productCategory, notes },
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
    await prisma.emailTracker.delete({ where: { id } });
    await logActivity(req.user?.id, "delete", "email_tasks", id, {});
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting email task:", error);
    res.status(500).json({ error: "Failed to delete email task" });
  }
};

// ─── Gmail Inbox Sync ─────────────────────────────────────────────────────────

export const triggerSync = async (req: AuthRequest, res: Response) => {
  try {
    const account = req.query.account as string | undefined;
    const result = account
      ? await syncGmailInbox(account)
      : await syncAllGmailAccounts();

    res.json({
      success: true,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      syncedAt: result.syncedAt,
    });
  } catch (err: any) {
    console.error("Manual Gmail sync failed:", err);
    res.status(500).json({ error: err?.message ?? "Sync failed" });
  }
};

export const getSyncStatus = async (_req: AuthRequest, res: Response) => {
  try {
    const accounts = await getAccountSyncStatuses();
    res.json({ accounts });
  } catch (error) {
    console.error("Error getting sync status:", error);
    res.status(500).json({ error: "Failed to get sync status" });
  }
};
