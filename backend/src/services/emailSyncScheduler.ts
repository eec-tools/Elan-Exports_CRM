/**
 * Email Sync Scheduler
 *
 * Runs a cron job every 15 minutes to pull new emails from Outlook
 * and persist them into the email_tracker table.
 *
 * The scheduler is a no-op when Outlook credentials are not configured,
 * so it is safe to deploy without them.
 */

import cron from "node-cron";
import { syncOutlookEmails } from "./outlookService.js";

let isRunning = false;

async function runSync(): Promise<void> {
  if (isRunning) {
    console.log("[EmailSync] Previous sync still running — skipping this cycle.");
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    console.log("[EmailSync] Starting Outlook email sync…");
    const result = await syncOutlookEmails();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[EmailSync] Done in ${elapsed}s — inserted: ${result.inserted}, skipped: ${result.skipped}, errors: ${result.errors}`
    );
  } catch (err: any) {
    console.error("[EmailSync] Sync failed:", err?.message ?? err);
  } finally {
    isRunning = false;
  }
}

export function startEmailSyncScheduler(): void {
  const missingVars = [
    "OUTLOOK_TENANT_ID",
    "OUTLOOK_CLIENT_ID",
    "OUTLOOK_CLIENT_SECRET",
    "OUTLOOK_MAILBOX",
  ].filter((k) => !process.env[k]);

  if (missingVars.length > 0) {
    console.warn(
      `[EmailSync] Outlook not configured — scheduler disabled. Missing: ${missingVars.join(", ")}`
    );
    return;
  }

  // Run immediately on startup, then every 15 minutes
  runSync();

  // "*/15 * * * *"  →  every 15 minutes
  cron.schedule("*/15 * * * *", runSync);

  console.log("[EmailSync] Outlook email sync scheduler started (every 15 min).");
}
