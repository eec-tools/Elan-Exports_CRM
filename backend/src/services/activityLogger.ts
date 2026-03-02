import prisma from "../config/db.js";
import { Prisma } from "@prisma/client";

/**
 * Log an activity event to the database
 */
export async function logActivity(
  userId: string | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: userId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        details: (details as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    // Don't let logging failures break the main operation
    console.error("Failed to log activity:", err);
  }
}
