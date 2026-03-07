import { Response } from "express";
import { AuthRequest } from "../types/index.js";
/**
 * GET /api/settings/:key
 */
export declare function getSetting(req: AuthRequest, res: Response): Promise<void>;
/**
 * PUT /api/settings/:key
 */
export declare function updateSetting(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=settings.controller.d.ts.map