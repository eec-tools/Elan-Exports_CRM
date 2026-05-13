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

export async function syncGmailInbox(accountEmail: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, errors: 0, syncedAt: new Date() };

  let auth;
  try {
    auth = await getAuthedClient(accountEmail);
  } catch {
    // Account not connected — skip silently
    return result;
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
