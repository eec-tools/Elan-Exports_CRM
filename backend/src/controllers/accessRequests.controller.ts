import { Response } from "express";
import { Permission } from "@prisma/client";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

const VALID_PERMISSIONS = new Set<string>(Object.values(Permission));

/**
 * GET /api/access-requests
 * Admin sees all, member sees own
 */
export async function listAccessRequests(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const isAdmin = req.user!.roles.includes("admin");

    const where = isAdmin ? {} : { userId: req.user!.id };

    const requests = await prisma.accessRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { fullName: true, email: true } },
        reviewer: { select: { fullName: true, email: true } },
      },
    });

    res.json(requests);
  } catch (err) {
    console.error("List access requests error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/access-requests
 */
export async function createAccessRequest(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { permission, reason } = req.body;

    const request = await prisma.accessRequest.create({
      data: {
        userId: req.user!.id,
        permission,
        reason,
      },
    });

    res.status(201).json(request);
  } catch (err) {
    console.error("Create access request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/access-requests/:id
 * Approve or reject (admin only)
 */
export async function reviewAccessRequest(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body; // "approved" or "rejected"

    const request = await prisma.accessRequest.findUnique({ where: { id } });
    if (!request) {
      res.status(404).json({ error: "Access request not found" });
      return;
    }

    if (request.status !== "pending") {
      res.status(400).json({ error: "Request already reviewed" });
      return;
    }

    // Use a transaction so status update + permission grant succeed or fail together
    const updated = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.accessRequest.update({
        where: { id },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedBy: req.user!.id,
        },
      });

      // If approved, actually grant the permission
      if (status === "approved") {
        const permValue = request.permission;

        if (!VALID_PERMISSIONS.has(permValue)) {
          throw new Error(
            `Invalid permission value: "${permValue}". Valid values: ${[...VALID_PERMISSIONS].join(", ")}`,
          );
        }

        await tx.userPermission.upsert({
          where: {
            userId_permission: {
              userId: request.userId,
              permission: permValue as Permission,
            },
          },
          update: {},
          create: {
            userId: request.userId,
            permission: permValue as Permission,
            accessLevel: "edit",
          },
        });
      }

      return updatedRequest;
    });

    res.json(updated);
  } catch (err: any) {
    console.error("Review access request error:", err?.message);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

