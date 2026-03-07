import { neon } from "@neondatabase/serverless";
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";
import { Readable } from "stream";

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

// ─────────────────────────────────────────────
// Maps raw CSV row labels → database column names
// ─────────────────────────────────────────────
const fieldMap: Record<string, string> = {
  "Company Name":                             "company",
  "Lidl Assigned Factory Id":                 "lidl_factory_id",
  "Commission %":                             "commission_percent",
  "Contract Signed wth (Buyer Name)":         "contract_buyer",
  "Approved Confirm %":                       "approved_confirm_percent",
  "Products dealing with":                    "products",
  "Country":                                  "country",
  "Contact person":                           "contact_person",
  "Phone Number":                             "phone",
  "Company Address":                          "company_address",
  "Email":                                    "email",
  "Website":                                  "website",
  "Product catalog shared: Yes/No":           "product_catalog_shared",
  "Production capacity:":                     "production_capacity",
  "Factory videos shared: Yes/No":            "factory_videos_shared",
  "Warehouse videos shared: Yes/No":          "warehouse_videos_shared",
  "Countries currently exporting to:":        "exporting_countries",
  "Sample Policy: Yes/No":                    "sample_policy",
  "Certificates:":                            "certifications",
  "Working with Our brands - Yes/No":         "working_with_our_brands",
  "Other companies/brands they are working with:": "other_brands",
  "Remarks":                                  "remarks",
  "Current Status":                           "current_status",
};

// ─────────────────────────────────────────────
// Step 1 – Migrate the suppliers table schema
// Run this once; safe to re-run (uses IF NOT EXISTS / IF EXISTS)
// ─────────────────────────────────────────────
async function migrateSchema() {
  console.log("🔧 Running schema migration...");

  // Drop old columns that no longer exist in the source data
  const columnsToDrop = [
    "product_category",
    "contract_start_date",
    "contract_end_date",
    "contract_value",
    "renewal_date",
    "performance_score",
  ];

  for (const col of columnsToDrop) {
    await sql`
      ALTER TABLE suppliers
      DROP COLUMN IF EXISTS ${sql(col)}
    `;
    console.log(`  ✂️  Dropped column (if existed): ${col}`);
  }

  // Add new columns that come from the correct dataset
  const columnsToAdd: [string, string][] = [
    ["lidl_factory_id",         "TEXT"],
    ["approved_confirm_percent","TEXT"],
    ["company_address",         "TEXT"],
    ["website",                 "TEXT"],
    ["product_catalog_shared",  "TEXT"],
    ["factory_videos_shared",   "TEXT"],
    ["warehouse_videos_shared", "TEXT"],
    ["exporting_countries",     "TEXT"],
    ["sample_policy",           "TEXT"],
    ["working_with_our_brands", "TEXT"],
    ["other_brands",            "TEXT"],
  ];

  for (const [col, type] of columnsToAdd) {
    await sql`
      ALTER TABLE suppliers
      ADD COLUMN IF NOT EXISTS ${sql(col)} ${sql(type)}
    `;
    console.log(`  ✅  Added column (if missing): ${col}`);
  }

  console.log("✅ Schema migration complete.\n");
}

// ─────────────────────────────────────────────
// Step 2 – Parse the transposed CSV
// The file has fields as ROWS and companies as COLUMNS.
// We flip it into an array of per-company objects.
// ─────────────────────────────────────────────
async function parseCSV(filePath: string): Promise<Record<string, string>[]> {
  const rawRows: string[][] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ headers: false, skipLines: 0 }))
      .on("data", (row: Record<string, string>) => {
        rawRows.push(Object.values(row));
      })
      .on("end", resolve)
      .on("error", reject);
  });

  // Find the row whose first cell is "Company Name" — that is our header row
  const headerRowIndex = rawRows.findIndex(
    (row) => row[0]?.trim() === "Company Name"
  );

  if (headerRowIndex === -1) {
    throw new Error('Could not find "Company Name" row in CSV.');
  }

  const headerRow = rawRows[headerRowIndex]; // company names across columns
  const dataRows  = rawRows.slice(headerRowIndex + 1); // field rows below

  // Total companies = columns 1..N in the header row (col 0 is the label)
  const companyCount = headerRow.length - 1;
  const suppliers: Record<string, string>[] = [];

  for (let colIdx = 1; colIdx <= companyCount; colIdx++) {
    const companyName = headerRow[colIdx]?.trim().replace(/\n/g, " ");
    if (!companyName) continue; // skip empty columns

    const supplier: Record<string, string> = {};

    // Always store the raw company name first
    supplier["Company Name"] = companyName;

    // Walk every field row and grab this company's value
    for (const fieldRow of dataRows) {
      const rawLabel = fieldRow[0]?.trim();
      if (!rawLabel) continue;

      // Normalise label so it matches fieldMap keys
      const normLabel = rawLabel.replace(/\s+/g, " ");
      const value     = fieldRow[colIdx]?.trim().replace(/\n/g, " ") ?? "";

      supplier[normLabel] = value;
    }

    suppliers.push(supplier);
  }

  return suppliers;
}

// ─────────────────────────────────────────────
// Step 3 – Insert / upsert into the database
// ─────────────────────────────────────────────
async function importSuppliers(suppliers: Record<string, string>[]) {
  console.log(`📦 Importing ${suppliers.length} suppliers...\n`);
  let counter = 1;

  for (const raw of suppliers) {
    // Map raw labels → db column names
    const row: Record<string, string | null> = {};
    for (const [rawLabel, dbCol] of Object.entries(fieldMap)) {
      // Try exact match first, then trimmed/normalised match
      const value =
        raw[rawLabel] ??
        raw[rawLabel.trim()] ??
        null;
      row[dbCol] = value || null;
    }

    if (!row.company) continue; // skip rows without a company name

    const id = `sup_${String(counter).padStart(3, "0")}`;
    counter++;

    await sql`
      INSERT INTO suppliers (
        id,
        company,
        lidl_factory_id,
        commission_percent,
        contract_buyer,
        approved_confirm_percent,
        products,
        country,
        contact_person,
        phone,
        company_address,
        email,
        website,
        product_catalog_shared,
        production_capacity,
        factory_videos_shared,
        warehouse_videos_shared,
        exporting_countries,
        sample_policy,
        certifications,
        working_with_our_brands,
        other_brands,
        remarks,
        current_status,
        created_by
      ) VALUES (
        ${id},
        ${row.company},
        ${row.lidl_factory_id},
        ${row.commission_percent},
        ${row.contract_buyer},
        ${row.approved_confirm_percent},
        ${row.products},
        ${row.country},
        ${row.contact_person},
        ${row.phone},
        ${row.company_address},
        ${row.email},
        ${row.website},
        ${row.product_catalog_shared},
        ${row.production_capacity},
        ${row.factory_videos_shared},
        ${row.warehouse_videos_shared},
        ${row.exporting_countries},
        ${row.sample_policy},
        ${row.certifications},
        ${row.working_with_our_brands},
        ${row.other_brands},
        ${row.remarks},
        ${row.current_status ?? "Active"},
        ${process.env.CREATED_BY_USER_ID ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        company                 = EXCLUDED.company,
        lidl_factory_id         = EXCLUDED.lidl_factory_id,
        commission_percent      = EXCLUDED.commission_percent,
        contract_buyer          = EXCLUDED.contract_buyer,
        approved_confirm_percent= EXCLUDED.approved_confirm_percent,
        products                = EXCLUDED.products,
        country                 = EXCLUDED.country,
        contact_person          = EXCLUDED.contact_person,
        phone                   = EXCLUDED.phone,
        company_address         = EXCLUDED.company_address,
        email                   = EXCLUDED.email,
        website                 = EXCLUDED.website,
        product_catalog_shared  = EXCLUDED.product_catalog_shared,
        production_capacity     = EXCLUDED.production_capacity,
        factory_videos_shared   = EXCLUDED.factory_videos_shared,
        warehouse_videos_shared = EXCLUDED.warehouse_videos_shared,
        exporting_countries     = EXCLUDED.exporting_countries,
        sample_policy           = EXCLUDED.sample_policy,
        certifications          = EXCLUDED.certifications,
        working_with_our_brands = EXCLUDED.working_with_our_brands,
        other_brands            = EXCLUDED.other_brands,
        remarks                 = EXCLUDED.remarks,
        current_status          = EXCLUDED.current_status
    `;

    console.log(`  ✅  [${id}] ${row.company}`);
  }
}

// ─────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────
async function run() {
  // Change this path to wherever the CSV lives relative to this script
  const CSV_PATH = "./scripts/Database_for_Signed_Contract_Suppliers.csv";

  await migrateSchema();

  const suppliers = await parseCSV(CSV_PATH);
  console.log(`📋 Parsed ${suppliers.length} suppliers from CSV.\n`);

  await importSuppliers(suppliers);

  console.log("\n🚀 Import complete!");
}

run().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
