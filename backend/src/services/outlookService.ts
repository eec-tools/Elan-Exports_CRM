/**
 * Outlook / Microsoft Graph API email sync service.
 *
 * Auth strategy: Client Credentials (app-only).
 * Requires an Azure App Registration with Mail.Read *application* permission
 * granted on the shared mailbox.
 *
 * Env vars needed:
 *   OUTLOOK_TENANT_ID      – Azure AD tenant ID
 *   OUTLOOK_CLIENT_ID      – App registration client ID
 *   OUTLOOK_CLIENT_SECRET  – App registration client secret
 *   OUTLOOK_MAILBOX        – The mailbox address to monitor (e.g. sales@elanexports.com)
 */

import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Token cache ────────────────────────────────────────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if valid for at least another 60 seconds
  if (tokenCache && tokenCache.expiresAt - now > 60_000) {
    return tokenCache.accessToken;
  }

  const tenantId = process.env.OUTLOOK_TENANT_ID;
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Missing Outlook credentials. Set OUTLOOK_TENANT_ID, OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET in .env"
    );
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get Outlook access token: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

// ─── Graph API helpers ───────────────────────────────────────────────────────

interface GraphMessage {
  id: string;
  subject: string | null;
  receivedDateTime: string;
  bodyPreview: string;
  importance: "low" | "normal" | "high";
  isRead: boolean;
  conversationId: string;
  webLink: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
}

interface GraphMessagesResponse {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
}

async function fetchMessages(
  mailbox: string,
  since: Date | null,
  token: string
): Promise<GraphMessage[]> {
  const allMessages: GraphMessage[] = [];

  // Build the $filter — fetch only newer messages when we have a sync cursor
  const filterClause = since
    ? `&$filter=receivedDateTime ge ${since.toISOString()}`
    : "";

  let url: string | undefined =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages` +
    `?$select=id,subject,from,receivedDateTime,bodyPreview,conversationId,importance,isRead,webLink` +
    `&$orderby=receivedDateTime desc` +
    `&$top=50` +
    filterClause;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Graph API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as GraphMessagesResponse;
    allMessages.push(...data.value);

    // Follow pagination but cap at 200 messages per sync run
    url = allMessages.length < 200 ? data["@odata.nextLink"] : undefined;
  }

  return allMessages;
}

// ─── Main sync function ──────────────────────────────────────────────────────

export interface SyncResult {
  inserted: number;
  skipped: number;
  errors: number;
  syncedAt: Date;
}

export async function syncOutlookEmails(): Promise<SyncResult> {
  const mailbox = process.env.OUTLOOK_MAILBOX;
  if (!mailbox) {
    throw new Error("OUTLOOK_MAILBOX env variable is not set.");
  }

  // Read the last successful sync timestamp from AppSettings
  const lastSyncSetting = await prisma.appSetting.findUnique({
    where: { key: "outlook_last_sync" },
  });

  const since: Date | null = lastSyncSetting
    ? new Date(lastSyncSetting.value)
    : null;

  const token = await getAccessToken();
  const messages = await fetchMessages(mailbox, since, token);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of messages) {
    try {
      const senderAddress =
        msg.from?.emailAddress?.address ?? "unknown@unknown.com";

      await prisma.emailTracker.upsert({
        where: { messageId: msg.id },
        create: {
          dateReceived: new Date(msg.receivedDateTime),
          senderAddress,
          subject: msg.subject ?? "(No Subject)",
          bodyPreview: msg.bodyPreview?.slice(0, 500) ?? null,
          conversationId: msg.conversationId ?? null,
          importance: msg.importance ?? "normal",
          isRead: msg.isRead ?? false,
          emailLink: msg.webLink ?? null,
          messageId: msg.id,
          source: "outlook",
          syncedAt: new Date(),
          status: "Not Started",
        },
        update: {
          // Only update volatile fields on re-sync; preserve CRM annotations
          isRead: msg.isRead ?? false,
          syncedAt: new Date(),
        },
      });
      inserted++;
    } catch (err: any) {
      // Duplicate key on messageId = already exists → skip gracefully
      if (err?.code === "P2002") {
        skipped++;
      } else {
        console.error(`[Outlook Sync] Error processing message ${msg.id}:`, err);
        errors++;
      }
    }
  }

  const syncedAt = new Date();

  // Persist the new sync cursor (now)
  await prisma.appSetting.upsert({
    where: { key: "outlook_last_sync" },
    create: { key: "outlook_last_sync", value: syncedAt.toISOString() },
    update: { value: syncedAt.toISOString() },
  });

  return { inserted, skipped, errors, syncedAt };
}

export async function getLastSyncInfo(): Promise<{
  lastSyncAt: string | null;
  configured: boolean;
}> {
  const configured = !!(
    process.env.OUTLOOK_TENANT_ID &&
    process.env.OUTLOOK_CLIENT_ID &&
    process.env.OUTLOOK_CLIENT_SECRET &&
    process.env.OUTLOOK_MAILBOX
  );

  const setting = await prisma.appSetting.findUnique({
    where: { key: "outlook_last_sync" },
  });

  return {
    lastSyncAt: setting?.value ?? null,
    configured,
  };
}
