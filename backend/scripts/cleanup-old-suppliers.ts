import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  const beforeCount = await sql`SELECT COUNT(*) as count FROM old_suppliers`;
  console.log(`Before: ${beforeCount[0].count} records`);

  await sql`
    DELETE FROM old_suppliers
    WHERE NOT (id >= 'old_sup_001' AND id <= 'old_sup_024')
  `;

  const afterCount = await sql`SELECT COUNT(*) as count FROM old_suppliers`;
  console.log(`After:  ${afterCount[0].count} records`);
  console.log("✅ Cleanup complete. Only old_sup_001–old_sup_024 remain.");
}

run().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
