/**
 * Imports old supplier records from oldsupplierrecords.csv into the old_suppliers table.
 * The CSV has a title row on line 1 and actual headers on line 2.
 *
 * Run: npx tsx scripts/import-new-suppliers.ts
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const prisma = new PrismaClient();

const CSV_PATH = path.join(__dirname, "oldsupplierrecords.csv");


type Row = Record<string, string>;

async function parseCSV(filePath: string): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const rows: Row[] = [];
    let lineIndex = 0;

    fs.createReadStream(filePath)
      .pipe(
        csv({
          // Skip the first title row, use row 2 as headers
          skipLines: 1,
        })
      )
      .on("data", (row: Row) => {
        lineIndex++;
        rows.push(row);
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

async function importSuppliers(rows: Row[]) {
  console.log(`\nImporting ${rows.length} suppliers into old_suppliers...\n`);
  let imported = 0;
  let skipped = 0;

  for (const raw of rows) {
    const company = raw["Company Name"]?.trim();
    if (!company) {
      skipped++;
      continue;
    }

    await prisma.oldSupplier.create({
      data: {
        company,
        city:            raw["City"]?.trim()             || null,
        country:         raw["Country"]?.trim()           || null,
        email:           raw["Email"]?.trim()             || null,
        website:         raw["Website"]?.trim()           || null,
        productCategory: raw["Product Category"]?.trim()  || null,
        certifications:  raw["Certifications"]?.trim()    || null,
        companyAddress:  raw["Full Address"]?.trim()      || null,
        product:         raw["Products"]?.trim()          || null,
        supplierStage:   "Closed",
        dealStage:       "Communication",
      },
    });

    imported++;
    if (imported % 100 === 0) {
      console.log(`  ... ${imported} imported so far`);
    }
  }

  console.log(`\nDone. Imported: ${imported}  Skipped (no company name): ${skipped}`);
}

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at: ${CSV_PATH}`);
    process.exit(1);
  }

  console.log(`Reading: ${CSV_PATH}`);
  const rows = await parseCSV(CSV_PATH);
  console.log(`Parsed ${rows.length} rows from CSV.`);

  if (rows.length === 0) {
    console.log("No rows found. Exiting.");
    await prisma.$disconnect();
    return;
  }

  await importSuppliers(rows);
  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error("Import failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
