import cron from "node-cron";
import prisma from "../config/db.js";
import { sendFollowupReminderEmail, sendReplyPendingReminderEmail } from "./mailer.js";
import { createNotification } from "./notificationService.js";
import { executeSendStep } from "../controllers/sourcingEmailCampaign.controller.js";
import { executeSendStep as executeBuyerSendStep } from "../controllers/sourcingBuyerEmailCampaign.controller.js";

const BUYER_GMAIL_DEFAULT = "partners@eectrade.com";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const EMAIL_SEND_DELAY_MS = 2 * 60 * 1000;

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

const stepLabel: Record<number, string> = {
  1: "Follow-up 1",
  2: "Follow-up 2",
  3: "Follow-up 3",
};

async function sendDailyFollowupReminders() {
  try {
    const today = endOfDay(new Date());

    const dueCampaigns = await prisma.supplierEmailCampaign.findMany({
      where: {
        status: "active",
        nextFollowupDue: { lte: today },
      },
      include: {
        supplier: {
          select: {
            company: true,
            email: true,
            contactPerson: true,
          },
        },
      },
    });

    if (dueCampaigns.length === 0) return;

    const suppliers = dueCampaigns.map((c) => ({
      company: c.supplier.company,
      email: c.supplier.email,
      contactPerson: c.supplier.contactPerson,
      step: c.currentStep, // currentStep=1 means followup1 is due, etc.
      dueDate: c.nextFollowupDue!,
    }));

    // Send digest to all admin users
    const admins = await prisma.userRole.findMany({
      where: { role: "admin" },
      include: { user: { select: { email: true, fullName: true, isActive: true } } },
    });

    const activeAdmins = admins.filter((r) => r.user.isActive);

    await Promise.allSettled(
      activeAdmins.map((r) =>
        sendFollowupReminderEmail({
          to: r.user.email,
          adminName: r.user.fullName,
          suppliers,
        }),
      ),
    );

    // Create in-app notifications for each due campaign
    await Promise.allSettled(
      dueCampaigns.map((c) =>
        createNotification({
          type: "campaign_followup_due",
          title: "Follow-up Email Due",
          message: `${stepLabel[c.currentStep] ?? "Follow-up"} due for ${c.supplier.company}`,
          entityType: "supplier",
          entityId: c.supplierId,
          entityName: c.supplier.company,
          entityLink: `/suppliers/signed-contract/${c.supplierId}`,
        }),
      ),
    );

    console.log(
      `[EmailCampaignScheduler] Sent follow-up reminders to ${activeAdmins.length} admin(s) for ${suppliers.length} supplier(s).`,
    );
  } catch (err) {
    console.error("[EmailCampaignScheduler] Error sending reminders:", err);
  }
}

async function autoSendDueFollowups() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    console.warn("[EmailCampaignScheduler] GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET not set — skipping auto-send.");
    return;
  }

  try {
    const today = endOfDay(new Date());

    const dueCampaigns = await (prisma as any).sourcingEmailCampaign.findMany({
      where: {
        status: "active",
        currentStep: { lt: 4 },
        nextFollowupDue: { lte: today },
      },
      include: {
        sourcingSupplier: {
          select: { id: true, company: true, assignedGmailAccount: true },
        },
      },
    });

    if (dueCampaigns.length === 0) return;

    let sent = 0;
    for (let i = 0; i < dueCampaigns.length; i++) {
      const campaign = dueCampaigns[i];
      if (!campaign.sourcingSupplier.assignedGmailAccount) continue;
      try {
        await executeSendStep(campaign.sourcingId);
        sent++;
      } catch (err) {
        console.error(`[EmailCampaignScheduler] Failed to auto-send for ${campaign.sourcingSupplier.company}:`, err);
      }
      if (i < dueCampaigns.length - 1) {
        await sleep(EMAIL_SEND_DELAY_MS);
      }
    }

    console.log(`[EmailCampaignScheduler] Auto-sent ${sent}/${dueCampaigns.length} due sourcing follow-ups`);
  } catch (err) {
    console.error("[EmailCampaignScheduler] autoSendDueFollowups error:", err);
  }
}

async function autoSendDueBuyerFollowups() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    console.warn("[EmailCampaignScheduler] GMAIL credentials not set — skipping buyer auto-send.");
    return;
  }

  try {
    const today = endOfDay(new Date());

    const dueCampaigns = await (prisma as any).sourcingBuyerEmailCampaign.findMany({
      where: {
        status: "active",
        currentStep: { lt: 4 },
        nextFollowupDue: { lte: today },
      },
      include: {
        sourcingBuyer: {
          select: { id: true, company: true, assignedGmailAccount: true },
        },
      },
    });

    if (dueCampaigns.length === 0) return;

    let sent = 0;
    for (let i = 0; i < dueCampaigns.length; i++) {
      const campaign = dueCampaigns[i];
      try {
        await executeBuyerSendStep(campaign.sourcingBuyerId);
        sent++;
      } catch (err) {
        console.error(`[EmailCampaignScheduler] Failed to auto-send buyer follow-up for ${campaign.sourcingBuyer.company}:`, err);
      }
      if (i < dueCampaigns.length - 1) {
        await sleep(EMAIL_SEND_DELAY_MS);
      }
    }

    console.log(`[EmailCampaignScheduler] Auto-sent ${sent}/${dueCampaigns.length} due buyer follow-ups`);
  } catch (err) {
    console.error("[EmailCampaignScheduler] autoSendDueBuyerFollowups error:", err);
  }
}

async function sendReplyPendingReminders() {
  try {
    // Buyers where they replied but we haven't replied back; exclude invalid emails
    const buyerPendingRows = await (prisma as any).$queryRaw`
      SELECT ber.sourcing_buyer_id AS id, MAX(ber.received_at) AS responded_at
      FROM buyer_email_replies ber
      JOIN sourcing_buyers sb ON sb.id = ber.sourcing_buyer_id
      WHERE ber.direction = 'received'
        AND ber.sourcing_buyer_id IS NOT NULL
        AND sb.status != 'invalid'
        AND NOT EXISTS (
          SELECT 1 FROM buyer_email_replies b2
          WHERE b2.sourcing_buyer_id = ber.sourcing_buyer_id
            AND b2.direction = 'sent'
            AND b2.received_at > ber.received_at
        )
      GROUP BY ber.sourcing_buyer_id
    ` as { id: string; responded_at: Date }[];

    // Suppliers where they replied but we haven't replied back; exclude invalid emails
    const supplierPendingRows = await (prisma as any).$queryRaw`
      SELECT ser.sourcing_id AS id, MAX(ser.received_at) AS responded_at
      FROM supplier_email_replies ser
      JOIN sourcing_suppliers ss ON ss.id = ser.sourcing_id
      WHERE ser.direction = 'received'
        AND ser.sourcing_id IS NOT NULL
        AND ss.status != 'invalid'
        AND NOT EXISTS (
          SELECT 1 FROM supplier_email_replies s2
          WHERE s2.sourcing_id = ser.sourcing_id
            AND s2.direction = 'sent'
            AND s2.received_at > ser.received_at
        )
      GROUP BY ser.sourcing_id
    ` as { id: string; responded_at: Date }[];

    if (buyerPendingRows.length === 0 && supplierPendingRows.length === 0) {
      console.log("[ReplyReminder] No pending replies today — skipping.");
      return;
    }

    const [buyers, suppliers] = await Promise.all([
      (prisma as any).sourcingBuyer.findMany({
        where: { id: { in: buyerPendingRows.map((r: any) => r.id) } },
        select: { company: true, email: true, contactPerson: true, assignedGmailAccount: true },
      }),
      (prisma as any).sourcingSupplier.findMany({
        where: { id: { in: supplierPendingRows.map((r: any) => r.id) } },
        select: { company: true, email: true, contactPerson: true, assignedGmailAccount: true },
      }),
    ]);

    type Entry = { company: string; email: string | null; contactPerson: string | null; respondedAt?: string | null };
    const accountMap = new Map<string, { buyers: Entry[]; suppliers: Entry[] }>();

    // Build a map of buyer id → respondedAt from the raw query
    const buyerRespondedAtMap = new Map<string, string>(
      buyerPendingRows.map((r: any) => [r.id as string, (r.responded_at as Date | null)?.toISOString() ?? null] as [string, string]),
    );
    const supplierRespondedAtMap = new Map<string, string>(
      supplierPendingRows.map((r: any) => [r.id as string, (r.responded_at as Date | null)?.toISOString() ?? null] as [string, string]),
    );

    for (const buyer of buyers) {
      const account = (buyer.assignedGmailAccount as string | null) ?? BUYER_GMAIL_DEFAULT;
      if (!accountMap.has(account)) accountMap.set(account, { buyers: [], suppliers: [] });
      accountMap.get(account)!.buyers.push({
        company: buyer.company as string,
        email: (buyer.email as string | null) ?? null,
        contactPerson: (buyer.contactPerson as string | null) ?? null,
        respondedAt: buyerRespondedAtMap.get(buyer.id as string) ?? null,
      });
    }

    for (const supplier of suppliers) {
      const account = supplier.assignedGmailAccount as string | null;
      if (!account) continue;
      if (!accountMap.has(account)) accountMap.set(account, { buyers: [], suppliers: [] });
      accountMap.get(account)!.suppliers.push({
        company: supplier.company as string,
        email: (supplier.email as string | null) ?? null,
        contactPerson: (supplier.contactPerson as string | null) ?? null,
        respondedAt: supplierRespondedAtMap.get(supplier.id as string) ?? null,
      });
    }

    for (const [account, { buyers: accBuyers, suppliers: accSuppliers }] of accountMap) {
      try {
        await sendReplyPendingReminderEmail({
          to: account,
          pendingBuyers: accBuyers,
          pendingSuppliers: accSuppliers,
        });
        console.log(
          `[ReplyReminder] Sent to ${account} — ${accBuyers.length} buyer(s), ${accSuppliers.length} supplier(s) pending`,
        );
      } catch (err) {
        console.error(`[ReplyReminder] Failed to send to ${account}:`, err);
      }
    }
  } catch (err) {
    console.error("[ReplyReminder] Error:", err);
  }
}

export { autoSendDueFollowups, autoSendDueBuyerFollowups };

export function startEmailCampaignScheduler() {
  // Signed supplier follow-up reminders — 9:00 AM IST daily
  cron.schedule("0 9 * * *", sendDailyFollowupReminders, { timezone: "Asia/Kolkata" });
  // Auto-send due sourcing supplier follow-ups — 9:00 AM IST daily
  cron.schedule("0 9 * * *", autoSendDueFollowups, { timezone: "Asia/Kolkata" });
  // Auto-send due buyer outreach follow-ups — 9:00 AM IST daily
  cron.schedule("0 9 * * *", autoSendDueBuyerFollowups, { timezone: "Asia/Kolkata" });
  // Reply-pending reminders — 9:05 AM IST daily (staggered to avoid overlap)
  cron.schedule("5 9 * * *", sendReplyPendingReminders, { timezone: "Asia/Kolkata" });
  console.log("[EmailCampaignScheduler] Daily follow-up jobs scheduled at 9:00 AM IST.");

  // Run on startup to catch overdue campaigns — stagger to avoid hitting rate limits simultaneously
  setTimeout(() => {
    console.log("[EmailCampaignScheduler] Running startup check for overdue supplier follow-ups...");
    autoSendDueFollowups();
  }, 5000);
  setTimeout(() => {
    console.log("[EmailCampaignScheduler] Running startup check for overdue buyer follow-ups...");
    autoSendDueBuyerFollowups();
  }, 10 * 60 * 1000); // 10 minutes after supplier scheduler
}
