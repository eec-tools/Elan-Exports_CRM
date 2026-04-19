import { Response } from "express";
import { randomUUID } from "crypto";
import PDFDocument from "pdfkit";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

const QUOTATION_FIELDS = [
    "supplierName", "supplierWebsite", "date", "hsCode", "product",
    "fclDetails", "fobSupplierPrice", "fobCommissionPercent", "fobWithCommission",
    "cifSupplierPrice", "cifWithCommission", "loadability", "packing",
    "paymentTerms", "origin", "priceValidity", "supplierCertifications",
    "leadTime", "supplierComments", "buyerSpecifications", "fieldConfig", "fieldSources",
    "linkedSupplierId", "linkedSupplierType", "status",
] as const;

// Immutable fields that can never be updated via PUT
const FORBIDDEN_UPDATE_FIELDS = new Set(["id", "formToken", "createdAt", "createdBy"]);

export const QUOTATION_FIELD_LABELS: Record<string, string> = {
    supplierName: "Supplier",
    supplierWebsite: "Website",
    date: "Date",
    hsCode: "HS Code",
    product: "Product",
    fclDetails: "FCL Details",
    fobSupplierPrice: "FOB — Supplier's Price",
    fobCommissionPercent: "FOB — Commission %",
    fobWithCommission: "FOB — With Commission",
    cifSupplierPrice: "CIF — Supplier's Price",
    cifWithCommission: "CIF — With Commission",
    loadability: "Loadability",
    packing: "Packing",
    paymentTerms: "Payment Terms",
    origin: "Origin",
    priceValidity: "Price Validity",
    supplierCertifications: "Supplier Certifications",
    leadTime: "Lead Time",
    supplierComments: "Supplier Comments on Specs",
};

/**
 * GET /api/quotations
 */
export async function listQuotations(req: AuthRequest, res: Response): Promise<void> {
    try {
        const {
            search = "",
            page = "1",
            limit = "20",
            status,
        } = req.query as Record<string, string>;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};

        if (search) {
            where.OR = [
                { supplierName: { contains: search, mode: "insensitive" } },
                { product: { contains: search, mode: "insensitive" } },
                { hsCode: { contains: search, mode: "insensitive" } },
                { origin: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status && status !== "all") {
            where.status = status;
        }

        const [quotations, total] = await Promise.all([
            (prisma as any).quotation.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: "desc" },
            }),
            (prisma as any).quotation.count({ where }),
        ]);

        res.json({
            data: quotations,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    } catch (err) {
        console.error("List quotations error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/quotations/stats
 */
export async function getQuotationStats(_req: AuthRequest, res: Response): Promise<void> {
    try {
        const [total, pending, formSent, responseReceived, negotiating, finalized] = await Promise.all([
            (prisma as any).quotation.count(),
            (prisma as any).quotation.count({ where: { status: "pending" } }),
            (prisma as any).quotation.count({ where: { status: "form_sent" } }),
            (prisma as any).quotation.count({ where: { status: "response_received" } }),
            (prisma as any).quotation.count({ where: { status: "negotiating" } }),
            (prisma as any).quotation.count({ where: { status: "finalized" } }),
        ]);
        res.json({ total, pending, formSent, responseReceived, negotiating, finalized });
    } catch (err) {
        console.error("Quotation stats error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/quotations/search-suppliers?q=
 * Search NewSupplier + Supplier tables by company name for autocomplete.
 */
export async function searchSuppliers(req: AuthRequest, res: Response): Promise<void> {
    try {
        const q = (req.query.q as string) || "";

        const where = q
            ? { company: { contains: q, mode: "insensitive" as const } }
            : {};

        const [newSuppliers, signedSuppliers] = await Promise.all([
            (prisma as any).newSupplier.findMany({
                where,
                take: 15,
                orderBy: { company: "asc" },
                select: { id: true, company: true, email: true },
            }),
            (prisma as any).supplier.findMany({
                where,
                take: 15,
                orderBy: { company: "asc" },
                select: { id: true, company: true, email: true },
            }),
        ]);

        const results = [
            ...newSuppliers.map((s: any) => ({ ...s, supplierType: "new" })),
            ...signedSuppliers.map((s: any) => ({ ...s, supplierType: "signed" })),
        ].sort((a, b) => a.company.localeCompare(b.company)).slice(0, 20);

        res.json(results);
    } catch (err) {
        console.error("Search suppliers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/quotations/:id
 */
export async function getQuotation(req: AuthRequest, res: Response): Promise<void> {
    try {
        const quotation = await (prisma as any).quotation.findUnique({
            where: { id: req.params.id },
        });
        if (!quotation) {
            res.status(404).json({ error: "Quotation not found" });
            return;
        }
        res.json(quotation);
    } catch (err) {
        console.error("Get quotation error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * POST /api/quotations
 */
export async function createQuotation(req: AuthRequest, res: Response): Promise<void> {
    try {
        const {
            supplierName, linkedSupplierId, linkedSupplierType,
            supplierWebsite, product, fieldConfig,
        } = req.body;

        if (!supplierName) {
            res.status(400).json({ error: "Supplier name is required" });
            return;
        }

        const quotation = await (prisma as any).quotation.create({
            data: {
                supplierName,
                linkedSupplierId: linkedSupplierId ?? null,
                linkedSupplierType: linkedSupplierType ?? null,
                supplierWebsite: supplierWebsite ?? null,
                product: product ?? null,
                fieldConfig: fieldConfig ?? {},
                fieldSources: {},
                status: "pending",
                formToken: randomUUID(),
                createdBy: req.user!.id,
            },
        });

        res.status(201).json(quotation);
    } catch (err) {
        console.error("Create quotation error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * PUT /api/quotations/:id
 */
export async function updateQuotation(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const existing = await (prisma as any).quotation.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Quotation not found" });
            return;
        }

        const updateData: any = {};
        for (const field of QUOTATION_FIELDS) {
            if (req.body[field] !== undefined && !FORBIDDEN_UPDATE_FIELDS.has(field)) {
                updateData[field] = req.body[field];
            }
        }

        const updated = await (prisma as any).quotation.update({
            where: { id },
            data: updateData,
        });

        res.json(updated);
    } catch (err) {
        console.error("Update quotation error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * DELETE /api/quotations/:id
 */
export async function deleteQuotation(req: AuthRequest, res: Response): Promise<void> {
    try {
        await (prisma as any).quotation.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        console.error("Delete quotation error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * POST /api/quotations/:id/regenerate-token
 * Generate a new formToken for re-sending to supplier.
 */
export async function regenerateToken(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const updated = await (prisma as any).quotation.update({
            where: { id },
            data: { formToken: randomUUID(), status: "form_sent" },
        });
        res.json({ formToken: updated.formToken });
    } catch (err) {
        console.error("Regenerate token error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/quotations/:id/export-pdf?mode=supplier|all
 */
export async function exportQuotationPdf(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const mode = (req.query.mode as string) === "all" ? "all" : "supplier";

        const quotation = await (prisma as any).quotation.findUnique({ where: { id } });
        if (!quotation) {
            res.status(404).json({ error: "Quotation not found" });
            return;
        }

        const fieldConfig: Record<string, { sentToSupplier: boolean; mandatory: boolean }> =
            (quotation.fieldConfig as any) || {};

        const doc = new PDFDocument({ margin: 50, size: "A4" });
        const filename = `Quotation_${quotation.supplierName.replace(/\s+/g, "_")}_${(id ?? "").slice(0, 8)}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        doc.pipe(res);

        // ── Header ──
        doc.fontSize(20).font("Helvetica-Bold").text("Quotation", { align: "center" });
        doc.moveDown(0.3);
        doc.fontSize(11).font("Helvetica").text(`Supplier: ${quotation.supplierName}`, { align: "center" });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        const renderField = (label: string, value: string | null | undefined, isInternal = false) => {
            if (!value) return;
            doc.fontSize(9).font("Helvetica-Bold").fillColor(isInternal ? "#888888" : "#222222")
                .text(`${label}${isInternal ? " (Internal)" : ""}:`, { continued: false });
            doc.fontSize(10).font("Helvetica").fillColor("#111111").text(value, { indent: 10 });
            doc.moveDown(0.3);
        };

        for (const [key, label] of Object.entries(QUOTATION_FIELD_LABELS)) {
            const config = fieldConfig[key];
            const sentToSupplier = config?.sentToSupplier ?? true;
            const value = quotation[key] as string | null;

            if (mode === "supplier" && !sentToSupplier) continue;
            renderField(label, value, !sentToSupplier);
        }

        if (mode === "all") {
            const buyerSpecs = quotation.buyerSpecifications as Record<string, string> | null;
            if (buyerSpecs && Object.values(buyerSpecs).some(Boolean)) {
                doc.moveDown(0.5);
                doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
                doc.moveDown(0.3);
                doc.fontSize(12).font("Helvetica-Bold").fillColor("#444444").text("Buyer's Specifications (Internal)");
                doc.moveDown(0.3);
                const specLabels: Record<string, string> = {
                    targetPrice: "Target Price",
                    specs: "Specifications / Requirements",
                    requiredCertifications: "Required Certifications",
                    notes: "Notes",
                };
                for (const [k, lbl] of Object.entries(specLabels)) {
                    renderField(lbl, buyerSpecs[k], true);
                }
            }
        }

        doc.end();
    } catch (err) {
        console.error("Export PDF error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
