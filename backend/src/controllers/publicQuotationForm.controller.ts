import { Request, Response } from "express";
import prisma from "../config/db.js";

const FORBIDDEN_FIELDS = new Set([
    "id", "formToken", "status", "buyerSpecifications",
    "fieldConfig", "fieldSources", "createdBy", "createdAt", "updatedAt",
    "linkedSupplierId", "linkedSupplierType",
]);

/**
 * GET /api/public/quotation-form/:token
 * Returns the field config and current supplier-visible field values.
 * No auth required.
 */
export async function getPublicQuotationForm(req: Request, res: Response): Promise<void> {
    try {
        const { token } = req.params;

        const quotation = await (prisma as any).quotation.findUnique({
            where: { formToken: token },
        });

        if (!quotation) {
            res.status(404).json({ error: "Form not found or link is invalid." });
            return;
        }

        const fieldConfig: Record<string, { sentToSupplier: boolean; mandatory: boolean }> =
            (quotation.fieldConfig as any) || {};

        // Only expose fields that are configured to be sent to supplier
        const supplierFields: Record<string, unknown> = {};
        const supplierFieldKeys = [
            "supplierName", "supplierWebsite", "date", "hsCode", "product",
            "fclDetails", "fobSupplierPrice", "fobCommissionPercent", "fobWithCommission",
            "cifSupplierPrice", "cifWithCommission", "loadability", "packing",
            "paymentTerms", "origin", "priceValidity", "supplierCertifications",
            "leadTime", "supplierComments",
        ];

        for (const key of supplierFieldKeys) {
            const cfg = fieldConfig[key];
            if (cfg?.sentToSupplier) {
                supplierFields[key] = quotation[key] ?? null;
            }
        }

        res.json({
            supplierName: quotation.supplierName,
            fieldConfig,
            fields: supplierFields,
        });
    } catch (err) {
        console.error("Get public quotation form error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * POST /api/public/quotation-form/:token
 * Supplier submits the form. Merges non-empty values.
 * No auth required.
 */
export async function submitPublicQuotationForm(req: Request, res: Response): Promise<void> {
    try {
        const { token } = req.params;

        const quotation = await (prisma as any).quotation.findUnique({
            where: { formToken: token },
        });

        if (!quotation) {
            res.status(404).json({ error: "Form not found or link is invalid." });
            return;
        }

        const fieldConfig: Record<string, { sentToSupplier: boolean; mandatory: boolean }> =
            (quotation.fieldConfig as any) || {};

        const currentSources: Record<string, string> = (quotation.fieldSources as any) || {};
        const updateData: Record<string, unknown> = {};
        const newSources: Record<string, string> = { ...currentSources };

        for (const [key, value] of Object.entries(req.body)) {
            if (FORBIDDEN_FIELDS.has(key)) continue;

            const cfg = fieldConfig[key];
            if (!cfg?.sentToSupplier) continue; // only accept sent fields

            if (value !== null && value !== undefined && value !== "") {
                updateData[key] = value;
                newSources[key] = "supplier";
            }
        }

        const updated = await (prisma as any).quotation.update({
            where: { formToken: token },
            data: {
                ...updateData,
                fieldSources: newSources,
                status: "response_received",
            },
        });

        res.json({ success: true, updatedAt: updated.updatedAt });
    } catch (err) {
        console.error("Submit public quotation form error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
