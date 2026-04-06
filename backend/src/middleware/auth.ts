import { Response, NextFunction } from "express";
import { Permission, AccessLevel } from "@prisma/client";
import { verifyToken } from "../utils/jwt.js";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

/**
 * Decode JWT, load user with roles & permissions, attach to req.user
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    let token = "";
    if (header?.startsWith("Bearer ")) {
      token = header.slice(7);
    } else if (req.query.token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (!token) {
      res.status(401).json({ error: "Missing or invalid token" });
      return;
    }

    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        roles: { select: { role: true } },
        permissions: { select: { permission: true, accessLevel: true } },
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      roles: user.roles.map((r) => r.role),
      permissions: user.permissions.map((p) => ({
        permission: p.permission,
        accessLevel: p.accessLevel,
      })),
      assignedCompanies: user.assignedCompanies || [],
    };

    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Require the user to have the 'admin' role
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user?.roles.includes("admin")) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

/**
 * Require admin role OR the specified permission (read or edit)
 */
export function requirePermission(perm: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.user?.roles.includes("admin")) {
      next();
      return;
    }

    const has = req.user?.permissions.find((p) => p.permission === perm);
    if (!has) {
      res.status(403).json({ error: `Permission '${perm}' required` });
      return;
    }
    next();
  };
}

/**
 * Require admin role OR the specified permission with 'edit' access level
 */
export function requireEdit(perm: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.user?.roles.includes("admin")) {
      next();
      return;
    }

    const has = req.user?.permissions.find(
      (p) => p.permission === perm && p.accessLevel === "edit",
    );
    if (!has) {
      res.status(403).json({ error: `Edit permission for '${perm}' required` });
      return;
    }
    next();
  };
}
