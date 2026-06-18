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

  const [deals, buyers, vaultFolders, sourcingBuyers] = await Promise.all([
    prisma.deal.findMany({
      orderBy: { createdAt: "asc" },
      include: { complianceDocuments: true },
    }),
    prisma.buyer.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.sourcingVaultFolder.findMany({
      orderBy: { createdAt: "asc" },
      include: { suppliers: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.sourcingBuyer.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  console.log(`  ✅ Deals: ${deals.length}`);
  console.log(`  ✅ Buyers Directory: ${buyers.length}`);
  console.log(`  ✅ Sourcing Vault folders: ${vaultFolders.length}`);
  console.log(`  ✅ Sourcing Buyers: ${sourcingBuyers.length}`);

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

  // ── File 1: DEALS ────────────────────────────────────────────────────────
  {
    const c: Paragraph[] = [
      ...coverPara("Deals", `Total records: ${deals.length}`),
      sectionHeading("Deals"),
    ];
    if (deals.length === 0) {
      c.push(noData());
    } else {
      deals.forEach((deal, i) => {
        c.push(
          recordHeader(deal.title, i + 1),
          field("Buyer", deal.buyer),
          field("Supplier", deal.supplier),
          field("Product", deal.product),
          field("HS Code", deal.hsCode),
          field("Stage", deal.stage),
          field("Volume", deal.volume),
          field("Price (USD)", deal.price?.toString()),
          field("Expected Revenue", deal.expectedRevenue?.toString()),
          field("Margin (%)", deal.margin?.toString()),
          field("Probability (%)", deal.probability?.toString()),
          field("Category", deal.category),
          field("Risk Score", deal.riskScore),
          field("Notes", deal.notes),
          field("Created", formatDate(deal.createdAt))
        );
        if (deal.complianceDocuments.length > 0) {
          c.push(
            new Paragraph({
              children: [new TextRun({ text: "Compliance Documents:", bold: true, size: 19, color: "374151" })],
              spacing: { before: 100, after: 60 },
              indent: { left: 360 },
            })
          );
          deal.complianceDocuments.forEach((doc) => {
            c.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `  • ${doc.docType}`, size: 18 }),
                  new TextRun({ text: `  [${doc.status}]`, bold: true, size: 18, color: doc.status === "RECEIVED" ? "16a34a" : doc.status === "PENDING" ? "d97706" : "dc2626" }),
                  doc.dueDate ? new TextRun({ text: `  Due: ${formatDate(doc.dueDate)}`, size: 18, color: "6b7280" }) : new TextRun({ text: "" }),
                ],
                spacing: { after: 50 },
                indent: { left: 540 },
              })
            );
          });
        }
        if (i < deals.length - 1) c.push(divider());
      });
    }
    await saveDoc(makeDoc(c), `EEC-Deals-${dateStr}.docx`);
  }

  // ── File 2: BUYERS DIRECTORY ──────────────────────────────────────────────
  {
    const c: Paragraph[] = [
      ...coverPara("Buyers Directory", `Total records: ${buyers.length}`),
      sectionHeading("Buyers Directory"),
    ];
    if (buyers.length === 0) {
      c.push(noData());
    } else {
      buyers.forEach((buyer, i) => {
        c.push(
          recordHeader(buyer.company, i + 1),
          field("Contact Name", buyer.name),
          field("Email", buyer.email),
          field("Phone", buyer.phone),
          field("WhatsApp", buyer.whatsapp),
          field("Country", buyer.country),
          field("City", buyer.city),
          field("Address", buyer.address),
          field("Website", buyer.website),
          field("Status", buyer.status),
          field("Buyer Type", buyer.buyerType),
          field("Contact Role", buyer.contactRole),
          field("Region", buyer.region),
          field("Product Category Interest", buyer.productCategoryInterest),
          field("Product Categories", buyer.productCategories),
          field("MOQ Requirements", buyer.moqRequirements),
          field("Pricing Range", buyer.pricingRange),
          field("Payment Terms", buyer.paymentTerms),
          field("Incoterms", buyer.incoterms),
          field("Shipping Mode", buyer.shippingMode),
          field("Ports of Discharge", buyer.portsOfDischarge),
          field("Preferred Currency", buyer.preferredCurrency),
          field("Annual Import Volume", buyer.annualImportVolume),
          field("Annual Purchase Value", buyer.annualPurchaseValue),
          field("Lead Source", buyer.leadSource),
          field("Risk Rating", buyer.riskRating),
          field("Strategic Value", buyer.strategicValue),
          field("Relationship Tier", buyer.relationshipTier),
          field("Reorder Likelihood", buyer.reorderLikelihood),
          field("Initial Order Value", buyer.initialOrderValue),
          field("Potential Annual Value", buyer.potentialAnnualValue),
          field("Last Contact Date", formatDate(buyer.lastContactDate ?? undefined)),
          field("Notes", buyer.notes),
          field("Created", formatDate(buyer.createdAt))
        );
        if (i < buyers.length - 1) c.push(divider());
      });
    }
    await saveDoc(makeDoc(c), `EEC-Buyers-Directory-${dateStr}.docx`);
  }

  // ── File 3: SOURCING VAULT ────────────────────────────────────────────────
  {
    const totalVaultSuppliers = vaultFolders.reduce((sum, f) => sum + f.suppliers.length, 0);
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

  // ── File 4: SOURCING BUYERS ───────────────────────────────────────────────
  {
    const c: Paragraph[] = [
      ...coverPara("Sourcing Buyers", `Total records: ${sourcingBuyers.length}`),
      sectionHeading("Sourcing Buyers"),
    ];
    if (sourcingBuyers.length === 0) {
      c.push(noData());
    } else {
      sourcingBuyers.forEach((buyer, i) => {
        c.push(
          recordHeader(buyer.company, i + 1),
          field("Contact Person", buyer.contactPerson),
          field("Email", buyer.email),
          field("Phone", buyer.phone),
          field("Country", buyer.country),
          field("Product", buyer.product),
          field("Product Category", buyer.productCategory),
          field("Status", buyer.status),
          field("Assigned Gmail", buyer.assignedGmailAccount),
          field("Notes", buyer.notes),
          field("Created", formatDate(buyer.createdAt))
        );
        if (i < sourcingBuyers.length - 1) c.push(divider());
      });
    }
    await saveDoc(makeDoc(c), `EEC-Sourcing-Buyers-${dateStr}.docx`);
  }

  console.log(`\n📁 All files saved to: ${outDir}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
