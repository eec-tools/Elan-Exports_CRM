import { Response } from "express";
import { randomUUID } from "crypto";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { createNotification } from "../services/notificationService.js";

const SOURCING_FIELDS = [
    "company", "productCategory", "product", "country", "accountManager",
    "currentStatus", "certifications", "latestQuotation", "reasonInactive",
    "dateMarkedInactive", "reactivationPotential", "notes", "phone", "email",
    "tradeName", "yearEstablished", "manufacturingAddress", "city", "state",
    "postalCode", "supplierType", "whatsapp", "contactPerson",
    "hsCode", "organicStatus", "ingredientList", "allergenDeclaration", "shelfLife",
    "storageConditions", "packagingType", "netWeightVariants", "sampleAvailable",
    "sampleLeadTime", "sampleCost",
    "annualProductionVolume", "avgMonthlyVolume", "maxScalableMonthlyVolume",
    "peakSeasonMonths", "offSeasonAvailability", "minExportableBatch", "moq",
    "leadTimeFirstOrder", "leadTimeRepeatOrder",
    "incotermsSupported", "portsOfExport", "targetExportMarkets", "currencyPreferred",
    "paymentTerms",
    "iecNumber", "gstNumber", "fssaiLicense", "apedaNumber", "fdaRegistrationNumber",
    "usAgentAppointed", "tracesNtRegistration", "coiCapability", "daffBiosecurity",
    "jasLabelCompliance",
    "haccpAvailable", "isoFsscCertNo", "isoCertValidityDate", "latestInternalAuditDate",
    "latestThirdPartyAuditDate", "auditingBodyName",
    "farmerOrganicCert", "aggregatorOrganicCert", "processingUnitOrganicCert",
    "certifyingBodyName", "certsValidForExport", "organicCertsByMarket",
    "labTestingRecords", "gmoFreeDeclaration", "irradiationFreeDeclaration",
    "foodContactCompliance", "compostabilityCert", "migrationTestReport",
    "exportBrand", "healthNutritionClaims", "claimsApprovedMarkets",
    "packagingComplianceRegions",
    "organicSegregationSop", "cleaningLinelearanceSop", "noProhibitedAids",
    "productCatalog", "supplierProducts", "productCatalogs", "productCatalogImages",
    "certificates", "warehousePhotos", "videoLinks", "quotations",
    "buyerIds", "dealStage",
    // EEC Internal (admin-only)
    "vettingScore", "exclusivityArrangement", "eecMarginPercent",
    "factoryVisitStatus", "factoryVisitDate", "factoryVisitOutcome", "referralSource",
] as const;

/**
 * GET /api/sourcing-suppliers
 */
export async function listSourcingSuppliers(req: AuthRequest, res: Response): Promise<void> {
    try {
        const {
            search = "",
            page = "1",
            limit = "20",
            status,
            country,
            productCategory,
        } = req.query as Record<string, string>;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};

        if (search) {
            where.OR = [
                { company: { contains: search, mode: "insensitive" } },
                { country: { contains: search, mode: "insensitive" } },
                { product: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { contactPerson: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status && status !== "all") {
            where.status = status;
        }
        if (country && country !== "all") {
            where.country = { equals: country, mode: "insensitive" };
        }
        if (productCategory && productCategory !== "all") {
            where.productCategory = { equals: productCategory, mode: "insensitive" };
        }

        const [suppliers, total] = await Promise.all([
            (prisma as any).sourcingSupplier.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: "desc" },
                include: { emailCampaign: true },
            }),
            (prisma as any).sourcingSupplier.count({ where }),
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
        console.error("List sourcing suppliers error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/sourcing-suppliers/stats
 */
export async function getSourcingSupplierStats(req: AuthRequest, res: Response): Promise<void> {
    try {
        const [total, activeCampaigns, responseReceived, converted, noResponse] = await Promise.all([
            (prisma as any).sourcingSupplier.count(),
            (prisma as any).sourcingEmailCampaign.count({ where: { status: "active" } }),
            (prisma as any).sourcingSupplier.count({ where: { status: "response_received" } }),
            (prisma as any).sourcingSupplier.count({ where: { status: "converted" } }),
            (prisma as any).sourcingSupplier.count({ where: { status: "no_response" } }),
        ]);
        res.json({ total, activeCampaigns, responseReceived, converted, noResponse });
    } catch (err) {
        console.error("Sourcing supplier stats error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/sourcing-suppliers/:id
 */
export async function getSourcingSupplier(req: AuthRequest, res: Response): Promise<void> {
    try {
        const supplier = await (prisma as any).sourcingSupplier.findUnique({
            where: { id: req.params.id },
            include: { emailCampaign: true },
        });
        if (!supplier) {
            res.status(404).json({ error: "Sourcing supplier not found" });
            return;
        }
        res.json(supplier);
    } catch (err) {
        console.error("Get sourcing supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * POST /api/sourcing-suppliers
 */
export async function createSourcingSupplier(req: AuthRequest, res: Response): Promise<void> {
    try {
        const {
            company, productCategory, product, country, accountManager,
            currentStatus, certifications, notes, phone, email, contactPerson,
        } = req.body;

        if (!company) {
            res.status(400).json({ error: "Company name is required" });
            return;
        }

        const supplier = await (prisma as any).sourcingSupplier.create({
            data: {
                company,
                productCategory: productCategory ?? null,
                product: product ?? null,
                country: country ?? null,
                accountManager: accountManager ?? null,
                currentStatus: currentStatus ?? null,
                certifications: certifications ?? null,
                notes: notes ?? null,
                phone: phone ?? null,
                email: email ?? null,
                contactPerson: contactPerson ?? null,
                formToken: randomUUID(),
                supplierStage: "Sourcing",
                status: "pending",
                buyerIds: [],
                supplierProducts: [],
                productCatalogs: [],
                productCatalogImages: [],
                certificates: [],
                warehousePhotos: [],
                videoLinks: [],
                quotations: [],
                createdBy: req.user!.id,
            },
        });

        res.status(201).json(supplier);
    } catch (err) {
        console.error("Create sourcing supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * PUT /api/sourcing-suppliers/:id
 */
export async function updateSourcingSupplier(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const existing = await (prisma as any).sourcingSupplier.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Sourcing supplier not found" });
            return;
        }

        // Build update data only from known fields (exclude id, formToken, supplierStage, status managed separately)
        const updateData: any = {};
        for (const field of SOURCING_FIELDS) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        const updated = await (prisma as any).sourcingSupplier.update({
            where: { id },
            data: updateData,
        });

        res.json(updated);
    } catch (err) {
        console.error("Update sourcing supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * DELETE /api/sourcing-suppliers/:id
 */
export async function deleteSourcingSupplier(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        await (prisma as any).sourcingSupplier.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        console.error("Delete sourcing supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * POST /api/sourcing-suppliers/:id/convert
 * Convert a sourcing supplier to a New Supplier.
 */
export async function convertToNewSupplier(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const sourcing = await (prisma as any).sourcingSupplier.findUnique({
            where: { id },
        });

        if (!sourcing) {
            res.status(404).json({ error: "Sourcing supplier not found" });
            return;
        }

        if (sourcing.status === "converted") {
            res.status(400).json({ error: "Supplier has already been converted" });
            return;
        }

        // Strip sourcing-specific fields before creating NewSupplier
        const {
            id: _id,
            supplierStage: _stage,
            status: _status,
            formToken: _token,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
            emailCampaign: _campaign,
            ...rest
        } = sourcing;

        const newSupplier = await (prisma as any).$transaction(async (tx: any) => {
            const created = await tx.newSupplier.create({
                data: {
                    ...rest,
                    supplierStage: "Onboarding",
                    buyerIds: Array.isArray(rest.buyerIds) ? rest.buyerIds : [],
                    supplierProducts: Array.isArray(rest.supplierProducts) ? rest.supplierProducts : [],
                    productCatalogs: Array.isArray(rest.productCatalogs) ? rest.productCatalogs : [],
                    productCatalogImages: Array.isArray(rest.productCatalogImages) ? rest.productCatalogImages : [],
                    certificates: Array.isArray(rest.certificates) ? rest.certificates : [],
                    warehousePhotos: Array.isArray(rest.warehousePhotos) ? rest.warehousePhotos : [],
                    videoLinks: Array.isArray(rest.videoLinks) ? rest.videoLinks : [],
                    quotations: Array.isArray(rest.quotations) ? rest.quotations : [],
                    blacklistedBuyerIds: [],
                    createdBy: req.user!.id,
                },
            });

            await tx.sourcingSupplier.update({
                where: { id },
                data: { status: "converted" },
            });

            return created;
        });

        await createNotification({
            type: "supplier_converted",
            title: "Sourcing Supplier Converted",
            message: `${sourcing.company} has been converted to a New Supplier`,
            entityType: "new_supplier",
            entityId: newSupplier.id,
            entityName: sourcing.company,
            entityLink: `/suppliers/new/${newSupplier.id}`,
            createdBy: req.user?.id,
        });

        res.status(201).json(newSupplier);
    } catch (err) {
        console.error("Convert sourcing supplier error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
