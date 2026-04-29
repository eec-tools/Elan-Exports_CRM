import cron from "node-cron";
import prisma from "../config/db.js";
import { checkForReply } from "./gmailService.js";
import { autoMoveToOldSupplier } from "../controllers/sourcingEmailCampaign.controller.js";
import { createNotification } from "./notificationService.js";

/**
 * Mark a campaign as having received a reply WITHOUT auto-converting to New Supplier.
 * The user sees a notification and converts manually via the "Responded" button.
 */
async function flagReplyReceived(sourcingId: string, company: string): Promise<void> {
    await (prisma as any).$transaction([
        (prisma as any).sourcingEmailCampaign.update({
            where: { sourcingId },
            data: {
                status: "response_received",
                responseReceivedAt: new Date(),
                nextFollowupDue: null,
            },
        }),
        (prisma as any).sourcingSupplier.update({
            where: { id: sourcingId },
            data: { status: "response_received" },
        }),
    ]);

    await createNotification({
        type: "campaign_responded",
        title: "Supplier Replied — Action Required",
        message: `${company} replied to your email. Open their record and click "Responded" to convert them to a New Supplier.`,
        entityType: "sourcing_supplier",
        entityId: sourcingId,
        entityName: company,
        entityLink: `/suppliers/sourcing/${sourcingId}`,
    });
}

async function checkCampaignReplies() {
    try {
        const campaigns = await (prisma as any).sourcingEmailCampaign.findMany({
            where: {
                status: "active",
                gmailThreadId: { not: null },
            },
            include: {
                sourcingSupplier: {
                    select: { id: true, company: true, assignedGmailAccount: true },
                },
            },
        });

        if (campaigns.length === 0) return;

        let repliesFound = 0;
        const now = new Date();

        for (const campaign of campaigns) {
            const supplier = campaign.sourcingSupplier;
            if (!supplier.assignedGmailAccount || !campaign.gmailThreadId) continue;

            try {
                const replied = await checkForReply({
                    accountEmail: supplier.assignedGmailAccount,
                    threadId: campaign.gmailThreadId,
                });

                if (replied) {
                    repliesFound++;
                    console.log(`[ReplyDetector] Reply detected from ${supplier.company} — flagging for manual review`);
                    // Flag as responded; do NOT auto-convert — user must click "Responded" to convert
                    await flagReplyReceived(campaign.sourcingId, supplier.company);
                } else {
                    await (prisma as any).sourcingEmailCampaign.update({
                        where: { sourcingId: campaign.sourcingId },
                        data: { lastCheckedAt: now },
                    });

                    // FU3 sent + grace period passed + still no reply → archive to Old Supplier
                    if (
                        campaign.currentStep === 4 &&
                        campaign.nextFollowupDue &&
                        new Date(campaign.nextFollowupDue) <= now
                    ) {
                        console.log(`[ReplyDetector] No reply after FU3 for ${supplier.company} — moving to Old Supplier`);
                        await autoMoveToOldSupplier(campaign.sourcingId);
                    }
                }
            } catch (err) {
                console.error(`[ReplyDetector] Error checking campaign for ${supplier.company}:`, err);
            }
        }

        console.log(`[ReplyDetector] Checked ${campaigns.length} campaigns — ${repliesFound} replies found`);
    } catch (err) {
        console.error("[ReplyDetector] Fatal error:", err);
    }
}

export function startGmailReplyDetector() {
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
        console.log("[ReplyDetector] GMAIL_CLIENT_ID/SECRET not set — reply detection disabled");
        return;
    }
    // Every 30 minutes
    cron.schedule("*/30 * * * *", checkCampaignReplies);
    console.log("[ReplyDetector] Gmail reply detection scheduled every 30 minutes");
}
