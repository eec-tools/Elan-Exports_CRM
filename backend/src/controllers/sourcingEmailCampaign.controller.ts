import { Response } from "express";
import { randomUUID } from "crypto";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { createNotification } from "../services/notificationService.js";
import { sendGmailEmail, fetchThreadReplies, getSmtpMessageId } from "../services/gmailService.js";
import { getTemplate } from "../services/emailTemplates.js";

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function buildFormLink(formToken: string): string {
    const baseUrl = (process.env.FRONTEND_URL?.split(",")[0] ?? "http://localhost:5173").trim();
    const normalizedBase = baseUrl.replace(/\/+$/, "");
    const normalizedToken = formToken.replace(/^\/+/, "");
    return `${normalizedBase}/supplier-form/${normalizedToken}`;
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

// ─── Auto-convert helpers ────────────────────────────────────────────────────

export async function autoConvertToNewSupplier(sourcingId: string): Promise<string> {
    const sourcing = await (prisma as any).sourcingSupplier.findUnique({ where: { id: sourcingId } });
    if (!sourcing) throw new Error("Sourcing supplier not found");

    const newSupplier = await (prisma as any).newSupplier.create({
        data: {
            convertedFromSourcingId: sourcingId,
            company: sourcing.company,
            email: sourcing.email,
            phone: sourcing.phone,
            contactPerson: sourcing.contactPerson,
            productCategory: sourcing.productCategory,
            product: sourcing.product,
            country: sourcing.country,
            accountManager: sourcing.accountManager,
            certifications: sourcing.certifications,
            notes: sourcing.notes,
            tradeName: sourcing.tradeName,
            yearEstablished: sourcing.yearEstablished,
            manufacturingAddress: sourcing.manufacturingAddress,
            city: sourcing.city,
            state: sourcing.state,
            postalCode: sourcing.postalCode,
            supplierType: sourcing.supplierType,
            whatsapp: sourcing.whatsapp,
            hsCode: sourcing.hsCode,
            organicStatus: sourcing.organicStatus,
            ingredientList: sourcing.ingredientList,
            allergenDeclaration: sourcing.allergenDeclaration,
            shelfLife: sourcing.shelfLife,
            storageConditions: sourcing.storageConditions,
            packagingType: sourcing.packagingType,
            netWeightVariants: sourcing.netWeightVariants,
            sampleAvailable: sourcing.sampleAvailable,
            sampleLeadTime: sourcing.sampleLeadTime,
            sampleCost: sourcing.sampleCost,
            annualProductionVolume: sourcing.annualProductionVolume,
            avgMonthlyVolume: sourcing.avgMonthlyVolume,
            maxScalableMonthlyVolume: sourcing.maxScalableMonthlyVolume,
            peakSeasonMonths: sourcing.peakSeasonMonths,
            offSeasonAvailability: sourcing.offSeasonAvailability,
            minExportableBatch: sourcing.minExportableBatch,
            moq: sourcing.moq,
            leadTimeFirstOrder: sourcing.leadTimeFirstOrder,
            leadTimeRepeatOrder: sourcing.leadTimeRepeatOrder,
            incotermsSupported: sourcing.incotermsSupported,
            portsOfExport: sourcing.portsOfExport,
            targetExportMarkets: sourcing.targetExportMarkets,
            currencyPreferred: sourcing.currencyPreferred,
            paymentTerms: sourcing.paymentTerms,
            iecNumber: sourcing.iecNumber,
            gstNumber: sourcing.gstNumber,
            fssaiLicense: sourcing.fssaiLicense,
            apedaNumber: sourcing.apedaNumber,
            fdaRegistrationNumber: sourcing.fdaRegistrationNumber,
            usAgentAppointed: sourcing.usAgentAppointed,
            tracesNtRegistration: sourcing.tracesNtRegistration,
            coiCapability: sourcing.coiCapability,
            daffBiosecurity: sourcing.daffBiosecurity,
            jasLabelCompliance: sourcing.jasLabelCompliance,
            haccpAvailable: sourcing.haccpAvailable,
            isoFsscCertNo: sourcing.isoFsscCertNo,
            isoCertValidityDate: sourcing.isoCertValidityDate,
            latestInternalAuditDate: sourcing.latestInternalAuditDate,
            latestThirdPartyAuditDate: sourcing.latestThirdPartyAuditDate,
            auditingBodyName: sourcing.auditingBodyName,
            farmerOrganicCert: sourcing.farmerOrganicCert,
            aggregatorOrganicCert: sourcing.aggregatorOrganicCert,
            processingUnitOrganicCert: sourcing.processingUnitOrganicCert,
            certifyingBodyName: sourcing.certifyingBodyName,
            certsValidForExport: sourcing.certsValidForExport,
            organicCertsByMarket: sourcing.organicCertsByMarket,
            labTestingRecords: sourcing.labTestingRecords,
            gmoFreeDeclaration: sourcing.gmoFreeDeclaration,
            irradiationFreeDeclaration: sourcing.irradiationFreeDeclaration,
            foodContactCompliance: sourcing.foodContactCompliance,
            compostabilityCert: sourcing.compostabilityCert,
            migrationTestReport: sourcing.migrationTestReport,
            exportBrand: sourcing.exportBrand,
            healthNutritionClaims: sourcing.healthNutritionClaims,
            claimsApprovedMarkets: sourcing.claimsApprovedMarkets,
            packagingComplianceRegions: sourcing.packagingComplianceRegions,
            organicSegregationSop: sourcing.organicSegregationSop,
            cleaningLinelearanceSop: sourcing.cleaningLinelearanceSop,
            noProhibitedAids: sourcing.noProhibitedAids,
            productCatalog: sourcing.productCatalog,
            supplierProducts: sourcing.supplierProducts ?? [],
            productCatalogs: sourcing.productCatalogs ?? [],
            productCatalogImages: sourcing.productCatalogImages ?? [],
            certificates: sourcing.certificates ?? [],
            warehousePhotos: sourcing.warehousePhotos ?? [],
            videoLinks: sourcing.videoLinks ?? [],
            quotations: sourcing.quotations ?? [],
            buyerIds: sourcing.buyerIds ?? [],
            dealStage: sourcing.dealStage ?? "Communication",
            supplierStage: "Onboarding",
            formToken: randomUUID(),
            createdBy: sourcing.createdBy,
        },
    });

    await (prisma as any).sourcingSupplier.update({
        where: { id: sourcingId },
        data: { status: "converted_to_new" },
    });

    return newSupplier.id;
}

export async function autoMoveToOldSupplier(sourcingId: string): Promise<void> {
    const sourcing = await (prisma as any).sourcingSupplier.findUnique({ where: { id: sourcingId } });
    if (!sourcing) return;

    await (prisma as any).$transaction([
        (prisma as any).oldSupplier.create({
            data: {
                company: sourcing.company,
                country: sourcing.country ?? null,
                product: sourcing.product ?? null,
                productCategory: sourcing.productCategory ?? null,
                certifications: sourcing.certifications ?? null,
                accountManager: sourcing.accountManager ?? null,
                notes: sourcing.notes ?? null,
                reasonInactive: "No response to follow-up email campaign",
                currentStatus: "Inactive",
                supplierStage: "Closed",
                dealStage: "Communication",
                createdBy: sourcing.createdBy ?? null,
            },
        }),
        (prisma as any).sourcingSupplier.update({
            where: { id: sourcingId },
            data: { status: "no_response" },
        }),
        (prisma as any).sourcingEmailCampaign.update({
            where: { sourcingId },
            data: { status: "completed", nextFollowupDue: null },
        }),
    ]);
}

// ─── Internal send helper (used by both controller and scheduler) ─────────────

export async function executeSendStep(sourcingId: string, createdBy?: string): Promise<void> {
    const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({
        where: { sourcingId },
        include: {
            sourcingSupplier: {
                select: {
                    id: true, company: true, email: true, contactPerson: true,
                    formToken: true, assignedGmailAccount: true, status: true,
                    product: true, productCategory: true,
                },
            },
        },
    });
    if (!campaign || campaign.status !== "active") return;

    const supplier = campaign.sourcingSupplier;
    const fromEmail = supplier.assignedGmailAccount;
    if (!fromEmail) throw new Error("No Gmail account assigned to this supplier");
    if (!supplier.email) throw new Error("Supplier has no email address");
    if (!supplier.formToken) throw new Error("Supplier has no form token");

    const nextStep = campaign.currentStep + 1;
    if (nextStep > 4) return; // all done

    const formLink = buildFormLink(supplier.formToken);
    const { html } = getTemplate(nextStep, {
        company: supplier.company,
        contactPerson: supplier.contactPerson,
        product: supplier.product ?? supplier.productCategory ?? null,
        formLink,
        fromEmail,
    });

    // Use the intro email's subject with "Re:" so follow-ups land in the same thread
    const { subject: introSubject } = getTemplate(1, {
        company: supplier.company,
        contactPerson: supplier.contactPerson,
        product: supplier.product ?? supplier.productCategory ?? null,
        formLink,
        fromEmail,
    });
    const replySubject = `Re: ${introSubject}`;

    // Fetch the intro email's SMTP Message-ID so recipients see follow-ups as replies
    const smtpMessageId = campaign.gmailMessageId
        ? await getSmtpMessageId(fromEmail, campaign.gmailMessageId)
        : null;

    await sendGmailEmail({
        fromEmail,
        to: supplier.email,
        subject: replySubject,
        html,
        threadId: campaign.gmailThreadId ?? undefined,
        inReplyTo: smtpMessageId ?? undefined,
        references: smtpMessageId ?? undefined,
    });

    const now = new Date();
    const isLastStep = nextStep === 4;

    const campaignUpdate: Record<string, unknown> = {
        currentStep: nextStep,
        nextFollowupDue: addDays(now, 3),
        lastCheckedAt: now,
    };
    if (nextStep >= 2) campaignUpdate[STEP_SENT_AT_FIELD[nextStep]] = now;

    await (prisma as any).$transaction([
        (prisma as any).sourcingEmailCampaign.update({
            where: { sourcingId },
            data: campaignUpdate,
        }),
        (prisma as any).sourcingSupplier.update({
            where: { id: sourcingId },
            data: { status: STEP_STATUS[nextStep] },
        }),
    ]);

    await createNotification({
        type: "campaign_followup",
        title: `${STEP_LABEL[nextStep]} Sent`,
        message: `${STEP_LABEL[nextStep]} sent to ${supplier.company} (${supplier.email})`,
        entityType: "sourcing_supplier",
        entityId: sourcingId,
        entityName: supplier.company,
        entityLink: `/suppliers/sourcing/${sourcingId}`,
        createdBy,
    });

    if (isLastStep) {
        // Give 3 days after FU3 before moving to old supplier (handled by reply detector)
        console.log(`[campaign] FU3 sent to ${supplier.company} — waiting 3 days for reply before archiving`);
    }
}

// ─── Internal mark-response helper (used by controller + scheduler) ──────────

export async function executeMarkResponse(sourcingId: string, createdBy?: string): Promise<string> {
    const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({
        where: { sourcingId },
        include: { sourcingSupplier: { select: { company: true } } },
    });
    if (!campaign) return "";

    // If already flagged by the cron detector, skip the status update but still convert
    if (campaign.status !== "response_received") {
        await (prisma as any).sourcingEmailCampaign.update({
            where: { sourcingId },
            data: {
                status: "response_received",
                responseReceivedAt: new Date(),
                nextFollowupDue: null,
            },
        });
    }

    const newSupplierId = await autoConvertToNewSupplier(sourcingId);
    const company = campaign.sourcingSupplier.company;

    await createNotification({
        type: "campaign_responded",
        title: "Supplier Responded — Converted",
        message: `${company} replied and has been automatically converted to a New Supplier`,
        entityType: "new_supplier",
        entityId: newSupplierId,
        entityName: company,
        entityLink: `/suppliers/new/${newSupplierId}`,
        createdBy,
    });

    return newSupplierId;
}

// ─── Shared helper: start a campaign for a supplier (used internally) ────────

export async function startCampaignForSupplier(sourcingId: string, userId?: string): Promise<boolean> {
    try {
        const supplier = await (prisma as any).sourcingSupplier.findUnique({ where: { id: sourcingId } });
        if (!supplier?.assignedGmailAccount || !supplier?.email || !supplier?.formToken) return false;

        const existing = await (prisma as any).sourcingEmailCampaign.findUnique({ where: { sourcingId } });
        if (existing) return false;

        const formLink = buildFormLink(supplier.formToken);
        const { subject, html } = getTemplate(1, {
            company: supplier.company,
            contactPerson: supplier.contactPerson,
            product: supplier.product ?? supplier.productCategory ?? null,
            formLink,
            fromEmail: supplier.assignedGmailAccount,
        });

        const { messageId, threadId } = await sendGmailEmail({
            fromEmail: supplier.assignedGmailAccount,
            to: supplier.email,
            subject,
            html,
        });

        const now = new Date();
        await (prisma as any).$transaction(async (tx: any) => {
            await tx.sourcingEmailCampaign.create({
                data: {
                    sourcingId,
                    status: "active",
                    currentStep: 1,
                    introEmailSentAt: now,
                    nextFollowupDue: addDays(now, 3),
                    gmailThreadId: threadId,
                    gmailMessageId: messageId,
                    lastCheckedAt: now,
                },
            });
            await tx.sourcingSupplier.update({
                where: { id: sourcingId },
                data: { status: "intro_sent" },
            });
        });

        await createNotification({
            type: "campaign_started",
            title: "Campaign Started",
            message: `Intro email sent to ${supplier.company} (${supplier.email}) via ${supplier.assignedGmailAccount}`,
            entityType: "sourcing_supplier",
            entityId: sourcingId,
            entityName: supplier.company,
            entityLink: `/suppliers/sourcing/${sourcingId}`,
            createdBy: userId,
        });

        return true;
    } catch (err) {
        console.error(`[campaign] Auto-start failed for supplier ${sourcingId}:`, err);
        return false;
    }
}

// ─── Route handlers ──────────────────────────────────────────────────────────

/**
 * GET /api/sourcing-campaigns
 */
export async function listCampaigns(_req: AuthRequest, res: Response): Promise<void> {
    try {
        const campaigns = await (prisma as any).sourcingEmailCampaign.findMany({
            include: {
                sourcingSupplier: {
                    select: { id: true, company: true, email: true, contactPerson: true, assignedGmailAccount: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(campaigns);
    } catch {
        res.status(500).json({ error: "Failed to fetch campaigns" });
    }
}

/**
 * GET /api/sourcing-campaigns/due
 */
export async function getDueCampaigns(_req: AuthRequest, res: Response): Promise<void> {
    try {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const campaigns = await (prisma as any).sourcingEmailCampaign.findMany({
            where: { status: "active", nextFollowupDue: { lte: today } },
            include: {
                sourcingSupplier: {
                    select: { id: true, company: true, email: true, contactPerson: true, assignedGmailAccount: true },
                },
            },
            orderBy: { nextFollowupDue: "asc" },
        });
        res.json(campaigns);
    } catch {
        res.status(500).json({ error: "Failed to fetch due campaigns" });
    }
}

/**
 * GET /api/sourcing-campaigns/:id
 */
export async function getCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
        const sourcingId = req.params.id;
        const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({
            where: { sourcingId },
            include: {
                sourcingSupplier: {
                    select: { id: true, company: true, email: true, contactPerson: true, assignedGmailAccount: true },
                },
            },
        });
        if (!campaign) {
            res.status(404).json({ error: "No campaign found for this supplier" });
            return;
        }
        res.json(campaign);
    } catch {
        res.status(500).json({ error: "Failed to fetch campaign" });
    }
}

/**
 * POST /api/sourcing-campaigns/:id/start
 * Sends the intro email via the supplier's assigned Gmail account
 */
export async function startCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
        const sourcingId = req.params.id;

        const supplier = await (prisma as any).sourcingSupplier.findUnique({ where: { id: sourcingId } });
        if (!supplier) {
            res.status(404).json({ error: "Sourcing supplier not found" });
            return;
        }
        if (!supplier.assignedGmailAccount) {
            res.status(400).json({ error: "No Gmail account assigned to this supplier. Edit the supplier and set a campaign email account first." });
            return;
        }
        if (!supplier.email) {
            res.status(400).json({ error: "Supplier has no email address. Add it before starting a campaign." });
            return;
        }
        if (!supplier.formToken) {
            res.status(400).json({ error: "Supplier has no form token." });
            return;
        }

        const existing = await (prisma as any).sourcingEmailCampaign.findUnique({ where: { sourcingId } });
        if (existing) {
            res.status(409).json({ error: "Campaign already exists for this supplier" });
            return;
        }

        const formLink = buildFormLink(supplier.formToken);
        const { subject, html } = getTemplate(1, {
            company: supplier.company,
            contactPerson: supplier.contactPerson,
            product: supplier.product ?? supplier.productCategory ?? null,
            formLink,
            fromEmail: supplier.assignedGmailAccount,
        });

        const { messageId, threadId } = await sendGmailEmail({
            fromEmail: supplier.assignedGmailAccount,
            to: supplier.email,
            subject,
            html,
        });

        const now = new Date();
        const campaign = await (prisma as any).$transaction(async (tx: any) => {
            const c = await tx.sourcingEmailCampaign.create({
                data: {
                    sourcingId,
                    status: "active",
                    currentStep: 1,
                    introEmailSentAt: now,
                    nextFollowupDue: addDays(now, 3),
                    gmailThreadId: threadId,
                    gmailMessageId: messageId,
                    lastCheckedAt: now,
                },
            });
            await tx.sourcingSupplier.update({
                where: { id: sourcingId },
                data: { status: "intro_sent" },
            });
            return c;
        });

        await createNotification({
            type: "campaign_started",
            title: "Campaign Started",
            message: `Intro email sent to ${supplier.company} (${supplier.email}) via ${supplier.assignedGmailAccount}`,
            entityType: "sourcing_supplier",
            entityId: sourcingId!,
            entityName: supplier.company,
            entityLink: `/suppliers/sourcing/${sourcingId}`,
            createdBy: req.user?.id,
        });

        res.status(201).json(campaign);
    } catch (err: any) {
        console.error("[campaign] startCampaign error:", err);
        res.status(500).json({ error: err?.message ?? "Failed to start campaign" });
    }
}

/**
 * POST /api/sourcing-campaigns/:id/send-followup
 * Manually sends the next follow-up in sequence
 */
export async function sendFollowup(req: AuthRequest, res: Response): Promise<void> {
    try {
        const sourcingId = req.params.id;

        const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({
            where: { sourcingId },
            include: { sourcingSupplier: { select: { company: true, email: true } } },
        });
        if (!campaign) {
            res.status(404).json({ error: "No campaign found for this supplier" });
            return;
        }
        if (campaign.status !== "active") {
            res.status(400).json({ error: `Campaign is already ${campaign.status}` });
            return;
        }
        if (campaign.currentStep >= 4) {
            res.status(400).json({ error: "All follow-ups have already been sent" });
            return;
        }

        await executeSendStep(sourcingId!, req.user!.id);

        const updated = await (prisma as any).sourcingEmailCampaign.findUnique({
            where: { sourcingId },
            include: {
                sourcingSupplier: {
                    select: { id: true, company: true, email: true, status: true, assignedGmailAccount: true },
                },
            },
        });
        res.json(updated);
    } catch (err: any) {
        console.error("[campaign] sendFollowup error:", err);
        res.status(500).json({ error: err?.message ?? "Failed to send follow-up" });
    }
}

/**
 * POST /api/sourcing-campaigns/:id/mark-response
 * Records supplier response → ends campaign → auto-converts to New Supplier
 */
export async function markResponseReceived(req: AuthRequest, res: Response): Promise<void> {
    try {
        const sourcingId = req.params.id;

        const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({ where: { sourcingId } });
        if (!campaign) {
            res.status(404).json({ error: "No campaign found for this supplier" });
            return;
        }

        const newSupplierId = await executeMarkResponse(sourcingId!, req.user!.id);

        const updated = await (prisma as any).sourcingEmailCampaign.findUnique({
            where: { sourcingId },
            include: {
                sourcingSupplier: { select: { id: true, company: true, status: true } },
            },
        });

        res.json({ ...updated, newSupplierId });
    } catch (err: any) {
        console.error("[campaign] markResponseReceived error:", err);
        res.status(500).json({ error: err?.message ?? "Failed to record response" });
    }
}

/**
 * POST /api/sourcing-campaigns/:id/mark-sent  (legacy — kept for compatibility)
 * Alias to sendFollowup
 */
export { sendFollowup as markEmailSent };

async function syncThreadToDb(sourcingId: string, accountEmail: string | null | undefined, threadId: string | null | undefined): Promise<void> {
    if (!accountEmail || !threadId) return;
    const messages = await fetchThreadReplies({ accountEmail, threadId });
    if (messages.length === 0) return;

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
}

/**
 * GET /api/sourcing-campaigns/:id/replies
 * Returns all thread messages. Auto-syncs from Gmail on first load if DB is empty.
 */
export async function getSourceReplies(req: AuthRequest, res: Response): Promise<void> {
    try {
        const sourcingId = req.params.id!;
        const stored = await (prisma as any).supplierEmailReply.findMany({
            where: { sourcingId },
            orderBy: { receivedAt: "asc" },
        });

        if (stored.length === 0) {
            const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({
                where: { sourcingId },
                include: { sourcingSupplier: { select: { assignedGmailAccount: true } } },
            });
            const threadId = (campaign?.gmailThreadId as string) || "";
            const gmailAccount = (campaign?.sourcingSupplier?.assignedGmailAccount as string) || "";
            if (threadId && gmailAccount) {
                await syncThreadToDb(sourcingId, gmailAccount, threadId);
                const refreshed = await (prisma as any).supplierEmailReply.findMany({
                    where: { sourcingId },
                    orderBy: { receivedAt: "asc" },
                });
                res.json(refreshed);
                return;
            }
        }

        res.json(stored);
    } catch {
        res.status(500).json({ error: "Failed to fetch replies" });
    }
}

/**
 * POST /api/sourcing-campaigns/:id/sync-replies
 * Fetches real reply messages from Gmail and stores them.
 * Used when a supplier is already flagged as responded but replies weren't captured.
 */
export async function syncReplies(req: AuthRequest, res: Response): Promise<void> {
    try {
        const sourcingId = req.params.id!;
        const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({
            where: { sourcingId },
            include: { sourcingSupplier: { select: { assignedGmailAccount: true } } },
        });
        const threadId = (campaign?.gmailThreadId as string) || "";
        const gmailAccount = (campaign?.sourcingSupplier?.assignedGmailAccount as string) || "";
        if (!threadId || !gmailAccount) { res.json([]); return; }

        await syncThreadToDb(sourcingId, gmailAccount, threadId);
        const all = await (prisma as any).supplierEmailReply.findMany({
            where: { sourcingId },
            orderBy: { receivedAt: "asc" },
        });
        res.json(all);
    } catch (err: any) {
        console.error("[syncReplies] error:", err);
        res.status(500).json({ error: err?.message ?? "Failed to sync replies" });
    }
}

/**
 * GET /api/new-suppliers/:id/replies
 * Returns all thread messages for a new supplier via its convertedFromSourcingId.
 * Auto-syncs from Gmail on first load if DB is empty.
 */
export async function getNewSupplierReplies(req: AuthRequest, res: Response): Promise<void> {
    try {
        const newSupplierId = req.params.id!;
        const supplier = await (prisma as any).newSupplier.findUnique({
            where: { id: newSupplierId },
            select: { convertedFromSourcingId: true, email: true, company: true },
        });
        if (!supplier) { res.json([]); return; }

        // Prefer the direct link; fall back to matching by email/company for older records
        let sourcingId: string = supplier.convertedFromSourcingId ?? "";
        if (!sourcingId && (supplier.email || supplier.company)) {
            const match = await (prisma as any).sourcingSupplier.findFirst({
                where: {
                    status: "converted_to_new",
                    ...(supplier.email ? { email: supplier.email } : { company: supplier.company }),
                },
                select: { id: true },
                orderBy: { createdAt: "desc" },
            });
            if (match) sourcingId = match.id;
        }
        if (!sourcingId) { res.json([]); return; }
        const stored = await (prisma as any).supplierEmailReply.findMany({
            where: { sourcingId },
            orderBy: { receivedAt: "asc" },
        });

        if (stored.length === 0) {
            const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({
                where: { sourcingId },
                include: { sourcingSupplier: { select: { assignedGmailAccount: true } } },
            });
            const threadId = (campaign?.gmailThreadId as string) || "";
            const gmailAccount = (campaign?.sourcingSupplier?.assignedGmailAccount as string) || "";
            if (threadId && gmailAccount) {
                await syncThreadToDb(sourcingId, gmailAccount, threadId);
                const refreshed = await (prisma as any).supplierEmailReply.findMany({
                    where: { sourcingId },
                    orderBy: { receivedAt: "asc" },
                });
                res.json(refreshed);
                return;
            }
        }

        res.json(stored);
    } catch {
        res.status(500).json({ error: "Failed to fetch replies" });
    }
}
