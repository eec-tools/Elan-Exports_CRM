import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { createNotification } from "../services/notificationService.js";

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * GET /api/sourcing-campaigns
 */
export async function listCampaigns(req: AuthRequest, res: Response): Promise<void> {
    try {
        const campaigns = await (prisma as any).sourcingEmailCampaign.findMany({
            include: {
                sourcingSupplier: {
                    select: { id: true, company: true, email: true, contactPerson: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(campaigns);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch campaigns" });
    }
}

/**
 * GET /api/sourcing-campaigns/due
 * Campaigns where nextFollowupDue <= today and status = active
 */
export async function getDueCampaigns(req: AuthRequest, res: Response): Promise<void> {
    try {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const campaigns = await (prisma as any).sourcingEmailCampaign.findMany({
            where: {
                status: "active",
                nextFollowupDue: { lte: today },
            },
            include: {
                sourcingSupplier: {
                    select: { id: true, company: true, email: true, contactPerson: true },
                },
            },
            orderBy: { nextFollowupDue: "asc" },
        });
        res.json(campaigns);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch due campaigns" });
    }
}

/**
 * GET /api/sourcing-campaigns/:sourcingId
 */
export async function getCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
        const sourcingId = req.params.id as string;
        const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({
            where: { sourcingId },
            include: {
                sourcingSupplier: {
                    select: { id: true, company: true, email: true, contactPerson: true },
                },
            },
        });
        if (!campaign) {
            res.status(404).json({ error: "No campaign found for this supplier" });
            return;
        }
        res.json(campaign);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch campaign" });
    }
}

/**
 * POST /api/sourcing-campaigns/:sourcingId/start
 * Create campaign and mark intro email as sent
 */
export async function startCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
        const sourcingId = req.params.id as string;

        const supplier = await (prisma as any).sourcingSupplier.findUnique({ where: { id: sourcingId } });
        if (!supplier) {
            res.status(404).json({ error: "Sourcing supplier not found" });
            return;
        }

        const existing = await (prisma as any).sourcingEmailCampaign.findUnique({ where: { sourcingId } });
        if (existing) {
            res.status(409).json({ error: "Campaign already exists for this supplier" });
            return;
        }

        const now = new Date();
        const [campaign] = await (prisma as any).$transaction([
            (prisma as any).sourcingEmailCampaign.create({
                data: {
                    sourcingId,
                    status: "active",
                    currentStep: 1,
                    introEmailSentAt: now,
                    nextFollowupDue: addDays(now, 3),
                },
            }),
            (prisma as any).sourcingSupplier.update({
                where: { id: sourcingId },
                data: { status: "intro_sent" },
            }),
        ]);

        await createNotification({
            type: "campaign_started",
            title: "Sourcing Campaign Started",
            message: `Intro email campaign started for ${supplier.company}`,
            entityType: "sourcing_supplier",
            entityId: sourcingId,
            entityName: supplier.company,
            entityLink: `/suppliers/sourcing/${sourcingId}`,
            createdBy: req.user?.id,
        });

        res.status(201).json(campaign);
    } catch (err) {
        res.status(500).json({ error: "Failed to start campaign" });
    }
}

/**
 * POST /api/sourcing-campaigns/:sourcingId/mark-sent
 * Mark the next follow-up in sequence as sent (max 2 follow-ups after intro)
 */
export async function markEmailSent(req: AuthRequest, res: Response): Promise<void> {
    try {
        const sourcingId = req.params.id as string;

        const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({ where: { sourcingId } });
        if (!campaign) {
            res.status(404).json({ error: "No campaign found for this supplier" });
            return;
        }
        if (campaign.status !== "active") {
            res.status(400).json({ error: `Campaign is already ${campaign.status}` });
            return;
        }

        const supplier = await (prisma as any).sourcingSupplier.findUnique({ where: { id: sourcingId } });

        const now = new Date();
        let campaignUpdate: Record<string, unknown> = {};
        let supplierStatus = "";

        if (campaign.currentStep === 1) {
            campaignUpdate = {
                currentStep: 2,
                followup1SentAt: now,
                nextFollowupDue: addDays(now, 3),
            };
            supplierStatus = "followup1_sent";
        } else if (campaign.currentStep === 2) {
            campaignUpdate = {
                currentStep: 3,
                followup2SentAt: now,
                nextFollowupDue: null,
                status: "completed",
            };
            supplierStatus = "no_response";
        } else {
            res.status(400).json({ error: "Campaign is already completed (all follow-ups sent)" });
            return;
        }

        await (prisma as any).$transaction([
            (prisma as any).sourcingEmailCampaign.update({
                where: { sourcingId },
                data: campaignUpdate,
            }),
            (prisma as any).sourcingSupplier.update({
                where: { id: sourcingId },
                data: { status: supplierStatus },
            }),
        ]);

        const stepName = campaign.currentStep === 1 ? "Follow-up 1" : "Follow-up 2 (Final)";

        await createNotification({
            type: "campaign_followup",
            title: "Follow-up Sent",
            message: `${stepName} sent to ${supplier?.company ?? sourcingId}`,
            entityType: "sourcing_supplier",
            entityId: sourcingId,
            entityName: supplier?.company ?? sourcingId,
            entityLink: `/suppliers/sourcing/${sourcingId}`,
            createdBy: req.user?.id,
        });

        const updated = await (prisma as any).sourcingEmailCampaign.findUnique({
            where: { sourcingId },
            include: { sourcingSupplier: { select: { id: true, company: true, status: true } } },
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: "Failed to mark email as sent" });
    }
}

/**
 * POST /api/sourcing-campaigns/:sourcingId/mark-response
 * Record that supplier responded — stops the campaign
 */
export async function markResponseReceived(req: AuthRequest, res: Response): Promise<void> {
    try {
        const sourcingId = req.params.id as string;

        const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({ where: { sourcingId } });
        if (!campaign) {
            res.status(404).json({ error: "No campaign found for this supplier" });
            return;
        }
        if (campaign.status === "response_received") {
            res.status(400).json({ error: "Response already recorded" });
            return;
        }

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

        const supplier = await (prisma as any).sourcingSupplier.findUnique({ where: { id: sourcingId } });

        await createNotification({
            type: "campaign_responded",
            title: "Sourcing Supplier Responded",
            message: `${supplier?.company ?? sourcingId} responded — you can now convert them to a New Supplier`,
            entityType: "sourcing_supplier",
            entityId: sourcingId,
            entityName: supplier?.company ?? sourcingId,
            entityLink: `/suppliers/sourcing/${sourcingId}`,
            createdBy: req.user?.id,
        });

        const updated = await (prisma as any).sourcingEmailCampaign.findUnique({
            where: { sourcingId },
            include: { sourcingSupplier: { select: { id: true, company: true, status: true } } },
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: "Failed to record response" });
    }
}
