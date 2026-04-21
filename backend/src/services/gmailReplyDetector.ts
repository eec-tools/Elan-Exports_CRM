import cron from "node-cron";
import prisma from "../config/db.js";
import { checkForReply } from "./gmailService.js";
import { executeMarkResponse, autoMoveToOldSupplier, executeSendStep } from "../controllers/sourcingEmailCampaign.controller.js";

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
                    console.log(`[ReplyDetector] Reply detected from ${supplier.company} — converting to New Supplier`);
                    await executeMarkResponse(campaign.sourcingId);
                } else {
                    // Update lastCheckedAt so we know the check ran
                    await (prisma as any).sourcingEmailCampaign.update({
                        where: { sourcingId: campaign.sourcingId },
                        data: { lastCheckedAt: now },
                    });

                    // If FU3 was sent AND nextFollowupDue has passed AND still no reply → move to Old Supplier
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
