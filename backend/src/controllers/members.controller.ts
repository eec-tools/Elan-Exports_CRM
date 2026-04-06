import { Request, Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { hashPassword } from "../utils/password.js";
import { logActivity } from "../services/activityLogger.js";
import { sendCredentialsEmail } from "../services/mailer.js";
import { Permission, AccessLevel } from "@prisma/client";

/**
 * GET /api/members
 */
export async function listMembers(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const members = await prisma.user.findMany({
      include: {
        roles: { select: { role: true } },
        permissions: { select: { permission: true, accessLevel: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      members.map((m) => ({
        id: m.id,
        email: m.email,
        fullName: m.fullName,
        isActive: m.isActive,
        createdAt: m.createdAt,
        roles: m.roles.map((r) => r.role),
        permissions: m.permissions.map((p) => ({
          permission: p.permission,
          accessLevel: p.accessLevel,
        })),
        assignedCompanies: m.assignedCompanies || [],
      })),
    );
  } catch (err) {
    console.error("List members error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/members
 */
export async function createMember(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { email, fullName, password, role, permissions, assignedCompanies } = req.body;

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        assignedCompanies: assignedCompanies || [],
        roles: {
          create: { role: role || "member" },
        },
        permissions: {
          create: (permissions || []).map(
            (p: { permission: Permission; accessLevel?: AccessLevel }) => ({
              permission: p.permission,
              accessLevel: p.accessLevel || "edit",
            }),
          ),
        },
      },
      include: {
        roles: { select: { role: true } },
        permissions: { select: { permission: true, accessLevel: true } },
      },
    });

    await logActivity(req.user!.id, "create", "members", user.id, {
      email: user.email,
      fullName: user.fullName,
    });

    res.status(201).json({
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
    });
  } catch (err) {
    console.error("Create member error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/members/:id
 */
export async function updateMember(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const { email, fullName, password, role, permissions, assignedCompanies } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    // If email is changed, ensure uniqueness
    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
    }

    const passwordHash = password
      ? await hashPassword(password)
      : existing.passwordHash;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        email: email ?? existing.email,
        fullName: fullName ?? existing.fullName,
        passwordHash,
        assignedCompanies: assignedCompanies !== undefined ? assignedCompanies : existing.assignedCompanies,
        roles: {
          deleteMany: {},
          create: { role: role || "member" },
        },
        permissions: {
          deleteMany: {},
          create: (permissions || []).map(
            (p: { permission: Permission; accessLevel?: AccessLevel }) => ({
              permission: p.permission,
              accessLevel: p.accessLevel || "edit",
            }),
          ),
        },
      },
      include: {
        roles: { select: { role: true } },
        permissions: { select: { permission: true, accessLevel: true } },
      },
    });

    await logActivity(req.user!.id, "update", "members", id, {
      email: updated.email,
      fullName: updated.fullName,
    });

    res.json({
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      isActive: updated.isActive,
      roles: updated.roles.map((r) => r.role),
      permissions: updated.permissions.map((p) => ({
        permission: p.permission,
        accessLevel: p.accessLevel,
      })),
      assignedCompanies: updated.assignedCompanies || [],
    });
  } catch (err) {
    console.error("Update member error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/members/:id
 */
export async function deleteMember(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    // Can't delete yourself
    if (id === req.user!.id) {
      res.status(400).json({ error: "Cannot delete your own account" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    // Must be inactive before deletion
    if (user.isActive) {
      res.status(400).json({ error: "Deactivate the member before deleting" });
      return;
    }

    // Delete related records that have FK constraints before deleting the user
    await prisma.accessRequest.deleteMany({
      where: { OR: [{ userId: id }, { reviewedBy: id }] },
    });

    await prisma.user.delete({ where: { id } });

    await logActivity(req.user!.id, "delete", "members", id, {
      email: user.email,
      targetUserEmail: user.email,
    });

    res.json({ message: "Member deleted" });
  } catch (err) {
    console.error("Delete member error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/members/:id/permissions
 */
export async function updatePermissions(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const { permissions } = req.body as {
      permissions: { permission: Permission; accessLevel: AccessLevel }[];
    };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    // Delete existing and recreate
    await prisma.userPermission.deleteMany({ where: { userId: id } });
    await prisma.userPermission.createMany({
      data: permissions.map((p) => ({
        userId: id as string,
        permission: p.permission,
        accessLevel: p.accessLevel,
      })),
    });

    await logActivity(req.user!.id, "update_permissions", "members", id, {
      targetUserEmail: user.email,
      permissions,
    });

    res.json({ message: "Permissions updated" });
  } catch (err) {
    console.error("Update permissions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/members/:id/status
 */
export async function updateStatus(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (id === req.user!.id) {
      res.status(400).json({ error: "Cannot change your own status" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    await prisma.user.update({
      where: { id },
      data: { isActive },
    });

    await logActivity(
      req.user!.id,
      isActive ? "activate" : "deactivate",
      "members",
      id,
      { targetUserEmail: user.email },
    );

    res.json({ message: `Member ${isActive ? "activated" : "deactivated"}` });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/members/:id/passkey
 */
export async function setPasskey(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { passkey } = req.body;

    await prisma.appSetting.upsert({
      where: { key: "sensitive_data_passkey" },
      update: { value: passkey },
      create: { key: "sensitive_data_passkey", value: passkey },
    });

    res.json({ message: "Passkey updated" });
  } catch (err) {
    console.error("Set passkey error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/members/:id/send-credentials
 */
export async function sendCredentials(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const loginUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/login`
      : "http://localhost:5173/login";

    await sendCredentialsEmail({
      to: user.email,
      fullName: user.fullName,
      email: user.email,
      password,
      loginUrl,
    });

    res.json({ message: "Credentials sent" });
  } catch (err: any) {
    console.error("Send credentials error:", err);
    const message = err?.message || "Failed to send email";
    res.status(500).json({ error: `Failed to send email: ${message}` });
  }
}
