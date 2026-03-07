import { Response, NextFunction } from "express";
import { Permission } from "@prisma/client";
import { AuthRequest } from "../types/index.js";
/**
 * Decode JWT, load user with roles & permissions, attach to req.user
 */
export declare function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Require the user to have the 'admin' role
 */
export declare function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void;
/**
 * Require admin role OR the specified permission (read or edit)
 */
export declare function requirePermission(perm: Permission): (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Require admin role OR the specified permission with 'edit' access level
 */
export declare function requireEdit(perm: Permission): (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map