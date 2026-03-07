import { Response } from "express";
import { AuthRequest } from "../types/index.js";
/**
 * GET /api/reports
 */
export declare function listReports(req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /api/reports
 */
export declare function createReport(req: AuthRequest, res: Response): Promise<void>;
/**
 * PUT /api/reports/:id
 */
export declare function updateReport(req: AuthRequest, res: Response): Promise<void>;
/**
 * DELETE /api/reports/:id
 */
export declare function deleteReport(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=reports.controller.d.ts.map