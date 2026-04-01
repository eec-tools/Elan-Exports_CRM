import { Request, Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { logActivity } from "../services/activityLogger.js";
import { createNotification } from "../services/notificationService.js";
import { syncSupplierDocsToVault } from "../services/vaultSync.service.js";
import { syncDealStageFromSupplier } from "../services/dealStageSync.service.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// ─── Cloudinary config ──────────────────────────────
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const newSupplierCatalogStorage = new CloudinaryStorage({
    cloudinary,
    params: async (_req: Express.Request, file: Express.Multer.File) => {
        let resource_type = "auto";
        let isRaw = false;
        if (
            file.mimetype === "application/pdf" ||
            file.originalname.toLowerCase().match(/\.(pdf|doc|docx|xls|xlsx|csv|zip)$/)
        ) {
            resource_type = "raw";
            isRaw = true;
        }
        const extMatch = file.originalname.match(/\.[^/.]+$/);
        const ext = isRaw && extMatch ? extMatch[0] : "";
        const baseName = file.originalname.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
        return {
            folder: "elan-new-suppliers",
            resource_type,
            public_id: `new_supplier_catalog_${Date.now()}_${baseName}${ext}`,
        };
    },
} as any);

export const uploadNewSupplierFile = multer({
    storage: newSupplierCatalogStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
});

/**
 * POST /api/new-suppliers/upload
 */
export async function uploadNewSupplierCatalog(
    _req: Request,
    res: Response,
): Promise<void> {
    try {
        const file = _req.file as any;
        if (!file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const fileUrl: string = file.path || file.secure_url || file.url;
        res.json({ url: fileUrl });
    } catch (err) {
        console.error("Upload new supplier catalog error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * GET /api/new-suppliers/list
 * Lightweight list for dropdown population
 */
export async function listNewSuppliersForDropdown(
    _req: AuthRequest,
    res: Response,
): Promise<void> {
    try {
        const suppliers = await (prisma as any).newSupplier.findMany({
            select: { id: true, company: true },
            orderBy: { company: "asc" },
        });
        res.json(suppliers.map((s: any) => ({ ...s, type: "new" })));
    } catch (err) {
        console.error("List new suppliers dropdown error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

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
            dateMarkedInactive, reactivationPotential, notes, phone, email,
            productCatalog, buyerIds: incomingBuyerIds,
            supplierProducts, productCatalogs,
            certificates, warehousePhotos, videoLinks,
            // Pass through all remaining supplier info sheet fields
            tradeName, yearEstablished, manufacturingAddress, city, state, postalCode, supplierType,
            whatsapp, hsCode, organicStatus, ingredientList, allergenDeclaration, shelfLife,
            storageConditions, packagingType, netWeightVariants, sampleAvailable, sampleLeadTime, sampleCost,
            annualProductionVolume, avgMonthlyVolume, maxScalableMonthlyVolume, peakSeasonMonths,
            offSeasonAvailability, minExportableBatch, moq, leadTimeFirstOrder, leadTimeRepeatOrder,
            incotermsSupported, portsOfExport, targetExportMarkets, currencyPreferred, paymentTerms,
            iecNumber, gstNumber, fssaiLicense, apedaNumber, fdaRegistrationNumber, usAgentAppointed,
            tracesNtRegistration, coiCapability, daffBiosecurity, jasLabelCompliance,
            haccpAvailable, isoFsscCertNo, isoCertValidityDate, latestInternalAuditDate,
            latestThirdPartyAuditDate, auditingBodyName, farmerOrganicCert, aggregatorOrganicCert,
            processingUnitOrganicCert, certifyingBodyName, certsValidForExport, organicCertsByMarket,
            labTestingRecords, gmoFreeDeclaration, irradiationFreeDeclaration, foodContactCompliance,
            compostabilityCert, migrationTestReport, exportBrand, healthNutritionClaims,
            claimsApprovedMarkets, packagingComplianceRegions, organicSegregationSop,
            cleaningLinelearanceSop, noProhibitedAids,
        } = req.body;

        console.log("Creating new supplier with payload:", req.body);

        const buyerIdsArr: string[] = Array.isArray(incomingBuyerIds) ? incomingBuyerIds : [];

        const supplier = await (prisma as any).$transaction(async (tx: any) => {
            const created = await tx.newSupplier.create({
                data: {
                    company, productCategory, product, country, accountManager,
                    currentStatus, certifications, latestQuotation, reasonInactive,
                    dateMarkedInactive, reactivationPotential, notes, phone, email,
                    productCatalog, buyerIds: buyerIdsArr,
                    supplierProducts: supplierProducts ?? [],
                    productCatalogs: productCatalogs ?? [],
                    certificates: certificates ?? [],
                    warehousePhotos: warehousePhotos ?? [],
                    videoLinks: videoLinks ?? [],
                    tradeName, yearEstablished, manufacturingAddress, city, state, postalCode, supplierType,
                    whatsapp, hsCode, organicStatus, ingredientList, allergenDeclaration, shelfLife,
                    storageConditions, packagingType, netWeightVariants, sampleAvailable, sampleLeadTime, sampleCost,
                    annualProductionVolume, avgMonthlyVolume, maxScalableMonthlyVolume, peakSeasonMonths,
                    offSeasonAvailability, minExportableBatch, moq, leadTimeFirstOrder, leadTimeRepeatOrder,
                    incotermsSupported, portsOfExport, targetExportMarkets, currencyPreferred, paymentTerms,
                    iecNumber, gstNumber, fssaiLicense, apedaNumber, fdaRegistrationNumber, usAgentAppointed,
                    tracesNtRegistration, coiCapability, daffBiosecurity, jasLabelCompliance,
                    haccpAvailable, isoFsscCertNo, isoCertValidityDate, latestInternalAuditDate,
                    latestThirdPartyAuditDate, auditingBodyName, farmerOrganicCert, aggregatorOrganicCert,
                    processingUnitOrganicCert, certifyingBodyName, certsValidForExport, organicCertsByMarket,
                    labTestingRecords, gmoFreeDeclaration, irradiationFreeDeclaration, foodContactCompliance,
                    compostabilityCert, migrationTestReport, exportBrand, healthNutritionClaims,
                    claimsApprovedMarkets, packagingComplianceRegions, organicSegregationSop,
                    cleaningLinelearanceSop, noProhibitedAids,
                    createdBy: req.user!.id,
                },
            });

            for (const buyerId of buyerIdsArr) {
                const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
                if (!buyer) continue;
                const links = (buyer.supplierLinks as { id: string; type: string }[]) ?? [];
                if (!links.some((l) => l.id === created.id && l.type === "new")) {
                    await tx.buyer.update({
                        where: { id: buyerId },
                        data: { supplierLinks: [...links, { id: created.id, type: "new" }] },
                    });
                }
            }

            return created;
        });

        await logActivity(req.user!.id, "create", "new_suppliers", supplier.id, {
            company: supplier.company,
        });

        // --- NEW: AUTO-GENERATE REPORT ON CREATE ---
        try {
            let reportBuyer = supplier.accountManager || "";
            const incomingIds: string[] = Array.isArray(req.body.buyerIds) ? req.body.buyerIds : [];
            if (!reportBuyer && incomingIds.length > 0) {
                const firstBuyer = await (prisma as any).buyer.findUnique({ where: { id: incomingIds[0] } });
                if (firstBuyer) reportBuyer = firstBuyer.company || firstBuyer.name || "";
            }
            if (!reportBuyer) reportBuyer = "Direct";
            const mappedBuyer = reportBuyer.split(',').map((b: string) => `${b.trim()} (${supplier.company})`).join(', ');

            let parsedProducts = "";
            const sProducts = (supplier as any).supplierProducts;
            if (Array.isArray(sProducts) && sProducts.length > 0) {
                parsedProducts = sProducts.map((p: any) => p.product).filter(Boolean).join(", ");
            }
            const reportProduct = parsedProducts || supplier.product || "N/A";
            const notesStr = supplier.notes ? ` Notes: ${supplier.notes}` : "";
            const newUpdatePoint = `[${new Date().toLocaleDateString()}] [${supplier.company}] New Supplier Onboarded.${notesStr}`;

            const existingReport = await (prisma as any).report.findFirst({
                where: {
                    productName: { equals: reportProduct, mode: "insensitive" }
                },
                orderBy: { createdAt: 'desc' }
            });

            const mergeStr = (a: string, b: string) => {
                if (!b || b === "Direct" || b === "N/A") return a;
                if (!a || a === "Direct" || a === "N/A") return b;
                const s = new Set([...a.split(",").map(x => x.trim()), ...b.split(",").map(x => x.trim())]);
                return Array.from(s).filter(Boolean).join(", ");
            };

            if (existingReport && reportProduct !== "N/A") {
                await (prisma as any).report.update({
                    where: { id: existingReport.id },
                    data: {
                        companyName: mergeStr(existingReport.companyName, supplier.company),
                        buyerName: mergeStr(existingReport.buyerName, mappedBuyer),
                        status: mergeStr(existingReport.status, supplier.currentStatus || "Onboarding"),
                        keyUpdates: existingReport.keyUpdates ? `${newUpdatePoint}\n\n${existingReport.keyUpdates}` : newUpdatePoint,
                        updateDate: new Date()
                    }
                });
            } else {
                await (prisma as any).report.create({
                    data: {
                        productName: reportProduct,
                        buyerName: mappedBuyer,
                        companyName: supplier.company,
                        status: supplier.currentStatus || "Onboarding",
                        keyUpdates: newUpdatePoint,
                        buyerSupplier: "Supplier",
                        reportDate: new Date(),
                        updateDate: new Date(),
                        createdBy: req.user!.id,
                    }
                });
            }
        } catch (e) { console.error("Auto Report Gen Failed", e); }
        // -------------------------------------------

        // --- VAULT SYNC: auto-create folders ---
        try {
            await syncSupplierDocsToVault(supplier.company, {
                certificates: supplier.certificates as any[] ?? [],
                productCatalogs: supplier.productCatalogs as any[] ?? [],
                warehousePhotos: supplier.warehousePhotos as any[] ?? [],
            }, req.user!.id);
        } catch (e) { console.error("Vault Sync Failed", e); }
        // ---------------------------------------

        // --- AUTO-CREATE DEAL ---
        try {
            const { autoCreateDealForSupplier } = await import("../services/dealStageSync.service.js");
            await autoCreateDealForSupplier(supplier.company, "NewSupplier", supplier);
        } catch (e) { console.error("Auto Deal Creation Failed", e); }
        // ------------------------

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
            dateMarkedInactive, reactivationPotential, notes, phone, email,
            productCatalog, buyerIds: incomingBuyerIds,
            supplierProducts, productCatalogs,
            certificates, warehousePhotos, videoLinks,
            tradeName, yearEstablished, manufacturingAddress, city, state, postalCode, supplierType,
            whatsapp, hsCode, organicStatus, ingredientList, allergenDeclaration, shelfLife,
            storageConditions, packagingType, netWeightVariants, sampleAvailable, sampleLeadTime, sampleCost,
            annualProductionVolume, avgMonthlyVolume, maxScalableMonthlyVolume, peakSeasonMonths,
            offSeasonAvailability, minExportableBatch, moq, leadTimeFirstOrder, leadTimeRepeatOrder,
            incotermsSupported, portsOfExport, targetExportMarkets, currencyPreferred, paymentTerms,
            iecNumber, gstNumber, fssaiLicense, apedaNumber, fdaRegistrationNumber, usAgentAppointed,
            tracesNtRegistration, coiCapability, daffBiosecurity, jasLabelCompliance,
            haccpAvailable, isoFsscCertNo, isoCertValidityDate, latestInternalAuditDate,
            latestThirdPartyAuditDate, auditingBodyName, farmerOrganicCert, aggregatorOrganicCert,
            processingUnitOrganicCert, certifyingBodyName, certsValidForExport, organicCertsByMarket,
            labTestingRecords, gmoFreeDeclaration, irradiationFreeDeclaration, foodContactCompliance,
            compostabilityCert, migrationTestReport, exportBrand, healthNutritionClaims,
            claimsApprovedMarkets, packagingComplianceRegions, organicSegregationSop,
            cleaningLinelearanceSop, noProhibitedAids,
        } = req.body;

        console.log("Updating new supplier with payload:", req.body);

        const supplierId = req.params.id;
        const incomingIds: string[] = Array.isArray(incomingBuyerIds)
            ? incomingBuyerIds
            : ((existing.buyerIds as string[]) ?? []);
        const oldIds: string[] = (existing.buyerIds as string[]) ?? [];
        const added = incomingIds.filter((bid) => !oldIds.includes(bid));
        const removed = oldIds.filter((bid) => !incomingIds.includes(bid));

        const supplier = await (prisma as any).$transaction(async (tx: any) => {
            const updated = await tx.newSupplier.update({
                where: { id: supplierId },
                data: {
                    company, productCategory, product, country, accountManager,
                    currentStatus, certifications, latestQuotation, reasonInactive,
                    dateMarkedInactive, reactivationPotential, notes, phone, email,
                    productCatalog, buyerIds: incomingIds,
                    supplierProducts: supplierProducts ?? [],
                    productCatalogs: productCatalogs ?? [],
                    certificates: certificates ?? [],
                    warehousePhotos: warehousePhotos ?? [],
                    videoLinks: videoLinks ?? [],
                    ...(req.body.dealStage !== undefined && { dealStage: req.body.dealStage }),
                    tradeName, yearEstablished, manufacturingAddress, city, state, postalCode, supplierType,
                    whatsapp, hsCode, organicStatus, ingredientList, allergenDeclaration, shelfLife,
                    storageConditions, packagingType, netWeightVariants, sampleAvailable, sampleLeadTime, sampleCost,
                    annualProductionVolume, avgMonthlyVolume, maxScalableMonthlyVolume, peakSeasonMonths,
                    offSeasonAvailability, minExportableBatch, moq, leadTimeFirstOrder, leadTimeRepeatOrder,
                    incotermsSupported, portsOfExport, targetExportMarkets, currencyPreferred, paymentTerms,
                    iecNumber, gstNumber, fssaiLicense, apedaNumber, fdaRegistrationNumber, usAgentAppointed,
                    tracesNtRegistration, coiCapability, daffBiosecurity, jasLabelCompliance,
                    haccpAvailable, isoFsscCertNo, isoCertValidityDate, latestInternalAuditDate,
                    latestThirdPartyAuditDate, auditingBodyName, farmerOrganicCert, aggregatorOrganicCert,
                    processingUnitOrganicCert, certifyingBodyName, certsValidForExport, organicCertsByMarket,
                    labTestingRecords, gmoFreeDeclaration, irradiationFreeDeclaration, foodContactCompliance,
                    compostabilityCert, migrationTestReport, exportBrand, healthNutritionClaims,
                    claimsApprovedMarkets, packagingComplianceRegions, organicSegregationSop,
                    cleaningLinelearanceSop, noProhibitedAids,
                },
            });

            for (const buyerId of added) {
                const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
                if (!buyer) continue;
                const links = (buyer.supplierLinks as { id: string; type: string }[]) ?? [];
                if (!links.some((l) => l.id === supplierId && l.type === "new")) {
                    await tx.buyer.update({
                        where: { id: buyerId },
                        data: { supplierLinks: [...links, { id: supplierId, type: "new" }] },
                    });
                }
            }

            for (const buyerId of removed) {
                const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
                if (!buyer) continue;
                const links = (buyer.supplierLinks as { id: string; type: string }[]) ?? [];
                await tx.buyer.update({
                    where: { id: buyerId },
                    data: {
                        supplierLinks: links.filter(
                            (l) => !(l.id === supplierId && l.type === "new"),
                        ),
                    },
                });
            }

            return updated;
        });

        await logActivity(req.user!.id, "update", "new_suppliers", supplier.id, {
            company: supplier.company,
        });

        // Sync deal stage if it changed
        if (req.body.dealStage && existing.dealStage !== req.body.dealStage) {
            await syncDealStageFromSupplier(supplier.company, req.body.dealStage, "NewSupplier");
        }

        // --- NEW: AUTO-GENERATE REPORT ---
        const changedNotes = existing.notes !== notes;
        const changedStatus = existing.currentStatus !== currentStatus;

        if (changedNotes || changedStatus) {
            let updatesText = "";
            const parts = [];
            if (changedStatus) parts.push(`Status changed to '${currentStatus}'`);
            if (changedNotes) parts.push(`Notes: ${notes || "(cleared)"}`);
            updatesText += parts.join(" | ");

            try {
                let reportBuyer = supplier.accountManager || existing.accountManager || "";
                if (!reportBuyer && Array.isArray(incomingIds) && incomingIds.length > 0) {
                    const firstBuyer = await (prisma as any).buyer.findUnique({ where: { id: incomingIds[0] } });
                    if (firstBuyer) reportBuyer = firstBuyer.company || firstBuyer.name || "";
                }
                if (!reportBuyer) reportBuyer = "Direct";
                const mappedBuyer = reportBuyer.split(',').map((b: string) => `${b.trim()} (${supplier.company})`).join(', ');

                let parsedProducts = "";
                const sProducts = (supplier as any).supplierProducts;
                const eProducts = (existing as any).supplierProducts;
                if (Array.isArray(sProducts) && sProducts.length > 0) {
                    parsedProducts = sProducts.map((p: any) => p.product).filter(Boolean).join(", ");
                } else if (Array.isArray(eProducts) && eProducts.length > 0) {
                    parsedProducts = eProducts.map((p: any) => p.product).filter(Boolean).join(", ");
                }
                const reportProduct = parsedProducts || supplier.product || existing.product || "N/A";

                const existingReport = await (prisma as any).report.findFirst({
                    where: {
                        productName: { equals: reportProduct, mode: "insensitive" }
                    },
                    orderBy: { createdAt: 'desc' }
                });

                const mergeStr = (a: string, b: string) => {
                    if (!b || b === "Direct" || b === "N/A") return a;
                    if (!a || a === "Direct" || a === "N/A") return b;
                    const s = new Set([...a.split(",").map(x => x.trim()), ...b.split(",").map(x => x.trim())]);
                    return Array.from(s).filter(Boolean).join(", ");
                };

                const newUpdatePoint = `[${new Date().toLocaleDateString()}] [${supplier.company}] ${updatesText}`;

                if (existingReport && reportProduct !== "N/A") {
                    await (prisma as any).report.update({
                        where: { id: existingReport.id },
                        data: {
                            companyName: mergeStr(existingReport.companyName, supplier.company),
                            buyerName: mergeStr(existingReport.buyerName, mappedBuyer),
                            status: mergeStr(existingReport.status, currentStatus || existing.currentStatus || "Status Updated"),
                            keyUpdates: existingReport.keyUpdates ? `${newUpdatePoint}\n\n${existingReport.keyUpdates}` : newUpdatePoint,
                            updateDate: new Date()
                        }
                    });
                } else {
                    await (prisma as any).report.create({
                        data: {
                            productName: reportProduct,
                            buyerName: mappedBuyer,
                            companyName: supplier.company,
                            status: currentStatus || existing.currentStatus || "Status Updated",
                            keyUpdates: newUpdatePoint,
                            buyerSupplier: "Supplier",
                            reportDate: new Date(),
                            updateDate: new Date(),
                            createdBy: req.user!.id,
                        }
                    });
                }
            } catch (e) { console.error("Auto Report Gen Failed", e); }
        }
        // ---------------------------------

        // --- VAULT SYNC: auto-create folders ---
        try {
            await syncSupplierDocsToVault(supplier.company, {
                certificates: supplier.certificates as any[] ?? [],
                productCatalogs: supplier.productCatalogs as any[] ?? [],
                warehousePhotos: supplier.warehousePhotos as any[] ?? [],
            }, req.user!.id);
        } catch (e) { console.error("Vault Sync Failed", e); }
        // ---------------------------------------

        if (currentStatus && existing.currentStatus !== currentStatus) {
            await createNotification({
                type: "status_change",
                title: "New Supplier Status Updated",
                message: `${supplier.company} status changed from "${existing.currentStatus}" to "${currentStatus}"`,
                entityType: "new_supplier",
                entityId: supplier.id,
                entityName: supplier.company,
                entityLink: `/suppliers/new/${supplier.id}`,
                createdBy: req.user!.id,
            });
        }

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

        const oldBuyerIds: string[] = (existing.buyerIds as string[]) ?? [];

        if (stage === "Signed") {
            const result = await (prisma as any).$transaction(async (tx: any) => {
                const supplier = await tx.supplier.create({
                    data: {
                        ...commonData,
                        email: existing.email,
                        phone: existing.phone,
                        remarks: existing.notes,
                        buyerIds: oldBuyerIds,
                    },
                });
                // Update each linked buyer's supplierLinks from type "new" → "signed"
                for (const buyerId of oldBuyerIds) {
                    const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
                    if (!buyer) continue;
                    const links = (buyer.supplierLinks as { id: string; type: string }[]) ?? [];
                    const updated = links.map((l) =>
                        l.id === req.params.id && l.type === "new"
                            ? { id: supplier.id, type: "signed" }
                            : l,
                    );
                    await tx.buyer.update({
                        where: { id: buyerId },
                        data: { supplierLinks: updated },
                    });
                }
                await tx.newSupplier.delete({ where: { id: req.params.id } });
                return supplier;
            });
            await logActivity(req.user!.id, "move_to_suppliers", "new_suppliers", result.id, { company: existing.company });
            await createNotification({
                type: "stage_change",
                title: "Supplier Converted to Signed",
                message: `${existing.company} moved from Onboarding → Signed`,
                entityType: "supplier",
                entityId: result.id,
                entityName: existing.company,
                entityLink: `/suppliers/signed-contract/${result.id}`,
                createdBy: req.user!.id,
            });
            res.json(result);
        } else if (stage === "Closed") {
            const result = await (prisma as any).$transaction(async (tx: any) => {
                const oldSupplier = await tx.oldSupplier.create({
                    data: { ...commonData, notes: existing.notes },
                });
                // Remove this supplier from all linked buyers' supplierLinks
                for (const buyerId of oldBuyerIds) {
                    const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
                    if (!buyer) continue;
                    const links = (buyer.supplierLinks as { id: string; type: string }[]) ?? [];
                    await tx.buyer.update({
                        where: { id: buyerId },
                        data: {
                            supplierLinks: links.filter(
                                (l) => !(l.id === req.params.id && l.type === "new"),
                            ),
                        },
                    });
                }
                await tx.newSupplier.delete({ where: { id: req.params.id } });
                return oldSupplier;
            });
            await logActivity(req.user!.id, "move_to_old_suppliers", "new_suppliers", result.id, { company: existing.company });
            await createNotification({
                type: "stage_change",
                title: "New Supplier Moved to Closed",
                message: `${existing.company} moved from Onboarding → Closed`,
                entityType: "old_supplier",
                entityId: result.id,
                entityName: existing.company,
                entityLink: `/suppliers/old`,
                createdBy: req.user!.id,
            });
            res.json(result);
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

        const supplierId = req.params.id;
        const buyerIds: string[] = (existing.buyerIds as string[]) ?? [];

        await (prisma as any).$transaction(async (tx: any) => {
            for (const buyerId of buyerIds) {
                const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
                if (!buyer) continue;
                const links = (buyer.supplierLinks as { id: string; type: string }[]) ?? [];
                await tx.buyer.update({
                    where: { id: buyerId },
                    data: {
                        supplierLinks: links.filter(
                            (l) => !(l.id === supplierId && l.type === "new"),
                        ),
                    },
                });
            }
            await tx.newSupplier.delete({ where: { id: supplierId } });
        });

        await logActivity(req.user!.id, "delete", "new_suppliers", supplierId, {
            company: existing.company,
        });

        // --- DELETE RELATED DEALS ---
        try {
            const deletedDeals = await (prisma as any).deal.deleteMany({
                where: { supplier: existing.company },
            });
            if (deletedDeals.count > 0) {
                console.log(`Deleted ${deletedDeals.count} deal(s) for new supplier: ${existing.company}`);
            }
        } catch (e) { console.error("Deal Deletion Failed", e); }
        // ----------------------------

        // --- NEW: AUTO-GENERATE REPORT CLEANUP ---
        try {
            let parsedProducts = "";
            const eProducts = (existing as any).supplierProducts;
            if (Array.isArray(eProducts) && eProducts.length > 0) {
                parsedProducts = eProducts.map((p: any) => p.product).filter(Boolean).join(", ");
            }
            const reportProduct = parsedProducts || existing.product || "N/A";
            if (reportProduct !== "N/A") {
                const existingReport = await (prisma as any).report.findFirst({
                    where: { productName: { equals: reportProduct, mode: "insensitive" } },
                    orderBy: { createdAt: 'desc' }
                });
                if (existingReport) {
                    const newCompany = existingReport.companyName.split(',').map((x: string) => x.trim()).filter((x: string) => x !== existing.company).join(', ');
                    const newBuyer = existingReport.buyerName.split(',').map((x: string) => x.trim()).filter((x: string) => !x.includes(`(${existing.company})`)).join(', ');
                    const newUpdate = `[${new Date().toLocaleDateString()}] [${existing.company}] Supplier Deleted from System.`;
                    const finalUpdates = existingReport.keyUpdates ? `${newUpdate}\n\n${existingReport.keyUpdates}` : newUpdate;

                    if (!newCompany) {
                        await (prisma as any).report.update({
                            where: { id: existingReport.id },
                            data: {
                                companyName: "No Active Suppliers",
                                buyerName: "None",
                                status: "System Deleted",
                                keyUpdates: finalUpdates
                            }
                        });
                    } else {
                        await (prisma as any).report.update({
                            where: { id: existingReport.id },
                            data: {
                                companyName: newCompany,
                                buyerName: newBuyer || "None",
                                keyUpdates: finalUpdates
                            }
                        });
                    }
                }
            }
        } catch (e) { console.error("Report Cleanup Failed", e); }
        // ------------------------------------------

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
        const { search = "", status, country, productCategory, accountManager, product, certifications, dateFrom, dateTo } = req.query as Record<string, string>;

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

        const suppliers = await (prisma as any).newSupplier.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        const headers = [
            "Company Name",
            "Trade Name",
            "Product Category",
            "Product",
            "Country",
            "City",
            "State",
            "Account Manager",
            "Phone",
            "WhatsApp",
            "Email",
            "Supplier Type",
            "Current Status",
            "Certifications",
            "Latest Quotation",
            "Organic Status",
            "HS Code",
            "MOQ",
            "Sample Available",
            "Sample Lead Time",
            "Sample Cost",
            "Annual Production Volume",
            "Avg Monthly Volume",
            "MOQ",
            "Lead Time First Order",
            "Lead Time Repeat Order",
            "Incoterms Supported",
            "Ports of Export",
            "Current Export Markets",
            "Target Export Markets",
            "Currency Preferred",
            "Payment Terms",
            "IEC Number",
            "GST Number",
            "FSSAI License",
            "APEDA Number",
            "HACCP Available",
            "ISO/FSSC Cert No",
            "Reason Inactive",
            "Date Marked Inactive",
            "Reactivation Potential",
            "Notes",
            "Created At"
        ];

        const rows = suppliers.map((s: any) => [
            s.company,
            s.tradeName || "",
            s.productCategory || "",
            s.product || "",
            s.country || "",
            s.city || "",
            s.state || "",
            s.accountManager || "",
            s.phone || "",
            s.whatsapp || "",
            s.email || "",
            s.supplierType || "",
            s.currentStatus || "",
            s.certifications || "",
            s.latestQuotation || "",
            s.organicStatus || "",
            s.hsCode || "",
            s.moq || "",
            s.sampleAvailable || "",
            s.sampleLeadTime || "",
            s.sampleCost || "",
            s.annualProductionVolume || "",
            s.avgMonthlyVolume || "",
            s.moq || "",
            s.leadTimeFirstOrder || "",
            s.leadTimeRepeatOrder || "",
            s.incotermsSupported || "",
            s.portsOfExport || "",
            s.exportingCountries || "",
            s.targetExportMarkets || "",
            s.currencyPreferred || "",
            s.paymentTerms || "",
            s.iecNumber || "",
            s.gstNumber || "",
            s.fssaiLicense || "",
            s.apedaNumber || "",
            s.haccpAvailable || "",
            s.isoFsscCertNo || "",
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

        // Deduplicate filter values case-insensitively (keep the first occurrence)
        const dedup = (arr: string[]) => {
            const seen = new Map<string, string>();
            for (const v of arr) {
                const key = v.toLowerCase();
                if (!seen.has(key)) seen.set(key, v);
            }
            return Array.from(seen.values());
        };

        res.json({
            statuses: dedup(statuses.map((s: any) => s.currentStatus).filter(Boolean)),
            countries: dedup(countries.map((c: any) => c.country).filter(Boolean)),
            productCategories: dedup(categories.map((c: any) => c.productCategory).filter(Boolean)),
            accountManagers: dedup(managers.map((m: any) => m.accountManager).filter(Boolean)),
            products: dedup(productsRaw.map((p: any) => p.product).filter(Boolean)),
            certifications: dedup(certificationsRaw.map((c: any) => c.certifications).filter(Boolean)),
            dates: formattedDates,
        });
    } catch (err) {
        console.error("Get new supplier filters error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
