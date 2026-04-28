import { Response } from "express";
import { randomUUID } from "crypto";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { createNotification } from "../services/notificationService.js";

const SOURCING_FIELDS = [
  "company",
  "productCategory",
  "product",
  "country",
  "accountManager",
  "currentStatus",
  "certifications",
  "latestQuotation",
  "reasonInactive",
  "dateMarkedInactive",
  "reactivationPotential",
  "notes",
  "phone",
  "email",
  "tradeName",
  "yearEstablished",
  "manufacturingAddress",
  "city",
  "state",
  "postalCode",
  "supplierType",
  "whatsapp",
  "contactPerson",
  "hsCode",
  "organicStatus",
  "ingredientList",
  "allergenDeclaration",
  "shelfLife",
  "storageConditions",
  "packagingType",
  "netWeightVariants",
  "sampleAvailable",
  "sampleLeadTime",
  "sampleCost",
  "annualProductionVolume",
  "avgMonthlyVolume",
  "maxScalableMonthlyVolume",
  "peakSeasonMonths",
  "offSeasonAvailability",
  "minExportableBatch",
  "moq",
  "leadTimeFirstOrder",
  "leadTimeRepeatOrder",
  "incotermsSupported",
  "portsOfExport",
  "targetExportMarkets",
  "currencyPreferred",
  "paymentTerms",
  "iecNumber",
  "gstNumber",
  "fssaiLicense",
  "apedaNumber",
  "fdaRegistrationNumber",
  "usAgentAppointed",
  "tracesNtRegistration",
  "coiCapability",
  "daffBiosecurity",
  "jasLabelCompliance",
  "haccpAvailable",
  "isoFsscCertNo",
  "isoCertValidityDate",
  "latestInternalAuditDate",
  "latestThirdPartyAuditDate",
  "auditingBodyName",
  "farmerOrganicCert",
  "aggregatorOrganicCert",
  "processingUnitOrganicCert",
  "certifyingBodyName",
  "certsValidForExport",
  "organicCertsByMarket",
  "labTestingRecords",
  "gmoFreeDeclaration",
  "irradiationFreeDeclaration",
  "foodContactCompliance",
  "compostabilityCert",
  "migrationTestReport",
  "exportBrand",
  "healthNutritionClaims",
  "claimsApprovedMarkets",
  "packagingComplianceRegions",
  "organicSegregationSop",
  "cleaningLinelearanceSop",
  "noProhibitedAids",
  "productCatalog",
  "supplierProducts",
  "productCatalogs",
  "productCatalogImages",
  "certificates",
  "warehousePhotos",
  "videoLinks",
  "quotations",
  "buyerIds",
  "dealStage",
  // EEC Internal (admin-only)
  "vettingScore",
  "exclusivityArrangement",
  "eecMarginPercent",
  "factoryVisitStatus",
  "factoryVisitDate",
  "factoryVisitOutcome",
  "referralSource",
] as const;

/**
 * GET /api/sourcing-suppliers
 */
export async function listSourcingSuppliers(
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
      createdBy,
      company,
      contactPerson,
      product,
      assignedGmailAccount,
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
    if (createdBy && createdBy !== "all") {
      where.createdBy = createdBy;
    }
    if (assignedGmailAccount && assignedGmailAccount !== "all") {
      where.assignedGmailAccount = { equals: assignedGmailAccount, mode: "insensitive" };
    }
    if (company && company !== "all") {
      where.company = { equals: company, mode: "insensitive" };
    }
    if (contactPerson && contactPerson !== "all") {
      where.contactPerson = { equals: contactPerson, mode: "insensitive" };
    }
    if (product && product !== "all") {
      where.product = { equals: product, mode: "insensitive" };
    }

    const [suppliers, total] = await Promise.all([
      (prisma as any).sourcingSupplier.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: {
          emailCampaign: true,
          creator: { select: { fullName: true, email: true } },
        },
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
export async function getSourcingSupplierStats(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const [total, activeCampaigns, responseReceived, converted, noResponse] =
      await Promise.all([
        (prisma as any).sourcingSupplier.count(),
        (prisma as any).sourcingEmailCampaign.count({
          where: { status: "active" },
        }),
        (prisma as any).sourcingSupplier.count({
          where: { status: "response_received" },
        }),
        (prisma as any).sourcingSupplier.count({
          where: { status: "converted" },
        }),
        (prisma as any).sourcingSupplier.count({
          where: { status: "no_response" },
        }),
      ]);
    res.json({
      total,
      activeCampaigns,
      responseReceived,
      converted,
      noResponse,
    });
  } catch (err) {
    console.error("Sourcing supplier stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/sourcing-suppliers/:id
 */
export async function getSourcingSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const supplier = await (prisma as any).sourcingSupplier.findUnique({
      where: { id: req.params.id },
      include: {
        emailCampaign: true,
        creator: { select: { fullName: true, email: true } },
      },
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
export async function createSourcingSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      company,
      email,
      assignedGmailAccount,
      // kept for backwards-compat if sent, but not required in add dialog
      productCategory,
      product,
      country,
      accountManager,
      currentStatus,
      certifications,
      notes,
      phone,
      contactPerson,
    } = req.body;

    if (!company) {
      res.status(400).json({ error: "Company name is required" });
      return;
    }
    if (!email) {
      res.status(400).json({ error: "Supplier email is required" });
      return;
    }

    const supplier = await (prisma as any).sourcingSupplier.create({
      data: {
        company,
        email,
        assignedGmailAccount: assignedGmailAccount ?? null,
        productCategory: productCategory ?? null,
        product: product ?? null,
        country: country ?? null,
        accountManager: accountManager ?? null,
        currentStatus: currentStatus ?? null,
        certifications: certifications ?? null,
        notes: notes ?? null,
        phone: phone ?? null,
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
export async function updateSourcingSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await (prisma as any).sourcingSupplier.findUnique({
      where: { id },
    });
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
export async function deleteSourcingSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
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
export async function convertToNewSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
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
          supplierProducts: Array.isArray(rest.supplierProducts)
            ? rest.supplierProducts
            : [],
          productCatalogs: Array.isArray(rest.productCatalogs)
            ? rest.productCatalogs
            : [],
          productCatalogImages: Array.isArray(rest.productCatalogImages)
            ? rest.productCatalogImages
            : [],
          certificates: Array.isArray(rest.certificates)
            ? rest.certificates
            : [],
          warehousePhotos: Array.isArray(rest.warehousePhotos)
            ? rest.warehousePhotos
            : [],
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

/**
 * GET /api/sourcing-suppliers/category-stats
 */
export async function getSourcingCategoryStats(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const [rows, total] = await Promise.all([
      (prisma as any).sourcingSupplier.groupBy({
        by: ["productCategory"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      (prisma as any).sourcingSupplier.count(),
    ]);
    res.json({ categories: rows, total });
  } catch (err) {
    console.error("Category stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/sourcing-suppliers/bulk-create
 * Body: { suppliers: Array<{ company, email, country, city, contactPerson, designation, phone, product, productCategory, website, linkedinUrl }> }
 */
export async function bulkCreateSourcingSuppliers(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { suppliers } = req.body as {
      suppliers: Array<{
        company: string;
        email?: string;
        country?: string;
        city?: string;
        contactPerson?: string;
        designation?: string;
        phone?: string;
        product?: string;
        productCategory?: string;
        website?: string;
        linkedinUrl?: string;
      }>;
    };

    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      res.status(400).json({ error: "No suppliers provided" });
      return;
    }

    const validRows = suppliers.filter((s) => s.company?.trim());
    if (validRows.length === 0) {
      res.status(400).json({ error: "All rows are missing company name" });
      return;
    }

    const data = validRows.map((s) => {
      const notesParts: string[] = [];
      if (s.website?.trim()) notesParts.push(`Website: ${s.website.trim()}`);
      if (s.linkedinUrl?.trim())
        notesParts.push(`LinkedIn: ${s.linkedinUrl.trim()}`);

      return {
        company: s.company.trim(),
        email: s.email?.trim() || null,
        country: s.country?.trim() || null,
        city: s.city?.trim() || null,
        contactPerson: s.contactPerson?.trim() || null,
        designation: s.designation?.trim() || null,
        phone: s.phone?.trim() || null,
        product: s.product?.trim() || null,
        productCategory: s.productCategory?.trim() || null,
        notes: notesParts.length > 0 ? notesParts.join("\n") : null,
        createdBy: req.user!.id,
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
      };
    });

    const result = await (prisma as any).sourcingSupplier.createMany({
      data,
      skipDuplicates: true,
    });

    res
      .status(201)
      .json({ imported: result.count, skipped: data.length - result.count });
  } catch (err) {
    console.error("Bulk create sourcing suppliers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/sourcing-suppliers/from-folder?folderId=X
 * Returns all SourcingVaultSupplier records for the folder with emailStatus = "Not Sent".
 */
export async function getVaultFolderNotSent(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { folderId } = req.query as Record<string, string>;

    if (!folderId) {
      res.status(400).json({ error: "folderId is required" });
      return;
    }

    const suppliers = await (prisma as any).sourcingVaultSupplier.findMany({
      where: { folderId, emailStatus: "Not Sent" },
      orderBy: { createdAt: "desc" },
    });

    res.json(suppliers);
  } catch (err) {
    console.error("Get vault folder not-sent error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/sourcing-suppliers/from-folder
 * Promotes all "Not Sent" vault suppliers from a folder to the SourcingSupplier pipeline,
 * marking them "Sent". The assignedGmailAccount and formTemplateId from this request
 * override whatever was used during the vault staging step.
 */
export async function addFromVaultFolder(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { folderId, assignedGmailAccount } = req.body as {
      folderId: string;
      assignedGmailAccount?: string;
      formTemplateId?: string;
    };

    if (!folderId) {
      res.status(400).json({ error: "folderId is required" });
      return;
    }

    const folder = await (prisma as any).sourcingVaultFolder.findUnique({
      where: { id: folderId },
    });
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    const vaultSuppliers = await (prisma as any).sourcingVaultSupplier.findMany(
      {
        where: { folderId, emailStatus: "Not Sent" },
      },
    );

    if (vaultSuppliers.length === 0) {
      res.status(400).json({ error: "No unsent suppliers in this folder" });
      return;
    }

    const supplierData = vaultSuppliers.map((s: any) => ({
      company: s.company,
      email: s.email,
      phone: s.phone,
      contactPerson: s.contactPerson,
      country: s.country,
      product: s.product,
      notes: s.notes,
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
    }));

    await (prisma as any).$transaction(async (tx: any) => {
      await tx.sourcingSupplier.createMany({
        data: supplierData,
        skipDuplicates: true,
      });

      await tx.sourcingVaultSupplier.updateMany({
        where: { folderId, emailStatus: "Not Sent" },
        data: { emailStatus: "Sent" },
      });
    });

    res.status(201).json({
      added: supplierData.length,
      suppliers: supplierData.map((s: any) => ({ company: s.company, formToken: s.formToken })),
    });
  } catch (err) {
    console.error("Add from vault folder error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/sourcing-suppliers/creators?productCategory=X
 * Returns distinct { id, fullName } of employees who sourced suppliers,
 * optionally scoped to a product category (folder).
 */
export async function getSourcingCreators(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { productCategory } = req.query as Record<string, string>;

    const where: any = { createdBy: { not: null } };
    if (productCategory && productCategory !== "all") {
      where.productCategory = { equals: productCategory, mode: "insensitive" };
    }

    const rows = await (prisma as any).sourcingSupplier.findMany({
      where,
      select: { createdBy: true, creator: { select: { fullName: true } } },
      distinct: ["createdBy"],
      orderBy: { creator: { fullName: "asc" } },
    });

    const creators = rows
      .filter((r: any) => r.createdBy && r.creator)
      .map((r: any) => ({
        id: r.createdBy as string,
        fullName: r.creator.fullName as string,
      }));

    res.json(creators);
  } catch (err) {
    console.error("Get sourcing creators error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
