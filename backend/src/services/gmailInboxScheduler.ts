import cron from "node-cron";
import { syncAllGmailAccounts } from "./gmailInboxService.js";

export function startGmailInboxScheduler() {
  const configured = !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    (process.env.GMAIL_ACCOUNT_1_EMAIL || process.env.GMAIL_ACCOUNT_EMAILS)
  );

  if (!configured) {
    console.log("[GmailInboxScheduler] Gmail not configured — skipping inbox sync");
    return;
  }

  // Sync every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    console.log("[GmailInboxScheduler] Running scheduled inbox sync...");
    await syncAllGmailAccounts();
  });

  // Sync immediately on startup
  syncAllGmailAccounts().catch((err) =>
    console.error("[GmailInboxScheduler] Initial sync failed:", err?.message)
  );

  console.log("[GmailInboxScheduler] Started — syncing every 5 minutes");
}
