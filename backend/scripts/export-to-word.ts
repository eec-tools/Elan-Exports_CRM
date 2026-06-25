import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";

dotenv.config();

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────────────────────

function title(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32, color: "1a1a2e" })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "4f46e5" },
    },
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: "374151" })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
  });
}

function field(label: string, value: string | null | undefined): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20 }),
      new TextRun({ text: value || "—", size: 20 }),
    ],
    spacing: { after: 60 },
    indent: { left: 360 },
  });
}

function divider(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" } },
    spacing: { before: 160, after: 160 },
    text: "",
  });
}


function recordHeader(text: string, index: number): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${index}. ${text}`, bold: true, size: 22, color: "1f2937" }),
    ],
    spacing: { before: 200, after: 80 },
    indent: { left: 180 },
  });
}

function noData(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: "No records found.", italics: true, color: "9ca3af", size: 20 })],
    spacing: { after: 120 },
    indent: { left: 360 },
  });
}

type VaultSupplier = {
  company: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  product: string | null;
  emailStatus: string;
  notes: string | null;
};

function vaultSupplierCards(suppliers: VaultSupplier[]): Paragraph[] {
  const paras: Paragraph[] = [];

  suppliers.forEach((s, i) => {
    const statusColor =
      s.emailStatus === "Sent" ? "16a34a" :
      s.emailStatus === "Not Sent" ? "dc2626" : "d97706";

    // Line 1: index + company name + status badge
    paras.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}.  `, bold: true, size: 19, color: "4f46e5" }),
          new TextRun({ text: s.company, bold: true, size: 19, color: "111827" }),
          new TextRun({ text: `   `, size: 19 }),
          new TextRun({ text: `[${s.emailStatus}]`, bold: true, size: 17, color: statusColor }),
        ],
        spacing: { before: 120, after: 40 },
        indent: { left: 360 },
      })
    );

    // Line 2: Contact | Email
    paras.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Contact: ", bold: true, size: 17, color: "6b7280" }),
          new TextRun({ text: s.contactPerson || "—", size: 17 }),
          new TextRun({ text: "     Email: ", bold: true, size: 17, color: "6b7280" }),
          new TextRun({ text: s.email || "—", size: 17 }),
        ],
        spacing: { after: 30 },
        indent: { left: 620 },
      })
    );

    // Line 3: Country | Product | Phone (if exists)
    paras.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Country: ", bold: true, size: 17, color: "6b7280" }),
          new TextRun({ text: s.country || "—", size: 17 }),
          new TextRun({ text: "     Product: ", bold: true, size: 17, color: "6b7280" }),
          new TextRun({ text: s.product || "—", size: 17 }),
          ...(s.phone
            ? [
                new TextRun({ text: "     Phone: ", bold: true, size: 17, color: "6b7280" }),
                new TextRun({ text: s.phone, size: 17 }),
              ]
            : []),
        ],
        spacing: { after: s.notes ? 30 : 60 },
        indent: { left: 620 },
      })
    );

    // Line 4: Notes (if exists)
    if (s.notes) {
      paras.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Notes: ", bold: true, size: 17, color: "6b7280" }),
            new TextRun({ text: s.notes, size: 17, italics: true }),
          ],
          spacing: { after: 60 },
          indent: { left: 620 },
        })
      );
    }

    // thin separator between suppliers (not after last)
    if (i < suppliers.length - 1) {
      paras.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.DOTTED, size: 1, color: "d1d5db" } },
          text: "",
          spacing: { before: 20, after: 20 },
        })
      );
    }
  });

  return paras;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Fetching data from database...");

  const [vaultFolders, sourcingSuppliers, newSuppliers, signedSuppliers, oldSuppliers, vaultDocuments, emailTrackers] = await Promise.all([
    prisma.sourcingVaultFolder.findMany({
      orderBy: { createdAt: "asc" },
      include: { suppliers: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.sourcingSupplier.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.newSupplier.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.supplier.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.oldSupplier.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.vaultDocument.findMany({
      orderBy: { createdAt: "asc" },
      where: { isFolder: false },
      include: { versions: { orderBy: { versionNum: "asc" } } },
    }),
    prisma.emailTracker.findMany({ orderBy: { dateReceived: "desc" } }),
  ]);

  const totalVaultSuppliers = vaultFolders.reduce((sum, f) => sum + f.suppliers.length, 0);
  console.log(`  ✅ Sourcing Suppliers: ${sourcingSuppliers.length}`);
  console.log(`  ✅ Sourcing Vault: ${vaultFolders.length} folders, ${totalVaultSuppliers} suppliers`);
  console.log(`  ✅ New Suppliers: ${newSuppliers.length}`);
  console.log(`  ✅ Signed Contracts: ${signedSuppliers.length}`);
  console.log(`  ✅ Old Suppliers: ${oldSuppliers.length}`);
  console.log(`  ✅ Document Vault: ${vaultDocuments.length} documents`);
  console.log(`  ✅ Email Tracker: ${emailTrackers.length}`);

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, "0")}-${today.toLocaleString("en-IN", { month: "short" })}-${today.getFullYear()}`;
  const outDir = "/Users/harshpatel/Desktop/Elan-Exports_CRM";

  const docStyles = {
    default: { document: { run: { font: "Calibri", size: 20 } } },
  };

  function makeDoc(children: Paragraph[]) {
    return new Document({ sections: [{ children }], styles: docStyles });
  }

  async function saveDoc(doc: Document, filename: string) {
    const filePath = path.join(outDir, filename);
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
    console.log(`  ✅ ${filename}  (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  function coverPara(sectionName: string, subtitle: string): Paragraph[] {
    return [
      title(`EEC — ${sectionName}`),
      new Paragraph({
        children: [new TextRun({ text: `Generated on: ${formatDate(new Date())}`, size: 22, color: "6b7280" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: subtitle, size: 20, italics: true, color: "6b7280" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      divider(),
    ];
  }

  console.log("\n📄 Generating files...");

  // ── File 1: SOURCING SUPPLIERS ────────────────────────────────────────────
  {
    const c: Paragraph[] = [
      ...coverPara("Sourcing Suppliers", `Total records: ${sourcingSuppliers.length}`),
      sectionHeading("Sourcing Suppliers"),
    ];
    if (sourcingSuppliers.length === 0) {
      c.push(noData());
    } else {
      sourcingSuppliers.forEach((s, i) => {
        c.push(
          recordHeader(s.company, i + 1),
          field("Contact Person", s.contactPerson),
          field("Designation", s.designation),
          field("Email", s.email),
          field("Phone", s.phone),
          field("WhatsApp", s.whatsapp),
          field("Country", s.country),
          field("City", s.city),
          field("State", s.state),
          field("Trade Name", s.tradeName),
          field("Supplier Type", s.supplierType),
          field("Supplier Stage", s.supplierStage),
          field("Status", s.status),
          field("Deal Stage", s.dealStage),
          field("Product Category", s.productCategory),
          field("Product", s.product),
          field("MOQ", s.moq),
          field("Payment Terms", s.paymentTerms),
          field("Incoterms Supported", s.incotermsSupported),
          field("Ports of Export", s.portsOfExport),
          field("Target Export Markets", s.targetExportMarkets),
          field("Currency Preferred", s.currencyPreferred),
          field("Certifications", s.certifications),
          field("EEC Margin (%)", s.eecMarginPercent),
          field("Vetting Score", s.vettingScore?.toString()),
          field("Account Manager", s.accountManager),
          field("Assigned Gmail", s.assignedGmailAccount),
          field("Year Established", s.yearEstablished),
          field("Organic Status", s.organicStatus),
          field("Latest Quotation", s.latestQuotation),
          field("Notes", s.notes),
          field("Created", formatDate(s.createdAt))
        );
        if (i < sourcingSuppliers.length - 1) c.push(divider());
      });
    }
    await saveDoc(makeDoc(c), `EEC-Sourcing-Suppliers-${dateStr}.docx`);
  }

  // ── File 2: SOURCING VAULT ────────────────────────────────────────────────
  {
    const c: Paragraph[] = [
      ...coverPara("Sourcing Vault", `${vaultFolders.length} folders  •  ${totalVaultSuppliers} suppliers`),
      sectionHeading("Sourcing Vault"),
    ];
    if (vaultFolders.length === 0) {
      c.push(noData());
    } else {
      vaultFolders.forEach((folder, fi) => {
        c.push(
          subHeading(`Folder ${fi + 1}: ${folder.name}  (${folder.suppliers.length} supplier${folder.suppliers.length !== 1 ? "s" : ""})`)
        );
        if (folder.suppliers.length === 0) {
          c.push(noData());
        } else {
          c.push(...vaultSupplierCards(folder.suppliers));
        }
        if (fi < vaultFolders.length - 1) c.push(divider());
      });
    }
    await saveDoc(makeDoc(c), `EEC-Sourcing-Vault-${dateStr}.docx`);
  }

  // ── File 3: NEW SUPPLIERS ─────────────────────────────────────────────────
  {
    const c: Paragraph[] = [
      ...coverPara("New Suppliers", `Total records: ${newSuppliers.length}`),
      sectionHeading("New Suppliers"),
    ];
    if (newSuppliers.length === 0) {
      c.push(noData());
    } else {
      newSuppliers.forEach((s, i) => {
        c.push(
          recordHeader(s.company, i + 1),
          field("Contact Person", s.contactPerson),
          field("Designation", s.designation),
          field("Email", s.email),
          field("Phone", s.phone),
          field("WhatsApp", s.whatsapp),
          field("Website", s.website),
          field("Country", s.country),
          field("City", s.city),
          field("State", s.state),
          field("Trade Name", s.tradeName),
          field("Supplier Type", s.supplierType),
          field("Supplier Stage", s.supplierStage),
          field("Deal Stage", s.dealStage),
          field("Product Category", s.productCategory),
          field("Product", s.product),
          field("MOQ", s.moq),
          field("Payment Terms", s.paymentTerms),
          field("Incoterms Supported", s.incotermsSupported),
          field("Ports of Export", s.portsOfExport),
          field("Target Export Markets", s.targetExportMarkets),
          field("Currency Preferred", s.currencyPreferred),
          field("Certifications", s.certifications),
          field("EEC Margin (%)", s.eecMarginPercent),
          field("Vetting Score", s.vettingScore?.toString()),
          field("Account Manager", s.accountManager),
          field("Year Established", s.yearEstablished),
          field("Organic Status", s.organicStatus),
          field("Current Status", s.currentStatus),
          field("Latest Quotation", s.latestQuotation),
          field("Notes", s.notes),
          field("Created", formatDate(s.createdAt))
        );
        if (i < newSuppliers.length - 1) c.push(divider());
      });
    }
    await saveDoc(makeDoc(c), `EEC-New-Suppliers-${dateStr}.docx`);
  }

  // ── File 4: SIGNED CONTRACTS ──────────────────────────────────────────────
  {
    const c: Paragraph[] = [
      ...coverPara("Signed Contracts", `Total records: ${signedSuppliers.length}`),
      sectionHeading("Signed Contracts"),
    ];
    if (signedSuppliers.length === 0) {
      c.push(noData());
    } else {
      signedSuppliers.forEach((s, i) => {
        c.push(
          recordHeader(s.company, i + 1),
          field("Contact Person", s.contactPerson),
          field("Designation", s.designation),
          field("Email", s.email),
          field("Phone", s.phone),
          field("WhatsApp", s.whatsapp),
          field("Website", s.website),
          field("Country", s.country),
          field("City", s.city),
          field("State", s.state),
          field("Trade Name", s.tradeName),
          field("Supplier Type", s.supplierType),
          field("Supplier Stage", s.supplierStage),
          field("Deal Stage", s.dealStage),
          field("Product Category", s.contractBuyer),
          field("Products", s.products),
          field("Certifications", s.certifications),
          field("Production Capacity", s.productionCapacity),
          field("MOQ", s.moq),
          field("Payment Terms", s.paymentTerms),
          field("Incoterms Supported", s.incotermsSupported),
          field("Ports of Export", s.portsOfExport),
          field("Target Export Markets", s.targetExportMarkets),
          field("EEC Margin (%)", s.eecMarginPercent),
          field("Commission (%)", s.commissionPercent),
          field("Vetting Score", s.vettingScore?.toString()),
          field("Account Manager", s.accountManager),
          field("Contract Start Date", formatDate(s.contractStartDate ?? undefined)),
          field("Contract End Date", formatDate(s.contractEndDate ?? undefined)),
          field("Factory Visit Status", s.factoryVisitStatus),
          field("Factory Visit Date", s.factoryVisitDate),
          field("Exclusivity Arrangement", s.exclusivityArrangement),
          field("Year Established", s.yearEstablished),
          field("Organic Status", s.organicStatus),
          field("Current Status", s.currentStatus),
          field("Remarks", s.remarks),
          field("Created", formatDate(s.createdAt))
        );
        if (i < signedSuppliers.length - 1) c.push(divider());
      });
    }
    await saveDoc(makeDoc(c), `EEC-Signed-Contracts-${dateStr}.docx`);
  }

  // ── File 5: OLD SUPPLIERS (batched to save memory) ───────────────────────
  {
    // 5000+ records — build in batches of 500 and write one file per batch
    const BATCH = 500;
    const totalBatches = Math.ceil(oldSuppliers.length / BATCH);

    for (let b = 0; b < totalBatches; b++) {
      const slice = oldSuppliers.slice(b * BATCH, (b + 1) * BATCH);
      const batchLabel = totalBatches > 1 ? ` (Part ${b + 1} of ${totalBatches})` : "";
      const c: Paragraph[] = [
        ...coverPara(`Old Suppliers${batchLabel}`, `Records ${b * BATCH + 1}–${b * BATCH + slice.length} of ${oldSuppliers.length}`),
        sectionHeading(`Old Suppliers${batchLabel}`),
      ];
      slice.forEach((s, i) => {
        const globalIdx = b * BATCH + i + 1;
        c.push(
          recordHeader(s.company, globalIdx),
          field("Contact Person", s.contactPerson),
          field("Email", s.email),
          field("Phone", s.phone),
          field("Country", s.country),
          field("City", s.city),
          field("Product Category", s.productCategory),
          field("Product", s.product),
          field("Current Status", s.currentStatus),
          field("Supplier Stage", s.supplierStage),
          field("Account Manager", s.accountManager),
          field("Reason Inactive", s.reasonInactive),
          field("Reactivation Potential", s.reactivationPotential),
          field("Last Contact Date", s.lastContactDate),
          field("Latest Quotation", s.latestQuotation),
          field("Notes", s.notes),
          field("Created", formatDate(s.createdAt))
        );
        if (i < slice.length - 1) c.push(divider());
      });
      const suffix = totalBatches > 1 ? `-Part${b + 1}` : "";
      await saveDoc(makeDoc(c), `EEC-Old-Suppliers${suffix}-${dateStr}.docx`);
    }
  }

  // ── File 6: DOCUMENT VAULT ────────────────────────────────────────────────
  {
    const c: Paragraph[] = [
      ...coverPara("Document Vault", `Total documents: ${vaultDocuments.length}`),
      sectionHeading("Document Vault"),
    ];
    if (vaultDocuments.length === 0) {
      c.push(noData());
    } else {
      // Group by category
      const byCategory = vaultDocuments.reduce<Record<string, typeof vaultDocuments>>((acc, doc) => {
        const cat = doc.category || "Uncategorised";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(doc);
        return acc;
      }, {});

      Object.entries(byCategory).forEach(([category, docs], ci, arr) => {
        c.push(subHeading(`${category}  (${docs.length} document${docs.length !== 1 ? "s" : ""})`));
        docs.forEach((doc, i) => {
          c.push(
            recordHeader(doc.name, i + 1),
            field("Category", doc.category),
            field("Region", doc.region),
            field("File Type", doc.fileType),
            field("Expiry Date", formatDate(doc.expiryDate ?? undefined)),
            field("Uploaded", formatDate(doc.createdAt))
          );
          if (doc.versions.length > 0) {
            c.push(
              new Paragraph({
                children: [new TextRun({ text: `Versions (${doc.versions.length}):`, bold: true, size: 18, color: "374151" })],
                spacing: { before: 80, after: 40 },
                indent: { left: 360 },
              })
            );
            doc.versions.forEach((v) => {
              c.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: `  • v${v.versionNum}  `, bold: true, size: 17 }),
                    new TextRun({ text: v.name, size: 17 }),
                    new TextRun({ text: `  —  ${formatDate(v.createdAt)}`, size: 17, color: "6b7280" }),
                  ],
                  spacing: { after: 40 },
                  indent: { left: 540 },
                })
              );
            });
          }
          if (i < docs.length - 1) c.push(divider());
        });
        if (ci < arr.length - 1) c.push(divider());
      });
    }
    await saveDoc(makeDoc(c), `EEC-Document-Vault-${dateStr}.docx`);
  }

  // ── File 7: EMAIL TRACKER ─────────────────────────────────────────────────
  {
    const c: Paragraph[] = [
      ...coverPara("Email Tracker", `Total records: ${emailTrackers.length}`),
      sectionHeading("Email Tracker"),
    ];
    if (emailTrackers.length === 0) {
      c.push(noData());
    } else {
      emailTrackers.forEach((e, i) => {
        c.push(
          recordHeader(e.subject || "(No Subject)", i + 1),
          field("From", e.senderAddress),
          field("Date Received", formatDate(e.dateReceived)),
          field("Subject", e.subject),
          field("Status", e.status),
          field("Priority", e.priority),
          field("Product Category", e.productCategory),
          field("Task", e.task),
          field("Respondent", e.respondent),
          field("Source", e.source),
          field("Gmail Account", e.gmailAccount),
          field("Importance", e.importance),
          field("Is Read", e.isRead ? "Yes" : "No"),
          field("Body Preview", e.bodyPreview),
          field("Notes", e.notes),
          field("Synced At", formatDate(e.syncedAt ?? undefined))
        );
        if (i < emailTrackers.length - 1) c.push(divider());
      });
    }
    await saveDoc(makeDoc(c), `EEC-Email-Tracker-${dateStr}.docx`);
  }

  console.log(`\n📁 All 7 files saved to: ${outDir}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
