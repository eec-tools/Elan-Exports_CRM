import "dotenv/config";
import { runDailyReport } from "../services/dailyReportScheduler.js";

console.log("=".repeat(60));
console.log("  Élan Exports — Manual Daily Report Trigger");
console.log("=".repeat(60));

runDailyReport()
  .then(() => {
    console.log("=".repeat(60));
    console.log("  Done. Check the vault under: Daily Reports folder.");
    console.log("  Email sent to: shirali@eectrade.com");
    console.log("=".repeat(60));
    process.exit(0);
  })
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
