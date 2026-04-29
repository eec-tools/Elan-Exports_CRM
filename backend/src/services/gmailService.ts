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

function buildRawMessage(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): string {
  const { from, to, subject, html } = params;

  // RFC 2047 encode any header value that may contain non-ASCII characters
  const encodeHeader = (v: string) => `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`;

  // Base64-encode the HTML body and wrap at 76 chars (MIME requirement)
  const encodedBody = Buffer.from(html, "utf-8").toString("base64").match(/.{1,76}/g)!.join("\r\n");

  const message = [
    `From: ${encodeHeader("Élan Exports")} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    encodedBody,
  ].join("\r\n");

  return Buffer.from(message).toString("base64url");
}

export async function sendGmailEmail(params: {
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
  threadId?: string;
}): Promise<{ messageId: string; threadId: string }> {
  const { fromEmail, to, subject, html, threadId } = params;
  const auth = await getAuthedClient(fromEmail);
  const gmail = google.gmail({ version: "v1", auth });

  const raw = buildRawMessage({ from: fromEmail, to, subject, html });

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      // Thread follow-ups into the same Gmail conversation as the intro email
      ...(threadId ? { threadId } : {}),
    },
  });

  return {
    messageId: res.data.id ?? "",
    threadId: res.data.threadId ?? "",
  };
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
