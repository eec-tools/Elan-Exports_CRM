# Template-Bound Signature Implementation Plan

## Problem

Currently signatures are linked to Gmail accounts (stored in `AppSetting` as `gmail_default_signature_{account}`). When a campaign starts, the intro email uses whatever signature is default for that account at that moment. If the signature default is changed after the intro is sent, all follow-up emails pick up the new signature — breaking consistency within a campaign thread.

## Solution

Bind a signature directly to each `BuyerEmailCampaignTemplate`. When a template has a signature selected, every email in that campaign (intro + all 3 follow-ups) uses that exact signature. The per-account default remains as a fallback for templates with no signature selected.

---

## Affected Files

| File | Change Type |
|------|-------------|
| `backend/prisma/schema.prisma` | Add `signatureId` field + relation to `BuyerEmailCampaignTemplate` |
| `backend/prisma/migrations/` | New migration file (auto-generated) |
| `backend/src/controllers/buyerEmailCampaignTemplate.controller.ts` | Include signature in CRUD operations |
| `backend/src/controllers/sourcingBuyerEmailCampaign.controller.ts` | Priority-fetch signature from template |
| `frontend/src/pages/BuyerEmailTemplatesPage.tsx` | Add signature selector in template editor |

---

## Step 1 — Database Migration (Zero Data Loss)

### What to change in `schema.prisma`

In `BuyerEmailCampaignTemplate` (around line 673), add two new lines:

```prisma
model BuyerEmailCampaignTemplate {
  id               String   @id @default(uuid())
  name             String
  isDefault        Boolean  @default(false) @map("is_default")
  introSubject     String   @map("intro_subject")
  introBody        String   @map("intro_body")
  followup1Subject String   @map("followup1_subject")
  followup1Body    String   @map("followup1_body")
  followup2Subject String   @map("followup2_subject")
  followup2Body    String   @map("followup2_body")
  followup3Subject String   @map("followup3_subject")
  followup3Body    String   @map("followup3_body")
  createdBy        String?  @map("created_by")
  // NEW FIELDS:
  signatureId      String?  @map("signature_id")
  signature        EmailSignature? @relation(fields: [signatureId], references: [id], onDelete: SetNull)
  // END NEW FIELDS
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@map("buyer_email_campaign_templates")
}
```

In `EmailSignature` (around line 822), add the back-relation:

```prisma
model EmailSignature {
  id        String   @id @default(uuid())
  name      String
  role      String   @default("")
  company   String   @default("")
  tagline   String   @default("")
  links     Json     @default("[]")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  // NEW LINE:
  buyerTemplates BuyerEmailCampaignTemplate[]

  @@map("email_signatures")
}
```

### Why this is safe

- `signatureId` is **nullable** (`String?`) — existing templates get `NULL`, which is valid
- `onDelete: SetNull` — if a signature is deleted, templates just lose the binding (no cascade delete, no crash)
- The migration is a pure `ALTER TABLE ADD COLUMN` — no existing rows or data are touched
- All existing campaigns continue to work via the account-default fallback (see Step 3)

### Command to run

```bash
cd backend && npx prisma migrate dev --name add_signature_to_buyer_template
```

---

## Step 2 — Backend: Buyer Template Controller

**File:** `backend/src/controllers/buyerEmailCampaignTemplate.controller.ts`

### Changes

**`listBuyerEmailTemplates`** — include the signature in the response:
```typescript
const templates = await prisma.buyerEmailCampaignTemplate.findMany({
  include: { signature: true },   // ADD THIS
  orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
});
```

**`getBuyerEmailTemplate`** — include the signature:
```typescript
const template = await prisma.buyerEmailCampaignTemplate.findUnique({
  where: { id },
  include: { signature: true },   // ADD THIS
});
```

**`createBuyerEmailTemplate`** — accept and save `signatureId`:
```typescript
// In the destructure of req.body, add:
const { name, isDefault, introSubject, introBody, ..., signatureId } = req.body;

// In the prisma.create data block, add:
signatureId: signatureId ?? null,
```

**`updateBuyerEmailTemplate`** — accept and save `signatureId`:
```typescript
// In the destructure of req.body, add:
const { name, isDefault, introSubject, ..., signatureId } = req.body;

// In the prisma.update data block, add:
signatureId: signatureId ?? null,
```

No other controller changes needed — delete logic is unchanged because `onDelete: SetNull` handles cleanup automatically.

---

## Step 3 — Backend: Campaign Controller (Core Fix)

**File:** `backend/src/controllers/sourcingBuyerEmailCampaign.controller.ts`

This is where the signature consistency bug lives. Both `startCampaignForBuyer` and `executeSendStep` currently call `fetchDefaultSignatureForAccount(fromEmail)`. We change the priority logic.

### New helper (add near the top of the file)

```typescript
async function resolveSignatureForBuyer(
  buyer: { assignedGmailAccount: string | null; emailTemplateId: string | null }
): Promise<SignatureData | null> {
  // 1. If buyer has a custom template, check if that template has a signature bound
  if (buyer.emailTemplateId) {
    const tpl = await prisma.buyerEmailCampaignTemplate.findUnique({
      where: { id: buyer.emailTemplateId },
      include: { signature: true },
    });
    if (tpl?.signature) {
      return tpl.signature as SignatureData;
    }
  }
  // 2. Fall back to the per-account default (existing behaviour, fully backward-compatible)
  const fromEmail = buyer.assignedGmailAccount ?? BUYER_GMAIL_ACCOUNT;
  return fetchDefaultSignatureForAccount(fromEmail);
}
```

### In `startCampaignForBuyer` (around line 61)

Replace:
```typescript
const signature = await fetchDefaultSignatureForAccount(fromEmail);
```
With:
```typescript
const signature = await resolveSignatureForBuyer(buyer);
```

### In `executeSendStep` (around line 171)

Replace:
```typescript
const signature = await fetchDefaultSignatureForAccount(fromEmail);
```
With:
```typescript
const signature = await resolveSignatureForBuyer(buyer);
```

### Why this is fully backward-compatible

| Template has `signatureId`? | Result |
|-----------------------------|--------|
| Yes | Uses the template's bound signature for ALL emails in the campaign |
| No | Falls back to `fetchDefaultSignatureForAccount` (existing behaviour, no regression) |
| No custom template at all | Falls back to `fetchDefaultSignatureForAccount` (existing behaviour, no regression) |

---

## Step 4 — Frontend: Template Editor

**File:** `frontend/src/pages/BuyerEmailTemplatesPage.tsx`

### 4a — Add signatures query

Near the top of the component where other queries are declared:

```typescript
const { data: signaturesData } = useQuery({
  queryKey: ["email-signatures"],
  queryFn: () => api.get<{ signatures: Signature[] }>("/email-signatures").then(r => r.data),
});
const allSignatures = signaturesData?.signatures ?? [];
```

(The `Signature` type already exists from the signatures-related code in this file.)

### 4b — Add `signatureId` to template state

In the form state object (where `name`, `isDefault`, `introSubject`, etc. are managed), add:
```typescript
signatureId: (editingTemplate?.signatureId ?? "") as string,
```

Include `signatureId` in the save mutation payload alongside the other template fields.

### 4c — Add selector UI in the template editor

Add a new section at the bottom of the template editor form (below the Follow-up 3 tab content, before the Save button). The placement is intentional — it's a template-level setting, not a per-step setting:

```
┌─────────────────────────────────────────────────────┐
│  Signature for this Template                        │
│                                                     │
│  [Dropdown: "— None (use account default) —"   ▼]  │
│                                                     │
│  ┌────── Preview (shows if signature selected) ─┐  │
│  │  [Amber left-border card]                    │  │
│  │  Signature Name                              │  │
│  │  Role · Company                              │  │
│  │  Links…                                      │  │
│  │  Tagline                                     │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Dropdown options:**
- First option: `— None (use account default) —` (value: `""`)
- Then one option per signature from `allSignatures`: `{sig.name} — {sig.role}` (value: `sig.id`)

**Preview card:** Only renders when a signature is selected. Reuse the same HTML-preview logic already present in the existing signature preview section of this page.

**Label hint text:** `"All emails sent with this template (intro + follow-ups) will use this signature."`

### 4d — Template list: show bound signature

In the template cards in the list view, add a small badge below the template name showing the bound signature name (if any), e.g.:

```
[ Test Template ]
  ★ Default
  Signature: Shirali
```

Use `template.signature?.name` — returned from the updated `include: { signature: true }` in the API response.

---

## Step 5 — TypeScript Types

**File:** `frontend/src/types/` (wherever `BuyerEmailCampaignTemplate` is typed, likely `types.ts` or similar)

Add to the template interface:
```typescript
interface BuyerEmailCampaignTemplate {
  // ... existing fields ...
  signatureId?: string | null;
  signature?: EmailSignature | null;  // populated when include: { signature: true }
}
```

---

## Rollout & Safety Checklist

- [ ] Run migration: `cd backend && npx prisma migrate dev --name add_signature_to_buyer_template`
- [ ] Verify migration SQL (auto-generated) is only `ALTER TABLE buyer_email_campaign_templates ADD COLUMN signature_id UUID REFERENCES email_signatures(id) ON DELETE SET NULL`
- [ ] Test: existing template with no signature set → campaign still sends with account-default signature (backward-compat)
- [ ] Test: set signature on a template → both intro and follow-up 1/2/3 use that signature
- [ ] Test: delete a signature that's bound to a template → template `signatureId` becomes `null`, falls back to account default (no crash)
- [ ] Test: template list page loads — cards show signature badge where bound
- [ ] No existing buyer records, campaign records, or signature records need migration (purely additive schema change)

---

## What is NOT Changed

- `EmailSignature` CRUD and the `SignaturesPage` — fully preserved, per-account defaults still work as fallback
- `SourcingBuyerDetailsPage` — start/send-followup buttons untouched
- `emailTemplates.ts` service — `buildSignatureHtml()` and all template rendering untouched
- Supplier (`EmailCampaignTemplate`) — separate model, not touched
- All existing `AppSetting` keys for account defaults — still read and used as fallback
