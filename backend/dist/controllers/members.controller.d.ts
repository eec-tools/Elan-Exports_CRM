import { Response } from "express";
import { AuthRequest } from "../types/index.js";
/**
 * GET /api/members
 */
export declare function listMembers(_req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /api/members
 */
export declare function createMember(req: AuthRequest, res: Response): Promise<void>;
/**
 * PUT /api/members/:id
 */
export declare function updateMember(req: AuthRequest, res: Response): Promise<void>;
/**
 * DELETE /api/members/:id
 */
export declare function deleteMember(req: AuthRequest, res: Response): Promise<void>;
/**
 * PUT /api/members/:id/permissions
 */
export declare function updatePermissions(req: AuthRequest, res: Response): Promise<void>;
/**
 * PUT /api/members/:id/status
 */
export declare function updateStatus(req: AuthRequest, res: Response): Promise<void>;
/**
 * PUT /api/members/:id/passkey
 */
export declare function setPasskey(req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /api/members/:id/send-credentials
 */
export declare function sendCredentials(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=members.controller.d.ts.map