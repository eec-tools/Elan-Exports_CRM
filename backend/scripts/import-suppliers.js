import { neon } from "@neondatabase/serverless";
import fetch from "node-fetch";
import csv from "csv-parser";
import dotenv from "dotenv";
import { Readable } from "stream";

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

const SHEET_URL =
"https://docs.google.com/spreadsheets/d/1uUZFOTQOxKeJqOab8MjO9la2errfjjfd/export?format=csv&gid=186510272";

const columnMap = {
  "Company Name": "company",
  "Product Category": "product_category",
  "Country": "country",
  "Contact Person": "contact_person",
  "Email": "email",
  "Phone": "phone",
  "Products": "products",
  "Contract Buyer": "contract_buyer",
  "Commission %": "commission_percent",
  "Certifications": "certifications",
  "Production Capacity": "production_capacity",
  "Contract Start Date": "contract_start_date",
  "Contract End Date": "contract_end_date",
  "Contract Value": "contract_value",
  "Renewal Date": "renewal_date",
  "Current Status": "current_status",
  "Performance Score": "performance_score",
  "Remarks": "remarks"
};

async function run() {
  console.log("Downloading Google Sheet...");

  const res = await fetch(SHEET_URL);
  const csvText = await res.text();

  const rows = [];

  await new Promise((resolve) => {
Readable.from(csvText)
  .pipe(csv({ skipLines: 1 }))
      .on("data", (data) => rows.push(data))
      .on("end", resolve);
  });

  console.log(`Found ${rows.length} rows`);

  let counter = 1;

  for (const row of rows) {
      if (!row["Company Name"]) continue;

    const cleaned = {};

    for (const key in columnMap) {
      cleaned[columnMap[key]] = row[key] || null;
    }

    const id = `sup_${String(counter).padStart(3, "0")}`;
    counter++;

    await sql`
      INSERT INTO suppliers (
        id,
        company,
        product_category,
        country,
        contact_person,
        email,
        phone,
        products,
        contract_buyer,
        commission_percent,
        certifications,
        production_capacity,
        contract_start_date,
        contract_end_date,
        contract_value,
        renewal_date,
        current_status,
        performance_score,
        remarks,
        created_by
      ) VALUES (
        ${id},
        ${cleaned.company},
        ${cleaned.product_category},
        ${cleaned.country},
        ${cleaned.contact_person},
        ${cleaned.email},
        ${cleaned.phone},
        ${cleaned.products},
        ${cleaned.contract_buyer},
        ${cleaned.commission_percent},
        ${cleaned.certifications},
        ${cleaned.production_capacity},
        ${cleaned.contract_start_date},
        ${cleaned.contract_end_date},
        ${cleaned.contract_value},
        ${cleaned.renewal_date},
        ${cleaned.current_status || "Active"},
        ${cleaned.performance_score},
        ${cleaned.remarks},
        ${process.env.CREATED_BY_USER_ID}
      )
    `;
  }

  console.log("Import complete 🚀");
}

run();