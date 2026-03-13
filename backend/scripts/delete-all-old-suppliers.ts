import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  const beforeCount = await sql`SELECT COUNT(*) as count FROM old_suppliers`;
  console.log(`Before: ${beforeCount[0].count} records`);

  await sql`DELETE FROM old_suppliers`;

  const afterCount = await sql`SELECT COUNT(*) as count FROM old_suppliers`;
  console.log(`After:  ${afterCount[0].count} records`);
  console.log("✅ Cleanup complete. All records deleted.");
}

run().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
