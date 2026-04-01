import ExcelJS from "exceljs";
import { Report } from "@prisma/client";
import { format } from "date-fns";

export async function generateBuyerReportsExcel(reports: Report[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Elan Exports";
  workbook.lastModifiedBy = "Elan Exports";
  workbook.created = new Date();
  
  const sheet = workbook.addWorksheet("Operations Reports", {
    views: [{ showGridLines: false }]
  });

  const generatedDate = format(new Date(), "PPpp");

  // Setup column definitions
  sheet.columns = [
    { header: "Report Date", key: "reportDate", width: 14 },
    { header: "Buyer Name", key: "buyerName", width: 20 },
    { header: "Product / Specification", key: "productName", width: 30 },
    { header: "Supplier / Company", key: "companyName", width: 30 },
    { header: "Status Summary", key: "status", width: 25 },
    { header: "Key Updates", key: "keyUpdates", width: 50 },
    { header: "Last Updated", key: "updateDate", width: 14 },
    { header: "Role", key: "buyerSupplier", width: 12 },
  ];

  // Header Row Styling
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" }, // Brand Blue
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF1D4ED8" } },
    };
  });

  // Populate data
  reports.forEach((report, index) => {
    const safeText = (value: unknown): string => {
      if (typeof value === "string") return value.trim();
      return "-";
    };

    const safeDate = (value: unknown): Date | null => {
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(value as string);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const updateDate = safeDate(report.updateDate);
    const reportDate = safeDate(report.reportDate);

    const rowData = {
      reportDate: reportDate ? format(reportDate, "MMM dd, yyyy") : "-",
      buyerName: safeText(report.buyerName),
      productName: safeText(report.productName),
      companyName: safeText(report.companyName),
      status: safeText(report.status),
      keyUpdates: safeText(report.keyUpdates),
      updateDate: updateDate ? format(updateDate, "MMM dd, yyyy") : "-",
      buyerSupplier: safeText(report.buyerSupplier),
    };

    const row = sheet.addRow(rowData);
    
    // Auto-adjust row height for wrapped text in updates
    const updatesText = rowData.keyUpdates;
    const estimatedLines = Math.ceil(updatesText.length / 50) + (updatesText.match(/\n/g)?.length || 0);
    row.height = Math.max(25, estimatedLines * 15);

    row.eachCell((cell) => {
      cell.font = { name: "Arial", size: 10, color: { argb: "FF111827" } };
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });

    // Alternate row backgrounds
    if (index % 2 === 1) {
      row.eachCell((cell) => {
        if (!cell.fill) {
           cell.fill = {
             type: "pattern",
             pattern: "solid",
             fgColor: { argb: "FFF9FAFB" },
           };
        }
      });
    }
  });

  // Add generated timestamp at the bottom
  const emptyRow = sheet.addRow([]);
  emptyRow.height = 10;
  emptyRow.eachCell(c => c.border = {});
  
  const footerRow = sheet.addRow(["Generated on:", generatedDate]);
  footerRow.eachCell(c => c.border = {});
  footerRow.getCell(1).font = { bold: true, size: 9, color: { argb: "FF6B7280" } };
  footerRow.getCell(2).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

  // Generate buffer
  return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
}
