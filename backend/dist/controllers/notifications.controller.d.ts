import { Response } from "express";
import { AuthRequest } from "../types/index.js";
/**
 * GET /api/notifications?unreadOnly=true
 * Returns all notifications with an `isRead` boolean for the current user.
 */
export declare function listNotifications(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/notifications/unread-count
 */
export declare function getUnreadCount(req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /api/notifications/:id/read
 * Mark a single notification as read for the current user.
 */
export declare function markOneRead(req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /api/notifications/read-all
 * Mark all unread notifications as read for the current user.
 */
export declare function markAllRead(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=notifications.controller.d.ts.map