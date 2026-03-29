import { Request, Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { logActivity } from "../services/activityLogger.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// ─── Cloudinary config ──────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const buyerCatalogStorage = new CloudinaryStorage({
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
      folder: "elan-buyers",
      resource_type,
      public_id: `buyer_catalog_${Date.now()}_${baseName}${ext}`,
    };
  },
} as any);

export const uploadBuyerFile = multer({
  storage: buyerCatalogStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

/**
 * POST /api/buyers/upload
 */
export async function uploadBuyerCatalog(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const file = req.file as any;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const fileUrl: string = file.path || file.secure_url || file.url;
    res.json({ url: fileUrl });
  } catch (err) {
    console.error("Upload buyer catalog error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/buyers
 * Query params: search, page, limit, status, product
 */
export async function listBuyers(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      search = "",
      page = "1",
      limit = "20",
      status,
      product,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      where.OR = [
        { company: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && status !== "all") {
      where.status = status;
    }

    // Filter by required product with current_requirement = true
    if (product) {
      where.requiredProducts = {
        path: "$",
        array_contains: [{ name: product, current_requirement: true }],
      };
    }

    const [buyers, total] = await Promise.all([
      prisma.buyer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: { creator: { select: { fullName: true, email: true } } },
      }),
      prisma.buyer.count({ where }),
    ]);

    res.json({
      data: buyers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("List buyers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/buyers/stats
 */
export async function getBuyerStats(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const [total, active, pending, suspended] = await Promise.all([
      prisma.buyer.count(),
      prisma.buyer.count({ where: { status: "Active" } }),
      prisma.buyer.count({ where: { status: "Pending" } }),
      prisma.buyer.count({ where: { status: "Suspended" } }),
    ]);

    res.json({ total, active, pending, suspended });
  } catch (err) {
    console.error("Buyer stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/buyers/cr-products
 * Returns unique product names where current_requirement = true
 */
export async function getCrProducts(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const buyers = await prisma.buyer.findMany({
      select: { requiredProducts: true },
    });

    const productSet = new Set<string>();
    for (const buyer of buyers) {
      const products = buyer.requiredProducts as any[];
      if (Array.isArray(products)) {
        for (const p of products) {
          if (p.current_requirement && p.name) {
            productSet.add(p.name);
          }
        }
      }
    }

    res.json([...productSet].sort());
  } catch (err) {
    console.error("CR products error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/buyers/:id
 */
export async function getBuyer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const buyer = await prisma.buyer.findUnique({
      where: { id: req.params.id },
      include: { creator: { select: { fullName: true, email: true } } },
    });

    if (!buyer) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }

    res.json(buyer);
  } catch (err) {
    console.error("Get buyer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/buyers
 */
export async function createBuyer(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const incomingLinks: { id: string; type: "new" | "signed" }[] =
      Array.isArray(req.body.supplierLinks) ? req.body.supplierLinks : [];

    const buyer = await prisma.$transaction(async (tx) => {
      const created = await tx.buyer.create({
        data: { ...req.body, createdBy: req.user!.id },
      });

      for (const link of incomingLinks) {
        if (link.type === "new") {
          const ns = await (tx as any).newSupplier.findUnique({ where: { id: link.id } });
          if (!ns) continue;
          const ids = (ns.buyerIds as string[]) ?? [];
          if (!ids.includes(created.id)) {
            await (tx as any).newSupplier.update({
              where: { id: link.id },
              data: { buyerIds: [...ids, created.id] },
            });
          }
        } else {
          const s = await tx.supplier.findUnique({ where: { id: link.id } });
          if (!s) continue;
          const ids = (s.buyerIds as string[]) ?? [];
          if (!ids.includes(created.id)) {
            await tx.supplier.update({
              where: { id: link.id },
              data: { buyerIds: [...ids, created.id] as any },
            });
          }
        }
      }

      return created;
    });

    await logActivity(req.user!.id, "create", "buyers", buyer.id, {
      company: buyer.company,
      name: buyer.name,
    });

    res.status(201).json(buyer);
  } catch (err) {
    console.error("Create buyer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/buyers/:id
 */
export async function updateBuyer(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const existing = await prisma.buyer.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }

    const {
      id,
      createdAt,
      updatedAt,
      createdBy,
      creator,
      ...updateData
    } = req.body;

    const buyerId = req.params.id as string;
    const incomingLinks: { id: string; type: "new" | "signed" }[] =
      Array.isArray(updateData.supplierLinks)
        ? updateData.supplierLinks
        : ((existing.supplierLinks as any[]) ?? []);
    const oldLinks: { id: string; type: "new" | "signed" }[] =
      (existing.supplierLinks as any[]) ?? [];

    const linkKey = (l: { id: string; type: string }) => `${l.id}::${l.type}`;
    const oldKeys = new Set(oldLinks.map(linkKey));
    const newKeys = new Set(incomingLinks.map(linkKey));
    const added = incomingLinks.filter((l) => !oldKeys.has(linkKey(l)));
    const removed = oldLinks.filter((l) => !newKeys.has(linkKey(l)));

    const buyer = await prisma.$transaction(async (tx) => {
      const updated = await tx.buyer.update({
        where: { id: buyerId },
        data: updateData,
      });

      for (const link of added) {
        if (link.type === "new") {
          const ns = await (tx as any).newSupplier.findUnique({ where: { id: link.id } });
          if (!ns) continue;
          const ids = (ns.buyerIds as string[]) ?? [];
          if (!ids.includes(buyerId)) {
            await (tx as any).newSupplier.update({
              where: { id: link.id },
              data: { buyerIds: [...ids, buyerId] },
            });
          }
        } else {
          const s = await tx.supplier.findUnique({ where: { id: link.id } });
          if (!s) continue;
          const ids = (s.buyerIds as string[]) ?? [];
          if (!ids.includes(buyerId)) {
            await tx.supplier.update({
              where: { id: link.id },
              data: { buyerIds: [...ids, buyerId] as any },
            });
          }
        }
      }

      for (const link of removed) {
        if (link.type === "new") {
          const ns = await (tx as any).newSupplier.findUnique({ where: { id: link.id } });
          if (!ns) continue;
          const ids = (ns.buyerIds as string[]) ?? [];
          await (tx as any).newSupplier.update({
            where: { id: link.id },
            data: { buyerIds: ids.filter((bid: string) => bid !== buyerId) },
          });
        } else {
          const s = await tx.supplier.findUnique({ where: { id: link.id } });
          if (!s) continue;
          const ids = (s.buyerIds as string[]) ?? [];
          await tx.supplier.update({
            where: { id: link.id },
            data: { buyerIds: ids.filter((bid: string) => bid !== buyerId) as any },
          });
        }
      }

      return updated;
    });

    await logActivity(req.user!.id, "update", "buyers", buyer.id, {
      company: buyer.company,
    });

    res.json(buyer);
  } catch (err) {
    console.error("Update buyer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/buyers/:id
 */
export async function deleteBuyer(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const existing = await prisma.buyer.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }

    const buyerId = req.params.id as string;
    const supplierLinks: { id: string; type: "new" | "signed" }[] =
      (existing.supplierLinks as any[]) ?? [];

    await prisma.$transaction(async (tx) => {
      for (const link of supplierLinks) {
        if (link.type === "new") {
          const ns = await (tx as any).newSupplier.findUnique({ where: { id: link.id } });
          if (!ns) continue;
          const ids = (ns.buyerIds as string[]) ?? [];
          await (tx as any).newSupplier.update({
            where: { id: link.id },
            data: { buyerIds: ids.filter((bid: string) => bid !== buyerId) },
          });
        } else {
          const s = await tx.supplier.findUnique({ where: { id: link.id } });
          if (!s) continue;
          const ids = (s.buyerIds as string[]) ?? [];
          await tx.supplier.update({
            where: { id: link.id },
            data: { buyerIds: ids.filter((bid: string) => bid !== buyerId) as any },
          });
        }
      }
      await tx.buyer.delete({ where: { id: buyerId } });
    });

    await logActivity(req.user!.id, "delete", "buyers", buyerId, {
      company: existing.company,
    });

    res.json({ message: "Buyer deleted" });
  } catch (err) {
    console.error("Delete buyer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/buyers/list
 * Lightweight list for dropdown population
 */
export async function listBuyersForDropdown(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const buyers = await prisma.buyer.findMany({
      select: { id: true, company: true, name: true },
      orderBy: { company: "asc" },
    });
    res.json(buyers);
  } catch (err) {
    console.error("List buyers dropdown error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/buyers/export/csv
 */
export async function exportBuyersCsv(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { search = "", from, to } = req.query as Record<string, string>;

    const where: any = {};

    if (search) {
      where.OR = [
        { company: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const buyers = await prisma.buyer.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Company",
      "Trade Name",
      "Contact Person",
      "Contact Role",
      "Email",
      "Phone",
      "WhatsApp",
      "Country",
      "City",
      "Region",
      "Status",
      "Buyer Type",
      "Product Categories",
      "Product Category Interest",
      "Markets Served",
      "Annual Import Volume",
      "Annual Purchase Value",
      "Current Suppliers / Origins",
      "Sourcing Requirements (count)",
      "MOQ Requirements",
      "Pricing Range",
      "Preferred Currency",
      "Payment Terms",
      "Incoterms",
      "Certification Requirements",
      "Shipping Mode",
      "Ports of Discharge",
      "Country of Final Delivery",
      "Freight Forwarder",
      "How Heard About Us",
      "Trade Fair Name",
      "Risk Rating",
      "Strategic Value",
      "Lead Source",
      "Last Contact Date",
      "Notes",
      "Created At",
    ];

    const rows = (buyers as any[]).map((b) => [
      b.company,
      b.tradeName || "",
      b.name,
      b.contactRole || "",
      b.email,
      b.phone || "",
      b.whatsapp || "",
      b.country,
      b.city || "",
      b.region || "",
      b.status || "",
      b.buyerType || "",
      b.productCategories || "",
      b.productCategoryInterest || "",
      b.marketsServed || "",
      b.annualImportVolume || "",
      b.annualPurchaseValue || "",
      b.currentSuppliersOrigins || "",
      Array.isArray(b.sourcingRequirements) ? String(b.sourcingRequirements.length) : "0",
      b.moqRequirements || "",
      b.pricingRange || "",
      b.preferredCurrency || "",
      b.paymentTerms || "",
      b.incoterms || "",
      b.certificationRequirements || "",
      b.shippingMode || "",
      b.portsOfDischarge || "",
      b.countryOfFinalDelivery || "",
      b.freightForwarder || "",
      b.howHeardAboutUs || "",
      b.tradeFairName || "",
      b.riskRating || "",
      b.strategicValue || "",
      b.leadSource || "",
      b.lastContactDate ? b.lastContactDate.toISOString().split("T")[0] : "",
      b.notes || "",
      b.createdAt.toISOString().split("T")[0],
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=buyers_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    res.send(csvContent);
  } catch (err) {
    console.error("Export buyers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
