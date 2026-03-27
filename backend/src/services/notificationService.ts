import prisma from "../config/db.js";
import { broadcastToAll } from "./sse.js";

export interface CreateNotificationParams {
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  entityName: string;
  entityLink?: string;
  createdBy?: string;
}

/**
 * Creates a notification visible to all users.
 * Each user tracks their own read state via NotificationRead.
 * Silently swallows errors so a notification failure never breaks the main action.
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<void> {
  try {
    const notification = await prisma.notification.create({ data: params });
    broadcastToAll("notification", notification);
  } catch (err) {
    console.error("[NotificationService] Failed to create notification:", err);
  }
}
