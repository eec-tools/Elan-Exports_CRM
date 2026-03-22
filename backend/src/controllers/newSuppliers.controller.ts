import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { logActivity } from "../services/activityLogger.js";

/**
 * GET /api/new-suppliers
 */
export async function listNewSuppliers(
    req: AuthRequest,
    res: Response,
): Promise<void> {
    try {
        const {
            search = "",
            page = "1",
            limit = "20",
            status,
            country,
            productCategory,
            accountManager,
            product,
            certifications,
            dateFrom,
            dateTo
        } = req.query as Record<string, string>;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};

        if (search) {
            where.OR = [
                { company: { contains: search, mode: "insensitive" } },
                { country: { contains: search, mode: "insensitive" } },
                { productCategory: { contains: search, mode: "insensitive" } },
                { product: { contains: search, mode: "insensitive" } },
                { accountManager: { contains: search, mode: "insensitive" } },
                { currentStatus: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
            ];
        }

        if (status && status !== "all") {
            where.currentStatus = status;
        }
        if (country && country !== "all") {
            where.country = country;
        }
        if (productCategory && productCategory !== "all") {
            where.productCategory = productCategory;
        }
        if (accountManager && accountManager !== "all") {
            where.accountManager = accountManager;
        }
        if (product && product !== "all") {
            where.product = product;
        }
        if (certifications && certifications !== "all") {
            where.certifications = certifications;
        }
        const dateFilter: any = {};
        if (dateFrom && dateFrom !== "all") {
            dateFilter.gte = new Date(`${dateFrom}T00:00:00.000Z`);
        }
        if (dateTo && dateTo !== "all") {
            dateFilter.lte = new Date(`${dateTo}T23:59:59.999Z`);
        }
        if (Object.keys(dateFilter).length > 0) {
            where.createdAt = dateFilter;
        }

        const [suppliers, total] = await Promise.all([
            (prisma as any).newSupplier.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: "desc" },
            }),
            (prisma as any).newSupplier.count({ where }),
        ]);

        res.json({
            data: suppliers,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    } catch (err) {
        console.error("List new suppliers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/new-suppliers/:id
 */
export async function getNewSupplier(
    req: AuthRequest,
    res: Response,
): Promise<void> {
    try {
        const supplier = await (prisma as any).newSupplier.findUnique({
            where: { id: req.params.id },
        });

        if (!supplier) {
            res.status(404).json({ error: "New supplier not found" });
            return;
        }

        res.json(supplier);
    } catch (err) {
        console.error("Get new supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * POST /api/new-suppliers
 */
export async function createNewSupplier(
    req: AuthRequest,
    res: Response,
): Promise<void> {
    try {
        const {
            company, productCategory, product, country, accountManager,
            currentStatus, certifications, latestQuotation, reasonInactive,
            dateMarkedInactive, reactivationPotential, notes, phone, email
        } = req.body;

        console.log("Creating new supplier with payload:", req.body);

        const supplier = await (prisma as any).newSupplier.create({
            data: {
                company, productCategory, product, country, accountManager,
                currentStatus, certifications, latestQuotation, reasonInactive,
                dateMarkedInactive, reactivationPotential, notes, phone, email,
                createdBy: req.user!.id,
            },
        });

        await logActivity(req.user!.id, "create", "new_suppliers", supplier.id, {
            company: supplier.company,
        });

        res.status(201).json(supplier);
    } catch (err) {
        console.error("Create new supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * PUT /api/new-suppliers/:id
 */
export async function updateNewSupplier(
    req: AuthRequest,
    res: Response,
): Promise<void> {
    try {
        const existing = await (prisma as any).newSupplier.findUnique({
            where: { id: req.params.id },
        });

        if (!existing) {
            res.status(404).json({ error: "New supplier not found" });
            return;
        }

        const {
            company, productCategory, product, country, accountManager,
            currentStatus, certifications, latestQuotation, reasonInactive,
            dateMarkedInactive, reactivationPotential, notes, phone, email
        } = req.body;

        console.log("Updating new supplier with payload:", req.body);

        const supplier = await (prisma as any).newSupplier.update({
            where: { id: req.params.id },
            data: {
                company, productCategory, product, country, accountManager,
                currentStatus, certifications, latestQuotation, reasonInactive,
                dateMarkedInactive, reactivationPotential, notes, phone, email
            },
        });

        await logActivity(req.user!.id, "update", "new_suppliers", supplier.id, {
            company: supplier.company,
        });

        res.json(supplier);
    } catch (err) {
        console.error("Update new supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * PATCH /api/new-suppliers/:id/stage
 */
export async function updateNewSupplierStage(
    req: AuthRequest,
    res: Response,
): Promise<void> {
    try {
        const { stage } = req.body;
        const existing = await (prisma as any).newSupplier.findUnique({
            where: { id: req.params.id },
        });

        if (!existing) {
            res.status(404).json({ error: "New supplier not found" });
            return;
        }

        if (stage === "Onboarding") {
            const supplier = await (prisma as any).newSupplier.update({
                where: { id: req.params.id },
                data: { supplierStage: stage },
            });
            await logActivity(req.user!.id, "update_stage", "new_suppliers", supplier.id, { company: supplier.company, stage });
            res.json(supplier);
            return;
        }

        const commonData = {
            company: existing.company,
            country: existing.country,
            certifications: existing.certifications,
            createdBy: req.user!.id,
            supplierStage: stage,
        };

        if (stage === "Signed") {
            const supplier = await (prisma as any).supplier.create({
                data: {
                    ...commonData,
                    email: existing.email,
                    phone: existing.phone,
                    remarks: existing.notes,
                },
            });
            await (prisma as any).newSupplier.delete({ where: { id: req.params.id } });
            await logActivity(req.user!.id, "move_to_suppliers", "new_suppliers", supplier.id, { company: existing.company });
            res.json(supplier);
        } else if (stage === "Closed") {
            const oldSupplier = await (prisma as any).oldSupplier.create({
                data: {
                    ...commonData,
                    notes: existing.notes,
                },
            });
            await (prisma as any).newSupplier.delete({ where: { id: req.params.id } });
            await logActivity(req.user!.id, "move_to_old_suppliers", "new_suppliers", oldSupplier.id, { company: existing.company });
            res.json(oldSupplier);
        } else {
            res.status(400).json({ error: "Invalid stage" });
        }
    } catch (err) {
        console.error("Update new supplier stage error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * DELETE /api/new-suppliers/:id
 */
export async function deleteNewSupplier(
    req: AuthRequest,
    res: Response,
): Promise<void> {
    try {
        const existing = await (prisma as any).newSupplier.findUnique({
            where: { id: req.params.id },
        });

        if (!existing) {
            res.status(404).json({ error: "New supplier not found" });
            return;
        }

        await (prisma as any).newSupplier.delete({ where: { id: req.params.id } });

        await logActivity(req.user!.id, "delete", "new_suppliers", req.params.id, {
            company: existing.company,
        });

        res.json({ message: "New supplier deleted" });
    } catch (err) {
        console.error("Delete new supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/new-suppliers/export/csv
 */
export async function exportNewSuppliersCsv(
    req: AuthRequest,
    res: Response,
): Promise<void> {
    try {
        const { search = "" } = req.query as Record<string, string>;

        const where: any = {};
        if (search) {
            where.OR = [
                { company: { contains: search, mode: "insensitive" } },
                { country: { contains: search, mode: "insensitive" } },
                { productCategory: { contains: search, mode: "insensitive" } },
                { product: { contains: search, mode: "insensitive" } },
                { accountManager: { contains: search, mode: "insensitive" } },
                { currentStatus: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
            ];
        }

        const suppliers = await (prisma as any).newSupplier.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        const headers = [
            "Company Name",
            "Product Category",
            "Product",
            "Country",
            "Account Manager",
            "Phone",
            "Email",
            "Current Status",
            "Certifications",
            "Latest Quotation",
            "Reason Inactive",
            "Date Marked Inactive",
            "Reactivation Potential",
            "Notes",
            "Created At"
        ];

        const rows = suppliers.map((s: any) => [
            s.company,
            s.productCategory || "",
            s.product || "",
            s.country || "",
            s.accountManager || "",
            s.phone || "",
            s.email || "",
            s.currentStatus || "",
            s.certifications || "",
            s.latestQuotation || "",
            s.reasonInactive || "",
            s.dateMarkedInactive || "",
            s.reactivationPotential || "",
            s.notes || "",
            s.createdAt.toISOString().split("T")[0],
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((row: any[]) =>
                row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
            ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=new_suppliers_export_${new Date().toISOString().split("T")[0]}.csv`,
        );
        res.send(csvContent);
    } catch (err) {
        console.error("Export new suppliers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/new-suppliers/filters
 */
export async function getNewSupplierFilters(
    req: AuthRequest,
    res: Response,
): Promise<void> {
    try {
        const [statuses, countries, categories, managers, productsRaw, certificationsRaw, datesRaw] = await Promise.all([
            (prisma as any).newSupplier.findMany({ select: { currentStatus: true }, distinct: ['currentStatus'] }),
            (prisma as any).newSupplier.findMany({ select: { country: true }, distinct: ['country'] }),
            (prisma as any).newSupplier.findMany({ select: { productCategory: true }, distinct: ['productCategory'] }),
            (prisma as any).newSupplier.findMany({ select: { accountManager: true }, distinct: ['accountManager'] }),
            (prisma as any).newSupplier.findMany({ select: { product: true }, distinct: ['product'] }),
            (prisma as any).newSupplier.findMany({ select: { certifications: true }, distinct: ['certifications'] }),
            (prisma as any).newSupplier.findMany({ select: { createdAt: true } }),
        ]);

        const formattedDates = Array.from(new Set(datesRaw.map((d: any) => 
            new Date(d.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
        ))).filter(Boolean);

        res.json({
            statuses: statuses.map((s: any) => s.currentStatus).filter(Boolean),
            countries: countries.map((c: any) => c.country).filter(Boolean),
            productCategories: categories.map((c: any) => c.productCategory).filter(Boolean),
            accountManagers: managers.map((m: any) => m.accountManager).filter(Boolean),
            products: productsRaw.map((p: any) => p.product).filter(Boolean),
            certifications: certificationsRaw.map((c: any) => c.certifications).filter(Boolean),
            dates: formattedDates,
        });
    } catch (err) {
        console.error("Get new supplier filters error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
