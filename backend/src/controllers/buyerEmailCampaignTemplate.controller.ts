import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

const DEFAULT_INTRO_SUBJECT = `Sourcing Partnership Inquiry - {{product}} | Élan Exports`;

const DEFAULT_INTRO_BODY = `{{greeting}}

Greetings from Élan Exports & Consultancy.

We are a Singapore-headquartered sourcing and execution consultancy with an established network of verified, export-ready suppliers across South Asia, Southeast Asia, and Africa. We work with international buyers to simplify their procurement - handling supplier identification, quality evaluation, compliance documentation, commercial negotiations, and end-to-end execution.

We came across {{company}} and believe there may be a strong fit, particularly for {{product}}. Our supplier network for this category includes manufacturers and exporters with established certifications (ISO, HACCP, BRC, organic, etc.), competitive pricing, and proven export track records.

We would be glad to explore the following with you:
- Product availability, specifications, and pricing
- Supplier certifications and compliance documentation
- MOQ, lead times, and packaging options
- Samples and pre-shipment quality inspection
- Logistics, incoterms, and payment terms

We operate as the central coordination point, ensuring pricing discipline, compliance, and smooth execution throughout. Buyer identity is kept confidential during the initial evaluation phase.

If this aligns with your current or upcoming sourcing requirements, we would welcome a brief introductory conversation or a written exchange. Please feel free to reply to this email or reach out directly.`;

const DEFAULT_FOLLOWUP1_SUBJECT = `Follow-Up - Sourcing Partnership | Élan Exports × {{company}}`;

const DEFAULT_FOLLOWUP1_BODY = `{{greeting}}

I hope this message finds you well. I am following up on my previous email regarding a potential sourcing partnership for {{product}} through Élan Exports & Consultancy.

In case my earlier email was missed, I wanted to reiterate that we have a curated network of verified, export-ready suppliers for this category - with the right certifications, competitive pricing, and the capacity to meet international buyer requirements.

We handle all the complexity - supplier vetting, compliance, documentation, and execution - so you can focus on your business.

If you have any current or upcoming requirements, I would be delighted to connect and share supplier profiles and indicative pricing. A brief reply is all it takes to get started.`;

const DEFAULT_FOLLOWUP2_SUBJECT = `Reminder - Sourcing Opportunity | Élan Exports × {{company}}`;

const DEFAULT_FOLLOWUP2_BODY = `{{greeting}}

I wanted to reach out once more regarding our sourcing services for {{company}}, particularly for {{product}}.

At Élan Exports, we help international buyers source reliably from South Asia and Southeast Asia. Our service covers everything from identifying the right suppliers to managing compliance, quality checks, and shipment execution - all under one roof.

We genuinely believe we can add value to your procurement process. If now is not the right time or your requirements have changed, please let us know and we will respect that entirely.

Otherwise, we would love to schedule a quick 15-minute call or exchange some product-specific details over email - whichever is more convenient for you.`;

const DEFAULT_FOLLOWUP3_SUBJECT = `Final Follow-Up - Élan Exports Sourcing Partnership | {{company}}`;

const DEFAULT_FOLLOWUP3_BODY = `{{greeting}}

This is our final follow-up regarding the sourcing partnership inquiry we sent to {{company}} for {{product}}.

We have genuinely valued the opportunity to reach out and hope our services may be of use to you at some point. If this is not the right time, we completely understand - and you are always welcome to reach out to us in the future when circumstances change.

Should you wish to explore a sourcing partnership with Élan Exports - whether now or in the future - we would be happy to reconnect. Please do not hesitate to write to us directly.`;

export const BUYER_DEFAULT_TEMPLATE_CONTENT = {
    introSubject: DEFAULT_INTRO_SUBJECT,
    introBody: DEFAULT_INTRO_BODY,
    followup1Subject: DEFAULT_FOLLOWUP1_SUBJECT,
    followup1Body: DEFAULT_FOLLOWUP1_BODY,
    followup2Subject: DEFAULT_FOLLOWUP2_SUBJECT,
    followup2Body: DEFAULT_FOLLOWUP2_BODY,
    followup3Subject: DEFAULT_FOLLOWUP3_SUBJECT,
    followup3Body: DEFAULT_FOLLOWUP3_BODY,
};

export async function listBuyerEmailTemplates(_req: AuthRequest, res: Response): Promise<void> {
    try {
        const templates = await prisma.buyerEmailCampaignTemplate.findMany({
            include: { signature: true },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        });
        res.json(templates);
    } catch (err) {
        console.error("[buyerEmailCampaignTemplate] list:", err);
        res.status(500).json({ error: "Failed to fetch buyer email templates" });
    }
}

export async function getBuyerEmailTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const template = await prisma.buyerEmailCampaignTemplate.findUnique({
            where: { id: req.params.id },
            include: { signature: true },
        });
        if (!template) { res.status(404).json({ error: "Template not found" }); return; }
        res.json(template);
    } catch (err) {
        console.error("[buyerEmailCampaignTemplate] get:", err);
        res.status(500).json({ error: "Failed to fetch buyer email template" });
    }
}

export async function getBuyerDefaultContent(_req: AuthRequest, res: Response): Promise<void> {
    res.json(BUYER_DEFAULT_TEMPLATE_CONTENT);
}

export async function createBuyerEmailTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const {
            name, isDefault,
            introSubject, introBody,
            followup1Subject, followup1Body,
            followup2Subject, followup2Body,
            followup3Subject, followup3Body,
            signatureId,
        } = req.body;

        if (!name) { res.status(400).json({ error: "Template name is required" }); return; }
        if (!introSubject || !introBody) { res.status(400).json({ error: "Intro subject and body are required" }); return; }

        if (isDefault) {
            await prisma.buyerEmailCampaignTemplate.updateMany({
                where: { isDefault: true },
                data: { isDefault: false },
            });
        }

        const template = await prisma.buyerEmailCampaignTemplate.create({
            data: {
                name,
                isDefault: isDefault ?? false,
                introSubject,
                introBody,
                followup1Subject: followup1Subject ?? DEFAULT_FOLLOWUP1_SUBJECT,
                followup1Body: followup1Body ?? DEFAULT_FOLLOWUP1_BODY,
                followup2Subject: followup2Subject ?? DEFAULT_FOLLOWUP2_SUBJECT,
                followup2Body: followup2Body ?? DEFAULT_FOLLOWUP2_BODY,
                followup3Subject: followup3Subject ?? DEFAULT_FOLLOWUP3_SUBJECT,
                followup3Body: followup3Body ?? DEFAULT_FOLLOWUP3_BODY,
                createdBy: req.user!.id,
                signatureId: signatureId ?? null,
            },
            include: { signature: true },
        });

        res.status(201).json(template);
    } catch (err) {
        console.error("[buyerEmailCampaignTemplate] create:", err);
        res.status(500).json({ error: "Failed to create buyer email template" });
    }
}

export async function updateBuyerEmailTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const {
            name, isDefault,
            introSubject, introBody,
            followup1Subject, followup1Body,
            followup2Subject, followup2Body,
            followup3Subject, followup3Body,
            signatureId,
        } = req.body;

        const existing = await prisma.buyerEmailCampaignTemplate.findUnique({ where: { id } });
        if (!existing) { res.status(404).json({ error: "Template not found" }); return; }

        if (isDefault) {
            await prisma.buyerEmailCampaignTemplate.updateMany({
                where: { isDefault: true, id: { not: id } },
                data: { isDefault: false },
            });
        }

        const updated = await prisma.buyerEmailCampaignTemplate.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(isDefault !== undefined && { isDefault }),
                ...(introSubject !== undefined && { introSubject }),
                ...(introBody !== undefined && { introBody }),
                ...(followup1Subject !== undefined && { followup1Subject }),
                ...(followup1Body !== undefined && { followup1Body }),
                ...(followup2Subject !== undefined && { followup2Subject }),
                ...(followup2Body !== undefined && { followup2Body }),
                ...(followup3Subject !== undefined && { followup3Subject }),
                ...(followup3Body !== undefined && { followup3Body }),
                // signatureId: explicit null clears, undefined means "not sent → leave unchanged"
                ...(signatureId !== undefined && { signatureId: signatureId || null }),
            },
            include: { signature: true },
        });

        res.json(updated);
    } catch (err) {
        console.error("[buyerEmailCampaignTemplate] update:", err);
        res.status(500).json({ error: "Failed to update buyer email template" });
    }
}

export async function deleteBuyerEmailTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        await prisma.buyerEmailCampaignTemplate.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        console.error("[buyerEmailCampaignTemplate] delete:", err);
        res.status(500).json({ error: "Failed to delete buyer email template" });
    }
}
