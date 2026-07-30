import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

function hasPerm(req: AuthRequest, permission: string): boolean {
  if (req.user?.roles.includes("admin")) return true;
  return !!req.user?.permissions.some((p) => p.permission === permission);
}

/**
 * GET /api/archived-buyers
 * Aggregates archived rows across Buyer (Buyers Directory) and SourcingBuyer
 * (Sourcing Buyer), scoped to whichever of those two the requesting user
 * actually has permission for.
 */
export async function listArchivedBuyers(req: AuthRequest, res: Response): Promise<void> {
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

    if (hasPerm(req, "buyers_directory")) {
      const buyers = await prisma.buyer.findMany({
        where: { isArchived: true, ...(searchOr ? { OR: searchOr } : {}) },
        orderBy: { archivedAt: "desc" },
      });
      rows.push(
        ...buyers.map((b) => ({
          id: b.id,
          sourceType: "buyer",
          sourceLabel: "Buyers Directory",
          company: b.company,
          contactPerson: b.name,
          email: b.email,
          phone: b.phone,
          country: b.country,
          product: b.productCategoryInterest,
          archivedAt: b.archivedAt,
          archivedBy: b.archivedBy,
          detailPath: `/buyers/${b.id}`,
        })),
      );
    }

    if (hasPerm(req, "sourcing_buyers")) {
      const sourcingBuyers = await (prisma as any).sourcingBuyer.findMany({
        where: { isArchived: true, ...(searchOr ? { OR: searchOr } : {}) },
        orderBy: { archivedAt: "desc" },
      });
      rows.push(
        ...sourcingBuyers.map((b: any) => ({
          id: b.id,
          sourceType: "sourcing_buyer",
          sourceLabel: "Sourcing Buyer",
          company: b.company,
          contactPerson: b.contactPerson,
          email: b.email,
          phone: b.phone,
          country: b.country,
          product: b.product ?? b.productCategory,
          archivedAt: b.archivedAt,
          archivedBy: b.archivedBy,
          detailPath: `/buyers/sourcing/${b.id}`,
        })),
      );
    }

    rows.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());

    res.json({ data: rows, total: rows.length });
  } catch (err) {
    console.error("List archived buyers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
