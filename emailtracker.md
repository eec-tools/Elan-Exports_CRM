# Email Tracker Redesign — Implementation Plan

## Overview

Complete redesign of the Email Tracker to replace the broken Outlook integration with Gmail.
Three Gmail accounts will each get their own tab in the UI. All inbox emails will be synced
automatically via the Gmail API using OAuth 2.0 (same OAuth flow already in place for campaigns).

**Accounts:**
| Tab | Email |
|-----|-------|
| Tab 1 | procurement1@eectrade.com |
| Tab 2 | partners@eectrade.com |
| Tab 3 | procurement2@eectrade.com |

---

## What's Being Removed

- `outlookService.ts` — Microsoft Graph API integration (disabled/deleted)
- `emailSyncScheduler.ts` — Outlook 15-min cron (replaced)
- Outlook env vars: `OUTLOOK_TENANT_ID`, `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`, `OUTLOOK_MAILBOX`
- "Sync Outlook" button in the UI (replaced with per-account sync)
- "Open in Outlook" links in email detail (replaced with Gmail links)

---

## Architecture

```
Gmail API (OAuth 2.0)
  ├── procurement1@eectrade.com  ──┐
  ├── partners@eectrade.com      ──┼──► gmailInboxService.ts ──► emailTracker DB table
  └── procurement2@eectrade.com  ──┘

gmailInboxScheduler.ts (cron every 5 min)
  └── syncs all 3 accounts, stores last sync time per account in AppSetting

Frontend: EmailTasksPage.tsx
  ├── Tab 1: procurement1 — filtered view + per-tab stats + sync
  ├── Tab 2: partners     — filtered view + per-tab stats + sync
  └── Tab 3: procurement2 — filtered view + per-tab stats + sync
```

---

## Step 1 — Database Schema Update

**File:** `backend/prisma/schema.prisma`

Update the `EmailTracker` model:

```prisma
model EmailTracker {
  id              String    @id @default(uuid())
  dateReceived    DateTime  @map("date_received")
  senderAddress   String    @map("sender_address")
  subject         String
  task            String?
  productCategory String?   @map("product_category")
  priority        String?   // Urgent, High, Medium, Low
  respondent      String?
  status          String    @default("Not Started")
  notes           String?
  emailLink       String?   @map("email_link")   // Gmail web link

  // Gmail fields (replacing Outlook fields)
  gmailAccount    String?   @map("gmail_account")   // which of the 3 accounts
  messageId       String?   @unique @map("message_id")  // Gmail message ID
  threadId        String?   @map("thread_id")           // Gmail thread ID
  bodyPreview     String?   @map("body_preview")         // snippet from Gmail
  isRead          Boolean   @default(false) @map("is_read")
  source          String    @default("gmail")  // "gmail" or "manual"
  syncedAt        DateTime? @map("synced_at")

  // Legacy Outlook fields (keep for existing rows, nullable)
  conversationId  String?   @map("conversation_id")
  importance      String?

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@index([gmailAccount])
  @@index([threadId])
  @@index([conversationId])
  @@map("email_tracker")
}
```

**Migration command:**
```bash
cd backend && npx prisma migrate dev --name add_gmail_inbox_fields
```

---

## Step 2 — New Gmail Inbox Service

**File:** `backend/src/services/gmailInboxService.ts` (NEW)

### Responsibilities
- Use the existing OAuth refresh tokens (stored in `AppSetting` as `gmail_refresh_token_<email>`)
- Call Gmail API `users.messages.list` with `q: 'in:inbox'` for each account
- Fetch full message metadata: `From`, `Subject`, `Date`, `Snippet`, `ThreadId`
- Upsert into `emailTracker` using `messageId` as the unique key
- Build `emailLink` as `https://mail.google.com/mail/u/0/#inbox/<messageId>`
- Track per-account last sync time in `AppSetting` as `gmail_inbox_last_sync_<email>`

### Key implementation details

```typescript
// Pseudocode outline
async function syncGmailInbox(accountEmail: string): Promise<SyncResult> {
  // 1. Get refresh token from AppSetting (key: gmail_refresh_token_<email>)
  // 2. Create OAuth2 client, set credentials
  // 3. Call gmail.users.messages.list({ userId: 'me', q: 'in:inbox', maxResults: 100 })
  // 4. For each messageId, call gmail.users.messages.get({ id, format: 'metadata', metadataHeaders: ['From','Subject','Date'] })
  // 5. Parse headers, build EmailTracker row
  // 6. prisma.emailTracker.upsert({ where: { messageId }, create: {...}, update: { isRead, syncedAt } })
  // 7. Update AppSetting gmail_inbox_last_sync_<email> = new Date()
  // 8. Return { synced, created, updated }
}

async function syncAllGmailAccounts(): Promise<void> {
  const accounts = [
    process.env.GMAIL_ACCOUNT_1_EMAIL,
    process.env.GMAIL_ACCOUNT_2_EMAIL,
    process.env.GMAIL_ACCOUNT_3_EMAIL,
  ].filter(Boolean)
  
  for (const account of accounts) {
    try {
      const result = await syncGmailInbox(account)
      console.log(`[GmailInbox] ${account}: synced ${result.created} new, ${result.updated} updated`)
    } catch (err) {
      console.error(`[GmailInbox] ${account} sync failed:`, err.message)
      // Don't throw — continue syncing other accounts
    }
  }
}
```

### Helper: Get account sync status

```typescript
async function getAccountSyncStatus(): Promise<AccountStatus[]>
// Returns array of { email, lastSync, connected, messageCount } for all 3 accounts
```

---

## Step 3 — New Gmail Inbox Scheduler

**File:** `backend/src/services/gmailInboxScheduler.ts` (NEW)

Replace `emailSyncScheduler.ts`:

```typescript
import cron from 'node-cron'
import { syncAllGmailAccounts } from './gmailInboxService'

export function startGmailInboxScheduler() {
  const configured = !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_ACCOUNT_1_EMAIL
  )

  if (!configured) {
    console.log('[GmailInboxScheduler] Gmail not configured, skipping')
    return
  }

  // Sync every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[GmailInboxScheduler] Running inbox sync...')
    await syncAllGmailAccounts()
  })

  // Sync immediately on startup
  syncAllGmailAccounts()
  console.log('[GmailInboxScheduler] Started — syncing every 5 minutes')
}
```

**Register in** `backend/src/index.ts` — replace the `startEmailSyncScheduler()` call with `startGmailInboxScheduler()`.

---

## Step 4 — Update Email Tasks Controller

**File:** `backend/src/controllers/emailTasks.controller.ts`

### Changes

1. **Add `gmailAccount` filter** to the list endpoint:
   ```
   GET /api/email-tasks?gmailAccount=procurement1@eectrade.com&status=...
   ```

2. **Update sync status endpoint** `GET /api/email-tasks/sync-status`:
   Return per-account status instead of single Outlook timestamp:
   ```json
   {
     "accounts": [
       { "email": "procurement1@eectrade.com", "lastSync": "...", "connected": true, "messageCount": 42 },
       { "email": "partners@eectrade.com",      "lastSync": "...", "connected": true, "messageCount": 17 },
       { "email": "procurement2@eectrade.com",  "lastSync": null,  "connected": false, "messageCount": 0 }
     ]
   }
   ```

3. **Update sync trigger** `POST /api/email-tasks/sync`:
   Accept optional `?account=email` to sync one or all accounts:
   ```typescript
   const account = req.query.account as string | undefined
   if (account) {
     await syncGmailInbox(account)
   } else {
     await syncAllGmailAccounts()
   }
   ```

4. **Per-tab stats** — add `gmailAccount` to stats query:
   ```
   GET /api/email-tasks/stats?gmailAccount=procurement1@eectrade.com
   ```

---

## Step 5 — Frontend Redesign

**File:** `frontend/src/pages/EmailTasksPage.tsx` (FULL REWRITE)

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Email Tracker                          [+ Add Manual]   │
├─────────────────────────────────────────────────────────┤
│  [procurement1@eectrade.com] [partners@] [procurement2@] │ ← Tabs
├─────────────────────────────────────────────────────────┤
│  Sync Status: Last synced 2 min ago    [Sync Now]        │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐               │
│  │Total │  │Urgent│  │Pending│ │Done  │  ← Stats cards  │
│  │  42  │  │  5   │  │  18   │ │  19  │               │
│  └──────┘  └──────┘  └──────┘  └──────┘               │
├─────────────────────────────────────────────────────────┤
│  [Search...] [Task ▼] [Priority ▼] [Status ▼] [Person ▼]│
├─────────────────────────────────────────────────────────┤
│  Table:                                                  │
│  Date | From | Subject | Task | Priority | Status | Who  │
│  ...                                                     │
│  [< Prev]  Page 1 of 5  [Next >]                        │
└─────────────────────────────────────────────────────────┘
```

### Tab design

- Each tab label shows the email address shortened: `procurement1` / `partners` / `procurement2`
- Tab badge shows unassigned email count (tasks with no `task` or `respondent`)
- Active tab has Gmail red accent underline
- If an account is not OAuth-connected: show a "Connect Gmail Account" banner instead of emails

### Stats Cards (per tab)
| Card | Value |
|------|-------|
| Total | All emails in this account |
| Urgent/High | Emails with priority = Urgent or High |
| Pending | Status = Not Started or In Progress |
| Completed | Status = Completed |

### Table Columns
| Column | Details |
|--------|---------|
| Date | `dateReceived` formatted as `DD MMM, HH:mm` |
| From | `senderAddress` (truncated at 30 chars) |
| Subject | `subject` + preview snippet on hover/expand |
| Task Type | Dropdown badge — editable inline |
| Priority | Color badge: red=Urgent, orange=High, yellow=Medium, gray=Low |
| Status | Pill: Not Started / In Progress / Completed |
| Assigned To | Avatar/initials chip |
| Actions | Open in Gmail icon + Edit icon |

### Email Detail Dialog
- Full subject line
- From, Date, Preview text
- "Open in Gmail" button (links to `emailLink`)
- Edit form: Task, Priority, Status, Product Category, Respondent, Notes
- Save / Cancel / Delete

### Not Connected State (per tab)
```
┌─────────────────────────────────────────────────────────┐
│  Gmail account not connected                             │
│  procurement1@eectrade.com has not been authorized yet.  │
│                                                          │
│  [Connect Gmail Account →]                               │
│  (Redirects to Gmail Settings page to complete OAuth)   │
└─────────────────────────────────────────────────────────┘
```

### Frontend API calls
```typescript
// Fetch emails for active tab
GET /api/email-tasks?gmailAccount=procurement1@eectrade.com&page=1&limit=20&status=...

// Fetch stats for active tab
GET /api/email-tasks/stats?gmailAccount=procurement1@eectrade.com

// Fetch sync status for all accounts
GET /api/email-tasks/sync-status

// Trigger sync for active tab account
POST /api/email-tasks/sync?account=procurement1@eectrade.com

// Update a task
PUT /api/email-tasks/:id

// Delete a task
DELETE /api/email-tasks/:id
```

---

## Step 6 — Update Startup Registration

**File:** `backend/src/index.ts`

```typescript
// Remove:
import { startEmailSyncScheduler } from './services/emailSyncScheduler'
startEmailSyncScheduler()

// Add:
import { startGmailInboxScheduler } from './services/gmailInboxScheduler'
startGmailInboxScheduler()
```

---

## Step 7 — Remove / Archive Outlook Code

1. Delete `backend/src/services/outlookService.ts`
2. Delete `backend/src/services/emailSyncScheduler.ts`
3. Remove Outlook-related env vars from `.env` (keep them in `.env.example` as legacy/commented)
4. Leave `AppSetting` rows with key `outlook_last_sync` in DB — they're harmless
5. Existing `emailTracker` rows with `source = 'outlook'` stay in the DB — they'll appear in the UI
   under whichever tab matches their `gmailAccount` (null = will show as "Unknown" or be filtered)

---

## Step 8 — Existing Gmail OAuth Reuse

The Gmail OAuth flow in `gmailService.ts` / `gmail.controller.ts` / `GmailSettingsPage.tsx`
already stores refresh tokens in `AppSetting` with key `gmail_refresh_token_<email>`.

The new `gmailInboxService.ts` reads those same tokens — **no new OAuth infrastructure needed**.

If an account has never been connected via Gmail Settings, `syncGmailInbox()` will fail gracefully
and the UI will show the "Connect Account" banner.

**Action required after deployment:** Ensure all 3 accounts are connected via `/settings/gmail`.

---

## File Change Summary

| File | Action | Notes |
|------|--------|-------|
| `backend/prisma/schema.prisma` | Edit | Add `gmailAccount`, `threadId` fields |
| `backend/src/services/gmailInboxService.ts` | Create | Core Gmail inbox sync logic |
| `backend/src/services/gmailInboxScheduler.ts` | Create | Replaces Outlook scheduler |
| `backend/src/services/outlookService.ts` | Delete | Outlook removed |
| `backend/src/services/emailSyncScheduler.ts` | Delete | Replaced by gmailInboxScheduler |
| `backend/src/controllers/emailTasks.controller.ts` | Edit | Add gmailAccount filter, update sync/status |
| `backend/src/index.ts` | Edit | Swap scheduler registration |
| `frontend/src/pages/EmailTasksPage.tsx` | Rewrite | 3-tab Gmail UI |

---

## Implementation Order

1. **Schema migration** → Add `gmailAccount` column, run `prisma migrate dev`
2. **`gmailInboxService.ts`** → Core sync logic (most critical)
3. **`gmailInboxScheduler.ts`** → Wire up cron
4. **`index.ts`** → Swap old scheduler for new
5. **`emailTasks.controller.ts`** → Add `gmailAccount` filter + update sync endpoints
6. **Delete** `outlookService.ts` and `emailSyncScheduler.ts`
7. **`EmailTasksPage.tsx`** → Full frontend rewrite with 3 tabs
8. **Test** → Connect all 3 Gmail accounts via `/settings/gmail`, trigger sync, verify emails appear per tab

---

## Environment Variables (No New Vars Needed)

All required vars already exist in `.env`:

```env
# Gmail OAuth — used by both campaign sender AND new inbox sync
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REDIRECT_URI=...
GMAIL_ACCOUNT_1_EMAIL=procurement1@eectrade.com
GMAIL_ACCOUNT_2_EMAIL=partners@eectrade.com
GMAIL_ACCOUNT_3_EMAIL=procurement2@eectrade.com
```

Tokens are stored per-account in `AppSetting` table after OAuth — nothing new needed.

---

## Notes

- The existing `gmailService.ts` is for **sending** campaign emails and detecting replies — it stays unchanged.
- The new `gmailInboxService.ts` is for **reading** inbox emails into the tracker — separate concern.
- Gmail API quota: 1 billion units/day. `messages.list` = 5 units, `messages.get` = 5 units.
  Syncing 100 messages per account × 3 accounts × 12 times/hour = 21,600 units/day — well within limits.
- Sync window: on first sync, fetch last 100 messages. On subsequent syncs, use `after:<epoch>`
  to only fetch new messages (reduces API calls and avoids re-processing old emails).
