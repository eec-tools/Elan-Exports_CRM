import prisma from "../config/db.js";
/**
 * Creates a notification visible to all users.
 * Each user tracks their own read state via NotificationRead.
 * Silently swallows errors so a notification failure never breaks the main action.
 */
export async function createNotification(params) {
    try {
        await prisma.notification.create({ data: params });
    }
    catch (err) {
        console.error("[NotificationService] Failed to create notification:", err);
    }
}
//# sourceMappingURL=notificationService.js.map