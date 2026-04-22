import { Response } from "express";
import { randomUUID } from "crypto";
import PDFDocument from "pdfkit";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

const QUOTATION_FIELDS = [
  "supplierName",
  "supplierWebsite",
  "date",
  "hsCode",
  "product",
  "fclDetails",
  "fobSupplierPrice",
  "fobCommissionPercent",
  "fobWithCommission",
  "cifSupplierPrice",
  "cifWithCommission",
  "loadability",
  "packing",
  "paymentTerms",
  "origin",
  "priceValidity",
  "supplierCertifications",
  "leadTime",
  "supplierComments",
  "quantityDetails",
  "monthlyVolume",
  "yearlyVolume",
  "palette",
  "buyerSpecifications",
  "fieldConfig",
  "fieldSources",
  "linkedSupplierId",
  "linkedSupplierType",
  "status",
] as const;

// Immutable fields that can never be updated via PUT
const FORBIDDEN_UPDATE_FIELDS = new Set([
  "id",
  "formToken",
  "createdAt",
  "createdBy",
]);

export const QUOTATION_FIELD_LABELS: Record<string, string> = {
  supplierName: "Supplier",
  supplierWebsite: "Website",
  date: "Date",
  hsCode: "HS Code",
  product: "Product",
  fclDetails: "FCL Details",
  fobSupplierPrice: "FOB — Supplier's Price",
  fobCommissionPercent: "FOB — Commission %",
  fobWithCommission: "FOB — With Commission",
  cifSupplierPrice: "CIF — Supplier's Price",
  cifWithCommission: "CIF — With Commission",
  loadability: "Loadability",
  packing: "Packing",
  paymentTerms: "Payment Terms",
  origin: "Origin",
  priceValidity: "Price Validity",
  supplierCertifications: "Supplier Certifications",
  leadTime: "Lead Time",
  supplierComments: "Supplier Comments on Specs",
  quantityDetails: "Quantity Details",
  monthlyVolume: "Monthly Volume",
  yearlyVolume: "Yearly Volume",
  palette: "Palette",
};

/**
 * GET /api/quotations
 */
export async function listQuotations(
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
        { supplierName: { contains: search, mode: "insensitive" } },
        { product: { contains: search, mode: "insensitive" } },
        { hsCode: { contains: search, mode: "insensitive" } },
        { origin: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status && status !== "all") {
      where.status = status;
    }

    const [quotations, total] = await Promise.all([
      (prisma as any).quotation.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      (prisma as any).quotation.count({ where }),
    ]);

    res.json({
      data: quotations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("List quotations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/quotations/stats
 */
export async function getQuotationStats(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const [total, pending, formSent, responseReceived, negotiating, finalized] =
      await Promise.all([
        (prisma as any).quotation.count(),
        (prisma as any).quotation.count({ where: { status: "pending" } }),
        (prisma as any).quotation.count({ where: { status: "form_sent" } }),
        (prisma as any).quotation.count({
          where: { status: "response_received" },
        }),
        (prisma as any).quotation.count({ where: { status: "negotiating" } }),
        (prisma as any).quotation.count({ where: { status: "finalized" } }),
      ]);
    res.json({
      total,
      pending,
      formSent,
      responseReceived,
      negotiating,
      finalized,
    });
  } catch (err) {
    console.error("Quotation stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/quotations/search-suppliers?q=
 * Search NewSupplier + Supplier tables by company name for autocomplete.
 */
export async function searchSuppliers(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const q = (req.query.q as string) || "";

    const where = q
      ? { company: { contains: q, mode: "insensitive" as const } }
      : {};

    const [newSuppliers, signedSuppliers] = await Promise.all([
      (prisma as any).newSupplier.findMany({
        where,
        take: 15,
        orderBy: { company: "asc" },
        select: { id: true, company: true, email: true },
      }),
      (prisma as any).supplier.findMany({
        where,
        take: 15,
        orderBy: { company: "asc" },
        select: { id: true, company: true, email: true },
      }),
    ]);

    const results = [
      ...newSuppliers.map((s: any) => ({ ...s, supplierType: "new" })),
      ...signedSuppliers.map((s: any) => ({ ...s, supplierType: "signed" })),
    ]
      .sort((a, b) => a.company.localeCompare(b.company))
      .slice(0, 20);

    res.json(results);
  } catch (err) {
    console.error("Search suppliers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/quotations/:id
 */
export async function getQuotation(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const quotation = await (prisma as any).quotation.findUnique({
      where: { id: req.params.id },
    });
    if (!quotation) {
      res.status(404).json({ error: "Quotation not found" });
      return;
    }
    res.json(quotation);
  } catch (err) {
    console.error("Get quotation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/quotations
 */
export async function createQuotation(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      supplierName,
      linkedSupplierId,
      linkedSupplierType,
      supplierWebsite,
      product,
      fieldConfig,
    } = req.body;

    if (!supplierName) {
      res.status(400).json({ error: "Supplier name is required" });
      return;
    }

    const quotation = await (prisma as any).quotation.create({
      data: {
        supplierName,
        linkedSupplierId: linkedSupplierId ?? null,
        linkedSupplierType: linkedSupplierType ?? null,
        supplierWebsite: supplierWebsite ?? null,
        product: product ?? null,
        fieldConfig: fieldConfig ?? {},
        fieldSources: {},
        status: "pending",
        formToken: randomUUID(),
        createdBy: req.user!.id,
      },
    });

    res.status(201).json(quotation);
  } catch (err) {
    console.error("Create quotation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/quotations/:id
 */
export async function updateQuotation(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await (prisma as any).quotation.findUnique({
      where: { id },
    });
    if (!existing) {
      res.status(404).json({ error: "Quotation not found" });
      return;
    }

    const updateData: any = {};
    for (const field of QUOTATION_FIELDS) {
      if (
        req.body[field] !== undefined &&
        !FORBIDDEN_UPDATE_FIELDS.has(field)
      ) {
        updateData[field] = req.body[field];
      }
    }

    const updated = await (prisma as any).quotation.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (err) {
    console.error("Update quotation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/quotations/:id
 */
export async function deleteQuotation(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    await (prisma as any).quotation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete quotation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/quotations/:id/regenerate-token
 * Generate a new formToken for re-sending to supplier.
 */
export async function regenerateToken(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const updated = await (prisma as any).quotation.update({
      where: { id },
      data: { formToken: randomUUID(), status: "form_sent" },
    });
    res.json({ formToken: updated.formToken });
  } catch (err) {
    console.error("Regenerate token error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/quotations/:id/export-pdf?mode=supplier|all
 */
export async function exportQuotationPdf(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const mode = (req.query.mode as string) === "all" ? "all" : "supplier";

    const quotation = await (prisma as any).quotation.findUnique({
      where: { id },
    });
    if (!quotation) {
      res.status(404).json({ error: "Quotation not found" });
      return;
    }

    const fieldConfig: Record<
      string,
      { sentToSupplier: boolean; mandatory: boolean }
    > = (quotation.fieldConfig as any) || {};

    const doc = new PDFDocument({ margin: 0, size: "A4", bufferPages: true });
    const filename = `Quotation_${quotation.supplierName.replace(/\s+/g, "_")}_${(id ?? "").slice(0, 8)}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // ── Color palette ──
    const DB = "#1B3A5C";
    const MB = "#2C5282";
    const LB = "#EBF0F5";
    const WH = "#FFFFFF";
    const DT = "#1A202C";
    const GT = "#718096";
    const BD = "#CBD5E0";

    const PW = 595.28;
    const PH = 841.89;
    const MX = 40;
    const CW = PW - 2 * MX;
    const C1W = 190;
    const C2W = CW - C1W;
    const PAD = 8;
    const MIN_RH = 28;
    const FOOTER_H = 35;
    const BOTTOM_MARGIN = FOOTER_H + 25;

    // ── Field sections for grouping ──
    const sections = [
      {
        title: "Supplier Information",
        keys: ["supplierName", "supplierWebsite", "date"],
      },
      { title: "Product Details", keys: ["product", "hsCode", "origin"] },
      {
        title: "FOB Pricing",
        keys: ["fobSupplierPrice", "fobCommissionPercent", "fobWithCommission"],
      },
      { title: "CIF Pricing", keys: ["cifSupplierPrice", "cifWithCommission"] },
      {
        title: "Logistics",
        keys: ["fclDetails", "loadability", "packing", "leadTime"],
      },
      { title: "Terms & Validity", keys: ["paymentTerms", "priceValidity"] },
      {
        title: "Volume & Quantity",
        keys: ["quantityDetails", "monthlyVolume", "yearlyVolume", "palette"],
      },
      {
        title: "Certifications & Comments",
        keys: ["supplierCertifications", "supplierComments"],
      },
    ];

    // Collect visible rows per section
    type Row = { label: string; value: string; isInternal: boolean };
    type Section = { title: string; rows: Row[] };
    const visibleSections: Section[] = [];

    for (const sec of sections) {
      const rows: Row[] = [];
      for (const key of sec.keys) {
        const config = fieldConfig[key];
        const sentToSupplier = config?.sentToSupplier ?? true;
        const value = quotation[key] as string | null;
        if (mode === "supplier" && !sentToSupplier) continue;
        if (!value) continue;
        rows.push({
          label: QUOTATION_FIELD_LABELS[key],
          value,
          isInternal: !sentToSupplier,
        });
      }
      if (rows.length > 0) {
        visibleSections.push({ title: sec.title, rows });
      }
    }

    // Buyer specs section (all mode only)
    if (mode === "all") {
      const buyerSpecs = quotation.buyerSpecifications as Record<
        string,
        string
      > | null;
      if (buyerSpecs && Object.values(buyerSpecs).some(Boolean)) {
        const specLabels: Record<string, string> = {
          targetPrice: "Target Price",
          specs: "Specifications / Requirements",
          requiredCertifications: "Required Certifications",
          notes: "Notes",
        };
        const rows: Row[] = [];
        for (const [k, lbl] of Object.entries(specLabels)) {
          if (buyerSpecs[k])
            rows.push({ label: lbl, value: buyerSpecs[k], isInternal: true });
        }
        if (rows.length > 0)
          visibleSections.push({
            title: "Buyer's Specifications (Internal)",
            rows,
          });
      }
    }

    // ── Drawing helpers ──
    const fillRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      c: string,
    ) => {
      doc.save().rect(x, y, w, h).fill(c);
    };
    const hLine = (x1: number, x2: number, yy: number, c = BD, lw = 0.5) => {
      doc
        .save()
        .strokeColor(c)
        .lineWidth(lw)
        .moveTo(x1, yy)
        .lineTo(x2, yy)
        .stroke();
    };
    const vLine = (x: number, y1: number, y2: number, c = BD, lw = 0.5) => {
      doc
        .save()
        .strokeColor(c)
        .lineWidth(lw)
        .moveTo(x, y1)
        .lineTo(x, y2)
        .stroke();
    };

    const drawTableHeader = (sy: number): number => {
      const h = 32;
      fillRect(MX, sy, CW, h, DB);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(WH)
        .text("Field", MX + PAD, sy + 9, { width: C1W - 2 * PAD });
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(WH)
        .text("Details", MX + C1W + PAD, sy + 9, { width: C2W - 2 * PAD });
      return sy + h;
    };

    const drawSectionHeader = (sy: number, title: string): number => {
      const h = 28;
      fillRect(MX, sy, CW, h, MB);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(WH)
        .text(title, MX + PAD, sy + 8, { width: CW - 2 * PAD });
      return sy + h;
    };

    // ── Page 1: Header banner ──
    let y = 0;

    fillRect(0, 0, PW, 85, DB);
    doc
      .font("Helvetica-Bold")
      .fontSize(26)
      .fillColor(WH)
      .text("QUOTATION", MX, 22, { width: CW, align: "center" });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#B0C4DE")
      .text("Elan Exports", MX, 52, { width: CW, align: "center" });

    // Sub-info bar
    fillRect(0, 85, PW, 36, MB);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(WH)
      .text(`Supplier: ${quotation.supplierName || "—"}`, MX + PAD, 96, {
        width: CW / 2,
      });
    const rightParts = [quotation.product, quotation.date]
      .filter(Boolean)
      .join("  |  ");
    if (rightParts) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(WH)
        .text(rightParts, MX + CW / 2 + PAD, 96, {
          width: CW / 2 - PAD,
          align: "right",
        });
    }

    y = 135;
    y = drawTableHeader(y);

    let rowIndex = 0;

    for (const sec of visibleSections) {
      // Section header
      if (y + 28 > PH - BOTTOM_MARGIN) {
        doc.addPage();
        y = 40;
        y = drawTableHeader(y);
      }
      y = drawSectionHeader(y, sec.title);

      for (const row of sec.rows) {
        // Calculate dynamic row height
        doc.font("Helvetica").fontSize(9);
        const valH = doc.heightOfString(row.value, { width: C2W - 2 * PAD });
        doc.font("Helvetica-Bold").fontSize(9);
        const lblText = row.label + (row.isInternal ? " (Internal)" : "");
        const lblH = doc.heightOfString(lblText, { width: C1W - 2 * PAD });
        const rh = Math.max(MIN_RH, Math.max(valH, lblH) + 2 * PAD);

        // Page break check
        if (y + rh > PH - BOTTOM_MARGIN) {
          doc.addPage();
          y = 40;
          y = drawTableHeader(y);
          y = drawSectionHeader(y, sec.title);
        }

        // Row background
        fillRect(MX, y, CW, rh, rowIndex % 2 === 0 ? WH : LB);

        // Cell borders
        hLine(MX, MX + CW, y);
        vLine(MX, y, y + rh);
        vLine(MX + C1W, y, y + rh);
        vLine(MX + CW, y, y + rh);

        // Label cell
        const lc = row.isInternal ? GT : DT;
        const lf = row.isInternal ? "Helvetica" : "Helvetica-Bold";
        doc
          .font(lf)
          .fontSize(9)
          .fillColor(lc)
          .text(lblText, MX + PAD, y + PAD, { width: C1W - 2 * PAD });

        // Value cell
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(row.isInternal ? GT : DT)
          .text(row.value, MX + C1W + PAD, y + PAD, { width: C2W - 2 * PAD });

        y += rh;
        rowIndex++;
      }
    }

    // Table bottom border
    hLine(MX, MX + CW, y, DB, 1.5);

    // ── Footers on every page ──
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      fillRect(0, PH - FOOTER_H, PW, FOOTER_H, DB);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#B0C4DE")
        .text("Elan Exports — Quotation", MX, PH - FOOTER_H + 10, {
          width: CW,
          align: "center",
        });
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#8AACC8")
        .text(`Page ${i + 1} of ${range.count}`, MX, PH - FOOTER_H + 22, {
          width: CW,
          align: "center",
        });
    }

    doc.end();
  } catch (err) {
    console.error("Export PDF error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
