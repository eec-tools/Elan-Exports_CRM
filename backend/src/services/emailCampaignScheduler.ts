import cron from "node-cron";
import prisma from "../config/db.js";
import { sendFollowupReminderEmail } from "./mailer.js";
import { createNotification } from "./notificationService.js";

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

export function startEmailCampaignScheduler() {
  // Run every day at 9:00 AM server time
  cron.schedule("0 9 * * *", sendDailyFollowupReminders);
  console.log("[EmailCampaignScheduler] Daily follow-up reminder job scheduled at 9:00 AM.");
}
