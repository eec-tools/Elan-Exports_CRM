import { Request, Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { logActivity } from "../services/activityLogger.js";
import { generateBuyerReportsPdf } from "../services/reportsPdf.service.js";
import { generateBuyerReportsExcel } from "../services/reportsExcel.service.js";

/**
 * GET /api/reports
 */
export async function listReports(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      search = "",
      page = "1",
      limit = "20",
      buyerSupplier,
      from,
      to,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      where.OR = [
        { productName: { contains: search, mode: "insensitive" } },
        { buyerName: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (buyerSupplier) {
      where.buyerSupplier = buyerSupplier;
    }

    if (from || to) {
      where.reportDate = {};
      if (from) {
        where.reportDate.gte = new Date(from);
      }
      if (to) {
        where.reportDate.lte = new Date(to);
      }
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: { creator: { select: { fullName: true, email: true } } },
      }),
      prisma.report.count({ where }),
    ]);

    res.json({
      data: reports,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("List reports error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/reports
 */
export async function createReport(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    // Handle image upload if multipart — productImageUrl may come from file or body
    const data = { ...req.body };

    // If using multer-storage-cloudinary, file path is the secure Cloudinary URL
    if ((req as any).file) {
      data.productImageUrl = (req as any).file.path;
    }

    const report = await prisma.report.create({
      data: {
        ...data,
        reportDate: new Date(data.reportDate),
        updateDate: data.updateDate ? new Date(data.updateDate) : null,
        createdBy: req.user!.id,
      },
    });

    await logActivity(req.user!.id, "create", "reports", report.id, {
      productName: report.productName,
      buyerName: report.buyerName,
    });

    res.status(201).json(report);
  } catch (err) {
    console.error("Create report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/reports/:id
 */
export async function updateReport(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const existing = await prisma.report.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const data = { ...req.body };
    if (data.reportDate) data.reportDate = new Date(data.reportDate);
    if (data.updateDate) data.updateDate = new Date(data.updateDate);

    if ((req as any).file) {
      data.productImageUrl = (req as any).file.path;
    }

    const report = await prisma.report.update({
      where: { id: req.params.id },
      data,
    });

    await logActivity(req.user!.id, "update", "reports", report.id, {
      productName: report.productName,
    });

    res.json(report);
  } catch (err) {
    console.error("Update report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/reports/:id
 */
export async function deleteReport(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const existing = await prisma.report.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    await prisma.report.delete({ where: { id: req.params.id } });

    await logActivity(req.user!.id, "delete", "reports", req.params.id, {
      productName: existing.productName,
    });

    res.json({ message: "Report deleted" });
  } catch (err) {
    console.error("Delete report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/reports/:id/resync
 * Re-calculates companyName from the buyer's actual current supplierLinks
 * and re-appends any missing key update note for the resync action.
 */
export async function resyncReportSuppliers(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const existing = await prisma.report.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const buyerNames = existing.buyerName
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Case-insensitive lookup for each buyer name
    const allBuyers: any[] = [];
    for (const name of buyerNames) {
      const found = await prisma.buyer.findMany({
        where: { company: { equals: name, mode: "insensitive" } },
      });
      allBuyers.push(...found);
    }

    // If no exact match found, try partial match as fallback
    if (allBuyers.length === 0) {
      for (const name of buyerNames) {
        const found = await prisma.buyer.findMany({
          where: { company: { contains: name, mode: "insensitive" } },
        });
        allBuyers.push(...found);
      }
    }

    const allSupplierNames = new Set<string>();
    for (const b of allBuyers) {
      const links = Array.isArray(b.supplierLinks) ? b.supplierLinks : [];
      for (const l of links as any[]) {
        if (l.type === "new") {
          const s = await (prisma as any).newSupplier.findUnique({ where: { id: l.id } });
          if (s) allSupplierNames.add(s.company);
        } else {
          const s = await prisma.supplier.findUnique({ where: { id: l.id } });
          if (s) allSupplierNames.add(s.company);
        }
      }
    }

    const supplierList = Array.from(allSupplierNames);
    const newCompanyName =
      supplierList.length > 0
        ? supplierList.join(", ")
        : existing.companyName; // preserve existing if none found

    const date = new Date().toLocaleDateString();
    const resyncNote =
      supplierList.length > 0
        ? `[${date}] Suppliers in talks: ${supplierList.join(", ")}.`
        : `[${date}] No linked suppliers found on buyer profile.`;

    const updatedKeyUpdates = existing.keyUpdates
      ? `${resyncNote}\n\n${existing.keyUpdates}`
      : resyncNote;

    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: {
        companyName: newCompanyName,
        keyUpdates: updatedKeyUpdates,
        updateDate: new Date(),
      },
    });

    res.json(report);
  } catch (err) {
    console.error("Resync report suppliers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/reports/export/pdf
 */
export async function exportPdf(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { buyerSupplier, from, to } = req.query as Record<string, string>;

    const where: any = {};
    if (buyerSupplier) {
      where.buyerSupplier = buyerSupplier;
    }
    if (from || to) {
      where.reportDate = {};
      if (from) where.reportDate.gte = new Date(from);
      if (to) where.reportDate.lte = new Date(to);
    }

    const reports = await prisma.report.findMany({
      where,
      orderBy: [
         { buyerName: "asc" },
         { reportDate: "desc" }
      ],
    });

    if (reports.length === 0) {
      res.status(404).json({ error: "No reports found to export" });
      return;
    }

    const pdfBuffer = await generateBuyerReportsPdf(reports);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="buyer-reports-export.pdf"`,
      "Content-Length": String(pdfBuffer.length),
    });

    res.send(pdfBuffer);
    
    // Log export asynchronously without impacting the response.
    if (req.user?.id) {
      logActivity(req.user.id, "export", "reports", "pdf", {}).catch(console.error);
    }

  } catch (err) {
    console.error("Export PDF error:", err);
    res.status(500).json({ error: "Internal server error generating PDF" });
  }
}

/**
 * GET /api/reports/export/excel
 */
export async function exportExcel(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { buyerSupplier, from, to } = req.query as Record<string, string>;

    const where: any = {};
    if (buyerSupplier) {
      where.buyerSupplier = buyerSupplier;
    }
    if (from || to) {
      where.reportDate = {};
      if (from) where.reportDate.gte = new Date(from);
      if (to) where.reportDate.lte = new Date(to);
    }

    const reports = await prisma.report.findMany({
      where,
      orderBy: [
         { buyerName: "asc" },
         { reportDate: "desc" }
      ],
    });

    if (reports.length === 0) {
      res.status(404).json({ error: "No reports found to export" });
      return;
    }

    const excelBuffer = await generateBuyerReportsExcel(reports);

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="buyer-reports-export.xlsx"`,
      "Content-Length": String(excelBuffer.length),
    });

    res.send(excelBuffer);
    
    // Log export asynchronously without impacting the response.
    if (req.user?.id) {
      logActivity(req.user.id, "export", "reports", "excel", {}).catch(console.error);
    }

  } catch (err) {
    console.error("Export Excel error:", err);
    res.status(500).json({ error: "Internal server error generating Excel" });
  }
}

/**
 * POST /api/reports/merge-duplicates
 * Merges duplicate report rows (same companyName + productName, case-insensitive).
 * Keeps the oldest row, merges buyerName, concatenates keyUpdates, takes most recent status.
 */
export async function mergeDuplicateReports(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const allReports = await prisma.report.findMany({ orderBy: { createdAt: 'asc' } });

    // Group by companyName::productName (case-insensitive key)
    const groups = new Map<string, typeof allReports>();
    for (const report of allReports) {
      const key = `${(report.companyName || "").toLowerCase()}::${(report.productName || "").toLowerCase()}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(report);
    }

    let mergedCount = 0;
    const mergeResults: { kept: string; deleted: string[] }[] = [];

    for (const [_key, reports] of groups) {
      if (reports.length <= 1) continue;

      // Keep the oldest row (first in ASC order)
      const base = reports[0];
      const extras = reports.slice(1);

      // Merge buyerName — deduplicated comma list
      const allBuyerNames = new Set<string>();
      for (const r of reports) {
        if (r.buyerName) {
          for (const name of r.buyerName.split(",").map(s => s.trim()).filter(Boolean)) {
            allBuyerNames.add(name);
          }
        }
      }
      const mergedBuyerName = allBuyerNames.size > 0
        ? Array.from(allBuyerNames).join(", ")
        : base.buyerName;

      // Concatenate ALL keyUpdates — deduplicate individual lines, sort newest-first
      const allUpdateLines = new Set<string>();
      for (const r of reports) {
        if (r.keyUpdates) {
          for (const line of r.keyUpdates.split("\n").map(l => l.trim()).filter(Boolean)) {
            allUpdateLines.add(line);
          }
        }
      }
      // Sort by date extracted from [DATE] prefix, newest first
      const sortedLines = Array.from(allUpdateLines).sort((a, b) => {
        const dateA = a.match(/^\[(.*?)\]/)?.[1] || "";
        const dateB = b.match(/^\[(.*?)\]/)?.[1] || "";
        const parsedA = new Date(dateA).getTime() || 0;
        const parsedB = new Date(dateB).getTime() || 0;
        return parsedB - parsedA; // newest first
      });
      const mergedKeyUpdates = sortedLines.join("\n\n");

      // Take the most recent status and updateDate
      let latestStatus = base.status;
      let latestUpdateDate = base.updateDate;
      for (const r of reports) {
        if (r.updateDate && (!latestUpdateDate || r.updateDate > latestUpdateDate)) {
          latestUpdateDate = r.updateDate;
          latestStatus = r.status;
        }
      }

      // Take the most recent product image if base doesn't have one
      let productImageUrl = base.productImageUrl;
      if (!productImageUrl) {
        for (const r of extras) {
          if (r.productImageUrl) {
            productImageUrl = r.productImageUrl;
            break;
          }
        }
      }

      // Update the base row with merged data
      await prisma.report.update({
        where: { id: base.id },
        data: {
          buyerName: mergedBuyerName,
          keyUpdates: mergedKeyUpdates || base.keyUpdates,
          status: latestStatus,
          updateDate: latestUpdateDate,
          ...(productImageUrl && { productImageUrl }),
        },
      });

      // Delete extra rows
      const deletedIds = extras.map(r => r.id);
      await prisma.report.deleteMany({
        where: { id: { in: deletedIds } },
      });

      mergedCount += extras.length;
      mergeResults.push({ kept: base.id, deleted: deletedIds });
    }

    res.json({
      merged: mergedCount,
      groupsProcessed: mergeResults.length,
      groups: mergeResults,
    });
  } catch (err) {
    console.error("Merge duplicate reports error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
