import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

/**
 * GET /api/notifications?unreadOnly=true
 * Returns all notifications with an `isRead` boolean for the current user.
 */
export async function listNotifications(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const unreadOnly = req.query.unreadOnly === "true";

    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        reads: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    const result = notifications
      .map((n) => ({
        ...n,
        isRead: n.reads.length > 0,
        reads: undefined,
      }))
      .filter((n) => (unreadOnly ? !n.isRead : true));

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
}

/**
 * GET /api/notifications/unread-count
 */
export async function getUnreadCount(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;

    // Count notifications NOT in this user's read list
    const total = await prisma.notification.count();
    const readCount = await prisma.notificationRead.count({
      where: { userId },
    });

    // unread = total notifications minus ones this user has read
    // (capped at 0 to handle edge cases)
    const count = Math.max(0, total - readCount);

    res.json({ count });
  } catch {
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
}

/**
 * POST /api/notifications/:id/read
 * Mark a single notification as read for the current user.
 */
export async function markOneRead(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id as string;

    await prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId, userId } },
      update: {},
      create: { notificationId, userId },
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
}

/**
 * POST /api/notifications/read-all
 * Mark all unread notifications as read for the current user.
 */
export async function markAllRead(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;

    // Get IDs of notifications this user hasn't read yet
    const readIds = await prisma.notificationRead.findMany({
      where: { userId },
      select: { notificationId: true },
    });
    const alreadyReadSet = new Set(readIds.map((r) => r.notificationId));

    const allNotifications = await prisma.notification.findMany({
      select: { id: true },
    });

    const toCreate = allNotifications
      .filter((n) => !alreadyReadSet.has(n.id))
      .map((n) => ({ notificationId: n.id, userId }));

    if (toCreate.length > 0) {
      await prisma.notificationRead.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    res.json({ marked: toCreate.length });
  } catch {
    res.status(500).json({ error: "Failed to mark all as read" });
  }
}

/**
 * GET /api/notifications/stream
 * Establish an SSE connection for real-time notifications.
 */
import { addClient, removeClient } from "../services/sse.js";

export function streamNotifications(req: AuthRequest, res: Response) {
  const userId = req.user!.id;

  // Set necessary headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering for SSE
  res.flushHeaders();

  // Send an initial connected event
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  addClient(userId, res);

  // Heartbeat every 25s to prevent AWS/nginx idle timeout from dropping the connection
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
  });
}

