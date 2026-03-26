import { Request, Response } from "express";
import { AuthRequest } from "../types/index.js";
import multer from "multer";
export declare const uploadSupplierFile: multer.Multer;
/**
 * GET /api/suppliers
 */
export declare function listSuppliers(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/suppliers/:id
 */
export declare function getSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /api/suppliers
 */
export declare function createSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * PUT /api/suppliers/:id
 */
export declare function updateSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * PATCH /api/suppliers/:id/stage
 */
export declare function updateSupplierStage(req: AuthRequest, res: Response): Promise<void>;
/**
 * DELETE /api/suppliers/:id
 */
export declare function deleteSupplier(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/suppliers/export/csv
 */
export declare function exportSuppliersCsv(req: AuthRequest, res: Response): Promise<void>;
/**
 * POST /api/suppliers/upload
 */
export declare function uploadCatalog(req: Request, res: Response): Promise<void>;
/**
 * GET /api/suppliers/stats
 */
export declare function getSupplierStats(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/suppliers/filters
 */
export declare function getSupplierFilters(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=suppliers.controller.d.ts.map