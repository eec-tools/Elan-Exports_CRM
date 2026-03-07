import prisma from "../config/db.js";
import { signToken } from "../utils/jwt.js";
import { comparePassword } from "../utils/password.js";
import { logActivity } from "../services/activityLogger.js";
/**
 * POST /api/auth/login
 */
export async function login(req, res) {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                roles: { select: { role: true } },
                permissions: { select: { permission: true, accessLevel: true } },
            },
        });
        if (!user) {
            res.status(401).json({ error: "Invalid email or password" });
            return;
        }
        if (!user.isActive) {
            res.status(403).json({ error: "Account is deactivated" });
            return;
        }
        const valid = await comparePassword(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: "Invalid email or password" });
            return;
        }
        const token = signToken({ userId: user.id, email: user.email });
        await logActivity(user.id, "login", "auth");
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                isActive: user.isActive,
                roles: user.roles.map((r) => r.role),
                permissions: user.permissions.map((p) => ({
                    permission: p.permission,
                    accessLevel: p.accessLevel,
                })),
            },
        });
    }
    catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * GET /api/auth/me
 */
export async function getMe(req, res) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                roles: { select: { role: true } },
                permissions: { select: { permission: true, accessLevel: true } },
            },
        });
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        res.json({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            isActive: user.isActive,
            createdAt: user.createdAt,
            roles: user.roles.map((r) => r.role),
            permissions: user.permissions.map((p) => ({
                permission: p.permission,
                accessLevel: p.accessLevel,
            })),
        });
    }
    catch (err) {
        console.error("GetMe error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
//# sourceMappingURL=auth.controller.js.map