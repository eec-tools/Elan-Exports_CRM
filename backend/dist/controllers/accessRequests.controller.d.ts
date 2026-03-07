import { Response } from "express";
import { AuthRequest } from "../types/index.js";
/**
 * GET /api/access-requests
 * Admin sees all, member sees own
 */
export declare function listAccessRequests(req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /api/access-requests
 */
export declare function createAccessRequest(req: AuthRequest, res: Response): Promise<void>;
/**
 * PUT /api/access-requests/:id
 * Approve or reject (admin only)
 */
export declare function reviewAccessRequest(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=accessRequests.controller.d.ts.map