import { google } from "googleapis";
import prisma from "../config/db.js";

const CLIENT_ID = process.env.GMAIL_CLIENT_ID!;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI!;

function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

async function getRefreshToken(email: string): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: `gmail_refresh_token_${email}` },
  });
  return setting?.value ?? null;
}

async function getAuthedClient(email: string) {
  const refreshToken = await getRefreshToken(email);
  if (!refreshToken) throw new Error(`No Gmail refresh token for ${email}. Connect the account first.`);
  const auth = getOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  mimeType: string;
}

function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    zip: "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}

export async function getGlobalEmailAttachment(): Promise<EmailAttachment | null> {
  const [urlSetting, nameSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "email_campaign_attachment_url" } }),
    prisma.appSetting.findUnique({ where: { key: "email_campaign_attachment_name" } }),
  ]);
  if (!urlSetting?.value) return null;
  try {
    const response = await fetch(urlSetting.value);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = Buffer.from(await response.arrayBuffer());
    const filename = nameSetting?.value ?? "attachment";
    return { filename, content, mimeType: getMimeTypeFromFilename(filename) };
  } catch (err) {
    console.error("[gmailService] Failed to fetch global attachment:", err);
    return null;
  }
}

function buildRawMessage(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  inReplyTo?: string;
  references?: string;
  attachments?: EmailAttachment[];
}): string {
  const { from, to, subject, html, inReplyTo, references, attachments } = params;

  const encodeHeader = (v: string) => `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`;
  const encodedBody = Buffer.from(html, "utf-8").toString("base64").match(/.{1,76}/g)!.join("\r\n");

  const baseHeaders: string[] = [
    `From: ${encodeHeader("Élan Exports")} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
  ];
  if (inReplyTo) baseHeaders.push(`In-Reply-To: ${inReplyTo}`);
  if (references) baseHeaders.push(`References: ${references}`);
  baseHeaders.push(`MIME-Version: 1.0`);

  if (!attachments?.length) {
    const lines = [
      ...baseHeaders,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      encodedBody,
    ];
    return Buffer.from(lines.join("\r\n")).toString("base64url");
  }

  // multipart/mixed — HTML body + one or more attachments
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [
    ...baseHeaders,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    encodedBody,
  ];

  for (const att of attachments) {
    const encodedAtt = att.content.toString("base64").match(/.{1,76}/g)!.join("\r\n");
    lines.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      ``,
      encodedAtt,
    );
  }

  lines.push(`--${boundary}--`);
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

function isRateLimitError(err: any): boolean {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  if (status === 429 || status === 403) return true;
  const msg: string = err?.message ?? "";
  return /rate limit|quota|userRateLimit/i.test(msg);
}

function extractRetryAfter(err: any): Date {
  const msg: string = err?.message ?? "";
  const match = msg.match(/retry after\s+(\S+)/i);
  if (match) {
    const d = new Date(match[1]);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(Date.now() + 10 * 60 * 1000);
}

const SEND_COOLDOWN_KEY = (email: string) => `gmail_send_rate_limit_until_${email}`;

async function checkSendCooldown(email: string): Promise<void> {
  const setting = await prisma.appSetting.findUnique({ where: { key: SEND_COOLDOWN_KEY(email) } });
  if (setting?.value) {
    const until = new Date(setting.value);
    if (until > new Date()) {
      throw new Error(`Gmail send rate-limit cooldown active for ${email} until ${until.toISOString()}. Please try after ${until.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST.`);
    }
  }
}

async function setSendCooldown(email: string, until: Date): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SEND_COOLDOWN_KEY(email) },
    update: { value: until.toISOString() },
    create: { key: SEND_COOLDOWN_KEY(email), value: until.toISOString() },
  });
}

export async function getSendCooldownUntil(email: string): Promise<Date | null> {
  const setting = await prisma.appSetting.findUnique({ where: { key: SEND_COOLDOWN_KEY(email) } });
  if (!setting?.value) return null;
  const d = new Date(setting.value);
  return d > new Date() ? d : null;
}

export async function sendGmailEmail(params: {
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: EmailAttachment[];
}): Promise<{ messageId: string; threadId: string }> {
  const { fromEmail, to, subject, html, threadId, inReplyTo, references, attachments } = params;

  await checkSendCooldown(fromEmail);

  const auth = await getAuthedClient(fromEmail);
  const gmail = google.gmail({ version: "v1", auth });

  const raw = buildRawMessage({ from: fromEmail, to, subject, html, inReplyTo, references, attachments });

  try {
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        ...(threadId ? { threadId } : {}),
      },
    });

    return {
      messageId: res.data.id ?? "",
      threadId: res.data.threadId ?? "",
    };
  } catch (err: any) {
    if (isRateLimitError(err)) {
      const until = extractRetryAfter(err);
      await setSendCooldown(fromEmail, until);
      console.warn(`[gmailService] Rate limit hit for ${fromEmail} — cooldown set until ${until.toISOString()}`);
      throw new Error(`Gmail rate limit exceeded for ${fromEmail}. Retry after ${until.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST.`);
    }
    const errMsg: string = err?.message ?? "";
    const errCode: string = err?.response?.data?.error ?? "";
    if (errMsg.includes("invalid_grant") || errCode === "invalid_grant") {
      throw new Error(`Gmail token expired for ${fromEmail}. Go to Settings → Gmail and click "Reconnect" for this account.`);
    }
    throw err;
  }
}

export async function getSmtpMessageId(accountEmail: string, gmailMessageId: string): Promise<string | null> {
  try {
    const auth = await getAuthedClient(accountEmail);
    const gmail = google.gmail({ version: "v1", auth });
    const res = await gmail.users.messages.get({
      userId: "me",
      id: gmailMessageId,
      format: "METADATA",
      metadataHeaders: ["Message-ID"],
    });
    const headers = res.data.payload?.headers ?? [];
    return (headers as any[]).find((h: any) => h.name?.toLowerCase() === "message-id")?.value ?? null;
  } catch {
    return null;
  }
}

export async function getIntroEmailHeaders(accountEmail: string, gmailMessageId: string): Promise<{ smtpMessageId: string | null; subject: string | null }> {
  try {
    const auth = await getAuthedClient(accountEmail);
    const gmail = google.gmail({ version: "v1", auth });
    const res = await gmail.users.messages.get({
      userId: "me",
      id: gmailMessageId,
      format: "METADATA",
      metadataHeaders: ["Message-ID", "Subject"],
    });
    const headers = res.data.payload?.headers ?? [];
    const get = (name: string) =>
      (headers as any[]).find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
    return { smtpMessageId: get("message-id"), subject: get("subject") };
  } catch {
    return { smtpMessageId: null, subject: null };
  }
}

const AUTO_REPLY_SENDER_PATTERNS = [
  "mailer-daemon",
  "postmaster",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "delivery-status",
  "delivery+",
  "bounce",
  "undeliverable",
];

function isAutoReplyMessage(headers: Array<{ name?: string | null; value?: string | null }>): boolean {
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name)?.value ?? "";

  // RFC 3834: auto-generated messages set this header
  const autoSubmitted = get("auto-submitted").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return true;

  // Common mail-system header
  if (get("x-autoreply") || get("x-auto-response-suppress")) return true;

  // Precedence: bulk / list / junk  is used by mailing lists and auto-responders
  const precedence = get("precedence").toLowerCase();
  if (precedence === "bulk" || precedence === "list" || precedence === "junk") return true;

  // From address looks like a system/no-reply sender
  const from = get("from").toLowerCase();
  if (AUTO_REPLY_SENDER_PATTERNS.some((p) => from.includes(p))) return true;

  // Subject hints at an auto-reply
  const subject = get("subject").toLowerCase();
  const autoSubjectPrefixes = ["out of office", "automatic reply", "auto-reply", "auto reply", "delivery status", "undeliverable", "delivery failed", "mail delivery"];
  if (autoSubjectPrefixes.some((p) => subject.startsWith(p) || subject.includes(p))) return true;

  return false;
}

const DELIVERY_FAILURE_SENDER_PATTERNS = [
  "mailer-daemon",
  "postmaster",
  "bounce+",
  "bounce@",
  "delivery-status",
  "delivery+",
];

const DELIVERY_FAILURE_SUBJECT_PATTERNS = [
  "undeliverable",
  "delivery failed",
  "delivery status notification",
  "mail delivery failed",
  "failure notice",
  "returned mail",
  "delivery failure",
];

export function isDeliveryFailure(
  headers: Array<{ name?: string | null; value?: string | null }>
): boolean {
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name)?.value ?? "";
  if (get("x-failed-recipients")) return true;
  const from = get("from").toLowerCase();
  if (DELIVERY_FAILURE_SENDER_PATTERNS.some((p) => from.includes(p))) return true;
  const subject = get("subject").toLowerCase();
  if (DELIVERY_FAILURE_SUBJECT_PATTERNS.some((p) => subject.includes(p))) return true;
  return false;
}

export interface EmailReplyMessage {
  gmailMessageId: string;
  direction: "sent" | "received";
  fromEmail: string;
  fromName?: string;
  subject?: string;
  body: string;
  receivedAt: Date;
  isDeliveryFailure?: boolean;
}

function decodeBase64Body(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function stripQuotedContent(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trimStart();
    // Quoted lines in plain-text email
    if (trimmed.startsWith(">")) break;
    // Gmail attribution: "On Mon, 29 Apr 2026 at 19:09, ..."
    if (/^On \w{3},\s/.test(trimmed)) break;
    // Outlook-style separator lines
    if (/^[-_]{4,}/.test(trimmed)) break;
    // Forwarded message "From:" block
    if (/^From:\s+\S/.test(trimmed) && result.length > 0) break;
    result.push(line);
  }

  while (result.length > 0 && result[result.length - 1].trim() === "") {
    result.pop();
  }
  return result.join("\n").trim();
}

function extractTextBody(payload: any): string {
  if (!payload) return "";
  // Prefer plain text
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Body(payload.body.data);
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = decodeBase64Body(payload.body.data);
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (payload.parts) {
    // Try plain text parts first
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain") {
        const text = extractTextBody(part);
        if (text) return text;
      }
    }
    // Fall back to any part
    for (const part of payload.parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }
  return "";
}

/**
 * Fetches ALL messages in a Gmail thread — both emails we sent and replies from
 * the supplier. Returns them in chronological order with a direction flag.
 * Auto-replies, bounces, and delivery notifications are excluded.
 */
export async function fetchThreadReplies(params: {
  accountEmail: string;
  threadId: string;
}): Promise<EmailReplyMessage[]> {
  const { accountEmail, threadId } = params;
  try {
    const auth = await getAuthedClient(accountEmail);
    const gmail = google.gmail({ version: "v1", auth });

    const res = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "FULL",
    });

    const messages = res.data.messages ?? [];
    const ourEmail = accountEmail.toLowerCase();
    const result: EmailReplyMessage[] = [];

    for (const msg of messages) {
      const headers = msg.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const from = getHeader("from");

      // Skip auto-replies; surface delivery failures so callers can track bounced addresses
      if (isAutoReplyMessage(headers)) {
        if (isDeliveryFailure(headers)) {
          const rawBody = extractTextBody(msg.payload);
          result.push({
            gmailMessageId: msg.id ?? "",
            direction: "received",
            fromEmail: getHeader("from"),
            fromName: undefined,
            subject: getHeader("subject") || undefined,
            body: rawBody.slice(0, 2000),
            receivedAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
            isDeliveryFailure: true,
          });
        }
        continue;
      }

      const isSentByUs = from.toLowerCase().includes(ourEmail);
      const direction: "sent" | "received" = isSentByUs ? "sent" : "received";

      const fromMatch = from.match(/^(?:"?(.+?)"?\s+)?<?([^>]+)>?$/);
      const fromName = fromMatch?.[1]?.replace(/"/g, "").trim() || undefined;
      const fromEmail = fromMatch?.[2]?.trim() || from;

      const rawBody = extractTextBody(msg.payload);
      const body = stripQuotedContent(rawBody);
      const internalDate = msg.internalDate ? new Date(Number(msg.internalDate)) : new Date();

      result.push({
        gmailMessageId: msg.id ?? "",
        direction,
        fromEmail,
        fromName,
        subject: getHeader("subject") || undefined,
        body: body.slice(0, 5000),
        receivedAt: internalDate,
      });
    }

    return result;
  } catch (err) {
    console.error(`[gmailService] fetchThreadReplies error for thread ${threadId}:`, err);
    return [];
  }
}

export async function checkForReply(params: {
  accountEmail: string;
  threadId: string;
}): Promise<boolean> {
  const { accountEmail, threadId } = params;
  try {
    const auth = await getAuthedClient(accountEmail);
    const gmail = google.gmail({ version: "v1", auth });

    const res = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "METADATA",
    });

    const messages = res.data.messages ?? [];
    if (messages.length <= 1) return false;

    const ourEmail = accountEmail.toLowerCase();
    for (let i = 1; i < messages.length; i++) {
      const headers = messages[i].payload?.headers ?? [];
      const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";

      // Skip our own outbound messages (follow-up emails in the thread)
      if (from.toLowerCase().includes(ourEmail)) continue;

      // Skip auto-replies, bounces, delivery notifications
      if (isAutoReplyMessage(headers)) continue;

      // A real human reply from the supplier
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[gmailService] checkForReply error for thread ${threadId}:`, err);
    return false;
  }
}

export async function getConfiguredAccounts(): Promise<Array<{ email: string; connected: boolean; label: string }>> {
  const fromListVar = (process.env.GMAIL_ACCOUNT_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  const fromLegacyVars = [
    process.env.GMAIL_ACCOUNT_1_EMAIL,
    process.env.GMAIL_ACCOUNT_2_EMAIL,
    process.env.GMAIL_ACCOUNT_3_EMAIL,
  ]
    .filter(Boolean)
    .map((email) => (email as string).trim());

  const accountEmails = [...new Set([...fromListVar, ...fromLegacyVars])];

  const results = await Promise.all(
    accountEmails.map(async (email, i) => {
      const token = await getRefreshToken(email);
      return { email, connected: !!token, label: `Account ${i + 1}` };
    }),
  );
  return results;
}

export async function saveRefreshToken(email: string, refreshToken: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: `gmail_refresh_token_${email}` },
    update: { value: refreshToken },
    create: { key: `gmail_refresh_token_${email}`, value: refreshToken },
  });
}

export function getAuthUrl(email: string): string {
  const auth = getOAuth2Client();
  return auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    state: email,
  });
}

export async function exchangeCodeForToken(code: string, email: string): Promise<{ email: string; refreshToken: string }> {
  const auth = getOAuth2Client();
  const { tokens } = await auth.getToken(code);
  if (!tokens.refresh_token) throw new Error("No refresh token returned. Re-authorize with prompt=consent.");

  await saveRefreshToken(email, tokens.refresh_token);
  return { email, refreshToken: tokens.refresh_token };
}
