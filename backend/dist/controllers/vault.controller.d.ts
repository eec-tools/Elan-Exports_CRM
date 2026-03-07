import { Request, Response, NextFunction } from "express";
import multer from "multer";
export declare const upload: multer.Multer;
/** GET /api/vault - list all vault documents (optional ?category=) */
export declare function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void>;
/** GET /api/vault/categories - get category names + doc counts */
export declare function getCategories(_req: Request, res: Response, next: NextFunction): Promise<void>;
/** POST /api/vault/upload - upload a new document */
export declare function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void>;
/** PUT /api/vault/:id - edit document metadata (name, category, region) */
export declare function editDocument(req: Request, res: Response, next: NextFunction): Promise<void>;
/** DELETE /api/vault/:id - delete a document and its Cloudinary file */
export declare function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=vault.controller.d.ts.map