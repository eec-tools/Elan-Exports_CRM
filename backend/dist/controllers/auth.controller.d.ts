import { Request, Response } from "express";
import { AuthRequest } from "../types/index.js";
/**
 * POST /api/auth/login
 */
export declare function login(req: Request, res: Response): Promise<void>;
/**
 * GET /api/auth/me
 */
export declare function getMe(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map