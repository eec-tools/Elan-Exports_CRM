import prisma from "../config/db.js";
import { logActivity } from "../services/activityLogger.js";
import { createNotification } from "../services/notificationService.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
// ─── Cloudinary config ──────────────────────────────
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const storage = new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => {
        let resource_type = "auto";
        let isRaw = false;
        if (file.mimetype === "application/pdf" ||
            file.originalname.toLowerCase().match(/\.(pdf|doc|docx|xls|xlsx|csv|zip)$/)) {
            resource_type = "raw";
            isRaw = true;
        }
        const extMatch = file.originalname.match(/\.[^/.]+$/);
        const ext = isRaw && extMatch ? extMatch[0] : "";
        const baseName = file.originalname.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
        return {
            folder: "elan-suppliers",
            resource_type,
            public_id: `supplier_catalog_${Date.now()}_${baseName}${ext}`,
        };
    },
});
export const uploadSupplierFile = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});
/**
 * GET /api/suppliers
 */
export async function listSuppliers(req, res) {
    try {
        const { search = "", page = "1", limit = "20", status, country, contractBuyer, products, certifications, dateFrom, dateTo } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search) {
            where.OR = [
                { company: { contains: search, mode: "insensitive" } },
                { contactPerson: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { country: { contains: search, mode: "insensitive" } },
                { products: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status && status !== "all") {
            where.currentStatus = { equals: status, mode: "insensitive" };
        }
        if (country && country !== "all") {
            where.country = { equals: country, mode: "insensitive" };
        }
        if (contractBuyer && contractBuyer !== "all") {
            where.contractBuyer = { equals: contractBuyer, mode: "insensitive" };
        }
        if (products && products !== "all") {
            where.products = { equals: products, mode: "insensitive" };
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
            prisma.supplier.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: "desc" },
                include: { creator: { select: { fullName: true, email: true } } },
            }),
            prisma.supplier.count({ where }),
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
        console.error("List suppliers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * GET /api/suppliers/:id
 */
export async function getSupplier(req, res) {
    try {
        const supplier = await prisma.supplier.findUnique({
            where: { id: req.params.id },
            include: { creator: { select: { fullName: true, email: true } } },
        });
        if (!supplier) {
            res.status(404).json({ error: "Supplier not found" });
            return;
        }
        res.json(supplier);
    }
    catch (err) {
        console.error("Get supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * POST /api/suppliers
 */
export async function createSupplier(req, res) {
    try {
        const supplier = await prisma.supplier.create({
            data: {
                ...req.body,
                createdBy: req.user.id,
            },
        });
        await logActivity(req.user.id, "create", "suppliers", supplier.id, {
            company: supplier.company,
        });
        res.status(201).json(supplier);
    }
    catch (err) {
        console.error("Create supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * PUT /api/suppliers/:id
 */
export async function updateSupplier(req, res) {
    try {
        const existing = await prisma.supplier.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            res.status(404).json({ error: "Supplier not found" });
            return;
        }
        const { id, createdBy, createdAt, updatedAt, creator, ...updateData } = req.body;
        const supplier = await prisma.supplier.update({
            where: { id: req.params.id },
            data: updateData,
        });
        await logActivity(req.user.id, "update", "suppliers", supplier.id, {
            company: supplier.company,
        });
        if (updateData.currentStatus && existing.currentStatus !== updateData.currentStatus) {
            await createNotification({
                type: "status_change",
                title: "Supplier Status Updated",
                message: `${supplier.company} status changed from "${existing.currentStatus}" to "${updateData.currentStatus}"`,
                entityType: "supplier",
                entityId: supplier.id,
                entityName: supplier.company,
                entityLink: `/suppliers/signed-contract/${supplier.id}`,
                createdBy: req.user.id,
            });
        }
        res.json(supplier);
    }
    catch (err) {
        console.error("Update supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * PATCH /api/suppliers/:id/stage
 */
export async function updateSupplierStage(req, res) {
    try {
        const { stage } = req.body;
        const existing = await prisma.supplier.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            res.status(404).json({ error: "Supplier not found" });
            return;
        }
        if (stage === "Signed") {
            const supplier = await prisma.supplier.update({
                where: { id: req.params.id },
                data: { supplierStage: stage },
            });
            await logActivity(req.user.id, "update_stage", "suppliers", supplier.id, { company: supplier.company, stage });
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
                    email: existing.email,
                    phone: existing.phone,
                    notes: existing.remarks,
                },
            });
            await prisma.supplier.delete({ where: { id: req.params.id } });
            await logActivity(req.user.id, "move_to_new_suppliers", "suppliers", newSupplier.id, { company: existing.company });
            await createNotification({
                type: "stage_change",
                title: "Supplier Moved to Onboarding",
                message: `${existing.company} moved from Signed → Onboarding`,
                entityType: "new_supplier",
                entityId: newSupplier.id,
                entityName: existing.company,
                entityLink: `/suppliers/new/${newSupplier.id}`,
                createdBy: req.user.id,
            });
            res.json(newSupplier);
        }
        else if (stage === "Closed") {
            const oldSupplier = await prisma.oldSupplier.create({
                data: {
                    ...commonData,
                    notes: existing.remarks,
                },
            });
            await prisma.supplier.delete({ where: { id: req.params.id } });
            await logActivity(req.user.id, "move_to_old_suppliers", "suppliers", oldSupplier.id, { company: existing.company });
            await createNotification({
                type: "stage_change",
                title: "Supplier Moved to Closed",
                message: `${existing.company} moved from Signed → Closed`,
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
        console.error("Update supplier stage error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * DELETE /api/suppliers/:id
 */
export async function deleteSupplier(req, res) {
    try {
        const existing = await prisma.supplier.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            res.status(404).json({ error: "Supplier not found" });
            return;
        }
        await prisma.supplier.delete({ where: { id: req.params.id } });
        await logActivity(req.user.id, "delete", "suppliers", req.params.id, {
            company: existing.company,
        });
        res.json({ message: "Supplier deleted" });
    }
    catch (err) {
        console.error("Delete supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * GET /api/suppliers/export/csv
 */
export async function exportSuppliersCsv(req, res) {
    try {
        const { search = "", status, country, contractBuyer, products, certifications, dateFrom, dateTo } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { company: { contains: search, mode: "insensitive" } },
                { contactPerson: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status && status !== "all") {
            where.currentStatus = { equals: status, mode: "insensitive" };
        }
        if (country && country !== "all") {
            where.country = { equals: country, mode: "insensitive" };
        }
        if (contractBuyer && contractBuyer !== "all") {
            where.contractBuyer = { equals: contractBuyer, mode: "insensitive" };
        }
        if (products && products !== "all") {
            where.products = { equals: products, mode: "insensitive" };
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
        const suppliers = await prisma.supplier.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        const headers = [
            "Company",
            "Country",
            "Contact Person",
            "Email",
            "Phone",
            "Products",
            "Contract Buyer",
            "Commission %",
            "Approved Confirm %",
            "Lidl Factory ID",
            "Company Address",
            "Website",
            "Certifications",
            "Production Capacity",
            "Exporting Countries",
            "Sample Policy",
            "Working With Our Brands",
            "Other Brands",
            "Product Catalog Shared",
            "Factory Videos Shared",
            "Warehouse Videos Shared",
            "Remarks",
            "Status",
            "Created At",
        ];
        const rows = suppliers.map((s) => [
            s.company,
            s.country || "",
            s.contactPerson || "",
            s.email || "",
            s.phone || "",
            s.products || "",
            s.contractBuyer || "",
            s.commissionPercent || "",
            s.approvedConfirmPercent || "",
            s.lidlFactoryId || "",
            s.companyAddress || "",
            s.website || "",
            s.certifications || "",
            s.productionCapacity || "",
            s.exportingCountries || "",
            s.samplePolicy || "",
            s.workingWithOurBrands || "",
            s.otherBrands || "",
            s.productCatalogShared || "",
            s.factoryVideosShared || "",
            s.warehouseVideosShared || "",
            s.remarks || "",
            s.currentStatus || "",
            s.createdAt.toISOString().split("T")[0],
        ]);
        const csvContent = [
            headers.join(","),
            ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
        ].join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=suppliers_export_${new Date().toISOString().split("T")[0]}.csv`);
        res.send(csvContent);
    }
    catch (err) {
        console.error("Export suppliers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * POST /api/suppliers/upload
 */
export async function uploadCatalog(req, res) {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        let fileUrl = file.path || file.secure_url || file.url;
        // Add fl_attachment if we don't want it to download, but for PDFs raw resources don't support fl_inline directly.
        // They are served directly via Cloudinary CDN. The browser handles PDF display based on Content-Disposition (which Cloudinary sets correctly for raw).
        res.json({ url: fileUrl });
    }
    catch (err) {
        console.error("Upload catalog error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * GET /api/suppliers/stats
 */
export async function getSupplierStats(req, res) {
    try {
        const suppliers = await prisma.supplier.findMany({
            select: { currentStatus: true },
        });
        const stats = {
            total: suppliers.length,
            active: 0,
            inactive: 0,
            underReview: 0,
            signed: 0,
        };
        for (const s of suppliers) {
            const status = s.currentStatus?.toLowerCase();
            if (status === "active")
                stats.active++;
            else if (status === "inactive")
                stats.inactive++;
            else if (status === "under review")
                stats.underReview++;
            else if (status === "signed")
                stats.signed++;
        }
        res.json(stats);
    }
    catch (err) {
        console.error("Get supplier stats error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * GET /api/suppliers/filters
 */
export async function getSupplierFilters(req, res) {
    try {
        const [countries, contractBuyers, statuses, productsRaw, certificationsRaw, datesRaw] = await Promise.all([
            prisma.supplier.findMany({ select: { country: true }, distinct: ['country'] }),
            prisma.supplier.findMany({ select: { contractBuyer: true }, distinct: ['contractBuyer'] }),
            prisma.supplier.findMany({ select: { currentStatus: true }, distinct: ['currentStatus'] }),
            prisma.supplier.findMany({ select: { products: true }, distinct: ['products'] }),
            prisma.supplier.findMany({ select: { certifications: true }, distinct: ['certifications'] }),
            prisma.supplier.findMany({ select: { createdAt: true } }),
        ]);
        const formattedDates = Array.from(new Set(datesRaw.map(d => new Date(d.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })))).filter(Boolean);
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
            countries: dedup(countries.map(c => c.country)),
            contractBuyers: dedup(contractBuyers.map(c => c.contractBuyer)),
            statuses: dedup(statuses.map(s => s.currentStatus)),
            products: dedup(productsRaw.map(p => p.products)),
            certifications: dedup(certificationsRaw.map(c => c.certifications)),
            dates: formattedDates,
        });
    }
    catch (err) {
        console.error("Get supplier filters error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
//# sourceMappingURL=suppliers.controller.js.map