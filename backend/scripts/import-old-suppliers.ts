import { neon } from "@neondatabase/serverless";
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN ALIASES
//
// Each key is the db field. The array lists every possible column header
// that could represent that field across different sheets.
// When you add a new sheet with yet another header name, just append it here.
// Matching is case-insensitive and ignores extra spaces.
// ─────────────────────────────────────────────────────────────────────────────
const COLUMN_ALIASES: Record<string, string[]> = {
  company: [
    "Company Name",
    "Company",
    "Supplier Name",
    "Supplier",
    "Organization",
  ],
  country: [
    "Country",
    "Country Name",
    "Location",
    "Region",
  ],
  website: [
    "Website",
    "Website Address",
    "Web",
    "URL",
    "Web Address",
    "Homepage",
  ],
  email: [
    "Email",
    "Email Id",
    "Email Address",
    "E-mail",
    "E-mail Address",
    "Contact Email",
  ],
  products: [
    "Products",
    "Product name",
    "Product Name",
    "Product",
    "Products dealing with",
    "Items",
    "Goods",
  ],
  notes: [
    "Notes",
    "Note",
    "Remark",
    "Remarks",
    "Comments",
    "COMMENTS",
    "Comment",
    "Additional Notes",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Detects which actual CSV header maps to which db field.
// Returns a map like: { company: "Company Name", email: "Email Id", ... }
// Fields missing from the sheet are simply omitted (treated as null on insert).
// ─────────────────────────────────────────────────────────────────────────────
function detectColumns(csvHeaders: string[]): Record<string, string> {
  const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const normalisedHeaders = csvHeaders.map(normalise);

  const detected: Record<string, string> = {};

  for (const [dbField, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalisedHeaders.indexOf(normalise(alias));
      if (idx !== -1) {
        detected[dbField] = csvHeaders[idx]; // store the original casing
        break;
      }
    }
  }

  return detected;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parses a CSV file and extracts only the 6 fields we care about.
// Rows without a company name are skipped.
// ─────────────────────────────────────────────────────────────────────────────
async function parseCSV(
  filePath: string
): Promise<Record<string, string | null>[]> {
  const allRows: Record<string, string>[] = [];
  let detectedColumns: Record<string, string> = {};

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("headers", (headers: string[]) => {
        detectedColumns = detectColumns(headers);

        console.log("📋 Detected column mapping:");
        for (const [dbField, csvHeader] of Object.entries(detectedColumns)) {
          console.log(`  ${dbField.padEnd(10)} ← "${csvHeader}"`);
        }

        const missing = Object.keys(COLUMN_ALIASES).filter(
          (f) => !detectedColumns[f]
        );
        if (missing.length) {
          console.log(`  ⚠️  Not found in this sheet (will be null): ${missing.join(", ")}`);
        }
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

    // Skip rows with no company name (section headers, empty rows, etc.)
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

// ─────────────────────────────────────────────────────────────────────────────
// Inserts suppliers into old_suppliers. Safe to re-run (ON CONFLICT = upsert).
// ─────────────────────────────────────────────────────────────────────────────
async function importSuppliers(
  suppliers: Record<string, string | null>[],
  startCounter = 1
) {
  console.log(`📦 Importing ${suppliers.length} suppliers...\n`);
  let counter = startCounter;

  for (const row of suppliers) {
    const id = `old_sup_${String(counter).padStart(3, "0")}`;
    counter++;

    await sql`
      INSERT INTO old_suppliers (
        id,
        company,
        country,
        website,
        email,
        products,
        notes,
        created_by,
        updated_at
      ) VALUES (
        ${id},
        ${row.company},
        ${row.country},
        ${row.website},
        ${row.email},
        ${row.products},
        ${row.notes},
        ${process.env.CREATED_BY_USER_ID ?? null},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        company    = EXCLUDED.company,
        country    = EXCLUDED.country,
        website    = EXCLUDED.website,
        email      = EXCLUDED.email,
        products   = EXCLUDED.products,
        notes      = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
    `;

    console.log(`  ✅  [${id}] ${row.company}`);
  }

  return counter;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
//
// Usage:
//   npx tsx scripts/import-old-suppliers.ts ./scripts/your-file.csv
//   npx tsx scripts/import-old-suppliers.ts ./scripts/sheet1.csv ./scripts/sheet2.csv
//
// Multiple files are processed in order; IDs continue from where the last
// file left off (e.g. old_sup_001 … old_sup_045 across two files).
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.error(
      "❌  No CSV files provided.\n" +
      "Usage: npx tsx scripts/import-old-suppliers.ts <file1.csv> [file2.csv ...]"
    );
    process.exit(1);
  }

  let counter = 1;

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

  console.log("\n🚀 All imports complete!");
}

run().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
