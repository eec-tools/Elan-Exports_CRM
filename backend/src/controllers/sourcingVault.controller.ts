import { Response } from "express";
import { randomUUID } from "crypto";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

/**
 * GET /api/sourcing-vault
 * Returns all vault folders, each enriched with a SourcingVaultSupplier count.
 */
export async function listFolders(req: AuthRequest, res: Response): Promise<void> {
    try {
        const folders = await (prisma as any).sourcingVaultFolder.findMany({
            orderBy: { createdAt: "asc" },
            include: { creator: { select: { fullName: true } } },
        });

        const counts = await Promise.all(
            folders.map((f: any) =>
                (prisma as any).sourcingVaultSupplier.count({ where: { folderId: f.id } })
            )
        );

        const result = folders.map((f: any, i: number) => ({
            ...f,
            supplierCount: counts[i],
        }));

        res.json(result);
    } catch (err) {
        console.error("List vault folders error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * POST /api/sourcing-vault
 * Creates a new folder.
 */
export async function createFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { name } = req.body as { name: string };

        if (!name?.trim()) {
            res.status(400).json({ error: "Folder name is required" });
            return;
        }

        const trimmed = name.trim();

        const existing = await (prisma as any).sourcingVaultFolder.findFirst({
            where: { name: { equals: trimmed, mode: "insensitive" } },
        });
        if (existing) {
            res.status(409).json({ error: `A folder named "${trimmed}" already exists` });
            return;
        }

        const folder = await (prisma as any).sourcingVaultFolder.create({
            data: { name: trimmed, createdBy: req.user!.id },
            include: { creator: { select: { fullName: true } } },
        });

        res.status(201).json({ ...folder, supplierCount: 0 });
    } catch (err) {
        console.error("Create vault folder error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * DELETE /api/sourcing-vault/:id
 */
export async function deleteFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const folder = await (prisma as any).sourcingVaultFolder.findUnique({ where: { id } });
        if (!folder) {
            res.status(404).json({ error: "Folder not found" });
            return;
        }

        await (prisma as any).sourcingVaultFolder.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        console.error("Delete vault folder error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/sourcing-vault/:folderId/suppliers
 * Returns vault suppliers for a folder, with optional ?emailStatus and ?createdBy filters.
 */
export async function listVaultSuppliers(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { folderId } = req.params as { folderId: string };
        const { emailStatus, createdBy, search } = req.query as Record<string, string>;

        const where: any = { folderId };
        if (emailStatus) where.emailStatus = emailStatus;
        if (createdBy && createdBy !== "all") where.createdBy = createdBy;
        if (search) {
            where.OR = [
                { company: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { contactPerson: { contains: search, mode: "insensitive" } },
                { country: { contains: search, mode: "insensitive" } },
                { product: { contains: search, mode: "insensitive" } },
            ];
        }

        const suppliers = await (prisma as any).sourcingVaultSupplier.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: { creator: { select: { fullName: true } } },
        });

        res.json(suppliers);
    } catch (err) {
        console.error("List vault suppliers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * POST /api/sourcing-vault/:folderId/suppliers
 * "Add to List" — stages suppliers in the vault with emailStatus = "Not Sent".
 * Does NOT create SourcingSupplier pipeline records.
 */
export async function addToList(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { folderId } = req.params as { folderId: string };
        const { suppliers } = req.body as {
            suppliers: Array<{
                company: string;
                email?: string;
                phone?: string;
                contactPerson?: string;
                country?: string;
                product?: string;
                notes?: string;
            }>;
        };

        const folder = await (prisma as any).sourcingVaultFolder.findUnique({ where: { id: folderId } });
        if (!folder) {
            res.status(404).json({ error: "Folder not found" });
            return;
        }

        if (!Array.isArray(suppliers) || suppliers.length === 0) {
            res.status(400).json({ error: "No suppliers provided" });
            return;
        }

        const validRows = suppliers.filter((s) => s.company?.trim());
        if (validRows.length === 0) {
            res.status(400).json({ error: "All rows are missing company name" });
            return;
        }

        const data = validRows.map((s) => ({
            folderId,
            company: s.company.trim(),
            email: s.email?.trim() || null,
            phone: s.phone?.trim() || null,
            contactPerson: s.contactPerson?.trim() || null,
            country: s.country?.trim() || null,
            product: s.product?.trim() || null,
            notes: s.notes?.trim() || null,
            emailStatus: "Not Sent",
            createdBy: req.user!.id,
        }));

        const result = await (prisma as any).sourcingVaultSupplier.createMany({ data });

        res.status(201).json({ added: result.count });
    } catch (err) {
        console.error("Add to list error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * POST /api/sourcing-vault/:folderId/suppliers/send
 * "Send Bulk Email" — stages suppliers with emailStatus = "Sent" AND creates
 * SourcingSupplier pipeline records.
 */
export async function sendBulkEmail(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { folderId } = req.params as { folderId: string };
        const { suppliers, assignedGmailAccount, formTemplateId } = req.body as {
            suppliers: Array<{
                company: string;
                email?: string;
                phone?: string;
                contactPerson?: string;
                country?: string;
                product?: string;
                notes?: string;
            }>;
            assignedGmailAccount?: string;
            formTemplateId?: string;
        };

        const folder = await (prisma as any).sourcingVaultFolder.findUnique({ where: { id: folderId } });
        if (!folder) {
            res.status(404).json({ error: "Folder not found" });
            return;
        }

        if (!Array.isArray(suppliers) || suppliers.length === 0) {
            res.status(400).json({ error: "No suppliers provided" });
            return;
        }

        const validRows = suppliers.filter((s) => s.company?.trim());
        if (validRows.length === 0) {
            res.status(400).json({ error: "All rows are missing company name" });
            return;
        }

        await (prisma as any).$transaction(async (tx: any) => {
            await tx.sourcingVaultSupplier.createMany({
                data: validRows.map((s) => ({
                    folderId,
                    company: s.company.trim(),
                    email: s.email?.trim() || null,
                    phone: s.phone?.trim() || null,
                    contactPerson: s.contactPerson?.trim() || null,
                    country: s.country?.trim() || null,
                    product: s.product?.trim() || null,
                    notes: s.notes?.trim() || null,
                    emailStatus: "Sent",
                    createdBy: req.user!.id,
                })),
            });

            await tx.sourcingSupplier.createMany({
                data: validRows.map((s) => ({
                    company: s.company.trim(),
                    email: s.email?.trim() || null,
                    phone: s.phone?.trim() || null,
                    contactPerson: s.contactPerson?.trim() || null,
                    country: s.country?.trim() || null,
                    product: s.product?.trim() || null,
                    notes: s.notes?.trim() || null,
                    productCategory: folder.name,
                    assignedGmailAccount: assignedGmailAccount ?? null,
                    formToken: randomUUID(),
                    status: "pending",
                    supplierStage: "Sourcing",
                    buyerIds: [],
                    supplierProducts: [],
                    productCatalogs: [],
                    productCatalogImages: [],
                    certificates: [],
                    warehousePhotos: [],
                    videoLinks: [],
                    quotations: [],
                    createdBy: req.user!.id,
                })),
                skipDuplicates: true,
            });
        });

        res.status(201).json({ added: validRows.length });
    } catch (err) {
        console.error("Send bulk email error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/sourcing-vault/:folderId/creators
 * Returns distinct employees who added vault suppliers to this folder.
 */
export async function listVaultCreators(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { folderId } = req.params as { folderId: string };

        const rows = await (prisma as any).sourcingVaultSupplier.findMany({
            where: { folderId, createdBy: { not: null } },
            select: { createdBy: true, creator: { select: { fullName: true } } },
            distinct: ["createdBy"],
            orderBy: { creator: { fullName: "asc" } },
        });

        const creators = rows
            .filter((r: any) => r.createdBy && r.creator)
            .map((r: any) => ({ id: r.createdBy as string, fullName: r.creator.fullName as string }));

        res.json(creators);
    } catch (err) {
        console.error("List vault creators error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
