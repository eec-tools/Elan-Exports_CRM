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
  if (!refreshToken) throw new Error(`No Gmail refresh token for ${email}`);
  const auth = getOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

function parseFromHeader(fromHeader: string): string {
  // "Some Name <email@example.com>" → "email@example.com"
  // "email@example.com" → "email@example.com"
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1].trim() : fromHeader.trim();
}

export interface SyncResult {
  created: number;
  updated: number;
  errors: number;
  syncedAt: Date;
}

function isRateLimitError(err: any): boolean {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  if (status === 429 || status === 403) return true;
  const msg: string = err?.message ?? "";
  return /rate limit|quota|userRateLimit/i.test(msg);
}

function extractRetryAfter(err: any): Date | null {
  // Try parsing "Retry after <ISO>" from the error message
  const msg: string = err?.message ?? "";
  const match = msg.match(/retry after\s+(\S+)/i);
  if (match) {
    const d = new Date(match[1]);
    if (!isNaN(d.getTime())) return d;
  }
  // Fall back to 10 minutes from now
  return new Date(Date.now() + 10 * 60 * 1000);
}

export async function syncGmailInbox(accountEmail: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, errors: 0, syncedAt: new Date() };

  let auth;
  try {
    auth = await getAuthedClient(accountEmail);
  } catch {
    // Account not connected — skip silently
    return result;
  }

  // Check if this account is in a rate-limit cooldown
  const cooldownKey = `gmail_inbox_rate_limit_until_${accountEmail}`;
  const cooldownSetting = await prisma.appSetting.findUnique({ where: { key: cooldownKey } });
  if (cooldownSetting?.value) {
    const until = new Date(cooldownSetting.value);
    if (until > new Date()) {
      console.log(`[GmailInbox] ${accountEmail}: rate-limit cooldown active until ${until.toISOString()} — skipping`);
      return result;
    }
  }

  const gmail = google.gmail({ version: "v1", auth });

  // Fetch the last sync time for incremental sync
  const lastSyncSetting = await prisma.appSetting.findUnique({
    where: { key: `gmail_inbox_last_sync_${accountEmail}` },
  });

  let query = "in:inbox";
  if (lastSyncSetting?.value) {
    // after: expects seconds since epoch
    const epochSeconds = Math.floor(new Date(lastSyncSetting.value).getTime() / 1000);
    // Subtract 5 minutes as buffer to avoid missing emails near the boundary
    query += ` after:${epochSeconds - 300}`;
  }

  try {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 100,
    });

    const messages = listRes.data.messages ?? [];

    for (const msg of messages) {
      if (!msg.id) continue;

      try {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "METADATA",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const headers = detail.data.payload?.headers ?? [];
        const getHeader = (name: string) =>
          (headers as Array<{ name?: string | null; value?: string | null }>)
            .find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

        const fromRaw = getHeader("From");
        const senderAddress = parseFromHeader(fromRaw) || fromRaw;
        const subject = getHeader("Subject") || "(no subject)";
        const dateStr = getHeader("Date");
        const dateReceived = dateStr ? new Date(dateStr) : new Date(Number(detail.data.internalDate));
        const threadId = detail.data.threadId ?? undefined;
        const snippet = detail.data.snippet ?? undefined;
        const isRead = !(detail.data.labelIds ?? []).includes("UNREAD");
        const emailLink = `https://mail.google.com/mail/u/0/#inbox/${msg.id}`;

        const existing = await prisma.emailTracker.findUnique({
          where: { messageId: msg.id },
        });

        if (existing) {
          await prisma.emailTracker.update({
            where: { messageId: msg.id },
            data: { isRead, syncedAt: result.syncedAt },
          });
          result.updated++;
        } else {
          await prisma.emailTracker.create({
            data: {
              dateReceived,
              senderAddress,
              subject,
              emailLink,
              gmailAccount: accountEmail,
              messageId: msg.id,
              threadId,
              bodyPreview: snippet,
              isRead,
              source: "gmail",
              syncedAt: result.syncedAt,
            },
          });
          result.created++;
        }
      } catch (err: any) {
        console.error(`[GmailInbox] Error processing message ${msg.id}:`, err?.message);
        result.errors++;
      }
    }

    // Update last sync time
    await prisma.appSetting.upsert({
      where: { key: `gmail_inbox_last_sync_${accountEmail}` },
      update: { value: result.syncedAt.toISOString() },
      create: { key: `gmail_inbox_last_sync_${accountEmail}`, value: result.syncedAt.toISOString() },
    });

    console.log(
      `[GmailInbox] ${accountEmail}: +${result.created} created, ${result.updated} updated, ${result.errors} errors`
    );
  } catch (err: any) {
    console.error(`[GmailInbox] Failed to list messages for ${accountEmail}:`, err?.message);
    result.errors++;
    if (isRateLimitError(err)) {
      const until = extractRetryAfter(err);
      if (until) {
        await prisma.appSetting.upsert({
          where: { key: cooldownKey },
          update: { value: until.toISOString() },
          create: { key: cooldownKey, value: until.toISOString() },
        });
        console.log(`[GmailInbox] ${accountEmail}: rate-limited — cooldown set until ${until.toISOString()}`);
      }
    }
  }

  return result;
}

export async function syncAllGmailAccounts(): Promise<SyncResult> {
  const accounts = [
    process.env.GMAIL_ACCOUNT_1_EMAIL,
    process.env.GMAIL_ACCOUNT_2_EMAIL,
    process.env.GMAIL_ACCOUNT_3_EMAIL,
  ]
    .filter(Boolean)
    .map((e) => (e as string).trim());

  const totals: SyncResult = { created: 0, updated: 0, errors: 0, syncedAt: new Date() };

  for (const account of accounts) {
    const r = await syncGmailInbox(account);
    totals.created += r.created;
    totals.updated += r.updated;
    totals.errors += r.errors;
  }

  return totals;
}

export interface AccountSyncStatus {
  email: string;
  connected: boolean;
  lastSync: string | null;
  messageCount: number;
}

export async function getAccountSyncStatuses(): Promise<AccountSyncStatus[]> {
  const accounts = [
    process.env.GMAIL_ACCOUNT_1_EMAIL,
    process.env.GMAIL_ACCOUNT_2_EMAIL,
    process.env.GMAIL_ACCOUNT_3_EMAIL,
  ]
    .filter(Boolean)
    .map((e) => (e as string).trim());

  return Promise.all(
    accounts.map(async (email) => {
      const [token, lastSyncSetting, messageCount] = await Promise.all([
        getRefreshToken(email),
        prisma.appSetting.findUnique({ where: { key: `gmail_inbox_last_sync_${email}` } }),
        prisma.emailTracker.count({ where: { gmailAccount: email } }),
      ]);
      return {
        email,
        connected: !!token,
        lastSync: lastSyncSetting?.value ?? null,
        messageCount,
      };
    })
  );
}
