import { Response } from "express";
import { AuthRequest } from "../types/index.js";
/**
 * GET /api/new-suppliers
 */
export declare function listNewSuppliers(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/new-suppliers/:id
 */
export declare function getNewSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /api/new-suppliers
 */
export declare function createNewSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * PUT /api/new-suppliers/:id
 */
export declare function updateNewSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * PATCH /api/new-suppliers/:id/stage
 */
export declare function updateNewSupplierStage(req: AuthRequest, res: Response): Promise<void>;
/**
 * DELETE /api/new-suppliers/:id
 */
export declare function deleteNewSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/new-suppliers/export/csv
 */
export declare function exportNewSuppliersCsv(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/new-suppliers/filters
 */
export declare function getNewSupplierFilters(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=newSuppliers.controller.d.ts.map