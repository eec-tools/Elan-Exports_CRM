import { Response } from "express";
import Groq from "groq-sdk";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { sendGmailEmail, getSmtpMessageId } from "../services/gmailService.js";
import { fetchDefaultSignatureForAccount } from "./emailSignatures.controller.js";
import { BUYER_GMAIL_ACCOUNT } from "./sourcingBuyers.controller.js";

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
const GROQ_MODEL = "openai/gpt-oss-120b";

// ── HTML helpers ──────────────────────────────────────────────────────────────
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

  const prompt = `You are an expert B2B relationship manager for Élan Exports & Consultancy (EEC), a premium sourcing intermediary headquartered in Singapore. EEC connects international buyers with verified, export-ready suppliers across South Asia, Southeast Asia, and Africa — handling supplier identification, quality evaluation, compliance documentation, commercial negotiations, and end-to-end execution.

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
Draft a professional, personalized reply to the buyer's latest message above.

STRICT RULES:
1. Mirror the buyer's TONE exactly — if they are formal, be formal; if they are casual or brief, match that energy.
2. Address EVERY question or point they raised. Do not skip anything.
3. Be warm, genuinely helpful, and solution-oriented. Never pushy, salesy, or aggressive.
4. Weave in EEC's value proposition naturally — we remove complexity and risk from procurement.
5. If you need specific information you do NOT have (e.g. exact pricing, supplier names, lead times, certifications, MOQ details, stock availability) DO NOT GUESS OR FABRICATE ANYTHING. Instead output EXACTLY this format and nothing else:

CLARIFICATION_NEEDED:
- [Specific question 1]
- [Specific question 2]

6. No controversial topics, politics, or anything unprofessional.
7. Quality over quantity — be impactful and concise unless the buyer wrote a long detailed message.
8. End with a specific, clear next step (e.g. schedule a call, share product specs, etc.)
9. Do NOT include a sign-off like "Warm regards" or your name — that is added automatically.

IF you have enough information, respond in this EXACT format (nothing else before or after):
SUBJECT: [subject line — use "Re: [original subject]" convention]
---
BODY:
[email body in plain text — professional paragraphs, no markdown symbols, no "---"]`;

  const groq = getGroq();
  const response = await (groq.chat.completions.create as Function)({
    model: GROQ_MODEL,
    max_completion_tokens: 8192,
    temperature: 1,
    top_p: 1,
    reasoning_effort: "medium",
    stream: false,
    stop: null,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (response.choices[0]?.message?.content ?? "").trim();

  // Check if clarifications are needed
  if (raw.startsWith("CLARIFICATION_NEEDED:")) {
    const lines = raw
      .replace("CLARIFICATION_NEEDED:", "")
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
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

/**
 * GET /api/ai-comms/inbox?account=<email>
 * Returns received messages grouped — each item includes buyer + latest received reply.
 */
export async function getInbox(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { account } = req.query as { account?: string };

    // Build WHERE clause for account filter
    const buyerWhere: any = {};
    if (account && account !== "all") {
      buyerWhere.assignedGmailAccount = account;
    } else {
      buyerWhere.assignedGmailAccount = { in: COMMS_ACCOUNTS };
    }

    // Find all sourcing buyers with received replies that haven't been replied to
    const buyers = await (prisma as any).sourcingBuyer.findMany({
      where: {
        ...buyerWhere,
        emailReplies: {
          some: { direction: "received" },
        },
      },
      include: {
        emailReplies: {
          where: { direction: "received" },
          orderBy: { receivedAt: "desc" },
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

        // Find the latest received reply
        const latestReply = b.emailReplies[0];
        const unrepliedCount = b.emailReplies.filter((r: any) => !r.repliedAt).length;

        return {
          id: b.id,
          company: b.company,
          contactPerson: b.contactPerson,
          email: b.email,
          country: b.country ?? vaultContact?.country,
          product: b.product ?? vaultContact?.product,
          assignedGmailAccount: b.assignedGmailAccount ?? BUYER_GMAIL_ACCOUNT,
          campaignStatus: b.emailCampaign?.status ?? "pending",
          latestReply: latestReply
            ? {
                id: latestReply.id,
                subject: latestReply.subject,
                body: latestReply.body,
                fromEmail: latestReply.fromEmail,
                fromName: latestReply.fromName,
                receivedAt: latestReply.receivedAt,
                repliedAt: latestReply.repliedAt,
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
 * GET /api/ai-comms/:sourcingBuyerId/thread
 * Returns the full email thread for a buyer.
 */
export async function getThread(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { sourcingBuyerId } = req.params as { sourcingBuyerId: string };
    const replies = await (prisma as any).buyerEmailReply.findMany({
      where: { sourcingBuyerId },
      orderBy: { receivedAt: "asc" },
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
    const { replyId, subject, body } = req.body as { replyId: string; subject: string; body: string };

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

    const { messageId, threadId } = await sendGmailEmail({
      fromEmail,
      to: buyer.email.split(";").map((e: string) => e.trim()).filter(Boolean).join(", "),
      subject: subject.trim(),
      html,
      threadId: campaign?.gmailThreadId ?? undefined,
      inReplyTo: smtpMessageId ?? undefined,
      references: smtpMessageId ?? undefined,
    });

    const now = new Date();

    // Store sent reply in DB
    await (prisma as any).buyerEmailReply.create({
      data: {
        sourcingBuyerId,
        gmailMessageId: messageId,
        direction: "sent",
        fromEmail,
        subject: subject.trim(),
        body: htmlToPlain(html),
        receivedAt: now,
      },
    });

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
