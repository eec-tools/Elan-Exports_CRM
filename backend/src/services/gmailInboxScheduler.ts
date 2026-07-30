import cron from "node-cron";
import prisma from "../config/db.js";
import { syncAllGmailAccounts } from "./gmailInboxService.js";

// Guards the "sync immediately on startup" call below against firing on every
// process restart (e.g. nodemon restarting on every file save in local dev, or a
// production crash-loop) — each restart would otherwise re-hit every configured
// Gmail account immediately, on top of whatever the 5-minute cron is already doing.
const STARTUP_SYNC_MIN_GAP_MS = 30 * 60 * 1000;

async function shouldRunStartupSync(): Promise<boolean> {
  const key = "startup_catchup_last_run_inbox_sync";
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  const last = setting?.value ? new Date(setting.value).getTime() : 0;
  if (Date.now() - last < STARTUP_SYNC_MIN_GAP_MS) return false;
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: new Date().toISOString() },
    create: { key, value: new Date().toISOString() },
  });
  return true;
}

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

  // Sync every 5 minutes — offset from the reply-detector crons (minutes 0 and 2)
  // so this doesn't burst-hit the same Gmail accounts at the same instant.
  cron.schedule("4-59/5 * * * *", async () => {
    console.log("[GmailInboxScheduler] Running scheduled inbox sync...");
    await syncAllGmailAccounts();
  });

  // Sync immediately on startup — but only if we haven't just done so (see guard above)
  shouldRunStartupSync().then((should) => {
    if (!should) {
      console.log("[GmailInboxScheduler] Startup sync ran recently — skipping (likely a restart)");
      return;
    }
    syncAllGmailAccounts().catch((err) =>
      console.error("[GmailInboxScheduler] Initial sync failed:", err?.message)
    );
  });

  console.log("[GmailInboxScheduler] Started — syncing every 5 minutes");
}
