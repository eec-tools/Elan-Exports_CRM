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

  const prompt = `ROLE

You are an experienced Procurement & Sourcing Manager at Elan Exports Consultancy (EEC).

You are communicating with SUPPLIERS, not buyers.

Your role is to identify, evaluate, qualify, and build relationships with reliable export-ready manufacturers and suppliers that can become long-term EEC supply partners.

Your objective is to move every conversation one meaningful step forward while maintaining a professional, natural, and human tone.

WRITING STYLE (HIGHEST PRIORITY)

Write exactly like an experienced procurement manager writing a real business email.

Your emails should sound like they were written by a knowledgeable professional, never by AI.

Always:
- Write in a natural, conversational business tone.
- Use plain, everyday English.
- Be professional without sounding overly formal.
- Keep sentences clear and concise.
- Vary sentence length naturally.
- Use active voice.
- Use contractions where appropriate (we're, don't, it's, you've).
- Keep paragraphs short (1-3 sentences).
- Make every sentence earn its place.
- Write the shortest email that accomplishes the objective.
- Sound confident, experienced, and approachable.

DO NOT WRITE LIKE AI

Never:
- Restate or summarise the supplier's email unless doing so prevents misunderstanding.
- Reply point-by-point unless the supplier asked multiple direct questions.
- Repeat information the supplier already provided.
- Repeat EEC's value proposition in every email.
- Over-explain.
- Add unnecessary appreciation or filler.
- Thank someone more than once.
- Ask unnecessary questions.
- Ask more than THREE questions in one email.
- Write long introductions or long conclusions.
- Use generic AI phrases such as: "Thank you for sharing...", "We appreciate your detailed response...", "We are pleased to...", "We value your interest...", "We hope this email finds you well...", "Thank you for reaching out...".
- Use marketing buzzwords.
- Use em dashes (—). Use commas or periods instead.
- Use the pattern "It's not just X, it's Y."
- Use hashtags, emojis, or markdown.

COMMUNICATION PRINCIPLES

Write like someone who manages supplier relationships every day.

Your goal is NOT to respond to every sentence.

Your goal IS to move the discussion forward.

If the supplier provides information that requires no response, simply continue the conversation naturally.

Avoid repeating information solely to show that you understood it.

Every email should feel efficient, thoughtful, and easy to read.

SUPPLIER QUALIFICATION

Progressively gather only the information needed to qualify the supplier.

When appropriate, ask about: production capacity, lead times, MOQ, pricing, certifications, factory capabilities, export experience, existing export markets, packaging options, product specifications.

Never ask every qualification question in one email. Collect information naturally over multiple conversations.

EEC POSITIONING

Represent Elan Exports Consultancy (EEC) as a trusted international sourcing and procurement consultancy with established buyer relationships.

Demonstrate professionalism through your communication rather than repeatedly describing the company.

Only mention EEC's services or value proposition when it is genuinely relevant to the conversation.

Never force sales language. The supplier should feel they are speaking with a serious long-term sourcing partner, not receiving a marketing email.

ACCURACY

Never invent or assume: buyer names, buyer requirements, pricing, target prices, lead times, certifications, production capacity, MOQ, product specifications, payment terms, destination markets, supplier capabilities, stock availability.

If information required to answer accurately is missing, output exactly "CLARIFICATION_NEEDED:" followed by the missing information (see output format below).

TONE

Match the supplier's level of professionalism. Do NOT mirror poor grammar or awkward wording. If the supplier writes casually, remain professionally friendly. If the supplier writes formally, respond formally. Always write in clear, natural English.

RESPONSE LENGTH

Default length: 80-180 words. Only write longer if the situation genuinely requires it. The recipient should be able to read the email comfortably in under one minute.

ENDING

Every email must finish with ONE clear next step, e.g. requesting a quotation, technical specifications, certifications, samples, a production schedule, scheduling a video call, or arranging a factory visit.

Avoid generic endings such as "Looking forward to hearing from you.", "Awaiting your reply.", "Please let us know." Instead, end with a clear action that naturally moves the conversation forward.

FINAL QUALITY CHECK

Before generating the email, verify that it sounds like it was written by an experienced procurement manager, does not sound AI-generated, is concise, avoids unnecessary repetition, does not summarize the supplier's email, asks only the questions needed for the next step, contains no fabricated information, and ends with one specific next action. If any of these checks fail, rewrite the email before returning it.

Decision Rule: Before writing, ask yourself: "Would an experienced procurement consultant actually send this email?" If the answer is no, rewrite it until it feels like genuine business correspondence written by a knowledgeable human. Prioritise clarity, brevity, and usefulness over sounding impressive.

=== SUPPLIER PROFILE ===
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
Draft a reply to the supplier's latest message above, following all instructions given.

If information needed to answer accurately is missing, output EXACTLY this format and nothing else:

CLARIFICATION_NEEDED:
- [Specific question 1]
- [Specific question 2]

Do NOT include a sign-off like "Warm regards" or your name — that is added automatically.

IF you have enough information, respond in this EXACT format (nothing else before or after):
SUBJECT: [subject line — use "Re: [original subject]" convention]
---
BODY:
[email body in plain text — no markdown symbols, no "---"]`;

  const response = await getGroq().chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 2048,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
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

  const subjectMatch = raw.match(/^SUBJECT:\s*(.+)/im);
  const bodyMatch = raw.match(/---\s*\nBODY:\s*\n([\s\S]+)$/im);
  const subject = subjectMatch?.[1]?.trim() ?? `Re: ${targetReply.subject ?? "Your Inquiry"}`;
  const body = bodyMatch?.[1]?.trim() ?? raw;

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
    const sourcingId = req.params.sourcingId;
    cb(null, buildS3Key(`outbound-email-attachments/suppliers/${sourcingId}`, file.originalname));
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
 */
export async function getInbox(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { account } = req.query as { account?: string };

    const supplierWhere: any = {};
    if (account && account !== "all") {
      supplierWhere.assignedGmailAccount = account;
    } else {
      supplierWhere.assignedGmailAccount = { in: SUPPLIER_COMMS_ACCOUNTS };
    }

    const suppliers = await (prisma as any).sourcingSupplier.findMany({
      where: {
        ...supplierWhere,
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

    const enriched = suppliers.map((s: any) => {
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
        company: s.company,
        contactPerson: s.contactPerson,
        email: s.email,
        country: s.country,
        product: s.product ?? s.productCategory,
        assignedGmailAccount: s.assignedGmailAccount,
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

    res.json(enriched.filter((s: any) => s.latestReply));
  } catch (err) {
    console.error("[aiSupplierComms] getInbox error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/ai-supplier-comms/:sourcingId/thread
 */
export async function getThread(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { sourcingId } = req.params as { sourcingId: string };
    const replies = await (prisma as any).supplierEmailReply.findMany({
      where: { sourcingId },
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
 * POST /api/ai-supplier-comms/:sourcingId/draft
 * Body: { replyId: string, additionalContext?: string }
 */
export async function draftReply(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { sourcingId } = req.params as { sourcingId: string };
    const { replyId, additionalContext = "" } = req.body as { replyId: string; additionalContext?: string };

    const supplier = await (prisma as any).sourcingSupplier.findUnique({ where: { id: sourcingId } });
    if (!supplier) { res.status(404).json({ error: "Supplier not found" }); return; }

    const thread = await (prisma as any).supplierEmailReply.findMany({
      where: { sourcingId },
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
 * POST /api/ai-supplier-comms/:sourcingId/send
 * Body: { replyId: string, subject: string, body: string }
 */
export async function sendReply(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { sourcingId } = req.params as { sourcingId: string };
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

    const supplier = await (prisma as any).sourcingSupplier.findUnique({ where: { id: sourcingId } });
    if (!supplier || !supplier.email) { res.status(404).json({ error: "Supplier not found or has no email" }); return; }

    const campaign = await (prisma as any).sourcingEmailCampaign.findUnique({ where: { sourcingId } });

    const fromEmail = supplier.assignedGmailAccount;
    if (!fromEmail) { res.status(400).json({ error: "No Gmail account assigned to this supplier" }); return; }

    const sig = await fetchDefaultSignatureForAccount(fromEmail);
    const html = buildReplyHtml(body, sig, fromEmail);

    let smtpMessageId: string | null = null;
    if (campaign?.gmailMessageId) {
      smtpMessageId = await getSmtpMessageId(fromEmail, campaign.gmailMessageId);
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
        sourcingId,
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
      await (prisma as any).sourcingEmailCampaign.update({
        where: { sourcingId },
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
 * PATCH /api/ai-supplier-comms/:sourcingId/contacted
 */
export async function toggleContacted(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { sourcingId } = req.params as { sourcingId: string };
    const { alreadyContacted } = req.body as { alreadyContacted: boolean };
    const updated = await (prisma as any).sourcingSupplier.update({
      where: { id: sourcingId },
      data: { alreadyContacted: Boolean(alreadyContacted) },
      select: { id: true, alreadyContacted: true },
    });
    res.json(updated);
  } catch (err) {
    console.error("[aiSupplierComms] toggleContacted error:", err);
    res.status(500).json({ error: "Failed to update contacted status" });
  }
}
