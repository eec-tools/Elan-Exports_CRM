import PDFDocument from "pdfkit";
import { Report } from "@prisma/client";
import { format } from "date-fns";

export async function generateBuyerReportsPdf(reports: Report[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 28,
      bufferPages: true,
      info: {
        Title: "Master Production Report – Elan Exports",
        Author: "Elan Exports CRM",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const safeText = (value: unknown, fallback = "—"): string => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : fallback;
      }
      return fallback;
    };

    const safeDate = (value: unknown): Date | null => {
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(value as string);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    // ── Colours & Fonts ──────────────────────────────────────────────
    const BRAND   = "#2563EB";
    const HEADER_BG  = "#1E3A5F";
    const COL_HDR_BG = "#F1F5F9";
    const ROW_EVEN   = "#FFFFFF";
    const ROW_ODD    = "#F8FAFC";
    const BORDER     = "#E2E8F0";
    const TEXT_DARK  = "#111827";
    const TEXT_MID   = "#374151";
    const TEXT_LIGHT = "#6B7280";
    const BADGE_BG   = "#EFF6FF";
    const BADGE_TEXT = "#1E40AF";

    const PAGE_W  = doc.page.width;
    const PAGE_H  = doc.page.height;
    const MARGIN  = 28;
    const TABLE_W = PAGE_W - MARGIN * 2;

    // Column widths (landscape A4 ~841pt wide, table ~785pt)
    const COLS = {
      no:       32,
      buyer:    90,
      product:  120,
      supplier: 110,
      status:   80,
      updated:  72,
      updates:  0, // fill remainder
    };
    COLS.updates = TABLE_W - COLS.no - COLS.buyer - COLS.product - COLS.supplier - COLS.status - COLS.updated;

    const COL_ORDER: (keyof typeof COLS)[] = ["no", "buyer", "product", "supplier", "status", "updated", "updates"];
    const COL_LABELS: Record<keyof typeof COLS, string> = {
      no:       "#",
      buyer:    "Buyer",
      product:  "Product",
      supplier: "Supplier",
      status:   "Status",
      updated:  "Updated",
      updates:  "Key Updates",
    };

    const ROW_H   = 42; // minimum row height
    const HDR_H   = 20; // column header height
    const FONT_SM = 8;
    const FONT_MD = 9;

    // ── Page Header ─────────────────────────────────────────────────
    function drawPageHeader() {
      // Background bar
      doc.rect(0, 0, PAGE_W, 48).fill(HEADER_BG);

      // Logo / brand
      doc.fontSize(16).fillColor("#FFFFFF").font("Helvetica-Bold")
        .text("Elan Exports", MARGIN, 12, { lineBreak: false });

      // Report title
      doc.fontSize(10).fillColor("#93C5FD").font("Helvetica")
        .text("Master Production Report", MARGIN, 30, { lineBreak: false });

      // Generated date (right aligned)
      const genLabel = `Generated: ${format(new Date(), "dd MMM yyyy, h:mm a")}`;
      doc.fontSize(8).fillColor("#CBD5E1").font("Helvetica")
        .text(genLabel, MARGIN, 19, { width: TABLE_W, align: "right" });

      doc.moveDown(0);
      doc.y = 56;
    }

    // ── Column Headers ───────────────────────────────────────────────
    function drawColHeaders() {
      const y = doc.y;
      let x = MARGIN;

      // Background
      doc.rect(x, y, TABLE_W, HDR_H).fill(COL_HDR_BG);

      doc.font("Helvetica-Bold").fontSize(FONT_SM).fillColor(TEXT_MID);

      for (const key of COL_ORDER) {
        const w = COLS[key];
        doc.rect(x, y, w, HDR_H).stroke(BORDER);
        doc.text(COL_LABELS[key], x + 4, y + 5, { width: w - 8, lineBreak: false });
        x += w;
      }

      doc.y = y + HDR_H;
    }

    // ── Check / add page ────────────────────────────────────────────
    function ensureSpace(neededH: number) {
      if (doc.y + neededH > PAGE_H - MARGIN) {
        doc.addPage();
        drawPageHeader();
        drawColHeaders();
      }
    }

    // ── Draw a single report row ─────────────────────────────────────
    function drawRow(report: Report, index: number) {
      const updateDate  = safeDate(report.updateDate);
      const reportDate  = safeDate(report.reportDate);
      const effectiveDate = updateDate || reportDate;
      const updatedText = effectiveDate ? format(effectiveDate, "dd MMM yy") : "—";

      const updates = safeText(report.keyUpdates, "")
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.length > 0);
      const updatesText = updates.map((u) => `• ${u}`).join("\n") || "—";

      const cells: Record<keyof typeof COLS, string> = {
        no:       String(index + 1),
        buyer:    safeText(report.buyerName),
        product:  report.productName === "General Sourcing Request" ? "No Requirements Yet" : safeText(report.productName),
        supplier: safeText(report.companyName),
        status:   safeText(report.status),
        updated:  updatedText,
        updates:  updatesText,
      };

      // Calculate row height based on tallest cell
      doc.font("Helvetica").fontSize(FONT_MD);
      let maxH = ROW_H;
      for (const key of COL_ORDER) {
        const cellW  = COLS[key] - 8;
        const txtH   = doc.heightOfString(cells[key], { width: cellW }) + 12;
        if (txtH > maxH) maxH = txtH;
      }

      ensureSpace(maxH);

      const y   = doc.y;
      const bg  = index % 2 === 0 ? ROW_EVEN : ROW_ODD;
      let   x   = MARGIN;

      // Row background
      doc.rect(x, y, TABLE_W, maxH).fill(bg);

      for (const key of COL_ORDER) {
        const w = COLS[key];

        // Cell border
        doc.rect(x, y, w, maxH).stroke(BORDER);

        const textX = x + 4;
        const textY = y + 6;
        const textW = w - 8;

        if (key === "status") {
          // Draw badge
          const badgeTxt = cells[key];
          doc.fontSize(FONT_SM);
          const badgeW   = Math.min(w - 8, doc.widthOfString(badgeTxt) + 10);
          const badgeH   = 14;
          doc.roundedRect(textX, textY, badgeW, badgeH, 3).fill(BADGE_BG);
          doc.font("Helvetica-Bold").fontSize(FONT_SM).fillColor(BADGE_TEXT)
            .text(badgeTxt, textX + 2, textY + 3, { width: badgeW - 4, lineBreak: false, ellipsis: true });
        } else if (key === "no") {
          doc.font("Helvetica").fontSize(FONT_SM).fillColor(TEXT_LIGHT)
            .text(cells[key], textX, textY, { width: textW, align: "center", lineBreak: false });
        } else if (key === "product") {
          doc.font("Helvetica-Bold").fontSize(FONT_MD).fillColor(TEXT_DARK)
            .text(cells[key], textX, textY, { width: textW });
        } else if (key === "updates") {
          doc.font("Helvetica").fontSize(FONT_SM).fillColor(TEXT_MID)
            .text(cells[key], textX, textY, { width: textW });
        } else {
          doc.font("Helvetica").fontSize(FONT_MD).fillColor(TEXT_DARK)
            .text(cells[key], textX, textY, { width: textW });
        }

        x += w;
      }

      doc.y = y + maxH;
    }

    // ── Summary section ──────────────────────────────────────────────
    function drawSummary() {
      ensureSpace(60);
      const y = doc.y + 12;

      const buyers = new Set(reports.map((r) => safeText(r.buyerName)).filter((b) => b !== "—"));
      const suppliers = new Set(reports.map((r) => safeText(r.companyName)).filter((s) => s !== "—"));

      doc.rect(MARGIN, y, TABLE_W, 40).fill("#F0F9FF").stroke(BRAND);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND)
        .text("EXPORT SUMMARY", MARGIN + 8, y + 8, { lineBreak: false });

      const summaryStr = `  ·  Total Reports: ${reports.length}   ·   Unique Buyers: ${buyers.size}   ·   Unique Suppliers: ${suppliers.size}`;
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MID)
        .text(summaryStr, MARGIN + 100, y + 8, { lineBreak: false });

      doc.y = y + 40;
    }

    // ── Build PDF ────────────────────────────────────────────────────
    drawPageHeader();
    drawSummary();
    doc.y += 8;
    drawColHeaders();

    for (let i = 0; i < reports.length; i++) {
      drawRow(reports[i], i);
    }

    // ── Footer on all pages ─────────────────────────────────────────
    const bufferedRange = doc.bufferedPageRange();
    for (let i = bufferedRange.start; i < bufferedRange.start + bufferedRange.count; i++) {
      doc.switchToPage(i);
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(7).fillColor(TEXT_LIGHT);
      
      const pageText = `Elan Exports CRM  –  Confidential  –  ${format(new Date(), "dd MMM yyyy")}  –  Page ${i + 1} of ${bufferedRange.count}`;
      doc.text(pageText, MARGIN, PAGE_H - 18, { width: TABLE_W, align: "center", lineBreak: false });
      
      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}
