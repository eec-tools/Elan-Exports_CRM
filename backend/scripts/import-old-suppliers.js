import { neon } from "@neondatabase/serverless";
import fetch from "node-fetch";
import csv from "csv-parser";
import dotenv from "dotenv";
import { Readable } from "stream";

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

const SHEET_URL =
"https://docs.google.com/spreadsheets/d/1uUZFOTQOxKeJqOab8MjO9la2errfjjfd/export?format=csv&gid=1362199516";

const columnMap = {
  "Company Name": "company",
  "Country": "country",
  "Website": "website",
  "Email": "email",
  "Products": "products",
  "Notes": "notes"
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
        ${row["Company Name"]},
        ${row["Country"] || null},
        ${row["Website"] || null},
        ${row["Email"] || null},
        ${row["Products"] || null},
        ${row["Notes"] || null},
        ${process.env.CREATED_BY_USER_ID},
        CURRENT_TIMESTAMP
      )
    `;
  }

  console.log("Old suppliers import complete 🚀");
}

run();