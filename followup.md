# Sourcing Supplier Follow-up Email Campaign — Full Implementation Plan

## Overview

Replace the current manual Outlook-based system with a fully automated Gmail-powered email campaign
for Sourcing Suppliers. When adding a sourcing supplier, the user picks which of the 3 Gmail accounts
will own all communication with that supplier — intro email + every follow-up — so the entire thread
stays in one mailbox with zero re-selection needed later.

The campaign sends an intro email (with the supplier form link) then up to 3 follow-up reminders on
3-day cycles. Replies are detected automatically via Gmail API. A reply at any stage auto-converts the
supplier to a New Supplier. No reply after Follow-up 3 auto-moves them to Old Supplier

---

## Campaign State Machine

```
[Add Sourcing Supplier — pick Gmail account]
      │
      ▼ (user clicks Start)
[Send Intro Email  ──────────── supplier replies ──► End Campaign → Convert to New Supplier]
      │ (no reply, 3 days — auto or manual)
      ▼
[Send Follow-up 1  ──────────── supplier replies ──► End Campaign → Convert to New Supplier]
      │ (no reply, 3 days)
      ▼
[Send Follow-up 2  ──────────── supplier replies ──► End Campaign → Convert to New Supplier]
      │ (no reply, 3 days)
      ▼
[Send Follow-up 3  ──────────── supplier replies ──► End Campaign → Convert to New Supplier]
      │ (no reply)
      ▼
[End Campaign → Move to Old Supplier — automatically]
```

**Campaign status:** `active` → `response_received` | `completed`  
**currentStep:** 1 = intro sent · 2 = followup1 sent · 3 = followup2 sent · 4 = followup3 sent  
**Supplier status:** `pending` → `intro_sent` → `followup1_sent` → `followup2_sent` → `followup3_sent` → `response_received` | `no_response` | `converted_to_new`

---

## Phase 1 — Gmail Account Assignment at Supplier Creation

This is the core UX change. The Gmail account is chosen **once**, when the supplier is first added.
Every subsequent email — intro, FU1, FU2, FU3 — automatically uses that same account.

### 1.1 Schema change — `SourcingSupplier`

Add one field to the `SourcingSupplier` model:

```prisma
model SourcingSupplier {
  // ... all existing fields unchanged ...
  assignedGmailAccount  String?  @map("assigned_gmail_account")  // ADD — e.g. "sales@elanexports.com"
}
```

### 1.2 Backend — `createSourcingSupplier` controller

**File:** `backend/src/controllers/sourcingSuppliers.controller.ts`

Add `assignedGmailAccount` to the destructured body and persist it:

```typescript
const { company, ..., assignedGmailAccount } = req.body;

await prisma.sourcingSupplier.create({
  data: {
    ...,
    assignedGmailAccount: assignedGmailAccount ?? null,
  },
});
```

Validation: if no account is selected, save as `null` — the campaign Start button will show
a warning prompt asking to assign one before proceeding.

### 1.3 Frontend — Add Sourcing Supplier dialog / form

**File:** `frontend/src/pages/SourcingSupplierPage.tsx` (or wherever the add dialog lives)

Add a **"Campaign Email Account"** dropdown field to the Add Supplier form:

```
┌──────────────────────────────────────────────┐
│  Add Sourcing Supplier                       │
│                                              │
│  Company Name *          [________________]  │
│  Supplier Email *        [________________]  │
│  Form Template           [Default        ▼]  │
│                                              │
│  Campaign Email Account *                    │
│  ┌──────────────────────────────────────┐    │
│  │  sales@elanexports.com            ▼  │    │
│  │  ─────────────────────────────────   │    │
│  │  sales@elanexports.com               │    │
│  │  sourcing@elanexports.com            │    │
│  │  procurement@elanexports.com         │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ℹ️  All emails to this supplier (intro +    │
│     3 follow-ups) will be sent from the      │
│     selected account.                        │
│                                              │
│  [Cancel]              [Add Supplier]        │
└──────────────────────────────────────────────┘
```

**Fields included:** Company Name, Supplier Email, Form Template, Campaign Email Account.  
**Fields removed from this dialog:** Contact Person, Product/Category, Country, Account Manager — these are filled in later on the supplier detail page after the supplier is added.

The dropdown is populated from `GET /api/gmail/accounts` — only shows **connected** accounts
(those with a valid refresh token stored). If no accounts are connected yet, show a warning link
to the Gmail settings page.

### 1.4 Display on supplier detail page

**File:** `frontend/src/pages/SourcingSupplierDetailsPage.tsx`

Show the assigned account in the supplier info section (read-only badge):

```
Campaign Email:  📧 sales@elanexports.com
```

An admin can change it via an edit icon — but only before the campaign has started (once
`introEmailSentAt` is set, the field is locked to preserve thread continuity).

---

## Phase 2 — Gmail Multi-Account Setup

### 2.1 Google Cloud Project (one-time setup)
- Create or use existing Google Cloud project
- Enable **Gmail API**
- Create OAuth 2.0 credentials (Web application) → get `CLIENT_ID` and `CLIENT_SECRET`
- Add authorized redirect URI: `https://yourdomain.com/api/gmail/callback` + `http://localhost:5000/api/gmail/callback`

### 2.2 Environment Variables (`.env` / `.env.example`)

```env
# Gmail OAuth2 app credentials (one shared app for all 3 accounts)
GMAIL_CLIENT_ID=your_google_oauth_client_id
GMAIL_CLIENT_SECRET=your_google_oauth_client_secret
GMAIL_REDIRECT_URI=http://localhost:5000/api/gmail/callback

# Gmail Account 1
GMAIL_ACCOUNT_1_EMAIL=sales@elanexports.com
GMAIL_ACCOUNT_1_REFRESH_TOKEN=          # filled after OAuth flow

# Gmail Account 2
GMAIL_ACCOUNT_2_EMAIL=sourcing@elanexports.com
GMAIL_ACCOUNT_2_REFRESH_TOKEN=

# Gmail Account 3
GMAIL_ACCOUNT_3_EMAIL=procurement@elanexports.com
GMAIL_ACCOUNT_3_REFRESH_TOKEN=
```

### 2.3 Persistent token storage

Refresh tokens are stored in the existing `AppSetting` table (already in schema):

| key | value |
|-----|-------|
| `gmail_refresh_token_sales@elanexports.com` | `1//0g...` |
| `gmail_refresh_token_sourcing@elanexports.com` | `1//0h...` |
| `gmail_refresh_token_procurement@elanexports.com` | `1//0i...` |

Keyed by email address so adding a 4th account later requires zero code changes.

### 2.4 One-time OAuth authorization flow

```
Admin visits: /settings/gmail → clicks "Connect" next to an account
Browser redirects to: GET /api/gmail/auth?email=sales@elanexports.com
Server builds Google consent URL (scope: gmail.send + gmail.readonly) → 302 redirect
User approves in Google
Google redirects to: GET /api/gmail/callback?code=...&state=sales@elanexports.com
Server exchanges code for tokens → saves refresh token to AppSetting table
Redirect back to /settings/gmail with success toast
```

---

## Phase 3 — New File: `gmailService.ts`

**Path:** `backend/src/services/gmailService.ts`

### Exported functions

```typescript
// Send an email from a specific Gmail account, returns { messageId, threadId }
sendEmail(fromEmail: string, to: string, subject: string, html: string): Promise<{ messageId: string; threadId: string }>

// Returns true if the supplier has replied (thread has >1 message)
checkForReply(fromEmail: string, threadId: string): Promise<boolean>

// Returns list of configured accounts with connection status
getConfiguredAccounts(): Promise<Array<{ email: string; connected: boolean }>>
```

### Implementation notes
- `npm install googleapis`
- One shared `OAuth2` client app (`GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`)
- Per-call: load refresh token from `AppSetting` by key `gmail_refresh_token_{email}`, set on OAuth2 client
- Access tokens are auto-refreshed by the googleapis SDK — no manual token management needed
- `sendEmail` encodes the email as RFC 2822 base64url, calls `gmail.users.messages.send`
- Returns both `messageId` and `threadId` from the API response — both are stored on the campaign
- `checkForReply`: calls `gmail.users.threads.get({ id: threadId })` → `messages.length > 1` means reply exists

---

## Phase 4 — Email Templates

**Path:** `backend/src/services/emailTemplates.ts`

### Function signatures

```typescript
introEmailTemplate(data: { company: string; contactPerson: string; formLink: string }): { subject: string; html: string }
followup1Template(data: { company: string; contactPerson: string; formLink: string }): { subject: string; html: string }
followup2Template(data: { company: string; contactPerson: string; formLink: string }): { subject: string; html: string }
followup3Template(data: { company: string; contactPerson: string; formLink: string }): { subject: string; html: string }
```

### Form link injection

The `SourcingSupplier` model already has `formToken`. The link is:
```
${process.env.FRONTEND_URL}/public/supplier-form/${supplier.formToken}
```
This is injected as a styled CTA button inside the email HTML.

### Template structure (user provides final copy — placeholders shown below)

**Intro Email**
```
Subject: Partnership Inquiry — Élan Exports × {company}
Body:
  Dear {contactPerson},
  [intro paragraph — who we are, why we're reaching out]
  [request to fill in the supplier form]
  [CTA button → form link]
  [signature]
```

**Follow-up 1** (3 days after intro)
```
Subject: Following Up — Supplier Form | Élan Exports
Body:
  Dear {contactPerson},
  [gentle reminder that we sent a form]
  [re-embed form link button]
  [signature]
```

**Follow-up 2** (3 days after FU1)
```
Subject: Reminder — We'd Love to Connect | Élan Exports
Body:
  Dear {contactPerson},
  [second reminder, slightly more direct]
  [form link button]
  [signature]
```

**Follow-up 3** (3 days after FU2 — final)
```
Subject: Last Follow-Up — Élan Exports Partnership
Body:
  Dear {contactPerson},
  [final outreach, mention this is the last email]
  [form link button]
  [signature]
```

> Templates are hardcoded initially in `emailTemplates.ts`. Phase 11 covers moving them to DB for
> admin editing — the interface contract (function signatures) does not change when that migration happens.

---

## Phase 5 — Database Schema Changes

**File:** `backend/prisma/schema.prisma`

### 5.1 `SourcingSupplier` — add `assignedGmailAccount`

```prisma
assignedGmailAccount  String?  @map("assigned_gmail_account")
```

### 5.2 `SourcingEmailCampaign` — add Gmail tracking fields + FU3

```prisma
model SourcingEmailCampaign {
  // existing fields unchanged
  followup3SentAt    DateTime?  @map("followup3_sent_at")   // was missing — campaign only had 2 FUs
  gmailThreadId      String?    @map("gmail_thread_id")      // intro email thread — for reply detection
  gmailMessageId     String?    @map("gmail_message_id")     // intro email message ID
  lastCheckedAt      DateTime?  @map("last_checked_at")      // last time reply-detector checked this
  // gmailAccount is read from supplier.assignedGmailAccount — not duplicated here
}
```

### 5.3 Migration

```bash
npx prisma migrate dev --name "sourcing_gmail_account_and_campaign_fields"
```

---

## Phase 6 — Backend Controller: Campaign Start & Follow-ups

**File:** `backend/src/controllers/sourcingEmailCampaign.controller.ts`

### 6.1 `startCampaign` — reads Gmail account from supplier, sends real email

```
POST /api/sourcing-campaigns/:id/start
Body: {}   ← no gmailAccount needed — already stored on the supplier
```

Steps:
1. Load `SourcingSupplier` — check `assignedGmailAccount` is set (400 if not)
2. Check no existing campaign (409 if exists)
3. Build intro email via `introEmailTemplate({ company, contactPerson, formLink })`
4. Call `gmailService.sendEmail(supplier.assignedGmailAccount, supplier.email, subject, html)`
5. Store `gmailThreadId` + `gmailMessageId` on the new campaign record
6. Set `status: "active"`, `currentStep: 1`, `introEmailSentAt: now`, `nextFollowupDue: now+3days`
7. Update supplier `status: "intro_sent"`
8. Create in-app notification

### 6.2 `sendFollowup` — auto-picks template, sends, advances step

```
POST /api/sourcing-campaigns/:id/send-followup
```

Steps:
1. Load campaign + supplier (need `assignedGmailAccount`, `email`, `contactPerson`, `formToken`)
2. Validate campaign is `active`
3. Pick template by `currentStep`: 1→FU1, 2→FU2, 3→FU3
4. Send via `gmailService.sendEmail(supplier.assignedGmailAccount, ...)`
5. Advance `currentStep`, set `followupNSentAt: now`
6. If `currentStep` was 3 (FU3 just sent):
   - Set `nextFollowupDue: now+3days` — still wait for possible reply
   - Set supplier `status: "followup3_sent"`
7. Else: set `nextFollowupDue: now+3days`, update supplier status to `followup{N}_sent`
8. Create notification

### 6.3 `markResponseReceived` — auto-converts to New Supplier

```
POST /api/sourcing-campaigns/:id/mark-response
```

Steps:
1. Set campaign `status: "response_received"`, `responseReceivedAt: now`, clear `nextFollowupDue`
2. Call `autoConvertToNewSupplier(sourcingId)` (see 6.5)
3. Create notification: "{company} responded — converted to New Supplier"

### 6.4 Auto-finalize after FU3 no-reply (called by scheduler)

When the scheduler detects that `currentStep = 4` and `nextFollowupDue` has passed with no reply:
1. Set campaign `status: "completed"`
2. Call `autoMoveToOldSupplier(sourcingId)`

### 6.5 Helper: `autoConvertToNewSupplier(sourcingId)`

- Reads all fields from `SourcingSupplier`
- Creates `NewSupplier` record — maps every field 1-to-1 (company, email, phone, contactPerson,
  productCategory, product, country, certifications, accountManager, all 11 form sections, files, etc.)
- Sets `NewSupplier.supplierStage = "Onboarding"`
- Sets `NewSupplier.formToken = randomUUID()` (fresh token for onboarding form)
- Updates `SourcingSupplier.status = "converted_to_new"`
- Returns `{ newSupplierId }` for the notification link

### 6.6 Helper: `autoMoveToOldSupplier(sourcingId)`

- Reads `SourcingSupplier`
- Creates `OldSupplier` record: `company`, `country`, `product`, `productCategory`,
  `certifications`, `accountManager`, `notes`,
  `reasonInactive: "No response to follow-up email campaign"`,
  `currentStatus: "Inactive"`, `supplierStage: "Closed"`
- Updates `SourcingSupplier.status = "no_response"`
- Creates notification: "{company} moved to Old Suppliers — no response after 3 follow-ups"

---

## Phase 7 — Gmail Reply Detection Scheduler

**File:** `backend/src/services/gmailReplyDetector.ts`

### Schedule: every 30 minutes (`*/30 * * * *`)

### Job: `checkCampaignReplies()`

```
1. Query SourcingEmailCampaigns where:
     status = "active" AND gmailThreadId IS NOT NULL

2. For each campaign:
   a. Load supplier.assignedGmailAccount
   b. Call gmailService.checkForReply(assignedGmailAccount, gmailThreadId)
   c. If reply found:
        → run markResponseReceived logic (auto-converts to New Supplier)
        → create notification
   d. Update campaign.lastCheckedAt = now

3. Log: "Reply check: {N} campaigns checked, {M} replies detected"
```

---

## Phase 8 — Auto-Send Follow-up Scheduler

**File:** `backend/src/services/emailCampaignScheduler.ts` (modify existing)

Add `autoSendDueFollowups()` job alongside the existing admin reminder job:

### Schedule: 9:00 AM daily (`0 9 * * *`)

```
1. Query active campaigns where nextFollowupDue <= today

2. For each:
   a. Check for reply first (gmailService.checkForReply) — if replied, convert and skip sending
   b. If no reply: call sendFollowup logic (send email, advance step)
   c. If currentStep was already 4 and no reply: call autoMoveToOldSupplier

3. Log results
```

This makes the campaign **fully automatic** — after the user clicks "Start", every follow-up
goes out on schedule with zero manual work required. Manual "Send Now" button still exists as
an override.

---

## Phase 9 — Routes

### 9.1 Campaign routes

**File:** `backend/src/routes/sourcingEmailCampaign.routes.ts`

```typescript
GET    /api/sourcing-campaigns                     // list all campaigns
GET    /api/sourcing-campaigns/due                 // campaigns with nextFollowupDue <= today
GET    /api/sourcing-campaigns/:id                 // single campaign

POST   /api/sourcing-campaigns/:id/start           // send intro email (uses supplier.assignedGmailAccount)
POST   /api/sourcing-campaigns/:id/send-followup   // manually send next follow-up
POST   /api/sourcing-campaigns/:id/mark-response   // record reply → auto-convert to New Supplier
```

### 9.2 Gmail account management routes

**File:** `backend/src/routes/gmail.routes.ts` (new)

```typescript
GET    /api/gmail/accounts                         // list all accounts + connection status
GET    /api/gmail/auth?email=sales@elanexports.com // initiate OAuth — redirects to Google
GET    /api/gmail/callback                         // OAuth callback — saves refresh token
```

---

## Phase 10 — Gmail OAuth Controller

**File:** `backend/src/controllers/gmail.controller.ts` (new)

```typescript
// GET /api/gmail/accounts
// Returns: [{ email, connected: boolean, label: "Account 1" }, ...]
export async function listAccounts(req, res) {
  // Read GMAIL_ACCOUNT_{1,2,3}_EMAIL from env
  // For each: check if AppSetting key gmail_refresh_token_{email} exists
  // Return array with connected status
}

// GET /api/gmail/auth?email=...
// Builds Google OAuth URL with state=email, redirects
export async function initiateAuth(req, res) { ... }

// GET /api/gmail/callback?code=...&state=email
// Exchanges code for tokens, saves refresh_token to AppSetting, redirects to /settings/gmail
export async function handleCallback(req, res) { ... }
```

---

## Phase 11 — Frontend Changes

### 11.1 Add Sourcing Supplier form — Gmail account dropdown

**File:** `frontend/src/pages/SourcingSupplierPage.tsx` (or the add supplier dialog component)

- Fetch connected Gmail accounts from `GET /api/gmail/accounts` on mount
- Render a `Select` dropdown for **"Campaign Email Account"** — shows only connected accounts
- If no accounts connected, show: `"No Gmail accounts connected — configure in Settings"` with a link
- Pass `assignedGmailAccount` in the POST body when submitting

### 11.2 Supplier detail page — assigned account badge + campaign timeline

**File:** `frontend/src/pages/SourcingSupplierDetailsPage.tsx`

**Assigned account display (info section):**
```
Campaign Email:  📧 sales@elanexports.com  [change ✎]
```
The edit (✎) icon opens an inline dropdown — locked once campaign has started.

**Campaign timeline card:**
```
┌──────────────────────────────────────────────┐
│  Email Campaign                              │
│  Sending from: sales@elanexports.com         │
│  ────────────────────────────────────────    │
│  ✅ Intro Email       Sent  Apr 10, 2026     │
│  ⏳ Follow-up 1       Due   Apr 13, 2026     │
│  ○  Follow-up 2       —     Apr 16 (est.)    │
│  ○  Follow-up 3       —     Apr 19 (est.)    │
│  ────────────────────────────────────────    │
│  [Mark as Responded]  [Send Follow-up Now]   │
└──────────────────────────────────────────────┘
```

- "Start Campaign" button is shown only when `campaign = null` and `assignedGmailAccount` is set
- "Send Follow-up Now" is shown when campaign is active and a follow-up is due (or overrideable)
- "Mark as Responded" stops campaign + triggers auto-convert
- Auto-refreshes every 60s via React Query `refetchInterval`

### 11.3 Sourcing suppliers list — campaign status column

**File:** `frontend/src/pages/SourcingSupplierPage.tsx`

Add a "Campaign" column to the table:
```
Company      | Email           | Campaign          | Next Due
─────────────────────────────────────────────────────────────
Acme Foods   | acme@example.com| ⏳ Follow-up 1 due | Apr 13
Beta Spices  | beta@example.com| ✅ Responded        | —
Gamma Herbs  | gam@example.com | ○ Not started       | —
```

### 11.4 Gmail Accounts settings page (admin only)

**File:** `frontend/src/pages/SettingsPage.tsx` or `frontend/src/pages/admin/GmailSettingsPage.tsx` (new)

```
Gmail Campaign Accounts
───────────────────────
Account 1   sales@elanexports.com        ● Connected     [Reconnect]
Account 2   sourcing@elanexports.com     ○ Not connected [Connect →]
Account 3   procurement@elanexports.com  ○ Not connected [Connect →]

ℹ️  Connect each account via Google OAuth to enable email campaigns.
    Accounts must have Gmail API access enabled in Google Cloud.
```

---

## Phase 12 — Email Template Management (Optional Enhancement)

Allow admins to edit email templates without a code deploy:

- Store in `AppSetting` table with keys:
  - `email_template_intro` — `{ subject: string, html: string }`
  - `email_template_followup1`, `email_template_followup2`, `email_template_followup3`
- Available variables: `{{contactPerson}}`, `{{company}}`, `{{formLink}}`
- Simple rich-text / HTML textarea editor in the admin Gmail settings page
- `emailTemplates.ts` checks DB first, falls back to hardcoded defaults

---

## Implementation Order

| # | Task | Files | Complexity |
|---|------|-------|------------|
| 1 | Add `assignedGmailAccount` to `SourcingSupplier` schema + migration | `schema.prisma` | Low |
| 2 | Add `followup3SentAt` + Gmail fields to `SourcingEmailCampaign` schema | `schema.prisma` | Low |
| 3 | Run migration | — | Low |
| 4 | Install `googleapis` | `package.json` | Low |
| 5 | Create `gmailService.ts` — send + reply check + account listing | new file | Medium |
| 6 | Create `emailTemplates.ts` — 4 templates with form link injection | new file | Low |
| 7 | Update `createSourcingSupplier` controller — accept + save `assignedGmailAccount` | `sourcingSuppliers.controller.ts` | Low |
| 8 | Create `gmail.controller.ts` + `gmail.routes.ts` — OAuth flow + account list | new files | Medium |
| 9 | Update `startCampaign` — send real email, no account param needed | `sourcingEmailCampaign.controller.ts` | Medium |
| 10 | Add `sendFollowup` endpoint — replaces `markEmailSent` | `sourcingEmailCampaign.controller.ts` | Medium |
| 11 | Add `autoConvertToNewSupplier` helper | `sourcingEmailCampaign.controller.ts` | Medium |
| 12 | Add `autoMoveToOldSupplier` helper | `sourcingEmailCampaign.controller.ts` | Low |
| 13 | Update `markResponseReceived` — calls auto-convert | `sourcingEmailCampaign.controller.ts` | Low |
| 14 | Create `gmailReplyDetector.ts` — 30-min reply-check cron | new file | Medium |
| 15 | Update `emailCampaignScheduler.ts` — add `autoSendDueFollowups` job | existing file | Medium |
| 16 | Register new routes + schedulers in `index.ts` | `index.ts` | Low |
| 17 | Frontend: add Gmail account dropdown to Add Supplier dialog | `SourcingSupplierPage.tsx` | Medium |
| 18 | Frontend: campaign timeline card + assigned account badge | `SourcingSupplierDetailsPage.tsx` | Medium |
| 19 | Frontend: campaign status column in supplier list | `SourcingSupplierPage.tsx` | Low |
| 20 | Frontend: Gmail accounts settings page | new page | Medium |

---

## New Files to Create

```
backend/src/services/gmailService.ts
backend/src/services/emailTemplates.ts
backend/src/services/gmailReplyDetector.ts
backend/src/controllers/gmail.controller.ts
backend/src/routes/gmail.routes.ts
frontend/src/pages/admin/GmailSettingsPage.tsx   (or add section to existing settings)
```

## Existing Files to Modify

```
backend/prisma/schema.prisma
  └─ Add assignedGmailAccount to SourcingSupplier
  └─ Add followup3SentAt + gmailThreadId + gmailMessageId + lastCheckedAt to SourcingEmailCampaign

backend/src/controllers/sourcingSuppliers.controller.ts
  └─ Accept + persist assignedGmailAccount in createSourcingSupplier

backend/src/controllers/sourcingEmailCampaign.controller.ts
  └─ startCampaign — sends real email via gmailService (reads account from supplier)
  └─ markEmailSent → replaced by sendFollowup
  └─ markResponseReceived — calls autoConvertToNewSupplier
  └─ Add autoConvertToNewSupplier + autoMoveToOldSupplier helpers

backend/src/routes/sourcingEmailCampaign.routes.ts
  └─ Add /send-followup route

backend/src/services/emailCampaignScheduler.ts
  └─ Add autoSendDueFollowups job at 9 AM

backend/src/index.ts
  └─ Register gmail.routes
  └─ Start gmailReplyDetector cron

backend/.env.example
  └─ Document all GMAIL_* env vars

frontend/src/pages/SourcingSupplierPage.tsx
  └─ Add Gmail account dropdown to Add Supplier form
  └─ Add campaign status column to supplier table

frontend/src/pages/SourcingSupplierDetailsPage.tsx
  └─ Assigned account badge (editable before campaign starts)
  └─ Campaign timeline card
```

---

## Dependencies

```bash
# Backend only — one new package
npm install googleapis
```

---

## Key Design Decisions

**Why assign Gmail account at supplier creation (not at campaign start)?**
The account assignment is a property of the *relationship* between Élan and this supplier — not just
the campaign. Locking it at creation time means: (a) no decision-fatigue at campaign start time,
(b) the supplier's inbox always sees emails from the same address, (c) reply detection always knows
which mailbox to check, (d) if a team member starts the campaign, they can't accidentally switch accounts.

**Why Gmail API instead of nodemailer SMTP?**
SMTP can send emails but cannot read them. Gmail API (`gmail.users.threads.get`) gives us the thread
model — a single call tells us whether the supplier replied. This is what powers auto-conversion
without any manual "mark replied" step.

**Why store refresh tokens in AppSetting (DB) instead of `.env`?**
Refresh tokens are rotated by Google when the OAuth flow is re-run. Storing in `.env` on a cloud
platform requires a redeploy every time a token is refreshed or a new account is connected.
`AppSetting` persists across deploys and can be updated via the OAuth callback in real time.

**Reply detection timing**
The 30-minute reply-check cron + 9 AM auto-send cron work together:
- Reply-check catches responses quickly (within 30 min of receiving)
- Auto-send handles the 3-day follow-up trigger at a consistent time
- Manual "Send Now" button remains available for human override at any time
