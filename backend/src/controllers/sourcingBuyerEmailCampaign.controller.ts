import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { createNotification } from "../services/notificationService.js";
import { sendGmailEmail, fetchThreadReplies, getSmtpMessageId, getGlobalEmailAttachment } from "../services/gmailService.js";
import { getBuyerTemplate, getCustomBuyerTemplate, CustomEmailTemplate } from "../services/emailTemplates.js";
import { fetchDefaultSignatureForAccount } from "./emailSignatures.controller.js";
import { BUYER_GMAIL_ACCOUNT } from "./sourcingBuyers.controller.js";

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function htmlToPlainText(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

const STEP_STATUS: Record<number, string> = {
    1: "intro_sent",
    2: "followup1_sent",
    3: "followup2_sent",
    4: "followup3_sent",
};

const STEP_SENT_AT_FIELD: Record<number, string> = {
    2: "followup1SentAt",
    3: "followup2SentAt",
    4: "followup3SentAt",
};

const STEP_LABEL: Record<number, string> = {
    1: "Intro Email",
    2: "Follow-up 1",
    3: "Follow-up 2",
    4: "Follow-up 3",
};

// ─── Signature resolution ─────────────────────────────────────────────────────

type SignatureData = {
    name: string; role: string; company: string; tagline: string;
    links: Array<{ label: string; url: string }>;
};

async function resolveSignatureForBuyer(buyer: {
    assignedGmailAccount: string | null;
    emailTemplateId: string | null;
}): Promise<SignatureData | null> {
    if (buyer.emailTemplateId) {
        const tpl = await prisma.buyerEmailCampaignTemplate.findUnique({
            where: { id: buyer.emailTemplateId },
            include: { signature: true },
        });
        if (tpl?.signature) {
            const s = tpl.signature;
            return {
                name: s.name,
                role: s.role,
                company: s.company,
                tagline: s.tagline,
                links: (s.links as Array<{ label: string; url: string }>) ?? [],
            };
        }
    }
    const fromEmail = buyer.assignedGmailAccount ?? BUYER_GMAIL_ACCOUNT;
    return fetchDefaultSignatureForAccount(fromEmail);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

export async function startCampaignForBuyer(sourcingBuyerId: string, createdBy?: string): Promise<boolean> {
    try {
        const buyer = await (prisma as any).sourcingBuyer.findUnique({ where: { id: sourcingBuyerId } });
        if (!buyer || !buyer.email) return false;

        const fromEmail = buyer.assignedGmailAccount ?? BUYER_GMAIL_ACCOUNT;

        const signature = await resolveSignatureForBuyer(buyer);
        const templateData = {
            company: buyer.company,
            contactPerson: buyer.contactPerson,
            product: buyer.product ?? buyer.productCategory ?? null,
            fromEmail,
            signature,
        };

        let subject: string;
        let html: string;

        if (buyer.emailTemplateId) {
            const customTpl = await (prisma as any).buyerEmailCampaignTemplate.findUnique({ where: { id: buyer.emailTemplateId } }) as CustomEmailTemplate | null;
            if (customTpl) {
                const result = getCustomBuyerTemplate(1, customTpl, templateData);
                subject = result.subject;
                html = result.html;
            } else {
                const result = getBuyerTemplate(1, templateData);
                subject = result.subject;
                html = result.html;
            }
        } else {
            const result = getBuyerTemplate(1, templateData);
            subject = result.subject;
            html = result.html;
        }

        const attachment = await getGlobalEmailAttachment();
        const { messageId, threadId } = await sendGmailEmail({
            fromEmail,
            to: buyer.email.split(";").map((e: string) => e.trim()).filter(Boolean).join(", "),
            subject,
            html,
            attachments: attachment ? [attachment] : undefined,
        });

        const now = new Date();
        await (prisma as any).$transaction([
            (prisma as any).sourcingBuyerEmailCampaign.create({
                data: {
                    sourcingBuyerId,
                    status: "active",
                    currentStep: 1,
                    introEmailSentAt: now,
                    nextFollowupDue: addDays(now, 3),
                    gmailThreadId: threadId ?? null,
                    gmailMessageId: messageId ?? null,
                },
            }),
            (prisma as any).sourcingBuyer.update({
                where: { id: sourcingBuyerId },
                data: { status: "intro_sent" },
            }),
        ]);

        // Record as sent reply
        await (prisma as any).buyerEmailReply.create({
            data: {
                sourcingBuyerId,
                gmailMessageId: messageId ?? null,
                direction: "sent",
                fromEmail,
                subject,
                body: htmlToPlainText(html),
                receivedAt: now,
            },
        });

        await createNotification({
            type: "campaign_started",
            title: "Buyer Campaign Started",
            message: `Intro email sent to ${buyer.company} (${buyer.email})`,
            entityType: "sourcing_buyer",
            entityId: sourcingBuyerId,
            entityName: buyer.company,
            entityLink: `/buyers/sourcing/${sourcingBuyerId}`,
            createdBy,
        });

        return true;
    } catch (err) {
        console.error(`[startCampaignForBuyer] Error for ${sourcingBuyerId}:`, err);
        return false;
    }
}

export async function executeSendStep(sourcingBuyerId: string, createdBy?: string): Promise<void> {
    const campaign = await (prisma as any).sourcingBuyerEmailCampaign.findUnique({
        where: { sourcingBuyerId },
        include: {
            sourcingBuyer: {
                select: {
                    id: true, company: true, email: true, contactPerson: true,
                    assignedGmailAccount: true, status: true, product: true,
                    productCategory: true, emailTemplateId: true,
                },
            },
        },
    });
    if (!campaign || campaign.status !== "active") return;

    const buyer = campaign.sourcingBuyer;
    const fromEmail = buyer.assignedGmailAccount ?? BUYER_GMAIL_ACCOUNT;
    if (!buyer.email) throw new Error("Buyer has no email address");

    const nextStep = campaign.currentStep + 1;
    if (nextStep > 4) return;

    const signature = await resolveSignatureForBuyer(buyer);
    const templateData = {
        company: buyer.company,
        contactPerson: buyer.contactPerson,
        product: buyer.product ?? buyer.productCategory ?? null,
        fromEmail,
        signature,
    };

    let subject: string;
    let html: string;

    if (buyer.emailTemplateId) {
        const customTpl = await (prisma as any).buyerEmailCampaignTemplate.findUnique({ where: { id: buyer.emailTemplateId } }) as CustomEmailTemplate | null;
        if (customTpl) {
            const r = getCustomBuyerTemplate(nextStep, customTpl, templateData);
            subject = r.subject; html = r.html;
        } else {
            const r = getBuyerTemplate(nextStep, templateData);
            subject = r.subject; html = r.html;
        }
    } else {
        const r = getBuyerTemplate(nextStep, templateData);
        subject = r.subject; html = r.html;
    }

    const smtpMessageId = campaign.gmailMessageId
        ? await getSmtpMessageId(fromEmail, campaign.gmailMessageId)
        : null;

    const attachment = await getGlobalEmailAttachment();
    await sendGmailEmail({
        fromEmail,
        to: buyer.email.split(";").map((e: string) => e.trim()).filter(Boolean).join(", "),
        subject,
        html,
        threadId: campaign.gmailThreadId ?? undefined,
        inReplyTo: smtpMessageId ?? undefined,
        references: smtpMessageId ?? undefined,
        attachments: attachment ? [attachment] : undefined,
    });

    const now = new Date();
    const campaignUpdate: Record<string, unknown> = {
        currentStep: nextStep,
        nextFollowupDue: addDays(now, 3),
        lastCheckedAt: now,
    };
    if (nextStep >= 2) campaignUpdate[STEP_SENT_AT_FIELD[nextStep]] = now;

    await (prisma as any).$transaction([
        (prisma as any).sourcingBuyerEmailCampaign.update({
            where: { sourcingBuyerId },
            data: campaignUpdate,
        }),
        (prisma as any).sourcingBuyer.update({
            where: { id: sourcingBuyerId },
            data: { status: STEP_STATUS[nextStep] },
        }),
    ]);

    await createNotification({
        type: "campaign_followup",
        title: `${STEP_LABEL[nextStep]} Sent`,
        message: `${STEP_LABEL[nextStep]} sent to ${buyer.company} (${buyer.email})`,
        entityType: "sourcing_buyer",
        entityId: sourcingBuyerId,
        entityName: buyer.company,
        entityLink: `/buyers/sourcing/${sourcingBuyerId}`,
        createdBy,
    });
}

export async function executeMarkBuyerResponse(sourcingBuyerId: string, createdBy?: string): Promise<string> {
    const campaign = await (prisma as any).sourcingBuyerEmailCampaign.findUnique({
        where: { sourcingBuyerId },
        include: { sourcingBuyer: { select: { company: true, email: true, contactPerson: true, country: true, product: true, productCategory: true, phone: true, notes: true } } },
    });
    if (!campaign) return "";

    const buyer = campaign.sourcingBuyer;
    const now = new Date();

    const newBuyer = await (prisma as any).$transaction(async (tx: any) => {
        const created = await tx.buyer.create({
            data: {
                company: buyer.company,
                name: buyer.contactPerson ?? buyer.company,
                email: buyer.email ?? "",
                phone: buyer.phone ?? null,
                country: buyer.country ?? "Unknown",
                productCategoryInterest: buyer.product ?? buyer.productCategory ?? null,
                notes: buyer.notes ?? null,
                leadSource: "Sourcing Outreach",
                status: "Prospect",
                requiredProducts: [],
                supplierLinks: [],
                documents: [],
                createdBy,
            },
        });

        await tx.sourcingBuyerEmailCampaign.update({
            where: { sourcingBuyerId },
            data: { status: "response_received", responseReceivedAt: now, nextFollowupDue: null },
        });

        await tx.sourcingBuyer.update({
            where: { id: sourcingBuyerId },
            data: { status: "converted_to_buyer" },
        });

        return created;
    });

    await createNotification({
        type: "buyer_response_received",
        title: "Buyer Responded",
        message: `${buyer.company} responded and has been added to the Buyers Directory`,
        entityType: "buyer",
        entityId: newBuyer.id,
        entityName: buyer.company,
        entityLink: `/buyers/${newBuyer.id}`,
        createdBy,
    });

    return newBuyer.id;
}

// ─── HTTP Handlers ────────────────────────────────────────────────────────────

export async function listCampaigns(_req: AuthRequest, res: Response): Promise<void> {
    try {
        const campaigns = await (prisma as any).sourcingBuyerEmailCampaign.findMany({
            orderBy: { createdAt: "desc" },
            include: { sourcingBuyer: { select: { company: true, email: true, status: true } } },
        });
        res.json(campaigns);
    } catch (err) {
        console.error("List buyer campaigns error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function getDueCampaigns(_req: AuthRequest, res: Response): Promise<void> {
    try {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const campaigns = await (prisma as any).sourcingBuyerEmailCampaign.findMany({
            where: { status: "active", nextFollowupDue: { lte: today } },
            include: { sourcingBuyer: { select: { company: true, email: true } } },
        });
        res.json(campaigns);
    } catch (err) {
        console.error("Get due buyer campaigns error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function getCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
        const campaign = await (prisma as any).sourcingBuyerEmailCampaign.findUnique({
            where: { sourcingBuyerId: req.params.id },
            include: { sourcingBuyer: true },
        });
        if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
        res.json(campaign);
    } catch (err) {
        console.error("Get buyer campaign error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function startCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const buyer = await (prisma as any).sourcingBuyer.findUnique({ where: { id } });
        if (!buyer) { res.status(404).json({ error: "Sourcing buyer not found" }); return; }
        if (!buyer.email) { res.status(400).json({ error: "Buyer has no email address" }); return; }

        const existing = await (prisma as any).sourcingBuyerEmailCampaign.findUnique({ where: { sourcingBuyerId: id } });
        if (existing) { res.status(400).json({ error: "Campaign already started" }); return; }

        const started = await startCampaignForBuyer(id, req.user?.id);
        if (!started) { res.status(500).json({ error: "Failed to start campaign - check Gmail connection" }); return; }

        res.json({ success: true });
    } catch (err) {
        console.error("Start buyer campaign error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function sendFollowup(req: AuthRequest, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        await executeSendStep(id, req.user?.id);
        res.json({ success: true });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Internal server error";
        console.error("Send buyer followup error:", err);
        res.status(500).json({ error: msg });
    }
}

export async function markResponseReceived(req: AuthRequest, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const newBuyerId = await executeMarkBuyerResponse(id, req.user?.id);
        if (!newBuyerId) { res.status(404).json({ error: "Campaign not found" }); return; }
        res.json({ success: true, newBuyerId });
    } catch (err) {
        console.error("Mark buyer response error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function getSourceReplies(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const replies = await (prisma as any).buyerEmailReply.findMany({
            where: { sourcingBuyerId: id },
            orderBy: { receivedAt: "asc" },
        });
        res.json(replies);
    } catch (err) {
        console.error("Get buyer replies error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function syncReplies(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const campaign = await (prisma as any).sourcingBuyerEmailCampaign.findUnique({
            where: { sourcingBuyerId: id },
            include: { sourcingBuyer: { select: { email: true, assignedGmailAccount: true } } },
        });
        if (!campaign?.gmailThreadId) { res.json({ synced: 0 }); return; }

        const fromEmail = campaign.sourcingBuyer.assignedGmailAccount ?? BUYER_GMAIL_ACCOUNT;
        const messages = await fetchThreadReplies({ accountEmail: fromEmail, threadId: campaign.gmailThreadId });

        let synced = 0;
        for (const msg of messages) {
            const exists = await (prisma as any).buyerEmailReply.findFirst({
                where: { gmailMessageId: msg.gmailMessageId },
            });
            if (!exists) {
                const isReply = msg.fromEmail !== fromEmail && msg.fromEmail !== campaign.sourcingBuyer.email;
                await (prisma as any).buyerEmailReply.create({
                    data: {
                        sourcingBuyerId: id,
                        gmailMessageId: msg.gmailMessageId,
                        direction: isReply ? "received" : "sent",
                        fromEmail: msg.fromEmail,
                        fromName: msg.fromName ?? null,
                        subject: msg.subject ?? null,
                        body: msg.body,
                        receivedAt: msg.receivedAt,
                    },
                });
                synced++;
            } else if (exists.body === exists.subject) {
                // Body was stored as subject placeholder — update with real content from Gmail
                await (prisma as any).buyerEmailReply.update({
                    where: { id: exists.id },
                    data: { body: msg.body },
                });
                synced++;
            }
        }

        // Auto-mark response if a real reply found and campaign still active
        if (synced > 0 && campaign.status === "active") {
            const hasReply = messages.some((m) => m.fromEmail !== fromEmail);
            if (hasReply) {
                await (prisma as any).sourcingBuyerEmailCampaign.update({
                    where: { sourcingBuyerId: id },
                    data: { status: "response_received", responseReceivedAt: new Date() },
                });
                await (prisma as any).sourcingBuyer.update({
                    where: { id },
                    data: { status: "response_received" },
                });
            }
        }

        res.json({ synced });
    } catch (err) {
        console.error("Sync buyer replies error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
