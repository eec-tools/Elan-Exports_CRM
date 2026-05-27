import cron from "node-cron";
import prisma from "../config/db.js";
import { sendFollowupReminderEmail } from "./mailer.js";
import { createNotification } from "./notificationService.js";
import { executeSendStep } from "../controllers/sourcingEmailCampaign.controller.js";

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

export { autoSendDueFollowups };

export function startEmailCampaignScheduler() {
  // Signed supplier follow-up reminders — 9:00 AM IST daily
  cron.schedule("0 9 * * *", sendDailyFollowupReminders, { timezone: "Asia/Kolkata" });
  // Auto-send due sourcing supplier follow-ups — 9:00 AM IST daily
  cron.schedule("0 9 * * *", autoSendDueFollowups, { timezone: "Asia/Kolkata" });
  console.log("[EmailCampaignScheduler] Daily follow-up jobs scheduled at 9:00 AM IST.");

  // Run immediately on startup to catch any overdue campaigns missed while server was down
  setTimeout(() => {
    console.log("[EmailCampaignScheduler] Running startup check for overdue follow-ups...");
    autoSendDueFollowups();
  }, 5000);
}
