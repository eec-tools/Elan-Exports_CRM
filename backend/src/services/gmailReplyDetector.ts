import cron from "node-cron";
import prisma from "../config/db.js";
import { fetchThreadReplies } from "./gmailService.js";
import { autoMoveToOldSupplier } from "../controllers/sourcingEmailCampaign.controller.js";
import { createNotification } from "./notificationService.js";
import { BUYER_GMAIL_ACCOUNT } from "../controllers/sourcingBuyers.controller.js";

/**
 * Fetch all messages in a thread and persist any that aren't already stored.
 * Returns true if at least one "received" (supplier-sent) message was found.
 */
async function syncThreadMessages(
    sourcingId: string,
    accountEmail: string,
    threadId: string,
): Promise<{ hasReply: boolean; hasBounce: boolean }> {
    const messages = await fetchThreadReplies({ accountEmail, threadId });
    if (messages.length === 0) return { hasReply: false, hasBounce: false };

    const existing = await (prisma as any).supplierEmailReply.findMany({
        where: { sourcingId },
        select: { gmailMessageId: true },
    });
    const existingIds = new Set(existing.map((r: any) => r.gmailMessageId));

    const newMessages = messages.filter((m) => !existingIds.has(m.gmailMessageId));
    if (newMessages.length > 0) {
        await (prisma as any).supplierEmailReply.createMany({
            data: newMessages.map((m) => ({
                sourcingId,
                gmailMessageId: m.gmailMessageId,
                direction: m.direction,
                fromEmail: m.fromEmail,
                fromName: m.fromName ?? null,
                subject: m.subject ?? null,
                body: m.body,
                receivedAt: m.receivedAt,
            })),
        });
    }

    const hasReply = messages.some((m) => m.direction === "received" && !m.isDeliveryFailure);
    const hasBounce = messages.some((m) => m.isDeliveryFailure === true);
    return { hasReply, hasBounce };
}

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
        message: `${company} replied to your email. Open their record and click "Convert" to move them to New Supplier.`,
        entityType: "sourcing_supplier",
        entityId: sourcingId,
        entityName: company,
        entityLink: `/suppliers/sourcing/${sourcingId}`,
    });
}

async function flagDeliveryFailure(sourcingId: string, company: string): Promise<void> {
    const supplier = await (prisma as any).sourcingSupplier.findUnique({
        where: { id: sourcingId },
        select: { status: true },
    });
    if (!supplier) return;

    // Don't overwrite a positive terminal state
    if (["response_received", "converted_to_new", "converted"].includes(supplier.status)) {
        console.log(`[ReplyDetector] Skipping invalid flag for ${company} — already in state: ${supplier.status}`);
        return;
    }

    await (prisma as any).$transaction([
        (prisma as any).sourcingEmailCampaign.update({
            where: { sourcingId },
            data: { status: "completed", nextFollowupDue: null },
        }),
        (prisma as any).sourcingSupplier.update({
            where: { id: sourcingId },
            data: { status: "invalid" },
        }),
    ]);

    console.log(`[ReplyDetector] Delivery failure detected for ${company} — marked as invalid`);

    await createNotification({
        type: "campaign_bounced",
        title: "Invalid Email Address Detected",
        message: `Email to ${company} bounced. Their email address may be invalid.`,
        entityType: "sourcing_supplier",
        entityId: sourcingId,
        entityName: company,
        entityLink: `/suppliers/sourcing/${sourcingId}`,
    });
}

async function checkCampaignReplies() {
    try {
        // Check both active campaigns (for new replies) and response_received
        // (to keep syncing any additional messages in the thread)
        const campaigns = await (prisma as any).sourcingEmailCampaign.findMany({
            where: {
                status: { in: ["active", "response_received"] },
                gmailThreadId: { not: null },
            },
            include: {
                sourcingSupplier: {
                    select: { id: true, company: true, assignedGmailAccount: true, status: true },
                },
            },
        });

        if (campaigns.length === 0) return;

        let repliesFound = 0;
        const now = new Date();
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        for (const campaign of campaigns) {
            const supplier = campaign.sourcingSupplier;
            if (!supplier.assignedGmailAccount || !campaign.gmailThreadId) continue;

            try {
                const { hasReply, hasBounce } = await syncThreadMessages(
                    campaign.sourcingId,
                    supplier.assignedGmailAccount,
                    campaign.gmailThreadId,
                );

                if (hasBounce && campaign.status === "active") {
                    repliesFound++;
                    console.log(`[ReplyDetector] Bounce detected from ${supplier.company} — marking invalid`);
                    await flagDeliveryFailure(campaign.sourcingId, supplier.company);
                } else if (hasReply && campaign.status === "active") {
                    repliesFound++;
                    console.log(`[ReplyDetector] Reply detected from ${supplier.company} — flagging`);
                    await flagReplyReceived(campaign.sourcingId, supplier.company);
                } else if (!hasReply && !hasBounce && campaign.status === "active") {
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
                        console.log(`[ReplyDetector] No reply after FU3 for ${supplier.company} — archiving`);
                        await autoMoveToOldSupplier(campaign.sourcingId);
                    }
                }
            } catch (err) {
                console.error(`[ReplyDetector] Error for ${supplier.company}:`, err);
            }

            await sleep(300);
        }

        if (repliesFound > 0) {
            console.log(`[ReplyDetector] Checked ${campaigns.length} campaigns — ${repliesFound} new replies`);
        }
    } catch (err) {
        console.error("[ReplyDetector] Fatal error:", err);
    }
}

async function syncBuyerThreadMessages(
    sourcingBuyerId: string,
    threadId: string,
): Promise<boolean> {
    const messages = await fetchThreadReplies({ accountEmail: BUYER_GMAIL_ACCOUNT, threadId });
    if (messages.length === 0) return false;

    const existing = await (prisma as any).buyerEmailReply.findMany({
        where: { sourcingBuyerId },
        select: { gmailMessageId: true },
    });
    const existingIds = new Set(existing.map((r: any) => r.gmailMessageId));

    const newMessages = messages.filter((m) => !existingIds.has(m.gmailMessageId));
    if (newMessages.length > 0) {
        await (prisma as any).buyerEmailReply.createMany({
            data: newMessages.map((m) => ({
                sourcingBuyerId,
                gmailMessageId: m.gmailMessageId,
                direction: m.direction,
                fromEmail: m.fromEmail,
                fromName: m.fromName ?? null,
                subject: m.subject ?? null,
                body: m.body,
                receivedAt: m.receivedAt,
            })),
        });
    }

    return messages.some((m) => m.direction === "received" && !m.isDeliveryFailure);
}

async function checkBuyerCampaignReplies() {
    try {
        const campaigns = await (prisma as any).sourcingBuyerEmailCampaign.findMany({
            where: {
                status: { in: ["active", "response_received"] },
                gmailThreadId: { not: null },
            },
            include: {
                sourcingBuyer: { select: { id: true, company: true, email: true } },
            },
        });

        if (campaigns.length === 0) return;

        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        for (const campaign of campaigns) {
            const buyer = campaign.sourcingBuyer;
            if (!campaign.gmailThreadId) continue;

            try {
                const hasReply = await syncBuyerThreadMessages(buyer.id, campaign.gmailThreadId);

                if (hasReply && campaign.status === "active") {
                    await (prisma as any).$transaction([
                        (prisma as any).sourcingBuyerEmailCampaign.update({
                            where: { sourcingBuyerId: buyer.id },
                            data: { status: "response_received", responseReceivedAt: new Date(), nextFollowupDue: null },
                        }),
                        (prisma as any).sourcingBuyer.update({
                            where: { id: buyer.id },
                            data: { status: "response_received" },
                        }),
                    ]);

                    await createNotification({
                        type: "buyer_response_received",
                        title: "Buyer Replied — Action Required",
                        message: `${buyer.company} replied to your email. Open their record and click "Convert" to move them to Buyers Directory.`,
                        entityType: "sourcing_buyer",
                        entityId: buyer.id,
                        entityName: buyer.company,
                        entityLink: `/buyers/sourcing/${buyer.id}`,
                    });
                }
            } catch (err) {
                console.error(`[ReplyDetector] Buyer error for ${buyer.company}:`, err);
            }

            await sleep(300);
        }
    } catch (err) {
        console.error("[ReplyDetector] Fatal error in buyer reply check:", err);
    }
}

export function startGmailReplyDetector() {
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
        console.log("[ReplyDetector] GMAIL_CLIENT_ID/SECRET not set — reply detection disabled");
        return;
    }
    // Every 5 minutes
    cron.schedule("*/5 * * * *", checkCampaignReplies);
    cron.schedule("*/5 * * * *", checkBuyerCampaignReplies);
    console.log("[ReplyDetector] Gmail reply detection scheduled every 5 minutes");
}
