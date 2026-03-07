import { Request, Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { logActivity } from "../services/activityLogger.js";

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
      where.currentStatus = status;
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

    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: req.body,
    });

    await logActivity(req.user!.id, "update", "suppliers", supplier.id, {
      company: supplier.company,
    });

    res.json(supplier);
  } catch (err) {
    console.error("Update supplier error:", err);
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

    await prisma.supplier.delete({ where: { id: req.params.id } });

    await logActivity(req.user!.id, "delete", "suppliers", req.params.id, {
      company: existing.company,
    });

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
    const { search = "" } = req.query as Record<string, string>;

    const where: any = {};
    if (search) {
      where.OR = [
        { company: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
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
