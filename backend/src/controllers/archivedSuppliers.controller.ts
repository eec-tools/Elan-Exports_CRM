import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

function hasPerm(req: AuthRequest, permission: string): boolean {
  if (req.user?.roles.includes("admin")) return true;
  return !!req.user?.permissions.some((p) => p.permission === permission);
}

/**
 * GET /api/archived-suppliers
 * Aggregates archived rows across SourcingSupplier, NewSupplier, Supplier
 * (Signed) and OldSupplier, scoped to whichever of those the requesting
 * user actually has permission for.
 */
export async function listArchivedSuppliers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { search = "" } = req.query as Record<string, string>;

    const searchOr = search
      ? [
          { company: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { country: { contains: search, mode: "insensitive" as const } },
        ]
      : undefined;

    const rows: any[] = [];

    if (hasPerm(req, "sourcing_suppliers")) {
      const sourcingSuppliers = await (prisma as any).sourcingSupplier.findMany({
        where: { isArchived: true, ...(searchOr ? { OR: searchOr } : {}) },
        orderBy: { archivedAt: "desc" },
      });
      rows.push(
        ...sourcingSuppliers.map((s: any) => ({
          id: s.id,
          sourceType: "sourcing_supplier",
          sourceLabel: "Sourcing Supplier",
          company: s.company,
          contactPerson: s.contactPerson,
          email: s.email,
          phone: s.phone,
          country: s.country,
          product: s.product ?? s.productCategory,
          archivedAt: s.archivedAt,
          archivedBy: s.archivedBy,
          detailPath: `/suppliers/sourcing/${s.id}`,
        })),
      );
    }

    if (hasPerm(req, "new_suppliers")) {
      const newSuppliers = await (prisma as any).newSupplier.findMany({
        where: { isArchived: true, ...(searchOr ? { OR: searchOr } : {}) },
        orderBy: { archivedAt: "desc" },
      });
      rows.push(
        ...newSuppliers.map((s: any) => ({
          id: s.id,
          sourceType: "new_supplier",
          sourceLabel: "New Supplier",
          company: s.company,
          contactPerson: s.contactPerson,
          email: s.email,
          phone: s.phone,
          country: s.country,
          product: s.product ?? s.productCategory,
          archivedAt: s.archivedAt,
          archivedBy: s.archivedBy,
          detailPath: `/suppliers/new/${s.id}`,
        })),
      );
    }

    if (hasPerm(req, "signed_suppliers") || hasPerm(req, "suppliers")) {
      const suppliers = await prisma.supplier.findMany({
        where: { isArchived: true, ...(searchOr ? { OR: searchOr } : {}) },
        orderBy: { archivedAt: "desc" },
      });
      rows.push(
        ...suppliers.map((s) => ({
          id: s.id,
          sourceType: "signed_supplier",
          sourceLabel: "Signed Supplier",
          company: s.company,
          contactPerson: s.contactPerson,
          email: s.email,
          phone: s.phone,
          country: s.country,
          product: s.products,
          archivedAt: s.archivedAt,
          archivedBy: s.archivedBy,
          detailPath: `/suppliers/signed-contract/${s.id}`,
        })),
      );
    }

    if (hasPerm(req, "old_suppliers")) {
      const oldSuppliers = await prisma.oldSupplier.findMany({
        where: { isArchived: true, ...(searchOr ? { OR: searchOr } : {}) },
        orderBy: { archivedAt: "desc" },
      });
      rows.push(
        ...oldSuppliers.map((s) => ({
          id: s.id,
          sourceType: "old_supplier",
          sourceLabel: "Old Supplier",
          company: s.company,
          contactPerson: s.contactPerson,
          email: s.email,
          phone: s.phone,
          country: s.country,
          product: s.product ?? s.productCategory,
          archivedAt: s.archivedAt,
          archivedBy: s.archivedBy,
          detailPath: `/suppliers/old?archived=${s.id}`,
        })),
      );
    }

    rows.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());

    res.json({ data: rows, total: rows.length });
  } catch (err) {
    console.error("List archived suppliers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
