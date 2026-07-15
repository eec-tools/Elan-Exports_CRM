import { Response } from "express";
import Groq from "groq-sdk";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { sendGmailEmail, getSmtpMessageId } from "../services/gmailService.js";
import { fetchDefaultSignatureForAccount } from "./emailSignatures.controller.js";

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

  const prompt = `You are an expert procurement and sourcing manager for Élan Exports & Consultancy (EEC), a premium sourcing intermediary headquartered in Singapore. EEC identifies and qualifies export-ready suppliers across South Asia, Southeast Asia, and Africa — then connects them with international buyers in Europe, the Middle East, and Asia. EEC handles commercial negotiations, quality oversight, compliance documentation, and end-to-end execution.

You are communicating with a SUPPLIER (not a buyer). Your goal is to evaluate their capability, build a professional relationship, and move towards onboarding them as a verified EEC supply partner.

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
Draft a professional, personalized reply to the supplier's latest message above.

STRICT RULES:
1. Mirror the supplier's TONE exactly — if they are formal, be formal; if they are brief and casual, match that.
2. Address EVERY question or point they raised. Do not skip anything.
3. Be warm, professional, and collaborative — you are evaluating them as a potential long-term supply partner, not just a vendor.
4. Position EEC as a serious, well-connected buyer with consistent volume requirements. Suppliers should feel this is a valuable partnership opportunity.
5. If they shared product details, acknowledge specifics and ask smart follow-up questions about capacity, lead times, pricing, certifications, or export experience as relevant.
6. If you need specific information you do NOT have (e.g. exact buyer requirements, target pricing, specific certification needs, destination market details) DO NOT GUESS OR FABRICATE ANYTHING. Instead output EXACTLY this format and nothing else:

CLARIFICATION_NEEDED:
- [Specific question 1]
- [Specific question 2]

7. No controversial topics, politics, or anything unprofessional.
8. Be concise and impactful. Quality over length.
9. End with a clear, specific next step (e.g. request a price sheet, product samples, certifications, a video call, factory visit scheduling, etc.)
10. Do NOT include a sign-off like "Warm regards" or your name — that is added automatically.

IF you have enough information, respond in this EXACT format (nothing else before or after):
SUBJECT: [subject line — use "Re: [original subject]" convention]
---
BODY:
[email body in plain text — professional paragraphs, no markdown symbols, no "---"]`;

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
          where: HUMAN_REPLY_FILTER,
          orderBy: { receivedAt: "desc" },
        },
        emailCampaign: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const enriched = suppliers.map((s: any) => {
      const latestReply = s.emailReplies[0];
      const unrepliedCount = s.emailReplies.filter((r: any) => !r.repliedAt).length;
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
              repliedAt: latestReply.repliedAt,
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
    const { replyId, subject, body } = req.body as { replyId: string; subject: string; body: string };

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

    const { messageId, threadId } = await sendGmailEmail({
      fromEmail,
      to: supplier.email.split(";").map((e: string) => e.trim()).filter(Boolean).join(", "),
      subject: subject.trim(),
      html,
      threadId: campaign?.gmailThreadId ?? undefined,
      inReplyTo: smtpMessageId ?? undefined,
      references: smtpMessageId ?? undefined,
    });

    const now = new Date();

    await (prisma as any).supplierEmailReply.create({
      data: {
        sourcingId,
        gmailMessageId: messageId,
        direction: "sent",
        fromEmail,
        subject: subject.trim(),
        body: htmlToPlain(html),
        receivedAt: now,
      },
    });

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
