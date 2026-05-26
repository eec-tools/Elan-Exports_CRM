import { PrismaClient, Prisma } from "@prisma/client";
import fs from "fs";
import readline from "readline";
import csv from "csv-parser";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DATABASE_URL!;
const separator = dbUrl.includes("?") ? "&" : "?";
const prisma = new PrismaClient({
  datasources: {
    db: { url: dbUrl + separator + "connection_limit=2&pool_timeout=120" },
  },
});

const BATCH_SIZE = 50;

const COLUMN_ALIASES: Record<string, string[]> = {
  supplierExternalId:      ["Supplier ID"],
  company:                 ["Company Name", "Company", "Supplier Name", "Supplier", "Organization"],
  productCategory:         ["Product Category", "Category"],
  product:                 ["Product", "Product Name", "Products", "Products dealing with", "Items"],
  country:                 ["Country", "Country Name", "Location", "Region"],
  city:                    ["City"],
  companyAddress:          ["Full Address", "Company Address", "Address"],
  website:                 ["Website"],
  yearFirstAdded:          ["Year First Added", "Year"],
  sourceSheet:             ["Source Sheet"],
  currentStatus:           ["Current Status", "Status"],
  contactPerson:           ["Primary Contact Name", "Contact Person", "Contact Name"],
  designation:             ["Designation"],
  email:                   ["Email", "Email Id", "Primary Email"],
  phone:                   ["Phone", "Phone Number", "Mobile"],
  whatsapp:                ["WhatsApp", "Whatsapp Number"],
  legalName:               ["Legal Name"],
  secondaryContactName:    ["Secondary Contact Name"],
  secondaryEmail:          ["Secondary Email"],
  secondaryPhone:          ["Secondary Phone"],
  accountManager:          ["Account Manager", "Manager"],
  subCategory:             ["Sub-category", "Sub Category", "Subcategory"],
  commodityType:           ["Commodity Type"],
  productionCapacity:      ["Annual Production Capacity", "Production Capacity"],
  moq:                     ["MOQ"],
  priceRange:              ["Price Range"],
  currency:                ["Currency"],
  exportMarkets:           ["Export Markets"],
  certifications:          ["Certifications", "Certification"],
  certBody:                ["Cert Body", "Certification Body"],
  certStatus:              ["Cert Status", "Certification Status"],
  certExpiryDate:          ["Cert Expiry Date", "Certification Expiry"],
  yearsInBusiness:         ["Years in Business"],
  factoryType:             ["Factory Type"],
  paymentTerms:            ["Payment Terms"],
  incoterms:               ["Incoterms"],
  leadTime:                ["Lead Time"],
  portOfLoading:           ["Port of Loading"],
  packagingType:           ["Packaging Type"],
  privateLabelAvailable:   ["Private Label Available"],
  complianceDocsAvailable: ["Compliance Documents Available"],
  leadSource:              ["Lead Source"],
  riskScore:               ["Risk Score"],
  dueDiligenceStatus:      ["Due Diligence Status"],
  lastContactDate:         ["Last Contact Date"],
  followUpRequired:        ["Follow-up Required", "Follow Up Required"],
  followUpDate:            ["Follow-up Date", "Follow Up Date"],
  internalNotes:           ["Internal Notes"],
  contractSigned:          ["Contract Signed"],
  contractDate:            ["Contract Date"],
  latestQuotation:         ["Latest Quotation", "Quotation"],
  performanceRating:       ["Performance Rating"],
  blacklisted:             ["Blacklisted"],
  reasonInactive:          ["Reason Inactive", "Reason"],
  dateMarkedInactive:      ["Date Marked Inactive", "Date Inactive"],
  reactivationPotential:   ["Reactivation Potential", "Potential"],
  notes:                   ["Notes", "Note", "Remark", "Remarks", "Comments", "COMMENTS"],
};

function detectColumns(csvHeaders: string[]): Record<string, string> {
  const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const normalisedHeaders = csvHeaders.map(normalise);
  const detected: Record<string, string> = {};
  for (const [dbField, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalisedHeaders.indexOf(normalise(alias));
      if (idx !== -1) {
        detected[dbField] = csvHeaders[idx];
        break;
      }
    }
  }
  return detected;
}

function detectSkipLines(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
    let lineNum = 0;
    let resolved = false;
    rl.on("line", (line: string) => {
      if (!resolved && line.toLowerCase().includes("company name")) {
        resolved = true;
        rl.close();
        resolve(lineNum);
      }
      lineNum++;
    });
    rl.on("close", () => { if (!resolved) resolve(0); });
  });
}

async function parseCSV(filePath: string): Promise<Record<string, string | null>[]> {
  const skipLines = await detectSkipLines(filePath);
  console.log(`  ℹ️  Auto-detected ${skipLines} line(s) to skip before header row.`);

  const allRows: Record<string, string>[] = [];
  let detectedColumns: Record<string, string> = {};

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ skipLines }))
      .on("headers", (headers: string[]) => {
        detectedColumns = detectColumns(headers);
        console.log("📋 Column mapping detected:");
        for (const [dbField, csvHeader] of Object.entries(detectedColumns)) {
          console.log(`  ${dbField.padEnd(24)} ← "${csvHeader}"`);
        }
        const missing = Object.keys(COLUMN_ALIASES).filter((f) => !detectedColumns[f]);
        if (missing.length) console.log(`  ⚠️  Not found (will be null): ${missing.join(", ")}`);
        console.log();
      })
      .on("data", (row: Record<string, string>) => allRows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  const suppliers: Record<string, string | null>[] = [];
  for (const row of allRows) {
    const companyCol = detectedColumns["company"];
    const companyValue = companyCol ? row[companyCol]?.trim() : null;
    if (!companyValue) continue;
    const supplier: Record<string, string | null> = {};
    for (const dbField of Object.keys(COLUMN_ALIASES)) {
      const csvHeader = detectedColumns[dbField];
      supplier[dbField] = csvHeader ? row[csvHeader]?.trim() || null : null;
    }
    suppliers.push(supplier);
  }
  return suppliers;
}

function buildRecord(row: Record<string, string | null>, id: string): Prisma.OldSupplierCreateInput {
  const v = (f: string) => row[f] ?? undefined;
  return {
    id,
    company:                 row.company!,
    productCategory:         v("productCategory"),
    product:                 v("product"),
    country:                 v("country"),
    city:                    v("city"),
    companyAddress:          v("companyAddress"),
    website:                 v("website"),
    yearFirstAdded:          v("yearFirstAdded"),
    sourceSheet:             v("sourceSheet"),
    currentStatus:           v("currentStatus"),
    contactPerson:           v("contactPerson"),
    designation:             v("designation"),
    email:                   v("email"),
    phone:                   v("phone"),
    whatsapp:                v("whatsapp"),
    legalName:               v("legalName"),
    secondaryContactName:    v("secondaryContactName"),
    secondaryEmail:          v("secondaryEmail"),
    secondaryPhone:          v("secondaryPhone"),
    accountManager:          v("accountManager"),
    subCategory:             v("subCategory"),
    commodityType:           v("commodityType"),
    productionCapacity:      v("productionCapacity"),
    moq:                     v("moq"),
    priceRange:              v("priceRange"),
    currency:                v("currency"),
    exportMarkets:           v("exportMarkets"),
    certifications:          v("certifications"),
    certBody:                v("certBody"),
    certStatus:              v("certStatus"),
    certExpiryDate:          v("certExpiryDate"),
    yearsInBusiness:         v("yearsInBusiness"),
    factoryType:             v("factoryType"),
    paymentTerms:            v("paymentTerms"),
    incoterms:               v("incoterms"),
    leadTime:                v("leadTime"),
    portOfLoading:           v("portOfLoading"),
    packagingType:           v("packagingType"),
    privateLabelAvailable:   v("privateLabelAvailable"),
    complianceDocsAvailable: v("complianceDocsAvailable"),
    leadSource:              v("leadSource"),
    riskScore:               v("riskScore"),
    dueDiligenceStatus:      v("dueDiligenceStatus"),
    lastContactDate:         v("lastContactDate"),
    followUpRequired:        v("followUpRequired"),
    followUpDate:            v("followUpDate"),
    internalNotes:           v("internalNotes"),
    contractSigned:          v("contractSigned"),
    contractDate:            v("contractDate"),
    latestQuotation:         v("latestQuotation"),
    performanceRating:       v("performanceRating"),
    blacklisted:             v("blacklisted"),
    reasonInactive:          v("reasonInactive"),
    dateMarkedInactive:      v("dateMarkedInactive"),
    reactivationPotential:   v("reactivationPotential"),
    notes:                   v("notes"),
    supplierExternalId:      v("supplierExternalId"),
    createdBy:               process.env.CREATED_BY_USER_ID ?? undefined,
  };
}

async function importSuppliers(
  suppliers: Record<string, string | null>[],
  startCounter = 1
) {
  console.log(`📦 Importing ${suppliers.length} suppliers in batches of ${BATCH_SIZE}...\n`);
  let counter = startCounter;

  // Split into batches
  for (let i = 0; i < suppliers.length; i += BATCH_SIZE) {
    const batch = suppliers.slice(i, i + BATCH_SIZE);

    const ops = batch.map((row) => {
      const id = `old_sup_${String(counter).padStart(5, "0")}`;
      counter++;
      const data = buildRecord(row, id);
      return prisma.oldSupplier.upsert({
        where: { id },
        create: data,
        update: { ...data, id: undefined },
      });
    });

    // Retry once on transient connection errors
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await prisma.$transaction(ops);
        break;
      } catch (err: any) {
        if (attempt < 3 && (err.code === "P1017" || err.code === "P2024")) {
          console.log(`  ⚠️  Connection error on batch ${Math.ceil(i / BATCH_SIZE) + 1}, retrying (${attempt}/3)...`);
          await prisma.$disconnect();
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          await prisma.$connect();
        } else {
          throw err;
        }
      }
    }

    const lastId = `old_sup_${String(counter - 1).padStart(5, "0")}`;
    const lastCompany = batch[batch.length - 1].company;
    console.log(`  ✅  Batch ${String(Math.ceil((i + 1) / BATCH_SIZE)).padStart(4)} | up to [${lastId}] ${lastCompany}`);
  }

  const finalId = `old_sup_${String(counter - 1).padStart(5, "0")}`;
  console.log(`\n  ✅  Done — last id: ${finalId}`);
  return counter;
}

async function run() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("❌  No CSV files provided.\nUsage: npx tsx scripts/import-old-suppliers.ts <file1.csv> [file2.csv ...]");
    process.exit(1);
  }

  const existing = await prisma.$queryRaw<{ max_num: number }[]>`
    SELECT MAX(CAST(SUBSTRING(id FROM 9) AS INTEGER)) AS max_num
    FROM old_suppliers
    WHERE id LIKE 'old_sup_%'
    AND SUBSTRING(id FROM 9) ~ '^[0-9]+$'
  `;
  let counter = 1;
  if (existing.length > 0 && existing[0].max_num) {
    counter = existing[0].max_num + 1;
    console.log(`ℹ️  Resuming from counter: ${counter} (last numeric id: ${existing[0].max_num})\n`);
  }

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.error(`❌  File not found: ${filePath}`);
      process.exit(1);
    }
    console.log(`\n${"─".repeat(60)}`);
    console.log(`📂 Processing: ${filePath}`);
    console.log("─".repeat(60));

    const suppliers = await parseCSV(filePath);
    console.log(`📋 Found ${suppliers.length} suppliers in this sheet.\n`);
    counter = await importSuppliers(suppliers, counter);
  }

  await prisma.$disconnect();
  console.log("\n🚀 All imports complete!");
}

run().catch(async (err) => {
  console.error("❌ Import failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
