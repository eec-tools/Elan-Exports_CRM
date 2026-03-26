import puppeteer from "puppeteer";
import { format } from "date-fns";
export async function generateBuyerReportsPdf(reports) {
    const generatedDate = format(new Date(), "PPpp");
    // Create table rows
    let tableRowsHtml = "";
    for (const report of reports) {
        const updates = (report.keyUpdates || "")
            .split("\n")
            .map(u => u.trim())
            .filter(u => u.length > 0);
        const bulletUpdates = updates.length > 0
            ? updates.map(u => `<div style="margin-bottom: 2px; padding-left: 10px; text-indent: -10px;">&bull; ${u}</div>`).join("")
            : "<span class='empty'>-</span>";
        const updatedText = report.updateDate ? format(new Date(report.updateDate), "MMM dd, yyyy") : format(new Date(report.reportDate), "MMM dd, yyyy");
        const supplierHtml = report.companyName.replace(/\n/g, "<br/>");
        const imageUrl = report.productImageUrl && report.productImageUrl.startsWith("http")
            ? report.productImageUrl
            : "https://via.placeholder.com/150x150.png?text=No+Image";
        tableRowsHtml += `
        <tr>
           <td class="img-cell"><img src="${imageUrl}" alt="Product" /></td>
           <td>${report.buyerName}</td>
           <td class="bold">${report.productName}</td>
           <td>${supplierHtml}</td>
           <td><span class="status-badge">${report.status}</span></td>
           <td class="text-right whitespace-nowrap">${updatedText}</td>
           <td class="updates">${bulletUpdates}</td>
        </tr>
     `;
    }
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Master Report</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Inter', Arial, sans-serif;
          background-color: #FFFFFF;
          color: #111827;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 20px;
          border-bottom: 2px solid #E5E7EB;
          padding-bottom: 12px;
        }
        
        .header-logo {
          font-size: 20px;
          font-weight: 700;
          color: #2563EB;
          letter-spacing: -0.5px;
        }

        .header-title {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .header-date {
          font-size: 11px;
          color: #6B7280;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        
        th {
          background-color: #F3F4F6;
          color: #374151;
          font-size: 11px;
          font-weight: 700;
          text-align: left;
          padding: 8px 10px;
          border: 1px solid #D1D5DB;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        tr {
          page-break-inside: avoid;
        }
        
        td {
          padding: 6px 8px;
          line-height: 1.4;
          font-size: 11px;
          color: #1F2937;
          border: 1px solid #E5E7EB;
          vertical-align: top;
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: normal;
          overflow: hidden;
        }
        
        tr:nth-child(even) {
          background-color: #F9FAFB;
        }

        .img-cell {
          text-align: center;
          vertical-align: middle;
          padding: 4px;
        }
        
        .img-cell img {
          width: 50px;
          height: 50px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid #E5E7EB;
          background-color: #F3F4F6;
        }

        .text-right {
          text-align: right;
        }

        .whitespace-nowrap {
          white-space: nowrap;
        }

        .bold {
          font-weight: 600;
          color: #111827;
        }
        
        .status-badge {
          display: inline-block;
          background-color: #EFF6FF;
          color: #1D4ED8;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          white-space: normal;
          word-wrap: break-word;
          border: 1px solid #BFDBFE;
        }

        .updates {
          line-height: 1.4;
          color: #4B5563;
        }

        .empty {
          color: #9CA3AF;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
           <div class="header-logo">Elan Exports</div>
           <div class="header-title">Master Production Report</div>
        </div>
        <div class="header-date">Generated: ${generatedDate}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 8%; text-align: center;">Image</th>
            <th style="width: 10%;">Buyer</th>
            <th style="width: 15%;">Product</th>
            <th style="width: 16%;">Supplier</th>
            <th style="width: 12%;">Status</th>
            <th style="width: 11%; text-align: right;">Updated</th>
            <th style="width: 28%;">Key Updates</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 }).catch(() => {
        // Ignore timeout errors
    });
    const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
        margin: {
            top: "10mm",
            right: "10mm",
            bottom: "10mm",
            left: "10mm"
        }
    });
    await browser.close();
    return Buffer.from(pdfBuffer);
}
//# sourceMappingURL=reportsPdf.service.js.map