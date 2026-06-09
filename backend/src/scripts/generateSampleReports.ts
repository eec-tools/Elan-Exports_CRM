import "dotenv/config";
import { runDailyReport, runWeeklyReport } from "../services/dailyReportScheduler.js";

const line = "=".repeat(62);

async function main() {
  console.log(line);
  console.log("  Élan Exports — Sample Report Generator");
  console.log("  Generates: yesterday (daily) + last week (weekly)");
  console.log(line);

  // ── 1. Daily report (yesterday) ───────────────────────────────────────────
  console.log("\n[1/2] Generating DAILY report (yesterday)…\n");
  await runDailyReport();

  console.log("\n" + "-".repeat(62));

  // ── 2. Weekly report (last Mon–Sun) ───────────────────────────────────────
  console.log("\n[2/2] Generating WEEKLY report (last week Mon–Sun)…\n");
  await runWeeklyReport();

  console.log("\n" + line);
  console.log("  Done. Both reports saved to:");
  console.log("    Vault › Daily Reports  (yesterday)");
  console.log("    Vault › Weekly Reports (last week)");
  console.log("  Email copies sent to: shirali@eectrade.com");
  console.log(line);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
}).finally(() => process.exit(0));
