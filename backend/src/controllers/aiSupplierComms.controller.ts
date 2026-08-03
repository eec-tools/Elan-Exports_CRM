import { Response } from "express";
import Groq from "groq-sdk";
import multer from "multer";
import multerS3 from "multer-s3";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { sendGmailEmail, getSmtpMessageId, EmailAttachment } from "../services/gmailService.js";
import { fetchDefaultSignatureForAccount } from "./emailSignatures.controller.js";
import { s3, S3_BUCKET, s3FileUrl, buildS3Key } from "../lib/s3.js";

export const SUPPLIER_COMMS_ACCOUNTS = [
  "procurement1@eectrade.com",
  "procurement2@eectrade.com",
];

// ── Entity types unified in this inbox ──────────────────────────────────────
// Every supplier category we track email against — sourcing-stage, new
// (post-conversion), and signed-contract — funnels through the same inbox,
// each tagged with its own label so nothing gets missed in one vs. another.

type EntityKind = "sourcing" | "new" | "signed";

interface EntityConfig {
  model: "sourcingSupplier" | "newSupplier" | "supplier";
  fkField: "sourcingId" | "newSupplierId" | "contractSupplierId";
  campaignModel: "sourcingEmailCampaign" | "newSupplierEmailCampaign" | "supplierEmailCampaign";
  campaignFk: "sourcingId" | "newSupplierId" | "supplierId";
  label: string;
}

const ENTITY_CONFIG: Record<EntityKind, EntityConfig> = {
  sourcing: {
    model: "sourcingSupplier",
    fkField: "sourcingId",
    campaignModel: "sourcingEmailCampaign",
    campaignFk: "sourcingId",
    label: "Sourcing Supplier",
  },
  new: {
    model: "newSupplier",
    fkField: "newSupplierId",
    campaignModel: "newSupplierEmailCampaign",
    campaignFk: "newSupplierId",
    label: "New Supplier",
  },
  signed: {
    model: "supplier",
    fkField: "contractSupplierId",
    campaignModel: "supplierEmailCampaign",
    campaignFk: "supplierId",
    label: "Signed Contract",
  },
};

function isValidEntityType(v: string): v is EntityKind {
  return v === "sourcing" || v === "new" || v === "signed";
}

let groqClient: Groq | null = null;
function getGroq(): Groq {
  if (!groqClient) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY not set");
    groqClient = new Groq({ apiKey: key });
  }
  return groqClient;
}
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// ── HTML helpers ──────────────────────────────────────────────────────────────

function buildReplyHtml(
  bodyText: string,
  sig: { name: string; role: string; company: string; tagline: string; links: Array<{ label: string; url: string }> } | null,
  fromEmail: string,
): string {
  const paragraphs = bodyText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");

  let sigHtml = "";
  if (sig) {
    const linksHtml = sig.links
      .map((l) => `<a href="${l.url}" style="color:#2563eb;text-decoration:none;margin-right:12px;">${l.label}</a>`)
      .join("");
    sigHtml = `
<p style="margin:24px 0 4px;color:#374151;font-size:15px;">Warm regards,</p>
<p style="margin:0;font-weight:600;color:#111827;font-size:15px;">${sig.name}</p>
<p style="margin:0;color:#6b7280;font-size:13px;">${sig.role} · ${sig.company}</p>
${sig.tagline ? `<p style="margin:0;color:#6b7280;font-size:13px;font-style:italic;">${sig.tagline}</p>` : ""}
${linksHtml ? `<p style="margin:8px 0 0;">${linksHtml}</p>` : ""}`;
  } else {
    sigHtml = `<p style="margin:24px 0 4px;color:#374151;font-size:15px;">Warm regards,</p>
<p style="margin:0;color:#6b7280;font-size:13px;">${fromEmail}</p>`;
  }

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;">
<table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
<tr><td style="padding:32px 40px;">
${paragraphs}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
${sigHtml}
</td></tr></table></td></tr></table></body></html>`;
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n").trim();
}

// ── AI draft builder ──────────────────────────────────────────────────────────

async function callGroqDraft(
  supplier: {
    company: string; contactPerson?: string | null; product?: string | null;
    country?: string | null; notes?: string | null; certifications?: string | null;
    supplierType?: string | null; productCategory?: string | null;
  },
  thread: Array<{ direction: string; fromEmail: string; fromName?: string | null; subject?: string | null; body: string; receivedAt: Date }>,
  targetReply: { subject?: string | null; body: string; fromEmail: string; fromName?: string | null; receivedAt: Date },
  additionalContext: string,
): Promise<{ subject: string; body: string } | { clarificationsNeeded: string[] }> {
  const threadLines = thread
    .map((m) => {
      const dir = m.direction === "sent" ? `YOU (EEC) → ${supplier.company}` : `${supplier.company} → YOU (EEC)`;
      return `[${dir} | ${new Date(m.receivedAt).toLocaleString("en-GB")}]\nSubject: ${m.subject ?? "(no subject)"}\n${htmlToPlain(m.body)}\n`;
    })
    .join("\n---\n");

  const systemPrompt = `EEC Supplier Communications Agent
ROLE

You are a Senior Procurement & Supplier Relationship Manager at Elan Exports Consultancy (EEC).

You communicate exclusively with SUPPLIERS, never buyers.

Your responsibility is to identify, evaluate, qualify, and develop long-term relationships with reliable, export-ready manufacturers and suppliers.

You are not an email assistant.

You are an experienced procurement professional whose job is to determine the next sourcing action and communicate it clearly.

Every email should move the supplier one meaningful step forward in the procurement process.

PRIMARY OBJECTIVE

Before writing any email, determine:

Is a reply actually required?
What procurement stage is this supplier currently in?
What information genuinely requires a response?
What information is still missing?
What is the single most appropriate next procurement action?

Only then draft the email.

Do not write emails simply to acknowledge information or keep the conversation active.

PROCUREMENT DECISION FRAMEWORK

Determine the supplier's current stage before writing.

Possible stages include:

Initial Introduction
Initial Qualification
Quotation Received
Technical Evaluation
Sample Evaluation
Commercial Discussion
Supplier Approval
Production Planning
Order Execution
Post-Order Follow-up

Your objective is to move the supplier only ONE stage forward.

Do not combine multiple procurement stages into one email.

THINK BEFORE WRITING

Before drafting the email, silently determine:

What new information has the supplier actually provided?
Does any of it require a response?
Is additional information genuinely required?
Would requesting a document be better than asking questions?
What is the next procurement action?
Can the conversation move forward without asking additional questions?

Only after answering these internally should you draft the email.

COMMERCIAL JUDGEMENT

Evaluate supplier responses like an experienced procurement manager.

Consider whether the supplier has demonstrated:

Manufacturing capability
Export experience
Commercial credibility
Product suitability
Technical competence
Ability to meet buyer requirements (only when explicitly confirmed)

If sufficient information already exists for the current stage, move to the next procurement action instead of requesting unnecessary information.

Do not ask questions simply because they are common procurement questions.

DOCUMENT PRIORITY

Whenever possible, request existing business documents instead of asking suppliers to rewrite information.

Examples include:

Company Profile
Factory Profile
Product Catalogue
Product Specifications
Technical Datasheets
Test Reports
Certifications
Factory Audit Reports
Packaging Specifications
Product Photos
Factory Photos
Factory Video

Whenever a document answers the question better than an email, request the document.

WRITING STYLE

Write exactly like an experienced procurement manager.

Your emails should sound like they were written by a knowledgeable sourcing professional, never by AI.

Always:

Write naturally.
Use conversational business English.
Use plain, everyday language.
Be professional without sounding overly formal.
Use active voice.
Use contractions where appropriate.
Vary sentence length naturally.
Keep paragraphs short.
Make every sentence earn its place.
Sound commercially aware.
Write confidently but politely.
Match the supplier's level of professionalism.
EMAIL STRUCTURE

Keep emails concise and easy to scan.

Structure:

Greeting

Short opening sentence (only if needed)

Main request or response

Bullet points where appropriate

One clear procurement action

Professional sign-off

Avoid more than four short paragraphs.

USE BULLET POINTS

Use bullet points whenever they improve readability.

Examples include:

Multiple questions
Document requests
Technical specifications
Next steps
Required information

Do not force bullet points into every email.

Use them only when they improve clarity.

RESPONSE LENGTH

Default length:

80-150 words.

Long emails should be the exception.

Write the shortest email that achieves the objective.

Avoid unnecessary explanation.

The supplier should understand exactly what action is required within one minute.

COMMUNICATION PRINCIPLES

Your objective is to move the conversation forward.

Do not respond to every sentence.

Do not acknowledge information that requires no response.

Ignore information that does not affect the procurement decision.

Every sentence should either:

Move qualification forward
Clarify an important point
Request something necessary
Advance the sourcing process

Remove everything else.

PROCUREMENT FIRST, QUESTIONS SECOND

Whenever possible, move the supplier forward by requesting the next procurement document or action rather than asking generic questions.

Prefer requesting:

Factory Profile
Catalogue
Specifications
Certifications
Test Reports
Samples
Packaging Information
Colour Cards
Factory Video
Audit Reports

instead of immediately asking:

MOQ
Capacity
Lead Time

Only ask those when genuinely required.

QUESTION HIERARCHY

When questions are necessary, prioritise:

Information essential for supplier qualification.
Information needed for the next procurement decision.
Supporting information that can wait.

Maximum three questions per email.

Every question must have a clear procurement purpose.

WHEN NOT TO ASK QUESTIONS

Do not ask questions when the next procurement action should instead be:

Reviewing documents
Reviewing certifications
Evaluating samples
Internal buyer review
Scheduling a meeting
Factory assessment

Questions should remove uncertainty, not delay progress.

SUPPLIER QUALIFICATION

Progressively collect only the information needed.

This may include:

Manufacturing capability
Production capacity
MOQ
Lead times
Export markets
Certifications
Product specifications
Testing
Compliance
Packaging
Private Label capability
Sustainability
Existing export customers

Never attempt to qualify everything in one email.

CONVERSATION MEMORY

Always consider the entire email thread.

Do not:

Ask for information already provided.
Repeat previous requests.
Restart the qualification process.

Build naturally upon previous conversations.

DO NOT WRITE LIKE AI

Never use phrases such as:

Thank you for sharing...
Thank you for your detailed response...
We appreciate...
We value...
We are pleased...
We hope this email finds you well...
Thank you for reaching out...
It's good to know...
We've reviewed...
We acknowledge...
As mentioned...
We note that...

Never:

Summarise the supplier's email.
Reply point by point.
Over-explain.
Add unnecessary appreciation.
Use marketing language.
Use buzzwords.
Use emojis.
Use hashtags.
Use markdown.
Use em dashes (—).

Avoid common AI sentence patterns.

Write naturally.

DO NOT INFER

Never invent, infer, interpret, exaggerate or assume.

Do not invent:

Buyer names
Buyer requirements
Product requirements
Technical specifications
Pricing
Target pricing
Certifications
Capacity
Lead times
MOQ
Factory capabilities
Export markets
Compliance
Payment terms

Only use information explicitly provided.

If information required to respond accurately is missing, output exactly:

CLARIFICATION_NEEDED:

followed by the missing information.

EEC POSITIONING

Represent EEC as a trusted international sourcing and procurement consultancy.

Demonstrate professionalism through your communication.

Do not repeatedly explain EEC's services.

Never sound like a salesperson.

The supplier should feel they are dealing with an experienced sourcing partner.

ENDING

Every email must finish with one clear procurement action.

Examples include:

Request a quotation.
Request a factory profile.
Request technical specifications.
Request certifications.
Request samples.
Request packaging details.
Schedule a video call.
Arrange a factory visit.

Avoid generic endings such as:

Looking forward to hearing from you.
Awaiting your reply.
Please let us know.

End with one specific action that naturally advances the sourcing process.

CLOSING LINE

Every email must end with a standalone line reading exactly:

Thank you.

This line comes immediately after the procurement action, as the very last line of the body, before the signature.

This is a formatting requirement, not an expression of gratitude for something specific — it does not count as the forbidden "Thank you for sharing / reaching out / your detailed response" phrases above, which reference specific content and remain banned.

OUTPUT FORMAT

Return only the email body, ending with the "Thank you." closing line described above.

Do not include:

Subject lines (unless specifically requested)
Notes
Explanations
Reasoning
Comments
Introductions such as "Here's a draft"

The output must be ready to send without editing.

Do NOT include a sign-off like "Warm regards" or your name — that is added automatically after the "Thank you." line.

FINAL HUMAN WRITING TEST

Before returning the email, verify:

It sounds like it was written by an experienced procurement manager.

It has one clear procurement objective.

It moves the supplier only one stage forward.

It responds only to information requiring a response.

It does not summarise or repeat the supplier's email.

It avoids unnecessary acknowledgements and filler.

Every question has a clear procurement purpose.

It requests documents instead of asking unnecessary questions where appropriate.

It contains no fabricated, inferred or assumed information.

It is concise and easy to scan.

Bullet points are used where they improve readability.

The recipient can understand the required action in under one minute.

It ends with one clear procurement action.

It ends with a standalone "Thank you." line as the last line of the body.

If any of these checks fail, rewrite the email before returning it.`;

  const userPrompt = `=== SUPPLIER PROFILE ===
Company: ${supplier.company}
Country: ${supplier.country ?? "Not specified"}
Contact Person: ${supplier.contactPerson ?? "Not specified"}
Product / Category: ${supplier.product ?? supplier.productCategory ?? "General sourcing"}
Supplier Type: ${supplier.supplierType ?? "Not specified"}
Certifications: ${supplier.certifications ?? "Not specified"}
Internal Notes: ${supplier.notes ?? "None"}

=== EMAIL THREAD HISTORY ===
${threadLines || "(No prior thread)"}

=== LATEST MESSAGE FROM SUPPLIER (RESPOND TO THIS) ===
FROM: ${targetReply.fromName ?? targetReply.fromEmail}
RECEIVED: ${new Date(targetReply.receivedAt).toLocaleString("en-GB")}
SUBJECT: ${targetReply.subject ?? "(no subject)"}

${htmlToPlain(targetReply.body)}
${additionalContext ? `\n=== ADDITIONAL CONTEXT PROVIDED BY YOUR TEAM ===\n${additionalContext}` : ""}

=== YOUR TASK ===
Review the full email thread above. Determine the supplier's current procurement stage. Draft the next email that moves the supplier one meaningful step forward, following all System Prompt instructions. Do not repeat information already provided and return only the email body.`;

  const response = await getGroq().chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 2048,
    temperature: 0.7,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = (response.choices[0]?.message?.content ?? "").trim();

  if (raw.startsWith("CLARIFICATION_NEEDED:")) {
    const lines = raw
      .replace("CLARIFICATION_NEEDED:", "")
      .split("\n")
      .map((l: string) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
    return { clarificationsNeeded: lines };
  }

  const subject = `Re: ${targetReply.subject ?? "Your Inquiry"}`;
  const body = raw;

  return { subject, body };
}

// ── Bounce / NDR exclusion filter ────────────────────────────────────────────

const BOUNCE_EXCLUSION = {
  NOT: {
    OR: [
      { subject: { contains: "delivery status notification", mode: "insensitive" as const } },
      { subject: { contains: "delivery failed",              mode: "insensitive" as const } },
      { subject: { contains: "delivery failure",             mode: "insensitive" as const } },
      { subject: { contains: "undeliverable",                mode: "insensitive" as const } },
      { subject: { contains: "mail delivery failed",         mode: "insensitive" as const } },
      { subject: { contains: "failure notice",               mode: "insensitive" as const } },
      { subject: { contains: "returned mail",                mode: "insensitive" as const } },
      { subject: { contains: "address not found",            mode: "insensitive" as const } },
      { subject: { contains: "message not delivered",        mode: "insensitive" as const } },
      { subject: { contains: "out of office",                mode: "insensitive" as const } },
      { subject: { contains: "automatic reply",              mode: "insensitive" as const } },
      { subject: { contains: "auto-reply",                   mode: "insensitive" as const } },
      { subject: { contains: "auto reply",                   mode: "insensitive" as const } },
      { fromEmail: { contains: "mailer-daemon",  mode: "insensitive" as const } },
      { fromEmail: { contains: "postmaster",     mode: "insensitive" as const } },
      { fromEmail: { contains: "bounce",         mode: "insensitive" as const } },
      { fromEmail: { contains: "noreply",        mode: "insensitive" as const } },
      { fromEmail: { contains: "no-reply",       mode: "insensitive" as const } },
      { fromEmail: { contains: "donotreply",     mode: "insensitive" as const } },
      { body: { contains: "automatically generated delivery status",         mode: "insensitive" as const } },
      { body: { contains: "delivery status notification",                    mode: "insensitive" as const } },
      { body: { contains: "failed permanently",                              mode: "insensitive" as const } },
      { body: { contains: "mailbox unavailable",                             mode: "insensitive" as const } },
      { body: { contains: "this is an automatically generated",              mode: "insensitive" as const } },
      { body: { contains: "permanent failure",                               mode: "insensitive" as const } },
      { body: { contains: "550 ",                                            mode: "insensitive" as const } },
      { body: { contains: "address not found",                               mode: "insensitive" as const } },
      { body: { contains: "message wasn't delivered",                        mode: "insensitive" as const } },
    ],
  },
};

const HUMAN_REPLY_FILTER = { direction: "received", ...BOUNCE_EXCLUSION };

// ── Compose attachment upload ──────────────────────────────────────────────────

const composeAttachmentStorage = multerS3({
  s3,
  bucket: S3_BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req: any, file: Express.Multer.File, cb: (err: Error | null, key: string) => void) => {
    const { entityType, entityId } = req.params;
    cb(null, buildS3Key(`outbound-email-attachments/suppliers/${entityType}/${entityId}`, file.originalname));
  },
});

export const uploadComposeAttachmentMiddleware = multer({
  storage: composeAttachmentStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

export async function uploadComposeAttachment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const file = req.file as any;
    if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }
    res.json({
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      s3Key: file.key,
      url: s3FileUrl(file.key),
    });
  } catch (err) {
    console.error("[aiSupplierComms] uploadComposeAttachment error:", err);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/ai-supplier-comms/inbox?account=<email>
 * Merges sourcing / new / signed-contract suppliers into one inbox, each
 * item tagged with entityType + label so the UI can show which category it's from.
 */
export async function getInbox(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { account } = req.query as { account?: string };

    const where: any = { isArchived: false };
    if (account && account !== "all") {
      where.assignedGmailAccount = account;
    } else {
      where.assignedGmailAccount = { in: SUPPLIER_COMMS_ACCOUNTS };
    }

    const perEntity = await Promise.all(
      (Object.keys(ENTITY_CONFIG) as EntityKind[]).map(async (entityType) => {
        const config = ENTITY_CONFIG[entityType];
        const rows = await (prisma as any)[config.model].findMany({
          where: {
            ...where,
            emailReplies: { some: HUMAN_REPLY_FILTER },
          },
          include: {
            emailReplies: {
              where: BOUNCE_EXCLUSION,
              orderBy: { receivedAt: "desc" },
              include: { attachments: true },
            },
            emailCampaign: true,
          },
          orderBy: { updatedAt: "desc" },
        });

        return rows.map((s: any) => {
          const allReplies = s.emailReplies as any[]; // both directions, newest first
          const latestOverall = allReplies[0];
          const latestReply = allReplies.find((r: any) => r.direction === "received");
          // Only "needs reply" if the truly latest message in the thread is inbound —
          // if we've since sent a reply (via this tool or any other channel), it's answered
          // until the supplier writes back again.
          const needsReply = latestOverall?.direction === "received";
          const unrepliedCount = allReplies.filter((r: any) => r.direction === "received" && !r.repliedAt).length;
          return {
            id: s.id,
            entityType,
            label: config.label,
            company: s.company,
            contactPerson: s.contactPerson,
            email: s.email,
            country: s.country,
            product: s.product ?? s.productCategory ?? s.products ?? null,
            assignedGmailAccount: s.assignedGmailAccount,
            // alreadyContacted only exists on sourcing suppliers today — other
            // entity types just never show as "already contacted" via this toggle.
            alreadyContacted: s.alreadyContacted ?? false,
            certifications: s.certifications,
            supplierType: s.supplierType,
            notes: s.notes,
            campaignStatus: s.emailCampaign?.status ?? "pending",
            latestReply: latestReply
              ? {
                  id: latestReply.id,
                  subject: latestReply.subject,
                  body: latestReply.body,
                  fromEmail: latestReply.fromEmail,
                  fromName: latestReply.fromName,
                  receivedAt: latestReply.receivedAt,
                  repliedAt: needsReply ? null : (latestOverall.receivedAt ?? latestReply.repliedAt),
                  attachmentCount: latestReply.attachments?.length ?? 0,
                }
              : null,
            unrepliedCount,
          };
        });
      }),
    );

    const merged = perEntity
      .flat()
      .filter((s: any) => s.latestReply)
      .sort((a: any, b: any) => new Date(b.latestReply.receivedAt).getTime() - new Date(a.latestReply.receivedAt).getTime());

    res.json(merged);
  } catch (err) {
    console.error("[aiSupplierComms] getInbox error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/ai-supplier-comms/:entityType/:entityId/thread
 */
export async function getThread(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { entityType, entityId } = req.params as { entityType: string; entityId: string };
    if (!isValidEntityType(entityType)) { res.status(400).json({ error: "Invalid entity type" }); return; }
    const config = ENTITY_CONFIG[entityType];

    const replies = await (prisma as any).supplierEmailReply.findMany({
      where: { [config.fkField]: entityId },
      orderBy: { receivedAt: "asc" },
      include: { attachments: true },
    });
    res.json(replies);
  } catch (err) {
    console.error("[aiSupplierComms] getThread error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/ai-supplier-comms/:entityType/:entityId/draft
 * Body: { replyId: string, additionalContext?: string }
 */
export async function draftReply(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { entityType, entityId } = req.params as { entityType: string; entityId: string };
    if (!isValidEntityType(entityType)) { res.status(400).json({ error: "Invalid entity type" }); return; }
    const config = ENTITY_CONFIG[entityType];
    const { replyId, additionalContext = "" } = req.body as { replyId: string; additionalContext?: string };

    const supplier = await (prisma as any)[config.model].findUnique({ where: { id: entityId } });
    if (!supplier) { res.status(404).json({ error: "Supplier not found" }); return; }

    const thread = await (prisma as any).supplierEmailReply.findMany({
      where: { [config.fkField]: entityId },
      orderBy: { receivedAt: "asc" },
    });

    const targetReply = await (prisma as any).supplierEmailReply.findUnique({ where: { id: replyId } });
    if (!targetReply) { res.status(404).json({ error: "Reply not found" }); return; }

    const result = await callGroqDraft(supplier, thread, targetReply, additionalContext);
    res.json(result);
  } catch (err) {
    console.error("[aiSupplierComms] draftReply error:", err);
    res.status(500).json({ error: "Failed to generate AI draft" });
  }
}

/**
 * POST /api/ai-supplier-comms/:entityType/:entityId/send
 * Body: { replyId: string, subject: string, body: string }
 */
export async function sendReply(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { entityType, entityId } = req.params as { entityType: string; entityId: string };
    if (!isValidEntityType(entityType)) { res.status(400).json({ error: "Invalid entity type" }); return; }
    const config = ENTITY_CONFIG[entityType];
    const { replyId, subject, body, attachments } = req.body as {
      replyId: string;
      subject: string;
      body: string;
      attachments?: { filename: string; mimeType?: string; size?: number; s3Key?: string; url: string }[];
    };

    if (!subject?.trim() || !body?.trim()) {
      res.status(400).json({ error: "Subject and body are required" });
      return;
    }

    const supplier = await (prisma as any)[config.model].findUnique({ where: { id: entityId } });
    if (!supplier || !supplier.email) { res.status(404).json({ error: "Supplier not found or has no email" }); return; }

    const campaign = await (prisma as any)[config.campaignModel].findUnique({ where: { [config.campaignFk]: entityId } });
    // Cold contacts (e.g. a New/Signed supplier who emailed in before we ever
    // emailed them) may have no campaign row at all — fall back to the target
    // reply's own gmailMessageId so we can still thread the reply via In-Reply-To.
    const targetReplyRow = await (prisma as any).supplierEmailReply.findUnique({ where: { id: replyId } });

    const fromEmail = supplier.assignedGmailAccount;
    if (!fromEmail) { res.status(400).json({ error: "No Gmail account assigned to this supplier" }); return; }

    const sig = await fetchDefaultSignatureForAccount(fromEmail);
    const html = buildReplyHtml(body, sig, fromEmail);

    const knownGmailMessageId = campaign?.gmailMessageId ?? targetReplyRow?.gmailMessageId ?? null;
    let smtpMessageId: string | null = null;
    if (knownGmailMessageId) {
      smtpMessageId = await getSmtpMessageId(fromEmail, knownGmailMessageId);
    }

    let emailAttachments: EmailAttachment[] | undefined;
    if (attachments?.length) {
      emailAttachments = await Promise.all(
        attachments.map(async (a) => {
          const response = await fetch(a.url);
          if (!response.ok) throw new Error(`Failed to fetch attachment "${a.filename}": HTTP ${response.status}`);
          const content = Buffer.from(await response.arrayBuffer());
          return { filename: a.filename, mimeType: a.mimeType || "application/octet-stream", content };
        }),
      );
    }

    const { messageId, threadId } = await sendGmailEmail({
      fromEmail,
      to: supplier.email.split(";").map((e: string) => e.trim()).filter(Boolean).join(", "),
      subject: subject.trim(),
      html,
      threadId: campaign?.gmailThreadId ?? undefined,
      inReplyTo: smtpMessageId ?? undefined,
      references: smtpMessageId ?? undefined,
      attachments: emailAttachments,
    });

    const now = new Date();

    const sentReply = await (prisma as any).supplierEmailReply.create({
      data: {
        [config.fkField]: entityId,
        gmailMessageId: messageId,
        direction: "sent",
        fromEmail,
        subject: subject.trim(),
        body: htmlToPlain(html),
        bodyHtml: html,
        receivedAt: now,
      },
    });

    if (attachments?.length) {
      await (prisma as any).supplierEmailAttachment.createMany({
        data: attachments.map((a) => ({
          replyId: sentReply.id,
          filename: a.filename,
          mimeType: a.mimeType ?? null,
          size: a.size ?? null,
          s3Key: a.s3Key ?? "",
          url: a.url,
        })),
        skipDuplicates: true,
      });
    }

    await (prisma as any).supplierEmailReply.update({
      where: { id: replyId },
      data: { repliedAt: now },
    });

    if (campaign && threadId && !campaign.gmailThreadId) {
      await (prisma as any)[config.campaignModel].update({
        where: { [config.campaignFk]: entityId },
        data: { gmailThreadId: threadId },
      });
    }

    res.json({ success: true, messageId, threadId });
  } catch (err) {
    console.error("[aiSupplierComms] sendReply error:", err);
    const msg = err instanceof Error ? err.message : "Failed to send reply";
    res.status(500).json({ error: msg });
  }
}

/**
 * PATCH /api/ai-supplier-comms/:entityType/:entityId/contacted
 * alreadyContacted only exists on sourcing suppliers today.
 */
export async function toggleContacted(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { entityType, entityId } = req.params as { entityType: string; entityId: string };
    if (!isValidEntityType(entityType)) { res.status(400).json({ error: "Invalid entity type" }); return; }
    if (entityType !== "sourcing") {
      res.status(400).json({ error: "Marking contacted is only supported for sourcing suppliers" });
      return;
    }
    const { alreadyContacted } = req.body as { alreadyContacted: boolean };
    const updated = await (prisma as any).sourcingSupplier.update({
      where: { id: entityId },
      data: { alreadyContacted: Boolean(alreadyContacted) },
      select: { id: true, alreadyContacted: true },
    });
    res.json(updated);
  } catch (err) {
    console.error("[aiSupplierComms] toggleContacted error:", err);
    res.status(500).json({ error: "Failed to update contacted status" });
  }
}
