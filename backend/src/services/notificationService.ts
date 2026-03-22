import prisma from "../config/db.js";

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
    await prisma.notification.create({ data: params });
  } catch (err) {
    console.error("[NotificationService] Failed to create notification:", err);
  }
}
