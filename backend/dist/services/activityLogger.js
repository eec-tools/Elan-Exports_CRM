import prisma from "../config/db.js";
/**
 * Log an activity event to the database
 */
export async function logActivity(userId, action, entityType, entityId, details) {
    try {
        await prisma.activityLog.create({
            data: {
                userId: userId ?? null,
                action,
                entityType,
                entityId: entityId ?? null,
                details: details ?? undefined,
            },
        });
    }
    catch (err) {
        // Don't let logging failures break the main operation
        console.error("Failed to log activity:", err);
    }
}
//# sourceMappingURL=activityLogger.js.map