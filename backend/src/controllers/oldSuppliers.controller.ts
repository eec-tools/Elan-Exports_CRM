import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { logActivity } from "../services/activityLogger.js";

/**
 * GET /api/old-suppliers
 */
export async function listOldSuppliers(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      search = "",
      page = "1",
      limit = "20",
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
      ];
    }

    const [suppliers, total] = await Promise.all([
      prisma.oldSupplier.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      prisma.oldSupplier.count({ where }),
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
    console.error("List old suppliers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/old-suppliers/:id
 */
export async function getOldSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const supplier = await prisma.oldSupplier.findUnique({
      where: { id: req.params.id },
    });

    if (!supplier) {
      res.status(404).json({ error: "Old supplier not found" });
      return;
    }

    res.json(supplier);
  } catch (err) {
    console.error("Get old supplier error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/old-suppliers
 */
export async function createOldSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      company, productCategory, product, country, accountManager,
      currentStatus, certifications, latestQuotation, reasonInactive,
      dateMarkedInactive, reactivationPotential, notes
    } = req.body;

    const supplier = await prisma.oldSupplier.create({
      data: {
        company, productCategory, product, country, accountManager,
        currentStatus, certifications, latestQuotation, reasonInactive,
        dateMarkedInactive, reactivationPotential, notes,
        createdBy: req.user!.id,
      },
    });

    await logActivity(req.user!.id, "create", "old_suppliers", supplier.id, {
      company: supplier.company,
    });

    res.status(201).json(supplier);
  } catch (err) {
    console.error("Create old supplier error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/old-suppliers/:id
 */
export async function updateOldSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const existing = await prisma.oldSupplier.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ error: "Old supplier not found" });
      return;
    }

    const {
      company, productCategory, product, country, accountManager,
      currentStatus, certifications, latestQuotation, reasonInactive,
      dateMarkedInactive, reactivationPotential, notes
    } = req.body;

    const supplier = await prisma.oldSupplier.update({
      where: { id: req.params.id },
      data: {
        company, productCategory, product, country, accountManager,
        currentStatus, certifications, latestQuotation, reasonInactive,
        dateMarkedInactive, reactivationPotential, notes
      },
    });

    await logActivity(req.user!.id, "update", "old_suppliers", supplier.id, {
      company: supplier.company,
    });

    res.json(supplier);
  } catch (err) {
    console.error("Update old supplier error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/old-suppliers/:id
 */
export async function deleteOldSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const existing = await prisma.oldSupplier.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ error: "Old supplier not found" });
      return;
    }

    await prisma.oldSupplier.delete({ where: { id: req.params.id } });

    await logActivity(req.user!.id, "delete", "old_suppliers", req.params.id, {
      company: existing.company,
    });

    res.json({ message: "Old supplier deleted" });
  } catch (err) {
    console.error("Delete old supplier error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/old-suppliers/export/csv
 */
export async function exportOldSuppliersCsv(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { search = "" } = req.query as Record<string, string>;

    const where: any = {};
    if (search) {
      where.OR = [
        { company: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
        { productCategory: { contains: search, mode: "insensitive" } },
        { product: { contains: search, mode: "insensitive" } },
        { accountManager: { contains: search, mode: "insensitive" } },
        { currentStatus: { contains: search, mode: "insensitive" } },
      ];
    }

    const suppliers = await prisma.oldSupplier.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Company Name",
      "Product Category",
      "Product",
      "Country",
      "Account Manager",
      "Current Status",
      "Certifications",
      "Latest Quotation",
      "Reason Inactive",
      "Date Marked Inactive",
      "Reactivation Potential",
      "Notes",
      "Created At"
    ];

    const rows = suppliers.map((s) => [
      s.company,
      s.productCategory || "",
      s.product || "",
      s.country || "",
      s.accountManager || "",
      s.currentStatus || "",
      s.certifications || "",
      s.latestQuotation || "",
      s.reasonInactive || "",
      s.dateMarkedInactive || "",
      s.reactivationPotential || "",
      s.notes || "",
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
      `attachment; filename=old_suppliers_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    res.send(csvContent);
  } catch (err) {
    console.error("Export old suppliers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
