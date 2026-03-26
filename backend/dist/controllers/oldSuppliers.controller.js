import prisma from "../config/db.js";
import { logActivity } from "../services/activityLogger.js";
import { createNotification } from "../services/notificationService.js";
/**
 * GET /api/old-suppliers
 */
export async function listOldSuppliers(req, res) {
    try {
        const { search = "", page = "1", limit = "20", status, country, productCategory, accountManager, dateFrom, dateTo } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search) {
            where.OR = [
                { company: { contains: search, mode: "insensitive" } },
                { country: { contains: search, mode: "insensitive" } },
                { productCategory: { contains: search, mode: "insensitive" } },
                { product: { contains: search, mode: "insensitive" } },
                { accountManager: { contains: search, mode: "insensitive" } },
                { currentStatus: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status && status !== "all") {
            where.currentStatus = { equals: status, mode: "insensitive" };
        }
        if (country && country !== "all") {
            where.country = { equals: country, mode: "insensitive" };
        }
        if (productCategory && productCategory !== "all") {
            where.productCategory = { equals: productCategory, mode: "insensitive" };
        }
        if (accountManager && accountManager !== "all") {
            where.accountManager = { equals: accountManager, mode: "insensitive" };
        }
        const dateFilter = {};
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
            prisma.oldSupplier.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: "desc" },
            }),
            prisma.oldSupplier.count({ where }),
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
    }
    catch (err) {
        console.error("List old suppliers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * GET /api/old-suppliers/:id
 */
export async function getOldSupplier(req, res) {
    try {
        const supplier = await prisma.oldSupplier.findUnique({
            where: { id: req.params.id },
        });
        if (!supplier) {
            res.status(404).json({ error: "Old supplier not found" });
            return;
        }
        res.json(supplier);
    }
    catch (err) {
        console.error("Get old supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * POST /api/old-suppliers
 */
export async function createOldSupplier(req, res) {
    try {
        const { company, productCategory, product, country, accountManager, currentStatus, certifications, latestQuotation, reasonInactive, dateMarkedInactive, reactivationPotential, notes } = req.body;
        const supplier = await prisma.oldSupplier.create({
            data: {
                company, productCategory, product, country, accountManager,
                currentStatus, certifications, latestQuotation, reasonInactive,
                dateMarkedInactive, reactivationPotential, notes,
                createdBy: req.user.id,
            },
        });
        await logActivity(req.user.id, "create", "old_suppliers", supplier.id, {
            company: supplier.company,
        });
        res.status(201).json(supplier);
    }
    catch (err) {
        console.error("Create old supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * PUT /api/old-suppliers/:id
 */
export async function updateOldSupplier(req, res) {
    try {
        const existing = await prisma.oldSupplier.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            res.status(404).json({ error: "Old supplier not found" });
            return;
        }
        const { company, productCategory, product, country, accountManager, currentStatus, certifications, latestQuotation, reasonInactive, dateMarkedInactive, reactivationPotential, notes } = req.body;
        const supplier = await prisma.oldSupplier.update({
            where: { id: req.params.id },
            data: {
                company, productCategory, product, country, accountManager,
                currentStatus, certifications, latestQuotation, reasonInactive,
                dateMarkedInactive, reactivationPotential, notes
            },
        });
        await logActivity(req.user.id, "update", "old_suppliers", supplier.id, {
            company: supplier.company,
        });
        res.json(supplier);
    }
    catch (err) {
        console.error("Update old supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * PATCH /api/old-suppliers/:id/stage
 */
export async function updateOldSupplierStage(req, res) {
    try {
        const { stage } = req.body;
        const existing = await prisma.oldSupplier.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            res.status(404).json({ error: "Old supplier not found" });
            return;
        }
        if (stage === "Closed") {
            const supplier = await prisma.oldSupplier.update({
                where: { id: req.params.id },
                data: { supplierStage: stage },
            });
            await logActivity(req.user.id, "update_stage", "old_suppliers", supplier.id, { company: supplier.company, stage });
            res.json(supplier);
            return;
        }
        const commonData = {
            company: existing.company,
            country: existing.country,
            certifications: existing.certifications,
            createdBy: req.user.id,
            supplierStage: stage,
        };
        if (stage === "Onboarding") {
            const newSupplier = await prisma.newSupplier.create({
                data: {
                    ...commonData,
                    notes: existing.notes,
                },
            });
            await prisma.oldSupplier.delete({ where: { id: req.params.id } });
            await logActivity(req.user.id, "move_to_new_suppliers", "old_suppliers", newSupplier.id, { company: existing.company });
            await createNotification({
                type: "stage_change",
                title: "Supplier Reactivated to Onboarding",
                message: `${existing.company} moved from Closed → Onboarding`,
                entityType: "new_supplier",
                entityId: newSupplier.id,
                entityName: existing.company,
                entityLink: `/suppliers/new/${newSupplier.id}`,
                createdBy: req.user.id,
            });
            res.json(newSupplier);
        }
        else if (stage === "Signed") {
            const supplier = await prisma.supplier.create({
                data: {
                    ...commonData,
                    remarks: existing.notes,
                },
            });
            await prisma.oldSupplier.delete({ where: { id: req.params.id } });
            await logActivity(req.user.id, "move_to_suppliers", "old_suppliers", supplier.id, { company: existing.company });
            await createNotification({
                type: "stage_change",
                title: "Supplier Reactivated to Signed",
                message: `${existing.company} moved from Closed → Signed`,
                entityType: "supplier",
                entityId: supplier.id,
                entityName: existing.company,
                entityLink: `/suppliers/signed-contract/${supplier.id}`,
                createdBy: req.user.id,
            });
            res.json(supplier);
        }
        else {
            res.status(400).json({ error: "Invalid stage" });
        }
    }
    catch (err) {
        console.error("Update old supplier stage error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * DELETE /api/old-suppliers/:id
 */
export async function deleteOldSupplier(req, res) {
    try {
        const existing = await prisma.oldSupplier.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            res.status(404).json({ error: "Old supplier not found" });
            return;
        }
        await prisma.oldSupplier.delete({ where: { id: req.params.id } });
        await logActivity(req.user.id, "delete", "old_suppliers", req.params.id, {
            company: existing.company,
        });
        res.json({ message: "Old supplier deleted" });
    }
    catch (err) {
        console.error("Delete old supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * GET /api/old-suppliers/export/csv
 */
export async function exportOldSuppliersCsv(req, res) {
    try {
        const { search = "", status, country, productCategory, accountManager } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { company: { contains: search, mode: "insensitive" } },
                { country: { contains: search, mode: "insensitive" } },
                { productCategory: { contains: search, mode: "insensitive" } },
                { product: { contains: search, mode: "insensitive" } },
                { accountManager: { contains: search, mode: "insensitive" } },
                { currentStatus: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status && status !== "all") {
            where.currentStatus = { equals: status, mode: "insensitive" };
        }
        if (country && country !== "all") {
            where.country = { equals: country, mode: "insensitive" };
        }
        if (productCategory && productCategory !== "all") {
            where.productCategory = { equals: productCategory, mode: "insensitive" };
        }
        if (accountManager && accountManager !== "all") {
            where.accountManager = { equals: accountManager, mode: "insensitive" };
        }
        const suppliers = await prisma.oldSupplier.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        const headers = [
            "Company Name",
            "Product Category",
            "Product",
            "Country",
            "Account Manager",
            "Current Status",
            "Certifications",
            "Latest Quotation",
            "Reason Inactive",
            "Date Marked Inactive",
            "Reactivation Potential",
            "Notes",
            "Created At"
        ];
        const rows = suppliers.map((s) => [
            s.company,
            s.productCategory || "",
            s.product || "",
            s.country || "",
            s.accountManager || "",
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
            ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
        ].join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=old_suppliers_export_${new Date().toISOString().split("T")[0]}.csv`);
        res.send(csvContent);
    }
    catch (err) {
        console.error("Export old suppliers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * GET /api/old-suppliers/filters
 */
export async function getOldSupplierFilters(req, res) {
    try {
        const [statuses, countries, categories, managers] = await Promise.all([
            prisma.oldSupplier.findMany({ select: { currentStatus: true }, distinct: ['currentStatus'] }),
            prisma.oldSupplier.findMany({ select: { country: true }, distinct: ['country'] }),
            prisma.oldSupplier.findMany({ select: { productCategory: true }, distinct: ['productCategory'] }),
            prisma.oldSupplier.findMany({ select: { accountManager: true }, distinct: ['accountManager'] }),
        ]);
        // Deduplicate filter values case-insensitively (keep the first occurrence)
        const dedup = (arr) => {
            const seen = new Map();
            for (const v of arr) {
                if (!v)
                    continue;
                const key = v.toLowerCase();
                if (!seen.has(key))
                    seen.set(key, v);
            }
            return Array.from(seen.values());
        };
        res.json({
            statuses: dedup(statuses.map(s => s.currentStatus)),
            countries: dedup(countries.map(c => c.country)),
            productCategories: dedup(categories.map(c => c.productCategory)),
            accountManagers: dedup(managers.map(m => m.accountManager)),
        });
    }
    catch (err) {
        console.error("Get old supplier filters error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
//# sourceMappingURL=oldSuppliers.controller.js.map