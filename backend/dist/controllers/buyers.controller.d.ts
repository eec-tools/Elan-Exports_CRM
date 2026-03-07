import { Response } from "express";
import { AuthRequest } from "../types/index.js";
/**
 * GET /api/buyers
 * Query params: search, page, limit, status, product
 */
export declare function listBuyers(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/buyers/stats
 */
export declare function getBuyerStats(_req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/buyers/cr-products
 * Returns unique product names where current_requirement = true
 */
export declare function getCrProducts(_req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/buyers/:id
 */
export declare function getBuyer(req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /api/buyers
 */
export declare function createBuyer(req: AuthRequest, res: Response): Promise<void>;
/**
 * PUT /api/buyers/:id
 */
export declare function updateBuyer(req: AuthRequest, res: Response): Promise<void>;
/**
 * DELETE /api/buyers/:id
 */
export declare function deleteBuyer(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/buyers/export/csv
 */
export declare function exportBuyersCsv(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=buyers.controller.d.ts.map