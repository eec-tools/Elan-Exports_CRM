import prisma from "../config/db.js";
import { logActivity } from "../services/activityLogger.js";
import { createNotification } from "../services/notificationService.js";
/**
 * GET /api/new-suppliers
 */
export async function listNewSuppliers(req, res) {
    try {
        const { search = "", page = "1", limit = "20", status, country, productCategory, accountManager, product, certifications, dateFrom, dateTo } = req.query;
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
                { phone: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
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
        if (product && product !== "all") {
            where.product = { equals: product, mode: "insensitive" };
        }
        if (certifications && certifications !== "all") {
            where.certifications = { equals: certifications, mode: "insensitive" };
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
            prisma.newSupplier.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: "desc" },
            }),
            prisma.newSupplier.count({ where }),
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
        console.error("List new suppliers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * GET /api/new-suppliers/:id
 */
export async function getNewSupplier(req, res) {
    try {
        const supplier = await prisma.newSupplier.findUnique({
            where: { id: req.params.id },
        });
        if (!supplier) {
            res.status(404).json({ error: "New supplier not found" });
            return;
        }
        res.json(supplier);
    }
    catch (err) {
        console.error("Get new supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * POST /api/new-suppliers
 */
export async function createNewSupplier(req, res) {
    try {
        const { company, productCategory, product, country, accountManager, currentStatus, certifications, latestQuotation, reasonInactive, dateMarkedInactive, reactivationPotential, notes, phone, email } = req.body;
        console.log("Creating new supplier with payload:", req.body);
        const supplier = await prisma.newSupplier.create({
            data: {
                company, productCategory, product, country, accountManager,
                currentStatus, certifications, latestQuotation, reasonInactive,
                dateMarkedInactive, reactivationPotential, notes, phone, email,
                createdBy: req.user.id,
            },
        });
        await logActivity(req.user.id, "create", "new_suppliers", supplier.id, {
            company: supplier.company,
        });
        res.status(201).json(supplier);
    }
    catch (err) {
        console.error("Create new supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * PUT /api/new-suppliers/:id
 */
export async function updateNewSupplier(req, res) {
    try {
        const existing = await prisma.newSupplier.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            res.status(404).json({ error: "New supplier not found" });
            return;
        }
        const { company, productCategory, product, country, accountManager, currentStatus, certifications, latestQuotation, reasonInactive, dateMarkedInactive, reactivationPotential, notes, phone, email } = req.body;
        console.log("Updating new supplier with payload:", req.body);
        const supplier = await prisma.newSupplier.update({
            where: { id: req.params.id },
            data: {
                company, productCategory, product, country, accountManager,
                currentStatus, certifications, latestQuotation, reasonInactive,
                dateMarkedInactive, reactivationPotential, notes, phone, email
            },
        });
        await logActivity(req.user.id, "update", "new_suppliers", supplier.id, {
            company: supplier.company,
        });
        if (currentStatus && existing.currentStatus !== currentStatus) {
            await createNotification({
                type: "status_change",
                title: "New Supplier Status Updated",
                message: `${supplier.company} status changed from "${existing.currentStatus}" to "${currentStatus}"`,
                entityType: "new_supplier",
                entityId: supplier.id,
                entityName: supplier.company,
                entityLink: `/suppliers/new/${supplier.id}`,
                createdBy: req.user.id,
            });
        }
        res.json(supplier);
    }
    catch (err) {
        console.error("Update new supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * PATCH /api/new-suppliers/:id/stage
 */
export async function updateNewSupplierStage(req, res) {
    try {
        const { stage } = req.body;
        const existing = await prisma.newSupplier.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            res.status(404).json({ error: "New supplier not found" });
            return;
        }
        if (stage === "Onboarding") {
            const supplier = await prisma.newSupplier.update({
                where: { id: req.params.id },
                data: { supplierStage: stage },
            });
            await logActivity(req.user.id, "update_stage", "new_suppliers", supplier.id, { company: supplier.company, stage });
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
        if (stage === "Signed") {
            const supplier = await prisma.supplier.create({
                data: {
                    ...commonData,
                    email: existing.email,
                    phone: existing.phone,
                    remarks: existing.notes,
                },
            });
            await prisma.newSupplier.delete({ where: { id: req.params.id } });
            await logActivity(req.user.id, "move_to_suppliers", "new_suppliers", supplier.id, { company: existing.company });
            await createNotification({
                type: "stage_change",
                title: "Supplier Converted to Signed",
                message: `${existing.company} moved from Onboarding → Signed`,
                entityType: "supplier",
                entityId: supplier.id,
                entityName: existing.company,
                entityLink: `/suppliers/signed-contract/${supplier.id}`,
                createdBy: req.user.id,
            });
            res.json(supplier);
        }
        else if (stage === "Closed") {
            const oldSupplier = await prisma.oldSupplier.create({
                data: {
                    ...commonData,
                    notes: existing.notes,
                },
            });
            await prisma.newSupplier.delete({ where: { id: req.params.id } });
            await logActivity(req.user.id, "move_to_old_suppliers", "new_suppliers", oldSupplier.id, { company: existing.company });
            await createNotification({
                type: "stage_change",
                title: "New Supplier Moved to Closed",
                message: `${existing.company} moved from Onboarding → Closed`,
                entityType: "old_supplier",
                entityId: oldSupplier.id,
                entityName: existing.company,
                entityLink: `/suppliers/old`,
                createdBy: req.user.id,
            });
            res.json(oldSupplier);
        }
        else {
            res.status(400).json({ error: "Invalid stage" });
        }
    }
    catch (err) {
        console.error("Update new supplier stage error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * DELETE /api/new-suppliers/:id
 */
export async function deleteNewSupplier(req, res) {
    try {
        const existing = await prisma.newSupplier.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            res.status(404).json({ error: "New supplier not found" });
            return;
        }
        await prisma.newSupplier.delete({ where: { id: req.params.id } });
        await logActivity(req.user.id, "delete", "new_suppliers", req.params.id, {
            company: existing.company,
        });
        res.json({ message: "New supplier deleted" });
    }
    catch (err) {
        console.error("Delete new supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * GET /api/new-suppliers/export/csv
 */
export async function exportNewSuppliersCsv(req, res) {
    try {
        const { search = "", status, country, productCategory, accountManager, product, certifications, dateFrom, dateTo } = req.query;
        const where = {};
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
        if (product && product !== "all") {
            where.product = { equals: product, mode: "insensitive" };
        }
        if (certifications && certifications !== "all") {
            where.certifications = { equals: certifications, mode: "insensitive" };
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
        const suppliers = await prisma.newSupplier.findMany({
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
        const rows = suppliers.map((s) => [
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
            ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
        ].join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=new_suppliers_export_${new Date().toISOString().split("T")[0]}.csv`);
        res.send(csvContent);
    }
    catch (err) {
        console.error("Export new suppliers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * GET /api/new-suppliers/filters
 */
export async function getNewSupplierFilters(req, res) {
    try {
        const [statuses, countries, categories, managers, productsRaw, certificationsRaw, datesRaw] = await Promise.all([
            prisma.newSupplier.findMany({ select: { currentStatus: true }, distinct: ['currentStatus'] }),
            prisma.newSupplier.findMany({ select: { country: true }, distinct: ['country'] }),
            prisma.newSupplier.findMany({ select: { productCategory: true }, distinct: ['productCategory'] }),
            prisma.newSupplier.findMany({ select: { accountManager: true }, distinct: ['accountManager'] }),
            prisma.newSupplier.findMany({ select: { product: true }, distinct: ['product'] }),
            prisma.newSupplier.findMany({ select: { certifications: true }, distinct: ['certifications'] }),
            prisma.newSupplier.findMany({ select: { createdAt: true } }),
        ]);
        const formattedDates = Array.from(new Set(datesRaw.map((d) => new Date(d.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })))).filter(Boolean);
        // Deduplicate filter values case-insensitively (keep the first occurrence)
        const dedup = (arr) => {
            const seen = new Map();
            for (const v of arr) {
                const key = v.toLowerCase();
                if (!seen.has(key))
                    seen.set(key, v);
            }
            return Array.from(seen.values());
        };
        res.json({
            statuses: dedup(statuses.map((s) => s.currentStatus).filter(Boolean)),
            countries: dedup(countries.map((c) => c.country).filter(Boolean)),
            productCategories: dedup(categories.map((c) => c.productCategory).filter(Boolean)),
            accountManagers: dedup(managers.map((m) => m.accountManager).filter(Boolean)),
            products: dedup(productsRaw.map((p) => p.product).filter(Boolean)),
            certifications: dedup(certificationsRaw.map((c) => c.certifications).filter(Boolean)),
            dates: formattedDates,
        });
    }
    catch (err) {
        console.error("Get new supplier filters error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
//# sourceMappingURL=newSuppliers.controller.js.map