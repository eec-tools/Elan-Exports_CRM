import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

const DEFAULT_CONFIG = {
    identity: { enabled: true, requiredFields: ["company"] },
    contacts: { enabled: true, requiredFields: ["email"] },
    products: { enabled: true, requiredFields: [] },
    production: { enabled: false, requiredFields: [] },
    commercial: { enabled: false, requiredFields: [] },
    regulatory: { enabled: false, requiredFields: [] },
    certifications: { enabled: false, requiredFields: [] },
    organic: { enabled: false, requiredFields: [] },
    labTesting: { enabled: false, requiredFields: [] },
    branding: { enabled: false, requiredFields: [] },
    processing: { enabled: false, requiredFields: [] },
    media: { enabled: true, requiredFields: [] },
};

/**
 * GET /api/supplier-form-templates
 */
export async function listTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
        const templates = await (prisma as any).supplierFormTemplate.findMany({
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        });
        res.json(templates);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch templates" });
    }
}

/**
 * GET /api/supplier-form-templates/:id
 */
export async function getTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const template = await (prisma as any).supplierFormTemplate.findUnique({
            where: { id: req.params.id },
        });
        if (!template) {
            res.status(404).json({ error: "Template not found" });
            return;
        }
        res.json(template);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch template" });
    }
}

/**
 * POST /api/supplier-form-templates
 */
export async function createTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { name, config, isDefault } = req.body;

        if (!name) {
            res.status(400).json({ error: "Template name is required" });
            return;
        }

        // If setting as default, unset other defaults
        if (isDefault) {
            await (prisma as any).supplierFormTemplate.updateMany({
                where: { isDefault: true },
                data: { isDefault: false },
            });
        }

        const template = await (prisma as any).supplierFormTemplate.create({
            data: {
                name,
                config: config ?? DEFAULT_CONFIG,
                isDefault: isDefault ?? false,
                createdBy: req.user!.id,
            },
        });

        res.status(201).json(template);
    } catch (err) {
        res.status(500).json({ error: "Failed to create template" });
    }
}

/**
 * PUT /api/supplier-form-templates/:id
 */
export async function updateTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { name, config, isDefault } = req.body;

        const existing = await (prisma as any).supplierFormTemplate.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Template not found" });
            return;
        }

        if (isDefault) {
            await (prisma as any).supplierFormTemplate.updateMany({
                where: { isDefault: true, id: { not: id } },
                data: { isDefault: false },
            });
        }

        const updated = await (prisma as any).supplierFormTemplate.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(config !== undefined && { config }),
                ...(isDefault !== undefined && { isDefault }),
            },
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: "Failed to update template" });
    }
}

/**
 * DELETE /api/supplier-form-templates/:id
 */
export async function deleteTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        await (prisma as any).supplierFormTemplate.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete template" });
    }
}
