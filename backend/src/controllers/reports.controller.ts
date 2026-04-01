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
