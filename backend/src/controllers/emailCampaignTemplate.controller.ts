import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

const DEFAULT_INTRO_SUBJECT = "Export Supply Partnership Inquiry – {{product}}";

const DEFAULT_INTRO_BODY = `{{greeting}}

Greetings from Elan Exports Consultancy.

We are a Singapore-headquartered sourcing and execution consultancy working with international buyers across regions, including Europe, the Middle East, Africa, Australia, and North America.

We are currently expanding our supplier network for {{product}} and are evaluating reliable manufacturers/exporters for ongoing and upcoming international sourcing requirements.

At this stage, we are identifying partners based on product capability, export readiness, pricing competitiveness, documentation strength, and responsiveness.

We would request you to kindly share the following details:
- Company profile
- Product catalogue / key SKUs
- Export markets currently served
- MOQ details
- Certifications (e.g., ISO, HACCP, BRC, etc.)
- Lead times
- Packaging options
- Indicative pricing for relevant products
- Factory / production details
- Contact details of your export / commercial team

You can submit the above details directly using our Supplier Information Form:

{{formButton}}

Please note that buyer-specific details are not being disclosed at this stage, as we are currently in the supplier evaluation and onboarding phase.

Please note that Elan Exports Consultancy operates through a structured sourcing and execution model, where we remain the central point of coordination across supplier evaluation, commercial discussions, and transaction management. This approach ensures consistency, pricing discipline, and smooth execution across all stages of the sourcing process. Accordingly, all communication and commercial alignment are managed through EEC.

We look forward to reviewing your profile and exploring a potential working relationship.`;

const DEFAULT_FOLLOWUP1_SUBJECT = "Following Up - Supplier Form | Élan Exports × {{company}}";

const DEFAULT_FOLLOWUP1_BODY = `{{greeting}}

I hope this message finds you well. I am writing to follow up on my previous email regarding a potential supplier partnership between {{company}} and Élan Exports & Consultancy.

In case my earlier email was missed, I wanted to share the Supplier Information Form once more. It only takes around 10–15 minutes and will help us move forward with evaluating a partnership:

{{formButton}}

If you have any questions or would prefer to connect over a call, please do not hesitate to reach out directly.`;

const DEFAULT_FOLLOWUP2_SUBJECT = "Reminder - Partnership Opportunity with Élan Exports | {{company}}";

const DEFAULT_FOLLOWUP2_BODY = `{{greeting}}

I wanted to reach out one more time regarding our partnership inquiry with {{company}}. We are genuinely interested in what you offer and would love the opportunity to work together.

Please take a moment to complete the Supplier Information Form - it helps us understand your products, certifications, and capacity so we can explore the right opportunities for you in our buyer network:

{{formButton}}

If this is not the right time or you are not interested, no worries at all - please let us know and we will not follow up further.`;

const DEFAULT_FOLLOWUP3_SUBJECT = "Last Follow-Up - Élan Exports Partnership Inquiry | {{company}}";

const DEFAULT_FOLLOWUP3_BODY = `{{greeting}}

This is our final follow-up regarding the supplier partnership inquiry we sent to {{company}}. We have reached out a few times and want to respect your time.

If you are interested in exploring an export partnership with Élan Exports, we would be delighted to connect. Please fill in the form below at your earliest convenience:

{{formButton}}

If we do not hear back, we will close this inquiry - but you are always welcome to reach out to us directly in the future if circumstances change.`;

export const DEFAULT_TEMPLATE_CONTENT = {
    introSubject: DEFAULT_INTRO_SUBJECT,
    introBody: DEFAULT_INTRO_BODY,
    followup1Subject: DEFAULT_FOLLOWUP1_SUBJECT,
    followup1Body: DEFAULT_FOLLOWUP1_BODY,
    followup2Subject: DEFAULT_FOLLOWUP2_SUBJECT,
    followup2Body: DEFAULT_FOLLOWUP2_BODY,
    followup3Subject: DEFAULT_FOLLOWUP3_SUBJECT,
    followup3Body: DEFAULT_FOLLOWUP3_BODY,
};

export async function listEmailTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
        const templates = await (prisma as any).emailCampaignTemplate.findMany({
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        });
        res.json(templates);
    } catch (err) {
        console.error("[emailCampaignTemplate] listEmailTemplates:", err);
        res.status(500).json({ error: "Failed to fetch email templates" });
    }
}

export async function getEmailTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const template = await (prisma as any).emailCampaignTemplate.findUnique({
            where: { id: req.params.id },
        });
        if (!template) {
            res.status(404).json({ error: "Template not found" });
            return;
        }
        res.json(template);
    } catch (err) {
        console.error("[emailCampaignTemplate] getEmailTemplate:", err);
        res.status(500).json({ error: "Failed to fetch email template" });
    }
}

export async function getDefaultContent(_req: AuthRequest, res: Response): Promise<void> {
    res.json(DEFAULT_TEMPLATE_CONTENT);
}

export async function createEmailTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const {
            name, isDefault,
            introSubject, introBody,
            followup1Subject, followup1Body,
            followup2Subject, followup2Body,
            followup3Subject, followup3Body,
        } = req.body;

        if (!name) {
            res.status(400).json({ error: "Template name is required" });
            return;
        }
        if (!introSubject || !introBody) {
            res.status(400).json({ error: "Intro subject and body are required" });
            return;
        }

        if (isDefault) {
            await (prisma as any).emailCampaignTemplate.updateMany({
                where: { isDefault: true },
                data: { isDefault: false },
            });
        }

        const template = await (prisma as any).emailCampaignTemplate.create({
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
            },
        });

        res.status(201).json(template);
    } catch (err) {
        console.error("[emailCampaignTemplate] createEmailTemplate:", err);
        res.status(500).json({ error: "Failed to create email template" });
    }
}

export async function updateEmailTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const {
            name, isDefault,
            introSubject, introBody,
            followup1Subject, followup1Body,
            followup2Subject, followup2Body,
            followup3Subject, followup3Body,
        } = req.body;

        const existing = await (prisma as any).emailCampaignTemplate.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Template not found" });
            return;
        }

        if (isDefault) {
            await (prisma as any).emailCampaignTemplate.updateMany({
                where: { isDefault: true, id: { not: id } },
                data: { isDefault: false },
            });
        }

        const updated = await (prisma as any).emailCampaignTemplate.update({
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
            },
        });

        res.json(updated);
    } catch (err) {
        console.error("[emailCampaignTemplate] updateEmailTemplate:", err);
        res.status(500).json({ error: "Failed to update email template" });
    }
}

export async function deleteEmailTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        await (prisma as any).emailCampaignTemplate.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        console.error("[emailCampaignTemplate] deleteEmailTemplate:", err);
        res.status(500).json({ error: "Failed to delete email template" });
    }
}
