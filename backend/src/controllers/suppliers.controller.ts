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

const storage = new CloudinaryStorage({
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
      folder: "elan-suppliers",
      resource_type,
      public_id: `supplier_catalog_${Date.now()}_${baseName}${ext}`,
    };
  },
} as any);

export const uploadSupplierFile = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

/**
 * GET /api/suppliers/list
 * Lightweight list for dropdown population
 */
export async function listSuppliersForDropdown(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const suppliers = await prisma.supplier.findMany({
      select: { id: true, company: true },
      orderBy: { company: "asc" },
    });
    res.json(suppliers.map((s) => ({ ...s, type: "signed" })));
  } catch (err) {
    console.error("List suppliers dropdown error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/suppliers
 */
export async function listSuppliers(
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
      contractBuyer,
      products,
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
  } catch (err) {
    console.error("List suppliers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/suppliers/:id
 */
export async function getSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
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
  } catch (err) {
    console.error("Get supplier error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/suppliers
 */
export async function createSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const supplier = await prisma.supplier.create({
      data: {
        ...req.body,
        createdBy: req.user!.id,
      },
    });

    await logActivity(req.user!.id, "create", "suppliers", supplier.id, {
      company: supplier.company,
    });

    // --- NEW: AUTO-GENERATE REPORT ON CREATE ---
    try {
      let reportBuyer = supplier.contractBuyer || "";
      const incomingIds: string[] = Array.isArray(req.body.buyerIds) ? req.body.buyerIds : [];
      if (!reportBuyer && incomingIds.length > 0) {
        const firstBuyer = await prisma.buyer.findUnique({ where: { id: incomingIds[0] } });
        if (firstBuyer) reportBuyer = firstBuyer.company || firstBuyer.name || "";
      }
      if (!reportBuyer) reportBuyer = "Direct";
      const mappedBuyer = reportBuyer.split(',').map((b: string) => `${b.trim()} (${supplier.company})`).join(', ');

      const sProducts = (supplier as any).supplierProducts;
      let productsToReport: {name: string, imageUrl: string | null}[] = [];
      if (Array.isArray(sProducts) && sProducts.length > 0) {
        productsToReport = sProducts.map((p: any) => ({
            name: p.product || "Unnamed Product",
            imageUrl: p.imageUrl || null
        }));
      } else {
        productsToReport = [{ name: supplier.products || "N/A", imageUrl: null }];
      }

      const remarksStr = supplier.remarks ? ` Remarks: ${supplier.remarks}` : "";
      const newUpdatePoint = `[${new Date().toLocaleDateString()}] [${supplier.company}] Supplier Added.${remarksStr}`;

      const mergeStr = (a: string, b: string) => {
        if (!b || b === "Direct" || b === "N/A") return a;
        if (!a || a === "Direct" || a === "N/A") return b;
        const s = new Set([...a.split(",").map(x => x.trim()), ...b.split(",").map(x => x.trim())]);
        return Array.from(s).filter(Boolean).join(", ");
      };

      for (const prod of productsToReport) {
          const reportProduct = prod.name;
          const productImage = prod.imageUrl;

          const existingReport = await prisma.report.findFirst({
            where: {
              productName: { equals: reportProduct, mode: "insensitive" }
            },
            orderBy: { createdAt: 'desc' }
          });

          if (existingReport && reportProduct !== "N/A") {
            await prisma.report.update({
              where: { id: existingReport.id },
              data: {
                companyName: mergeStr(existingReport.companyName, supplier.company),
                buyerName: mergeStr(existingReport.buyerName, mappedBuyer),
                status: mergeStr(existingReport.status, supplier.currentStatus || "Under Review"),
                keyUpdates: existingReport.keyUpdates ? `${newUpdatePoint}\n\n${existingReport.keyUpdates}` : newUpdatePoint,
                updateDate: new Date(),
                ...(productImage && !existingReport.productImageUrl && { productImageUrl: productImage }),
              }
            });
          } else {
            await prisma.report.create({
              data: {
                productName: reportProduct,
                productImageUrl: productImage,
                buyerName: mappedBuyer,
                companyName: supplier.company,
                status: supplier.currentStatus || "Under Review",
                keyUpdates: newUpdatePoint,
                buyerSupplier: "Supplier",
                reportDate: new Date(),
                updateDate: new Date(),
                createdBy: req.user!.id,
              }
            });
          }
      }
    } catch (e) { console.error("Auto Report Gen Failed", e); }
    // -------------------------------------------

    // --- VAULT SYNC: auto-create folders ---
    try {
      const docs = (supplier as any).documents;
      const supplierProducts = (supplier as any).supplierProducts;
      const contractDoc = (supplier as any).contractDocument;
      const productCatalogs = (supplier as any).productCatalogs;
      const productCatalogImages = (supplier as any).productCatalogImages;
      const quotations = (supplier as any).quotations;
      await syncSupplierDocsToVault(supplier.company, {
        certificates: Array.isArray(docs) ? docs : [],
        productCatalogs: Array.isArray(productCatalogs) ? productCatalogs : [],
        productCatalogImages: Array.isArray(productCatalogImages) ? productCatalogImages : [],
        warehousePhotos: [],
        contractDocument: contractDoc && contractDoc.url ? contractDoc : null,
        quotations: Array.isArray(quotations) ? quotations : [],
      }, req.user!.id);
    } catch (e) { console.error("Vault Sync Failed", e); }
    // ---------------------------------------

    // --- AUTO-CREATE DEAL ---
    try {
      const { autoCreateDealForSupplier } = await import("../services/dealStageSync.service.js");
      await autoCreateDealForSupplier(supplier.company, "Supplier", supplier);
    } catch (e) { console.error("Auto Deal Creation Failed", e); }
    // ------------------------

    res.status(201).json(supplier);
  } catch (err) {
    console.error("Create supplier error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/suppliers/:id
 */
export async function updateSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const existing = await prisma.supplier.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }

    const { id, createdBy, createdAt, updatedAt, creator, ...updateData } = req.body;

    const supplierId = req.params.id;
    const incomingIds: string[] = Array.isArray(updateData.buyerIds)
      ? updateData.buyerIds
      : ((existing.buyerIds as string[]) ?? []);
    const oldIds: string[] = (existing.buyerIds as string[]) ?? [];
    const added = incomingIds.filter((bid) => !oldIds.includes(bid));
    const removed = oldIds.filter((bid) => !incomingIds.includes(bid));

    const supplier = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id: supplierId },
        data: updateData,
      });

      for (const buyerId of added) {
        const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
        if (!buyer) continue;
        const links = (buyer.supplierLinks as { id: string; type: string }[]) ?? [];
        if (!links.some((l) => l.id === supplierId && l.type === "signed")) {
          await tx.buyer.update({
            where: { id: buyerId },
            data: { supplierLinks: [...links, { id: supplierId, type: "signed" }] },
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
              (l) => !(l.id === supplierId && l.type === "signed"),
            ),
          },
        });
      }

      return updated;
    });

    await logActivity(req.user!.id, "update", "suppliers", supplier.id, {
      company: supplier.company,
    });

    // Sync deal stage if it changed
    if (updateData.dealStage && existing.dealStage !== updateData.dealStage) {
      await syncDealStageFromSupplier(supplier.company, updateData.dealStage, "Supplier");
    }

    // --- NEW: AUTO-GENERATE REPORT ---
    const changedRemarks = existing.remarks !== updateData.remarks;
    const changedStatus = existing.currentStatus !== updateData.currentStatus;

    if (changedRemarks || changedStatus) {
      let updatesText = "";
      const parts = [];
      if (changedStatus) parts.push(`Status changed to '${updateData.currentStatus}'`);
      if (changedRemarks) parts.push(`Remarks: ${updateData.remarks || "(cleared)"}`);
      updatesText += parts.join(" | ");

      try {
        let reportBuyer = supplier.contractBuyer || existing.contractBuyer || "";
        if (!reportBuyer && Array.isArray(incomingIds) && incomingIds.length > 0) {
          const firstBuyer = await prisma.buyer.findUnique({ where: { id: incomingIds[0] } });
          if (firstBuyer) reportBuyer = firstBuyer.company || firstBuyer.name || "";
        }
        if (!reportBuyer) reportBuyer = "Direct";
        const mappedBuyer = reportBuyer.split(',').map((b: string) => `${b.trim()} (${supplier.company})`).join(', ');

        const sProducts = (supplier as any).supplierProducts;
        const eProducts = (existing as any).supplierProducts;
        let productsToReport: {name: string, imageUrl: string | null}[] = [];
        if (Array.isArray(sProducts) && sProducts.length > 0) {
            productsToReport = sProducts.map((p: any) => ({
                name: p.product || "Unnamed Product",
                imageUrl: p.imageUrl || null
            }));
        } else if (Array.isArray(eProducts) && eProducts.length > 0) {
            productsToReport = eProducts.map((p: any) => ({
                name: p.product || "Unnamed Product",
                imageUrl: p.imageUrl || null
            }));
        } else {
            productsToReport = [{ name: supplier.products || existing.products || "N/A", imageUrl: null }];
        }

        const mergeStr = (a: string, b: string) => {
          if (!b || b === "Direct" || b === "N/A") return a;
          if (!a || a === "Direct" || a === "N/A") return b;
          const s = new Set([...a.split(",").map(x => x.trim()), ...b.split(",").map(x => x.trim())]);
          return Array.from(s).filter(Boolean).join(", ");
        };

        const newUpdatePoint = `[${new Date().toLocaleDateString()}] [${supplier.company}] ${updatesText}`;

        for (const prod of productsToReport) {
            const reportProduct = prod.name;
            const productImage = prod.imageUrl;

            const existingReport = await prisma.report.findFirst({
              where: {
                productName: { equals: reportProduct, mode: "insensitive" }
              },
              orderBy: { createdAt: 'desc' }
            });

            if (existingReport && reportProduct !== "N/A") {
              await prisma.report.update({
                where: { id: existingReport.id },
                data: {
                  companyName: mergeStr(existingReport.companyName, supplier.company),
                  buyerName: mergeStr(existingReport.buyerName, mappedBuyer),
                  status: mergeStr(existingReport.status, updateData.currentStatus || existing.currentStatus || "Status Updated"),
                  keyUpdates: existingReport.keyUpdates ? `${newUpdatePoint}\n\n${existingReport.keyUpdates}` : newUpdatePoint,
                  updateDate: new Date(),
                  ...(productImage && { productImageUrl: productImage }),
                }
              });
            } else {
              await prisma.report.create({
                data: {
                  productName: reportProduct,
                  productImageUrl: productImage,
                  buyerName: mappedBuyer,
                  companyName: supplier.company,
                  status: updateData.currentStatus || existing.currentStatus || "Status Updated",
                  keyUpdates: newUpdatePoint,
                  buyerSupplier: "Supplier",
                  reportDate: new Date(),
                  updateDate: new Date(),
                  createdBy: req.user!.id,
                }
              });
            }
        }
      } catch (e) { console.error("Auto Report Gen Failed", e); }
    }
    // ---------------------------------

    // --- VAULT SYNC: auto-create folders ---
    try {
      const docs = (supplier as any).documents;
      const contractDoc = (supplier as any).contractDocument;
      const productCatalogs = (supplier as any).productCatalogs;
      const productCatalogImages = (supplier as any).productCatalogImages;
      const quotations = (supplier as any).quotations;
      await syncSupplierDocsToVault(supplier.company, {
        certificates: Array.isArray(docs) ? docs : [],
        productCatalogs: Array.isArray(productCatalogs) ? productCatalogs : [],
        productCatalogImages: Array.isArray(productCatalogImages) ? productCatalogImages : [],
        warehousePhotos: [],
        contractDocument: contractDoc && contractDoc.url ? contractDoc : null,
        quotations: Array.isArray(quotations) ? quotations : [],
      }, req.user!.id);
    } catch (e) { console.error("Vault Sync Failed", e); }
    // ---------------------------------------

    if (updateData.currentStatus && existing.currentStatus !== updateData.currentStatus) {
      await createNotification({
        type: "status_change",
        title: "Supplier Status Updated",
        message: `${supplier.company} status changed from "${existing.currentStatus}" to "${updateData.currentStatus}"`,
        entityType: "supplier",
        entityId: supplier.id,
        entityName: supplier.company,
        entityLink: `/suppliers/signed-contract/${supplier.id}`,
        createdBy: req.user!.id,
      });
    }

    res.json(supplier);
  } catch (err) {
    console.error("Update supplier error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PATCH /api/suppliers/:id/stage
 */
export async function updateSupplierStage(
  req: AuthRequest,
  res: Response,
): Promise<void> {
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
      await logActivity(req.user!.id, "update_stage", "suppliers", supplier.id, { company: supplier.company, stage });
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

    if (stage === "Onboarding") {
      const result = await prisma.$transaction(async (tx) => {
        const newSupplier = await (tx as any).newSupplier.create({
          data: {
            ...commonData,
            email: existing.email,
            phone: existing.phone,
            notes: existing.remarks,
            buyerIds: oldBuyerIds,
          },
        });
        // Update each linked buyer's supplierLinks from type "signed" → "new"
        for (const buyerId of oldBuyerIds) {
          const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
          if (!buyer) continue;
          const links = (buyer.supplierLinks as { id: string; type: string }[]) ?? [];
          const updated = links.map((l) =>
            l.id === req.params.id && l.type === "signed"
              ? { id: newSupplier.id, type: "new" }
              : l,
          );
          await tx.buyer.update({ where: { id: buyerId }, data: { supplierLinks: updated } });
        }
        await tx.supplier.delete({ where: { id: req.params.id } });
        return newSupplier;
      });
      await logActivity(req.user!.id, "move_to_new_suppliers", "suppliers", result.id, { company: existing.company });
      await createNotification({
        type: "stage_change",
        title: "Supplier Moved to Onboarding",
        message: `${existing.company} moved from Signed → Onboarding`,
        entityType: "new_supplier",
        entityId: result.id,
        entityName: existing.company,
        entityLink: `/suppliers/new/${result.id}`,
        createdBy: req.user!.id,
      });
      res.json(result);
    } else if (stage === "Closed") {
      const result = await prisma.$transaction(async (tx) => {
        const oldSupplier = await tx.oldSupplier.create({
          data: { ...commonData, notes: existing.remarks },
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
                (l) => !(l.id === req.params.id && l.type === "signed"),
              ),
            },
          });
        }
        await tx.supplier.delete({ where: { id: req.params.id } });
        return oldSupplier;
      });
      await logActivity(req.user!.id, "move_to_old_suppliers", "suppliers", result.id, { company: existing.company });
      await createNotification({
        type: "stage_change",
        title: "Supplier Moved to Closed",
        message: `${existing.company} moved from Signed → Closed`,
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
    console.error("Update supplier stage error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/suppliers/:id
 */
export async function deleteSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const existing = await prisma.supplier.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }

    const supplierId = req.params.id;
    const buyerIds: string[] = (existing.buyerIds as string[]) ?? [];

    await prisma.$transaction(async (tx) => {
      for (const buyerId of buyerIds) {
        const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
        if (!buyer) continue;
        const links = (buyer.supplierLinks as { id: string; type: string }[]) ?? [];
        await tx.buyer.update({
          where: { id: buyerId },
          data: {
            supplierLinks: links.filter(
              (l) => !(l.id === supplierId && l.type === "signed"),
            ),
          },
        });
      }
      await tx.supplier.delete({ where: { id: supplierId } });
    });

    await logActivity(req.user!.id, "delete", "suppliers", supplierId, {
      company: existing.company,
    });

    // --- DELETE RELATED DEALS ---
    try {
      const deletedDeals = await prisma.deal.deleteMany({
        where: { supplier: existing.company },
      });
      if (deletedDeals.count > 0) {
        console.log(`Deleted ${deletedDeals.count} deal(s) for supplier: ${existing.company}`);
      }
    } catch (e) { console.error("Deal Deletion Failed", e); }
    // ----------------------------

    // --- NEW: AUTO-GENERATE REPORT CLEANUP ---
    try {
      const reportProduct = existing.products || "N/A";
      if (reportProduct !== "N/A") {
        const existingReport = await prisma.report.findFirst({
          where: { productName: { equals: reportProduct, mode: "insensitive" } },
          orderBy: { createdAt: 'desc' }
        });
        if (existingReport) {
          const newCompany = existingReport.companyName.split(',').map((x: string) => x.trim()).filter((x: string) => x !== existing.company).join(', ');
          const newBuyer = existingReport.buyerName.split(',').map((x: string) => x.trim()).filter((x: string) => !x.includes(`(${existing.company})`)).join(', ');
          const newUpdate = `[${new Date().toLocaleDateString()}] [${existing.company}] Supplier Deleted from System.`;
          const finalUpdates = existingReport.keyUpdates ? `${newUpdate}\n\n${existingReport.keyUpdates}` : newUpdate;

          if (!newCompany) {
            await prisma.report.update({
              where: { id: existingReport.id },
              data: {
                companyName: "No Active Suppliers",
                buyerName: "None",
                status: "System Deleted",
                keyUpdates: finalUpdates
              }
            });
          } else {
            await prisma.report.update({
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

    res.json({ message: "Supplier deleted" });
  } catch (err) {
    console.error("Delete supplier error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/suppliers/export/csv
 */
export async function exportSuppliersCsv(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { search = "", status, country, contractBuyer, products, certifications, dateFrom, dateTo } = req.query as Record<string, string>;

    const where: any = {};
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

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Company",
      "Trade Name",
      "Country",
      "City",
      "State",
      "Contact Person",
      "Email",
      "Phone",
      "WhatsApp",
      "Supplier Type",
      "Products",
      "Organic Status",
      "HS Code",
      "Contract Buyer",
      "Commission %",
      "Approved Confirm %",
      "Lidl Factory ID",
      "Company Address",
      "Website",
      "Certifications",
      "Production Capacity",
      "Annual Production Volume",
      "MOQ",
      "Lead Time First Order",
      "Lead Time Repeat Order",
      "Incoterms Supported",
      "Ports of Export",
      "Exporting Countries",
      "Target Export Markets",
      "Currency Preferred",
      "Payment Terms",
      "Sample Policy",
      "Sample Available",
      "Sample Lead Time",
      "Sample Cost",
      "IEC Number",
      "GST Number",
      "FSSAI License",
      "APEDA Number",
      "FDA Registration Number",
      "HACCP Available",
      "ISO/FSSC Cert No",
      "Certifying Body Name",
      "Working With Our Brands",
      "Other Brands",
      "Export Brand",
      "Packaging Compliance Regions",
      "Product Catalog Shared",
      "Factory Videos Shared",
      "Warehouse Videos Shared",
      "Remarks",
      "Status",
      "Created At",
    ];

    const rows = suppliers.map((s: any) => {
      // Extract product names from supplierProducts JSON array
      let productNames = "";
      if (s.supplierProducts && Array.isArray(s.supplierProducts)) {
        productNames = s.supplierProducts
          .map((p: any) => p.product)
          .filter((name: string) => name)
          .join(", ");
      }
      // Fallback to legacy products field if supplierProducts is empty
      if (!productNames && s.products) {
        productNames = s.products;
      }

      return [
        s.company,
        s.tradeName || "",
        s.country || "",
        s.city || "",
        s.state || "",
        s.contactPerson || "",
        s.email || "",
        s.phone || "",
        s.whatsapp || "",
        s.supplierType || "",
        productNames,
        s.organicStatus || "",
        s.hsCode || "",
        s.contractBuyer || "",
        s.commissionPercent || "",
        s.approvedConfirmPercent || "",
        s.lidlFactoryId || "",
        s.companyAddress || "",
        s.website || "",
        s.certifications || "",
        s.productionCapacity || "",
        s.annualProductionVolume || "",
        s.moq || "",
        s.leadTimeFirstOrder || "",
        s.leadTimeRepeatOrder || "",
        s.incotermsSupported || "",
        s.portsOfExport || "",
        s.exportingCountries || "",
        s.targetExportMarkets || "",
        s.currencyPreferred || "",
        s.paymentTerms || "",
        s.samplePolicy || "",
        s.sampleAvailable || "",
        s.sampleLeadTime || "",
        s.sampleCost || "",
        s.iecNumber || "",
        s.gstNumber || "",
        s.fssaiLicense || "",
        s.apedaNumber || "",
        s.fdaRegistrationNumber || "",
        s.haccpAvailable || "",
        s.isoFsscCertNo || "",
        s.certifyingBodyName || "",
        s.workingWithOurBrands || "",
        s.otherBrands || "",
        s.exportBrand || "",
        s.packagingComplianceRegions || "",
        s.productCatalogShared || "",
        s.factoryVideosShared || "",
        s.warehouseVideosShared || "",
        s.remarks || "",
        s.currentStatus || "",
        s.createdAt.toISOString().split("T")[0],
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=suppliers_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    res.send(csvContent);
  } catch (err) {
    console.error("Export suppliers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/suppliers/upload
 */
export async function uploadCatalog(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const file = req.file as any;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    let fileUrl: string = file.path || file.secure_url || file.url;

    // Add fl_attachment if we don't want it to download, but for PDFs raw resources don't support fl_inline directly.
    // They are served directly via Cloudinary CDN. The browser handles PDF display based on Content-Disposition (which Cloudinary sets correctly for raw).

    res.json({ url: fileUrl });
  } catch (err) {
    console.error("Upload catalog error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/suppliers/stats
 */
export async function getSupplierStats(
  req: AuthRequest,
  res: Response,
): Promise<void> {
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
      if (status === "active") stats.active++;
      else if (status === "inactive") stats.inactive++;
      else if (status === "under review") stats.underReview++;
      else if (status === "signed") stats.signed++;
    }

    res.json(stats);
  } catch (err) {
    console.error("Get supplier stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/suppliers/filters
 */
export async function getSupplierFilters(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const [countries, contractBuyers, statuses, productsRaw, certificationsRaw, datesRaw] = await Promise.all([
      prisma.supplier.findMany({ select: { country: true }, distinct: ['country'] }),
      prisma.supplier.findMany({ select: { contractBuyer: true }, distinct: ['contractBuyer'] }),
      prisma.supplier.findMany({ select: { currentStatus: true }, distinct: ['currentStatus'] }),
      prisma.supplier.findMany({ select: { products: true }, distinct: ['products'] }),
      prisma.supplier.findMany({ select: { certifications: true }, distinct: ['certifications'] }),
      prisma.supplier.findMany({ select: { createdAt: true } }),
    ]);

    const formattedDates = Array.from(new Set(datesRaw.map(d =>
      new Date(d.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
    ))).filter(Boolean);

    // Deduplicate filter values case-insensitively (keep the first occurrence)
    const dedup = (arr: (string | null | undefined)[]) => {
      const seen = new Map<string, string>();
      for (const v of arr) {
        if (!v) continue;
        const key = v.toLowerCase();
        if (!seen.has(key)) seen.set(key, v);
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
  } catch (err) {
    console.error("Get supplier filters error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

