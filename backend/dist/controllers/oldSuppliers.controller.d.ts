import { Response } from "express";
import { AuthRequest } from "../types/index.js";
/**
 * GET /api/old-suppliers
 */
export declare function listOldSuppliers(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/old-suppliers/:id
 */
export declare function getOldSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /api/old-suppliers
 */
export declare function createOldSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * PUT /api/old-suppliers/:id
 */
export declare function updateOldSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * PATCH /api/old-suppliers/:id/stage
 */
export declare function updateOldSupplierStage(req: AuthRequest, res: Response): Promise<void>;
/**
 * DELETE /api/old-suppliers/:id
 */
export declare function deleteOldSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/old-suppliers/export/csv
 */
export declare function exportOldSuppliersCsv(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/old-suppliers/filters
 */
export declare function getOldSupplierFilters(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=oldSuppliers.controller.d.ts.map