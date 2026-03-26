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
export declare function createNotification(params: CreateNotificationParams): Promise<void>;
//# sourceMappingURL=notificationService.d.ts.map