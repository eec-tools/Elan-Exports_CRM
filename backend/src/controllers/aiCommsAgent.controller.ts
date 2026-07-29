import { Response } from "express";
import Groq from "groq-sdk";
import multer from "multer";
import multerS3 from "multer-s3";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { sendGmailEmail, getSmtpMessageId, EmailAttachment } from "../services/gmailService.js";
import { fetchDefaultSignatureForAccount } from "./emailSignatures.controller.js";
import { BUYER_GMAIL_ACCOUNT } from "./sourcingBuyers.controller.js";
import { s3, S3_BUCKET, s3FileUrl, buildS3Key } from "../lib/s3.js";

// ── Known Gmail account tabs ──────────────────────────────────────────────────
export const COMMS_ACCOUNTS = [
  "partners@eectrade.com",
  "procurement1@eectrade.com",
  "procurement2@eectrade.com",
];

// ── Groq client ───────────────────────────────────────────────────────────────
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
function normalizeLinkUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.includes("@")) return `mailto:${url}`;
  return `https://${url}`;
}

function buildReplyHtml(bodyText: string, sig: { name: string; role: string; company: string; tagline: string; links: Array<{ label: string; url: string }> } | null, fromEmail: string): string {
  const paragraphs = bodyText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");

  let sigHtml = "";
  if (sig) {
    const linksHtml = sig.links
      .map((l) => `<a href="${normalizeLinkUrl(l.url)}" style="color:#2563eb;text-decoration:none;margin-right:12px;">${l.label}</a>`)
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
  buyer: { company: string; contactPerson?: string | null; product?: string | null; country?: string | null },
  vaultContact: { keyPainPoints?: string | null; emailTemplate?: string | null; personalizationQuality?: string | null } | null,
  thread: Array<{ direction: string; fromEmail: string; fromName?: string | null; subject?: string | null; body: string; receivedAt: Date }>,
  targetReply: { subject?: string | null; body: string; fromEmail: string; fromName?: string | null; receivedAt: Date },
  additionalContext: string,
): Promise<{ subject: string; body: string } | { clarificationsNeeded: string[] }> {
  const threadLines = thread
    .map((m) => {
      const dir = m.direction === "sent" ? `YOU → ${buyer.company}` : `${buyer.company} → YOU`;
      return `[${dir} | ${new Date(m.receivedAt).toLocaleString("en-GB")}]\nSubject: ${m.subject ?? "(no subject)"}\n${htmlToPlain(m.body)}\n`;
    })
    .join("\n---\n");

  const prompt = `ROLE

You are a Senior International Procurement & Sourcing Consultant at Elan Exports Consultancy (EEC).

You are communicating with BUYERS, not suppliers.

Your role is to understand the buyer's sourcing requirements, reduce procurement complexity, identify suitable suppliers, and build long-term business relationships based on trust, responsiveness, and reliability.

Your objective is to move every conversation one meaningful step forward while positioning EEC as a dependable sourcing partner.

WRITING STYLE (HIGHEST PRIORITY)

Write exactly like an experienced international procurement consultant writing a real business email.

Your emails should sound natural, knowledgeable and professional, never AI-generated.

Always:
- Write in clear, conversational business English.
- Use plain language.
- Be confident without sounding promotional.
- Keep sentences concise.
- Vary sentence length naturally.
- Use active voice.
- Use contractions where appropriate (we're, don't, it's, you'll).
- Keep paragraphs short (1-3 sentences).
- Write only what is necessary.
- Make every sentence useful.
- Write like someone who manages international sourcing projects every day.

DO NOT WRITE LIKE AI

Never:
- Restate or summarize the buyer's email unless clarification is needed.
- Reply point-by-point unless the buyer asked multiple direct questions.
- Repeat information the buyer already knows.
- Repeat EEC's value proposition in every email.
- Over-explain.
- Add unnecessary appreciation.
- Thank someone more than once.
- Write long introductions.
- Write long conclusions.
- Use generic AI phrases such as: "Thank you for sharing...", "We appreciate your detailed inquiry...", "We are pleased to...", "We value your interest...", "We hope this email finds you well...", "Thank you for reaching out...".
- Use marketing buzzwords.
- Use em dashes (—).
- Use the pattern "It's not just X, it's Y."
- Use hashtags, emojis or markdown.

COMMUNICATION PRINCIPLES

Write like a trusted sourcing advisor. Do not try to "sell" EEC.

Instead, demonstrate expertise by asking thoughtful questions, providing practical guidance, and making procurement feel simple.

Focus on solving the buyer's problem. Every email should move the sourcing process forward.

BUYER DISCOVERY

When appropriate, gradually gather information such as: product specifications, required quantities, target pricing, destination country, delivery timeline, certifications, packaging requirements, preferred Incoterms, compliance requirements, quality expectations, existing sourcing challenges.

Only ask questions that are needed now. Never ask more than THREE questions in one email. Never overwhelm the buyer.

EEC POSITIONING

Represent Elan Exports Consultancy as a trusted international sourcing and procurement consultancy.

Position EEC as: responsive, knowledgeable, transparent, commercially aware, detail-oriented, easy to work with.

Avoid repeatedly describing EEC's services. Demonstrate EEC's value through professionalism and practical guidance rather than sales language. Never sound like a marketing brochure.

ACCURACY

Never invent or assume: supplier names, supplier availability, pricing, production capacity, lead times, certifications, factory capabilities, buyer requirements, stock availability, product specifications, shipping costs, Incoterms, payment terms.

If information required to answer accurately is missing, output exactly "CLARIFICATION_NEEDED:" followed by the missing information (see output format below).

TONE

Mirror the buyer's level of professionalism. If they write casually, remain professionally friendly. If they write formally, respond formally. Never imitate poor grammar. Always write in clear, natural English.

RESPONSE LENGTH

Default length: 80-180 words. Only write longer when genuinely necessary. Every email should be readable in under one minute.

WHEN TO EDUCATE

If the buyer appears unfamiliar with sourcing, procurement or international trade, briefly explain only what helps them make the next decision. Keep explanations practical. Never lecture.

PROBLEM SOLVING

Whenever appropriate: reduce uncertainty, suggest practical next steps, highlight risks only when relevant, offer solutions rather than generic reassurance. Think like a procurement consultant, not a salesperson.

ENDING

Every email must finish with ONE clear next step, e.g. confirming product specifications, requesting technical drawings, requesting target pricing, scheduling a discovery call, reviewing samples, discussing supplier options, confirming project timelines.

Avoid endings such as "Looking forward to hearing from you.", "Awaiting your reply.", "Please let us know." Instead, finish with a clear action that naturally advances the project.

FINAL QUALITY CHECK

Before generating the email, verify that it sounds like it was written by an experienced international procurement consultant, does not sound AI-generated, is concise, avoids repetition, does not summarize the buyer's email, only asks the questions needed for the next step, contains no fabricated information, positions EEC naturally through professionalism rather than sales language, and ends with one clear next action. If any check fails, rewrite the email before returning it.

Decision Rule: Before writing, ask yourself: "Would an experienced procurement consultant actually send this email?" If the answer is no, rewrite it until it feels like genuine business correspondence written by a knowledgeable human. Prioritise clarity, brevity, and usefulness over sounding impressive.

=== BUYER PROFILE ===
Company: ${buyer.company}
Country: ${buyer.country ?? "Not specified"}
Contact Person: ${buyer.contactPerson ?? "Not specified"}
Product Interest: ${buyer.product ?? "General sourcing"}
Key Pain Points: ${vaultContact?.keyPainPoints ?? "Not specified"}
Personalization Notes: ${vaultContact?.personalizationQuality ?? "Standard"}
${vaultContact?.emailTemplate ? `\nOriginal Outreach Template Used:\n${vaultContact.emailTemplate}` : ""}

=== EMAIL THREAD HISTORY ===
${threadLines || "(No prior thread)"}

=== LATEST MESSAGE FROM BUYER (RESPOND TO THIS) ===
FROM: ${targetReply.fromName ?? targetReply.fromEmail}
RECEIVED: ${new Date(targetReply.receivedAt).toLocaleString("en-GB")}
SUBJECT: ${targetReply.subject ?? "(no subject)"}

${htmlToPlain(targetReply.body)}
${additionalContext ? `\n=== ADDITIONAL CONTEXT PROVIDED BY YOUR TEAM ===\n${additionalContext}` : ""}

=== YOUR TASK ===
Draft a reply to the buyer's latest message above, following all instructions given.

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

  const groq = getGroq();
  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 2048,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (response.choices[0]?.message?.content ?? "").trim();

  // Check if clarifications are needed
  if (raw.startsWith("CLARIFICATION_NEEDED:")) {
    const lines = raw
      .replace("CLARIFICATION_NEEDED:", "")
      .split("\n")
      .map((l: string) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
    return { clarificationsNeeded: lines };
  }

  // Parse SUBJECT and BODY
  const subjectMatch = raw.match(/^SUBJECT:\s*(.+)/im);
  const bodyMatch = raw.match(/---\s*\nBODY:\s*\n([\s\S]+)$/im);

  const subject = subjectMatch?.[1]?.trim() ?? `Re: ${targetReply.subject ?? "Your Inquiry"}`;
  const body = bodyMatch?.[1]?.trim() ?? raw;

  return { subject, body };
}

// ─────────────────────────────────────────────────────────────────────────────

// Prisma filter that excludes bounce, NDR, and auto-reply messages
const BOUNCE_EXCLUSION = {
  NOT: {
    OR: [
      // Delivery-failure subjects
      { subject: { contains: "delivery status notification", mode: "insensitive" as const } },
      { subject: { contains: "delivery failed",              mode: "insensitive" as const } },
      { subject: { contains: "delivery failure",             mode: "insensitive" as const } },
      { subject: { contains: "undeliverable",                mode: "insensitive" as const } },
      { subject: { contains: "mail delivery failed",         mode: "insensitive" as const } },
      { subject: { contains: "failure notice",               mode: "insensitive" as const } },
      { subject: { contains: "returned mail",                mode: "insensitive" as const } },
      { subject: { contains: "address not found",            mode: "insensitive" as const } },
      { subject: { contains: "message not delivered",        mode: "insensitive" as const } },
      // Auto-reply subjects
      { subject: { contains: "out of office",    mode: "insensitive" as const } },
      { subject: { contains: "automatic reply",  mode: "insensitive" as const } },
      { subject: { contains: "auto-reply",       mode: "insensitive" as const } },
      { subject: { contains: "auto reply",       mode: "insensitive" as const } },
      // System senders
      { fromEmail: { contains: "mailer-daemon",  mode: "insensitive" as const } },
      { fromEmail: { contains: "postmaster",     mode: "insensitive" as const } },
      { fromEmail: { contains: "bounce",         mode: "insensitive" as const } },
      { fromEmail: { contains: "noreply",        mode: "insensitive" as const } },
      { fromEmail: { contains: "no-reply",       mode: "insensitive" as const } },
      { fromEmail: { contains: "donotreply",     mode: "insensitive" as const } },
      // Body tells (NDR body text)
      { body: { contains: "address not found",                               mode: "insensitive" as const } },
      { body: { contains: "address couldn't be found",                       mode: "insensitive" as const } },
      { body: { contains: "message wasn't delivered",                        mode: "insensitive" as const } },
      { body: { contains: "couldn't be found or is unable to receive",       mode: "insensitive" as const } },
      { body: { contains: "automatically generated delivery status",         mode: "insensitive" as const } },
      { body: { contains: "delivery status notification",                    mode: "insensitive" as const } },
      { body: { contains: "failed permanently",                              mode: "insensitive" as const } },
      { body: { contains: "mailbox unavailable",                             mode: "insensitive" as const } },
      { body: { contains: "this is an automatically generated",              mode: "insensitive" as const } },
      { body: { contains: "permanent failure",                               mode: "insensitive" as const } },
      { body: { contains: "550 ",                                            mode: "insensitive" as const } },
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
    const sourcingBuyerId = req.params.sourcingBuyerId;
    cb(null, buildS3Key(`outbound-email-attachments/buyers/${sourcingBuyerId}`, file.originalname));
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
    console.error("[aiComms] uploadComposeAttachment error:", err);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
}

/**
 * GET /api/ai-comms/inbox?account=<email>
 * Returns received messages grouped — each item includes buyer + latest received reply.
 */
export async function getInbox(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { account } = req.query as { account?: string };

    const buyerWhere: any = {};
    if (account && account !== "all") {
      buyerWhere.assignedGmailAccount = account;
    } else {
      buyerWhere.assignedGmailAccount = { in: COMMS_ACCOUNTS };
    }

    // Only include buyers that have at least one genuine human reply
    const buyers = await (prisma as any).sourcingBuyer.findMany({
      where: {
        ...buyerWhere,
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

    // Enrich with vault contact data
    const enriched = await Promise.all(
      buyers.map(async (b: any) => {
        let vaultContact = null;
        if (b.buyerVaultContactId) {
          vaultContact = await (prisma as any).buyerVaultContact.findUnique({
            where: { id: b.buyerVaultContactId },
            select: { keyPainPoints: true, personalizationQuality: true, website: true, linkedin: true, country: true, product: true },
          });
        }

        const allReplies = b.emailReplies as any[]; // both directions, newest first
        const latestOverall = allReplies[0];
        // Find the latest received reply
        const latestReply = allReplies.find((r: any) => r.direction === "received");
        // Only "needs reply" if the truly latest message in the thread is inbound —
        // if we've since sent a reply (via this tool or any other channel), it's answered
        // until the buyer writes back again.
        const needsReply = latestOverall?.direction === "received";
        const unrepliedCount = allReplies.filter((r: any) => r.direction === "received" && !r.repliedAt).length;

        return {
          id: b.id,
          company: b.company,
          contactPerson: b.contactPerson,
          email: b.email,
          country: b.country ?? vaultContact?.country,
          product: b.product ?? vaultContact?.product,
          assignedGmailAccount: b.assignedGmailAccount ?? BUYER_GMAIL_ACCOUNT,
          alreadyContacted: b.alreadyContacted ?? false,
          campaignStatus: b.emailCampaign?.status ?? "pending",
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
          vaultContact,
        };
      }),
    );

    res.json(enriched.filter((b: any) => b.latestReply));
  } catch (err) {
    console.error("[aiComms] getInbox error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PATCH /api/ai-comms/:sourcingBuyerId/contacted
 * Toggles the alreadyContacted flag on a sourcing buyer.
 */
export async function toggleContacted(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { sourcingBuyerId } = req.params as { sourcingBuyerId: string };
    const { alreadyContacted } = req.body as { alreadyContacted: boolean };
    const updated = await (prisma as any).sourcingBuyer.update({
      where: { id: sourcingBuyerId },
      data: { alreadyContacted: Boolean(alreadyContacted) },
      select: { id: true, alreadyContacted: true },
    });
    res.json(updated);
  } catch (err) {
    console.error("[aiComms] toggleContacted error:", err);
    res.status(500).json({ error: "Failed to update contacted status" });
  }
}

/**
 * GET /api/ai-comms/:sourcingBuyerId/thread
 * Returns the full email thread for a buyer.
 */
export async function getThread(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { sourcingBuyerId } = req.params as { sourcingBuyerId: string };
    const replies = await (prisma as any).buyerEmailReply.findMany({
      where: { sourcingBuyerId },
      orderBy: { receivedAt: "asc" },
      include: { attachments: true },
    });
    res.json(replies);
  } catch (err) {
    console.error("[aiComms] getThread error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/ai-comms/:sourcingBuyerId/draft
 * AI drafts a reply to the latest received message.
 * Body: { replyId: string, additionalContext?: string }
 */
export async function draftReply(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { sourcingBuyerId } = req.params as { sourcingBuyerId: string };
    const { replyId, additionalContext = "" } = req.body as { replyId: string; additionalContext?: string };

    const buyer = await (prisma as any).sourcingBuyer.findUnique({ where: { id: sourcingBuyerId } });
    if (!buyer) { res.status(404).json({ error: "Buyer not found" }); return; }

    // Get vault contact for enriched context
    let vaultContact = null;
    if (buyer.buyerVaultContactId) {
      vaultContact = await (prisma as any).buyerVaultContact.findUnique({
        where: { id: buyer.buyerVaultContactId },
      });
    }

    // Full thread
    const thread = await (prisma as any).buyerEmailReply.findMany({
      where: { sourcingBuyerId },
      orderBy: { receivedAt: "asc" },
    });

    // Target reply to respond to
    const targetReply = await (prisma as any).buyerEmailReply.findUnique({ where: { id: replyId } });
    if (!targetReply) { res.status(404).json({ error: "Reply not found" }); return; }

    const result = await callGroqDraft(buyer, vaultContact, thread, targetReply, additionalContext);

    res.json(result);
  } catch (err) {
    console.error("[aiComms] draftReply error:", err);
    res.status(500).json({ error: "Failed to generate AI draft" });
  }
}

/**
 * POST /api/ai-comms/:sourcingBuyerId/send
 * Sends the (reviewed) draft reply via Gmail.
 * Body: { replyId: string, subject: string, body: string }
 */
export async function sendReply(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { sourcingBuyerId } = req.params as { sourcingBuyerId: string };
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

    const buyer = await (prisma as any).sourcingBuyer.findUnique({ where: { id: sourcingBuyerId } });
    if (!buyer || !buyer.email) { res.status(404).json({ error: "Buyer not found or has no email" }); return; }

    const campaign = await (prisma as any).sourcingBuyerEmailCampaign.findUnique({
      where: { sourcingBuyerId },
    });

    const fromEmail = buyer.assignedGmailAccount ?? BUYER_GMAIL_ACCOUNT;
    const sig = await fetchDefaultSignatureForAccount(fromEmail);
    const html = buildReplyHtml(body, sig, fromEmail);

    // Thread the reply if we have a thread ID
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
      to: buyer.email.split(";").map((e: string) => e.trim()).filter(Boolean).join(", "),
      subject: subject.trim(),
      html,
      threadId: campaign?.gmailThreadId ?? undefined,
      inReplyTo: smtpMessageId ?? undefined,
      references: smtpMessageId ?? undefined,
      attachments: emailAttachments,
    });

    const now = new Date();

    // Store sent reply in DB
    const sentReply = await (prisma as any).buyerEmailReply.create({
      data: {
        sourcingBuyerId,
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
      await (prisma as any).buyerEmailAttachment.createMany({
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

    // Mark the incoming reply as replied
    await (prisma as any).buyerEmailReply.update({
      where: { id: replyId },
      data: { repliedAt: now },
    });

    // Update campaign thread ID if changed (shouldn't be, but safe)
    if (campaign && threadId && !campaign.gmailThreadId) {
      await (prisma as any).sourcingBuyerEmailCampaign.update({
        where: { sourcingBuyerId },
        data: { gmailThreadId: threadId },
      });
    }

    res.json({ success: true, messageId, threadId });
  } catch (err) {
    console.error("[aiComms] sendReply error:", err);
    const msg = err instanceof Error ? err.message : "Failed to send reply";
    res.status(500).json({ error: msg });
  }
}
