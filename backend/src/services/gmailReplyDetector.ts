import cron from "node-cron";
import prisma from "../config/db.js";
import { fetchThreadReplies, getGmailClientForAccount, withGmailThrottle } from "./gmailService.js";
import { persistSupplierAttachments, persistBuyerAttachments, resolveInlineImages, rewriteCidReferences } from "./emailAttachmentSync.service.js";
import { autoMoveToOldSupplier } from "../controllers/sourcingEmailCampaign.controller.js";
import { createNotification } from "./notificationService.js";
import { BUYER_GMAIL_ACCOUNT } from "../controllers/sourcingBuyers.controller.js";
import { SUPPLIER_COMMS_ACCOUNTS } from "../controllers/aiSupplierComms.controller.js";
import { sendImmediateReplyAlert } from "./mailer.js";

const CRM_BASE_URL = "https://crm.eectrade.com";

/**
 * Fetch all messages in a thread and persist any that aren't already stored.
 * Returns true if at least one "received" (supplier-sent) message was found.
 */
export async function syncThreadMessages(
    sourcingId: string,
    accountEmail: string,
    threadId: string,
): Promise<{ hasReply: boolean; hasBounce: boolean }> {
    const messages = await fetchThreadReplies({ accountEmail, threadId });
    if (messages.length === 0) return { hasReply: false, hasBounce: false };

    const existing = await (prisma as any).supplierEmailReply.findMany({
        where: { sourcingId },
        select: { id: true, gmailMessageId: true, bodyHtml: true },
    });
    const existingByMessage = new Map(existing.map((r: any) => [r.gmailMessageId, r]));

    for (const m of messages) {
        const existingRow = existingByMessage.get(m.gmailMessageId) as { id: string; bodyHtml: string | null } | undefined;
        let replyId = existingRow?.id;

        let resolvedHtml: string | undefined;
        if (m.bodyHtml && !existingRow?.bodyHtml) {
            const cidMap = m.inlineImages.length
                ? await resolveInlineImages({
                    accountEmail,
                    gmailMessageId: m.gmailMessageId,
                    keyPrefix: `inline-email-images/suppliers/${sourcingId}`,
                    inlineImages: m.inlineImages,
                })
                : {};
            resolvedHtml = rewriteCidReferences(m.bodyHtml, cidMap);
        }

        if (!replyId) {
            const created = await (prisma as any).supplierEmailReply.create({
                data: {
                    sourcingId,
                    gmailMessageId: m.gmailMessageId,
                    direction: m.direction,
                    fromEmail: m.fromEmail,
                    fromName: m.fromName ?? null,
                    subject: m.subject ?? null,
                    body: m.body,
                    bodyHtml: resolvedHtml ?? null,
                    receivedAt: m.receivedAt,
                },
                select: { id: true },
            });
            replyId = created.id;
        } else if (resolvedHtml) {
            await (prisma as any).supplierEmailReply.update({
                where: { id: replyId },
                data: { bodyHtml: resolvedHtml },
            });
        }

        if (m.attachments.length > 0) {
            await persistSupplierAttachments({
                accountEmail,
                sourcingId,
                replyId: replyId as string,
                gmailMessageId: m.gmailMessageId,
                attachments: m.attachments,
            });
        }
    }

    const hasReply = messages.some((m) => m.direction === "received" && !m.isDeliveryFailure);
    const hasBounce = messages.some((m) => m.isDeliveryFailure === true);
    return { hasReply, hasBounce };
}

/**
 * Same job as syncThreadMessages, but for New Supplier / Signed Contract
 * records — kept separate (rather than parameterizing syncThreadMessages
 * itself) so the existing sourcing-supplier reply pipeline is never touched.
 * Returns newlyReceivedCount so callers only notify once per message.
 */
export async function syncSupplierEntityThreadMessages(
    fkField: "newSupplierId" | "contractSupplierId",
    entityId: string,
    accountEmail: string,
    threadId: string,
): Promise<{ hasReply: boolean; hasBounce: boolean; newlyReceivedCount: number }> {
    const messages = await fetchThreadReplies({ accountEmail, threadId });
    if (messages.length === 0) return { hasReply: false, hasBounce: false, newlyReceivedCount: 0 };

    const existing = await (prisma as any).supplierEmailReply.findMany({
        where: { [fkField]: entityId },
        select: { id: true, gmailMessageId: true, bodyHtml: true },
    });
    const existingByMessage = new Map(existing.map((r: any) => [r.gmailMessageId, r]));
    let newlyReceivedCount = 0;

    for (const m of messages) {
        const existingRow = existingByMessage.get(m.gmailMessageId) as { id: string; bodyHtml: string | null } | undefined;
        let replyId = existingRow?.id;

        let resolvedHtml: string | undefined;
        if (m.bodyHtml && !existingRow?.bodyHtml) {
            const cidMap = m.inlineImages.length
                ? await resolveInlineImages({
                    accountEmail,
                    gmailMessageId: m.gmailMessageId,
                    keyPrefix: `inline-email-images/suppliers/${entityId}`,
                    inlineImages: m.inlineImages,
                })
                : {};
            resolvedHtml = rewriteCidReferences(m.bodyHtml, cidMap);
        }

        if (!replyId) {
            const created = await (prisma as any).supplierEmailReply.create({
                data: {
                    [fkField]: entityId,
                    gmailMessageId: m.gmailMessageId,
                    direction: m.direction,
                    fromEmail: m.fromEmail,
                    fromName: m.fromName ?? null,
                    subject: m.subject ?? null,
                    body: m.body,
                    bodyHtml: resolvedHtml ?? null,
                    receivedAt: m.receivedAt,
                },
                select: { id: true },
            });
            replyId = created.id;
            if (m.direction === "received" && !m.isDeliveryFailure) newlyReceivedCount++;
        } else if (resolvedHtml) {
            await (prisma as any).supplierEmailReply.update({
                where: { id: replyId },
                data: { bodyHtml: resolvedHtml },
            });
        }

        if (m.attachments.length > 0) {
            await persistSupplierAttachments({
                accountEmail,
                sourcingId: entityId,
                replyId: replyId as string,
                gmailMessageId: m.gmailMessageId,
                attachments: m.attachments,
            });
        }
    }

    const hasReply = messages.some((m) => m.direction === "received" && !m.isDeliveryFailure);
    const hasBounce = messages.some((m) => m.isDeliveryFailure === true);
    return { hasReply, hasBounce, newlyReceivedCount };
}

function parseSenderEmail(fromHeader: string): string {
    const match = fromHeader.match(/<([^>]+)>/);
    return (match ? match[1] : fromHeader).trim().toLowerCase();
}

function emailFieldMatches(candidateEmail: string, storedEmailField: string | null): boolean {
    if (!storedEmailField) return false;
    return storedEmailField
        .split(/[;,]/)
        .map((e) => e.trim().toLowerCase())
        .includes(candidateEmail);
}

/**
 * Catches "cold" inbound mail — messages from someone we track as a New
 * Supplier or Signed Contract supplier who emails in before we've ever sent
 * them anything, so there's no campaign gmailThreadId to follow yet.
 * Matches the sender address against NewSupplier/Supplier.email directly
 * against the raw inbox instead of following a known thread. Sourcing
 * suppliers are intentionally skipped here — checkCampaignReplies already
 * owns that path via their campaign's gmailThreadId.
 */
const SUPPLIER_INBOX_MATCH_LOOKBACK_DAYS = 30;
let unthreadedSupplierCheckRunning = false;

export async function checkUnthreadedSupplierInboxes() {
    if (unthreadedSupplierCheckRunning) {
        console.log("[ReplyDetector] Previous unthreaded supplier inbox check still running — skipping this tick");
        return;
    }
    unthreadedSupplierCheckRunning = true;
    try {
        for (const accountEmail of SUPPLIER_COMMS_ACCOUNTS) {
            await checkUnthreadedSupplierInboxForAccount(accountEmail);
        }
    } catch (err) {
        console.error("[ReplyDetector] Fatal error in unthreaded supplier inbox check:", err);
    } finally {
        unthreadedSupplierCheckRunning = false;
    }
}

async function checkUnthreadedSupplierInboxForAccount(accountEmail: string) {
    let gmail;
    try {
        gmail = await getGmailClientForAccount(accountEmail);
    } catch {
        return; // account not connected — skip silently
    }

    const cursorKey = `supplier_inbox_matcher_last_sync_${accountEmail}`;
    const cursorSetting = await (prisma as any).appSetting.findUnique({ where: { key: cursorKey } });
    const since = cursorSetting?.value
        ? new Date(cursorSetting.value)
        : new Date(Date.now() - SUPPLIER_INBOX_MATCH_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const epochSeconds = Math.floor(since.getTime() / 1000) - 300; // 5-min buffer
    const syncedAt = new Date();

    try {
        const listRes = await withGmailThrottle(accountEmail, () =>
            gmail.users.messages.list({ userId: "me", q: `in:inbox after:${epochSeconds}`, maxResults: 100 }),
        );
        const messages = listRes.data.messages ?? [];

        if (messages.length > 0) {
            const [newSuppliers, signedSuppliers] = await Promise.all([
                (prisma as any).newSupplier.findMany({
                    where: { isArchived: false, email: { not: null } },
                    select: { id: true, company: true, email: true, contactPerson: true, assignedGmailAccount: true },
                }),
                (prisma as any).supplier.findMany({
                    where: { isArchived: false, email: { not: null } },
                    select: { id: true, company: true, email: true, contactPerson: true, assignedGmailAccount: true },
                }),
            ]);

            for (const msg of messages) {
                if (!msg.id || !msg.threadId) continue;
                try {
                    const detail = await withGmailThrottle(accountEmail, () =>
                        gmail.users.messages.get({
                            userId: "me", id: msg.id!, format: "METADATA", metadataHeaders: ["From"],
                        }),
                    );
                    const fromHeader = (detail.data.payload?.headers ?? []).find(
                        (h: any) => h.name?.toLowerCase() === "from",
                    )?.value ?? "";
                    const senderEmail = parseSenderEmail(fromHeader);
                    if (!senderEmail || senderEmail === accountEmail.toLowerCase()) continue;

                    const newMatch = newSuppliers.find((s: any) => emailFieldMatches(senderEmail, s.email));
                    const signedMatch = !newMatch && signedSuppliers.find((s: any) => emailFieldMatches(senderEmail, s.email));
                    if (!newMatch && !signedMatch) continue;

                    const kind: "new" | "signed" = newMatch ? "new" : "signed";
                    const entity = (newMatch ?? signedMatch) as { id: string; company: string; email: string | null; contactPerson: string | null; assignedGmailAccount: string | null };
                    const fkField = kind === "new" ? "newSupplierId" : "contractSupplierId";

                    const { newlyReceivedCount } = await syncSupplierEntityThreadMessages(
                        fkField, entity.id, accountEmail, msg.threadId,
                    );

                    if (!entity.assignedGmailAccount) {
                        const model = kind === "new" ? "newSupplier" : "supplier";
                        await (prisma as any)[model].update({
                            where: { id: entity.id },
                            data: { assignedGmailAccount: accountEmail },
                        });
                    }

                    if (newlyReceivedCount > 0) {
                        const label = kind === "new" ? "New Supplier" : "Signed Contract";
                        const link = kind === "new" ? `/suppliers/new/${entity.id}` : `/suppliers/signed-contract/${entity.id}`;
                        console.log(`[ReplyDetector] Unthreaded inbound mail matched to ${kind} supplier ${entity.company} — flagging`);

                        await createNotification({
                            type: kind === "new" ? "new_supplier_email_received" : "signed_supplier_email_received",
                            title: `${label} Emailed You`,
                            message: `${entity.company} (${label}) sent you an email. Check the AI Supplier Comms inbox to respond.`,
                            entityType: kind === "new" ? "new_supplier" : "supplier",
                            entityId: entity.id,
                            entityName: entity.company,
                            entityLink: link,
                        });

                        sendImmediateReplyAlert({
                            to: accountEmail,
                            company: entity.company,
                            contactPerson: entity.contactPerson ?? null,
                            companyEmail: entity.email ?? null,
                            entityType: "supplier",
                            crmLink: `${CRM_BASE_URL}${link}`,
                        }).catch((err: unknown) => console.error(`[ReplyDetector] Failed to send inbox alert for ${entity.company}:`, err));
                    }
                } catch (err) {
                    console.error(`[ReplyDetector] Unthreaded inbox: error processing message ${msg.id} for ${accountEmail}:`, err);
                }
            }
        }

        await (prisma as any).appSetting.upsert({
            where: { key: cursorKey },
            update: { value: syncedAt.toISOString() },
            create: { key: cursorKey, value: syncedAt.toISOString() },
        });
    } catch (err) {
        console.error(`[ReplyDetector] Unthreaded inbox scan failed for ${accountEmail}:`, err);
    }
}

async function flagReplyReceived(sourcingId: string, company: string, assignedGmailAccount: string, supplierEmail?: string | null, contactPerson?: string | null): Promise<void> {
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

    // Instant email alert to the sender account
    sendImmediateReplyAlert({
        to: assignedGmailAccount,
        company,
        contactPerson: contactPerson ?? null,
        companyEmail: supplierEmail ?? null,
        entityType: "supplier",
        crmLink: `${CRM_BASE_URL}/suppliers/sourcing/${sourcingId}`,
    }).catch((err: unknown) => console.error(`[ReplyDetector] Failed to send instant alert for ${company}:`, err));
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

let supplierCheckRunning = false;
let buyerCheckRunning = false;

async function checkCampaignReplies() {
    if (supplierCheckRunning) {
        console.log("[ReplyDetector] Previous supplier reply check still running — skipping this tick");
        return;
    }
    supplierCheckRunning = true;
    try {
        // Check both active campaigns (for new replies) and response_received
        // (to keep syncing any additional messages in the thread)
        const campaigns = await (prisma as any).sourcingEmailCampaign.findMany({
            where: {
                status: { in: ["active", "response_received"] },
                gmailThreadId: { not: null },
                sourcingSupplier: { isArchived: false },
            },
            include: {
                sourcingSupplier: {
                    select: { id: true, company: true, email: true, contactPerson: true, assignedGmailAccount: true, status: true },
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
                    await flagReplyReceived(campaign.sourcingId, supplier.company, supplier.assignedGmailAccount, supplier.email, supplier.contactPerson);
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
        }

        if (repliesFound > 0) {
            console.log(`[ReplyDetector] Checked ${campaigns.length} campaigns — ${repliesFound} new replies`);
        }
    } catch (err) {
        console.error("[ReplyDetector] Fatal error:", err);
    } finally {
        supplierCheckRunning = false;
    }
}

export async function syncBuyerThreadMessages(
    sourcingBuyerId: string,
    threadId: string,
    accountEmail: string = BUYER_GMAIL_ACCOUNT,
): Promise<{ hasReply: boolean; hasBounce: boolean }> {
    const messages = await fetchThreadReplies({ accountEmail, threadId });
    if (messages.length === 0) return { hasReply: false, hasBounce: false };

    const existing = await (prisma as any).buyerEmailReply.findMany({
        where: { sourcingBuyerId },
        select: { id: true, gmailMessageId: true, bodyHtml: true },
    });
    const existingByMessage = new Map(existing.map((r: any) => [r.gmailMessageId, r]));

    for (const m of messages) {
        const existingRow = existingByMessage.get(m.gmailMessageId) as { id: string; bodyHtml: string | null } | undefined;
        let replyId = existingRow?.id;

        let resolvedHtml: string | undefined;
        if (m.bodyHtml && !existingRow?.bodyHtml) {
            const cidMap = m.inlineImages.length
                ? await resolveInlineImages({
                    accountEmail,
                    gmailMessageId: m.gmailMessageId,
                    keyPrefix: `inline-email-images/buyers/${sourcingBuyerId}`,
                    inlineImages: m.inlineImages,
                })
                : {};
            resolvedHtml = rewriteCidReferences(m.bodyHtml, cidMap);
        }

        if (!replyId) {
            const created = await (prisma as any).buyerEmailReply.create({
                data: {
                    sourcingBuyerId,
                    gmailMessageId: m.gmailMessageId,
                    direction: m.direction,
                    fromEmail: m.fromEmail,
                    fromName: m.fromName ?? null,
                    subject: m.subject ?? null,
                    body: m.body,
                    bodyHtml: resolvedHtml ?? null,
                    receivedAt: m.receivedAt,
                },
                select: { id: true },
            });
            replyId = created.id;
        } else if (resolvedHtml) {
            await (prisma as any).buyerEmailReply.update({
                where: { id: replyId },
                data: { bodyHtml: resolvedHtml },
            });
        }

        if (m.attachments.length > 0) {
            await persistBuyerAttachments({
                accountEmail,
                sourcingBuyerId,
                replyId: replyId as string,
                gmailMessageId: m.gmailMessageId,
                attachments: m.attachments,
            });
        }
    }

    const hasReply = messages.some((m) => m.direction === "received" && !m.isDeliveryFailure);
    const hasBounce = messages.some((m) => m.isDeliveryFailure === true);
    return { hasReply, hasBounce };
}

async function checkBuyerCampaignReplies() {
    if (buyerCheckRunning) {
        console.log("[ReplyDetector] Previous buyer reply check still running — skipping this tick");
        return;
    }
    buyerCheckRunning = true;
    try {
        const campaigns = await (prisma as any).sourcingBuyerEmailCampaign.findMany({
            where: {
                status: { in: ["active", "response_received"] },
                gmailThreadId: { not: null },
                sourcingBuyer: { isArchived: false },
            },
            include: {
                sourcingBuyer: { select: { id: true, company: true, email: true, contactPerson: true, assignedGmailAccount: true, buyerVaultContactId: true } },
            },
        });

        if (campaigns.length === 0) return;

        const now = new Date();

        for (const campaign of campaigns) {
            const buyer = campaign.sourcingBuyer;
            if (!campaign.gmailThreadId) continue;

            try {
                const { hasReply, hasBounce } = await syncBuyerThreadMessages(buyer.id, campaign.gmailThreadId);

                if (hasBounce && campaign.status === "active") {
                    console.log(`[ReplyDetector] Bounce detected for buyer ${buyer.company} — marking invalid`);
                    const updateOps: any[] = [
                        (prisma as any).sourcingBuyerEmailCampaign.update({
                            where: { sourcingBuyerId: buyer.id },
                            data: { status: "completed", nextFollowupDue: null },
                        }),
                        (prisma as any).sourcingBuyer.update({
                            where: { id: buyer.id },
                            data: { status: "invalid" },
                        }),
                    ];
                    if (buyer.buyerVaultContactId) {
                        updateOps.push(
                            (prisma as any).buyerVaultContact.update({
                                where: { id: buyer.buyerVaultContactId },
                                data: { emailStatus: "Invalid" },
                            })
                        );
                    }
                    await (prisma as any).$transaction(updateOps);

                    await createNotification({
                        type: "buyer_email_bounced",
                        title: "Invalid Buyer Email Detected",
                        message: `Email to ${buyer.company} bounced. Their email address has been marked as invalid and follow-ups have been stopped.`,
                        entityType: "sourcing_buyer",
                        entityId: buyer.id,
                        entityName: buyer.company,
                        entityLink: `/buyers/sourcing/${buyer.id}`,
                    });
                } else if (hasReply && campaign.status === "active") {
                    const updateOps: any[] = [
                        (prisma as any).sourcingBuyerEmailCampaign.update({
                            where: { sourcingBuyerId: buyer.id },
                            data: { status: "response_received", responseReceivedAt: new Date(), nextFollowupDue: null },
                        }),
                        (prisma as any).sourcingBuyer.update({
                            where: { id: buyer.id },
                            data: { status: "response_received" },
                        }),
                    ];
                    if (buyer.buyerVaultContactId) {
                        updateOps.push(
                            (prisma as any).buyerVaultContact.update({
                                where: { id: buyer.buyerVaultContactId },
                                data: { emailStatus: "Responded" },
                            })
                        );
                    }
                    await (prisma as any).$transaction(updateOps);

                    await createNotification({
                        type: "buyer_response_received",
                        title: "Buyer Replied — Action Required",
                        message: `${buyer.company} replied to your email. Open their record and click "Convert" to move them to Buyers Directory.`,
                        entityType: "sourcing_buyer",
                        entityId: buyer.id,
                        entityName: buyer.company,
                        entityLink: `/buyers/sourcing/${buyer.id}`,
                    });

                    // Instant email alert to the assigned sender account
                    const alertTo = buyer.assignedGmailAccount ?? BUYER_GMAIL_ACCOUNT;
                    sendImmediateReplyAlert({
                        to: alertTo,
                        company: buyer.company,
                        contactPerson: buyer.contactPerson ?? null,
                        companyEmail: buyer.email ?? null,
                        entityType: "buyer",
                        crmLink: `${CRM_BASE_URL}/buyers/sourcing/${buyer.id}`,
                    }).catch((err: unknown) => console.error(`[ReplyDetector] Failed to send buyer alert for ${buyer.company}:`, err));
                } else if (!hasReply && !hasBounce && campaign.status === "active") {
                    // FU3 sent + 3-day grace period passed + still no reply → mark completed
                    if (
                        campaign.currentStep === 4 &&
                        campaign.nextFollowupDue &&
                        new Date(campaign.nextFollowupDue) <= now
                    ) {
                        await (prisma as any).$transaction([
                            (prisma as any).sourcingBuyerEmailCampaign.update({
                                where: { sourcingBuyerId: buyer.id },
                                data: { status: "completed", nextFollowupDue: null },
                            }),
                            (prisma as any).sourcingBuyer.update({
                                where: { id: buyer.id },
                                data: { status: "no_response" },
                            }),
                        ]);
                        console.log(`[ReplyDetector] No reply after FU3 for buyer ${buyer.company} — marked completed`);
                    }
                }
            } catch (err) {
                console.error(`[ReplyDetector] Buyer error for ${buyer.company}:`, err);
            }
        }
    } catch (err) {
        console.error("[ReplyDetector] Fatal error in buyer reply check:", err);
    } finally {
        buyerCheckRunning = false;
    }
}

export async function backfillInvalidBuyerEmails(): Promise<{ checked: number; markedInvalid: number; companies: string[] }> {
    const campaigns = await (prisma as any).sourcingBuyerEmailCampaign.findMany({
        where: { gmailThreadId: { not: null } },
        include: {
            sourcingBuyer: {
                select: { id: true, company: true, status: true, buyerVaultContactId: true },
            },
        },
    });

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let checked = 0;
    let markedInvalid = 0;
    const companies: string[] = [];

    for (const campaign of campaigns) {
        const buyer = campaign.sourcingBuyer;

        // Skip already-terminal positive states
        if (["invalid", "response_received", "converted_to_buyer"].includes(buyer.status)) {
            await sleep(200);
            continue;
        }

        try {
            const { hasBounce } = await syncBuyerThreadMessages(buyer.id, campaign.gmailThreadId);
            checked++;

            if (hasBounce) {
                console.log(`[Backfill] Bounce found for buyer ${buyer.company} — marking invalid`);

                const updateOps: any[] = [
                    (prisma as any).sourcingBuyerEmailCampaign.update({
                        where: { sourcingBuyerId: buyer.id },
                        data: { status: "completed", nextFollowupDue: null },
                    }),
                    (prisma as any).sourcingBuyer.update({
                        where: { id: buyer.id },
                        data: { status: "invalid" },
                    }),
                ];
                if (buyer.buyerVaultContactId) {
                    updateOps.push(
                        (prisma as any).buyerVaultContact.update({
                            where: { id: buyer.buyerVaultContactId },
                            data: { emailStatus: "Invalid" },
                        })
                    );
                }
                await (prisma as any).$transaction(updateOps);

                await createNotification({
                    type: "buyer_email_bounced",
                    title: "Invalid Buyer Email Detected",
                    message: `Email to ${buyer.company} bounced. Their email address has been marked as invalid and follow-ups have been stopped.`,
                    entityType: "sourcing_buyer",
                    entityId: buyer.id,
                    entityName: buyer.company,
                    entityLink: `/buyers/sourcing/${buyer.id}`,
                });

                markedInvalid++;
                companies.push(buyer.company);
            }
        } catch (err) {
            console.error(`[Backfill] Error checking buyer ${buyer.company}:`, err);
        }

        await sleep(300);
    }

    console.log(`[Backfill] Done — checked ${checked}, marked ${markedInvalid} invalid`);
    return { checked, markedInvalid, companies };
}

export function startGmailReplyDetector() {
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
        console.log("[ReplyDetector] GMAIL_CLIENT_ID/SECRET not set — reply detection disabled");
        return;
    }
    // Every 5 minutes — staggered so jobs sharing the same Gmail accounts don't
    // all burst-fetch at the same instant.
    cron.schedule("*/5 * * * *", checkCampaignReplies);
    cron.schedule("2-59/5 * * * *", checkBuyerCampaignReplies);
    cron.schedule("1-59/5 * * * *", checkUnthreadedSupplierInboxes);
    console.log("[ReplyDetector] Gmail reply detection scheduled every 5 minutes (staggered)");
}
