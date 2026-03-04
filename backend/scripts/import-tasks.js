import { neon } from "@neondatabase/serverless";
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config({ path: "../.env" }); // Make sure we load the right env if we run from scripts dir

// Fallback logic for DATABASE_URL if run from backend root vs backend/scripts
if (!process.env.DATABASE_URL) {
    dotenv.config();
}

const sql = neon(process.env.DATABASE_URL);

async function run() {
    console.log("Reading local CSV...");

    const rows = [];

    await new Promise((resolve) => {
        fs.createReadStream("scripts/task_tracker_data.csv")
            .pipe(csv())
            .on("data", (data) => rows.push(data))
            .on("end", resolve);
    });

    console.log(`Found ${rows.length} rows`);

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
        if (!row["Date"] || !row["Subject"]) {
            skipped++;
            continue;
        }

        const id = crypto.randomUUID();
        const date_received = new Date(row["Date"]);
        const sender_address = row["Sender's Address"] || "Unknown";
        const subject = row["Subject"];
        const task = row["Task"] || null;
        const product_category = row["Product Category"] || null;
        const priority = row["Priority"] || null;
        const respondent = row["Respondent"] || null;
        let status = row["Status"] || "Not Started";

        // Clean up status strings if needed to match enum/standard cases in application
        // Let's ensure it's "Not Started", "In Progress", or "Completed"
        const statusMap = {
            "not started": "Not Started",
            "in progress": "In Progress",
            "incomplete": "In Progress",
            "completed": "Completed"
        };
        status = statusMap[status.toLowerCase().trim()] || status;

        let notes = row["Notes"] || "";
        if (row["Deadline"]) {
            notes += (notes ? " | " : "") + `Deadline: ${row["Deadline"]}`;
        }
        notes = notes || null;

        try {
            await sql`
        INSERT INTO email_tracker (
          id,
          date_received,
          sender_address,
          subject,
          task,
          product_category,
          priority,
          respondent,
          status,
          notes,
          created_at,
          updated_at
        ) VALUES (
          ${id},
          ${date_received},
          ${sender_address},
          ${subject},
          ${task},
          ${product_category},
          ${priority},
          ${respondent},
          ${status},
          ${notes},
          ${new Date()},
          ${new Date()}
        )
      `;
            imported++;
        } catch (err) {
            console.error(`Failed to insert row: ${subject}`, err);
        }
    }

    console.log(`Import complete 🚀. Imported: ${imported}, Skipped: ${skipped}`);
}

run().catch(console.error);
