import { Request, Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { logActivity } from "../services/activityLogger.js";

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
    const buyer = await prisma.buyer.create({
      data: {
        ...req.body,
        createdBy: req.user!.id,
      },
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

    const buyer = await prisma.buyer.update({
      where: { id: req.params.id },
      data: req.body,
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

    await prisma.buyer.delete({ where: { id: req.params.id } });

    await logActivity(req.user!.id, "delete", "buyers", req.params.id, {
      company: existing.company,
    });

    res.json({ message: "Buyer deleted" });
  } catch (err) {
    console.error("Delete buyer error:", err);
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
      "Contact Person",
      "Email",
      "Phone",
      "Country",
      "Region",
      "Status",
      "Product Category Interest",
      "MOQ Requirements",
      "Pricing Range",
      "Certification Requirements",
      "Payment Terms",
      "Incoterms",
      "Risk Rating",
      "Strategic Value",
      "Lead Source",
      "Last Contact Date",
      "Required Products",
      "Notes",
      "Created At",
    ];

    const rows = buyers.map((b) => [
      b.company,
      b.name,
      b.email,
      b.phone || "",
      b.country,
      b.region || "",
      b.status || "",
      b.productCategoryInterest || "",
      b.moqRequirements || "",
      b.pricingRange || "",
      b.certificationRequirements || "",
      b.paymentTerms || "",
      b.incoterms || "",
      b.riskRating || "",
      b.strategicValue || "",
      b.leadSource || "",
      b.lastContactDate ? b.lastContactDate.toISOString().split("T")[0] : "",
      Array.isArray(b.requiredProducts)
        ? (b.requiredProducts as any[]).map((p: any) => p.name).join("; ")
        : "",
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
