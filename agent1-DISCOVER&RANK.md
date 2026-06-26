# Agent 1 — Discover & Rank
### Elan Exports CRM · AI Buyer Discovery Pipeline

---

```
Status:      PLANNING                 Last Updated: 2026-06-26
Owner:       Harsh (Build)            Trigger:      Mohita (Runs)
AI (test):   Groq llama-3.3-70b      AI (prod):    Claude claude-sonnet-4-6
Stack:       Node / TypeScript / Prisma / PostgreSQL / React
```

---

## Table of Contents

1. [What This Agent Does](#1-what-this-agent-does)
2. [Key Decisions](#2-key-decisions)
3. [Tech Stack](#3-tech-stack)
4. [Full Data Flow](#4-full-data-flow)
5. [Scoring Model](#5-scoring-model)
6. [Phase-by-Phase Plan](#6-phase-by-phase-plan)
   - [Phase 1 — Foundation](#phase-1--foundation--infrastructure--days-12)
   - [Phase 2 — Input Handler](#phase-2--input-handler--days-23)
   - [Phase 3 — Company Discovery](#phase-3--company-discovery-firecrawl--days-36)
   - [Phase 4 — Email Engine](#phase-4--email-discovery--verification-hunterio--days-67)
   - [Phase 5 — AI Scoring](#phase-5--ai-scoring-engine--days-79)
   - [Phase 6 — Orchestrator](#phase-6--agent-orchestrator--days-910)
   - [Phase 7 — API Routes](#phase-7--api-routes--days-910)
   - [Phase 8 — Frontend UI](#phase-8--frontend-ui--days-1113)
7. [File Structure](#7-file-structure)
8. [Database Schema](#8-database-schema)
9. [API Contract](#9-api-contract)
10. [Rate Limits & Costs](#10-rate-limits--costs)
11. [Switching to Claude (Production)](#11-switching-to-claude-production)
12. [Testing Checklist](#12-testing-checklist)
13. [Risk Register](#13-risk-register)
14. [Phases Summary Table](#14-phases-summary-table)

---

## 1. What This Agent Does

Mohita enters **two inputs** — a country and a product category. Agent 1 runs autonomously and returns a **ranked list of import companies** with verified contacts, fit scores, and plain-English rationale.

```
INPUT                          OUTPUT
──────────────────             ─────────────────────────────────────────────
Country:  Germany        →     Rank │ Company        │ Email (verified) │ Score │ Tier
Category: Organic Food         ─────┼────────────────┼──────────────────┼───────┼──────
                                 1  │ Bioland GmbH   │ k.huber@bio…     │  87   │ HIGH
                                 2  │ NaturKost AG   │ a.schulz@nat…    │  74   │ HIGH
                                 3  │ GreenSource    │ m.lee@green…     │  61   │ HIGH
                                ...│ ...            │ ...              │  ...  │ ...
```

**Mandatory output fields — both must be present or the company is discarded:**
- **Company name** — required, always extracted from Firecrawl
- **Verified email** — required, must be `valid` or `deliverable` via Hunter.io. No verified email = company skipped entirely, not flagged.

Everything else (LinkedIn, job title, employee count, revenue, etc.) is optional enrichment.

**What makes it High Priority:** imports the right product, sources from Asia/India, the right company size ($10M–$200M or 50–500 employees), has a reachable procurement contact, and is in EEC's target market.

**Trigger time → results:** ~8–15 minutes per run (rate-limit sleep dominates).

---

## 2. Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Company discovery source | **Firecrawl** (not Apollo) | No paid Apollo plan. Firecrawl search hits Europages, Kompass, and general web — sufficient with LLM enrichment. |
| AI for scoring (testing) | **Groq API** (free) | Free tier, fast, `llama-3.3-70b-versatile` gives good JSON output. Swap is 5 lines when moving to production. |
| AI for scoring (production) | **Claude claude-sonnet-4-6** | Better reasoning, consistent JSON, EEC already uses Anthropic. |
| Email discovery | **Hunter.io REST API** | MCP available but direct REST API is simpler for this use case. Free tier: 25 searches + 50 verifications/month. |
| Run model | **Async + polling** | Agent takes 8–15 min. Fire-and-forget with `runId` returned immediately. Frontend polls every 5s. |
| Data cap | **50 companies/run** | Hunter.io free tier ceiling. Keeps runs fast and manageable. |
| Mandatory fields | **Company name + verified email** | No verified email = company discarded before scoring. No exceptions — Agent 2 cannot email a company without an address. |
| Discard threshold | **Score < 30** | Companies this low waste Agent 2 quota. Saved to DB for audit but excluded from results. |

---

## 3. Tech Stack

| Layer | Tool | Role |
|-------|------|------|
| Runtime | Node.js + TypeScript | Existing backend |
| Web discovery | Firecrawl API (`@mendable/firecrawl-js`) | Search queries + website scraping |
| Email | Hunter.io REST API | Domain search + email verification |
| AI — testing | Groq API (`groq-sdk`) | Scoring, rationale generation |
| AI — production | Claude API (`@anthropic-ai/sdk`) | Drop-in swap, 5-line change |
| Database | PostgreSQL + Prisma | 3 new tables added to existing schema |
| HTTP | Express.js | 4 new endpoints |
| Frontend | React (existing) | New Agent 1 page + 4 components |

---

## 4. Full Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  MOHITA TRIGGERS                                                │
│  Country: "Germany"   Category: "Organic Food"                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
              ┌─────────────────────────────┐
              │   1.1  INPUT HANDLER        │
              │  • Validate both fields     │
              │  • Map category → 5 search  │
              │    query templates          │
              │  • Map country → native     │
              │    language hint query      │
              │  • Build 3 directory queries│
              │    (Europages, Kompass, ...) │
              └──────────────┬──────────────┘
                             │  8 total search queries
                             ▼
              ┌─────────────────────────────┐
              │   1.2  FIRECRAWL SEARCH     │
              │  • Run queries one-by-one   │
              │  • 10 results per query     │
              │  • Deduplicate by domain    │
              │  • Cap at 50 companies      │
              └──────────────┬──────────────┘
                             │  up to 50 raw companies
                             ▼
              ┌─────────────────────────────┐
              │   1.2b WEBSITE ENRICHMENT   │◄── (parallel per company)
              │  • Firecrawl scrape homepage│
              │  • Extract: products,       │
              │    employee count, keywords │
              │  • Detect Asia/India signals│
              │    via keyword matching     │
              └──────────────┬──────────────┘
                             │  enriched profiles
                             ▼
              ┌─────────────────────────────┐
              │   1.3  HUNTER.IO EMAILS     │
              │  • Domain search per company│
              │  • Filter: procurement/     │
              │    import/buying titles     │
              │  • Verify top 1–2 emails    │
              └──────────┬──────────────────┘
                         │
             ┌───────────┴────────────────┐
             │  Verified email found?     │
             └───────────┬────────────────┘
                   NO    │    YES
                   ▼     │     ▼
          ┌──────────┐   │  ┌──────────────────────────┐
          │ DISCARD  │   │  │  Pass to scoring         │
          │ save to  │   │  │  (email mandatory — ✓)   │
          │ DB with  │   │  └──────────┬───────────────┘
          │ reason   │   │             │
          └──────────┘   └─────────────┘
                                       │  only verified-email companies
                                       ▼
              ┌─────────────────────────────┐
              │   1.4  GROQ SCORING         │
              │  • 5 dimensions × 20 pts    │
              │  • Total 0–100              │
              │  • Tier: High/Med/Low/Disc  │
              │  • 2–3 line rationale       │
              └──────────────┬──────────────┘
                             │  scored + tiered companies
                             ▼
              ┌─────────────────────────────┐
              │   1.5  OUTPUT               │
              │  • Save to PostgreSQL       │
              │  • Sort descending by score │
              │  • Expose via REST API      │
              │  • Display in React UI      │
              └─────────────────────────────┘
```

---

## 5. Scoring Model

Each company is scored across **5 dimensions, 20 points each** (max 100).

```
┌────┬──────────────────────────────┬─────────────────────────────────────────────┐
│ D# │ Dimension                    │ Scoring Guide                               │
├────┼──────────────────────────────┼─────────────────────────────────────────────┤
│ D1 │ Product Category Match       │ 20 = perfect match                          │
│    │                              │ 10 = adjacent/partial                       │
│    │                              │  5 = possible / unclear                     │
│    │                              │  0 = no match                               │
├────┼──────────────────────────────┼─────────────────────────────────────────────┤
│ D2 │ Asia / India Sourcing Signal │ 20 = confirmed India sourcing               │
│    │                              │ 15 = confirmed Asia (non-India)             │
│    │                              │  8 = possible / partial signal              │
│    │                              │  0 = no signal found                        │
├────┼──────────────────────────────┼─────────────────────────────────────────────┤
│ D3 │ Company Size ICP Fit         │ 20 = clearly in range ($10M–$200M / 50–500) │
│    │                              │ 12 = likely in range (data thin)            │
│    │                              │  5 = unclear                                │
│    │                              │  0 = clearly out of range                   │
├────┼──────────────────────────────┼─────────────────────────────────────────────┤
│ D4 │ Decision-Maker Reachability  │ 20 = verified email of procurement contact  │
│    │                              │ 12 = verified email, title unknown          │
│    │                              │  8 = verified email, non-procurement title  │
│    │                              │  0 = no verified email → NEVER REACHES HERE │
│    │                              │      (discarded before scoring)             │
├────┼──────────────────────────────┼─────────────────────────────────────────────┤
│ D5 │ Geography Alignment          │ 20 = core EEC target market                 │
│    │                              │ 12 = secondary target market                │
│    │                              │  5 = adjacent market                        │
│    │                              │  0 = wrong geography entirely               │
└────┴──────────────────────────────┴─────────────────────────────────────────────┘
```

**Priority Tiers:**

```
Score 70–100  →  HIGH PRIORITY    ← pass to Agent 2 immediately
Score 45–69   →  MEDIUM PRIORITY  ← pass to Agent 2
Score 30–44   →  LOW PRIORITY     ← saved, not passed to Agent 2
Score 0–29    →  DISCARD          ← saved for audit only, excluded from results
```

---

## 6. Phase-by-Phase Plan

---

### Phase 1 — Foundation & Infrastructure · Days 1–2

**Deliverables:** dependencies installed, env vars set, 3 new DB tables migrated.

#### Install Dependencies

```bash
# backend/
npm install groq-sdk @mendable/firecrawl-js axios
npm install --save-dev @types/axios
```

#### Environment Variables

Add to `backend/.env`:

```env
# ── AI: Groq (testing — free) ──────────────────────────────────
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile

# ── Web Discovery ───────────────────────────────────────────────
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxxxx

# ── Email ───────────────────────────────────────────────────────
HUNTER_API_KEY=xxxxxxxxxxxxxxxxxxxx

# ── AI: Claude (production — uncomment when ready) ─────────────
# ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
# CLAUDE_MODEL=claude-sonnet-4-6
```

#### Database — 3 New Prisma Models

Add to `backend/prisma/schema.prisma`:

```prisma
// ── Agent 1: Discover & Rank ────────────────────────────────────

model AgentRun {
  id              String              @id @default(uuid())
  triggeredBy     String              @map("triggered_by")
  country         String
  productCategory String              @map("product_category")
  status          AgentRunStatus      @default(pending)
  totalFound      Int                 @default(0) @map("total_found")
  totalScored     Int                 @default(0) @map("total_scored")
  totalHighPrio   Int                 @default(0) @map("total_high_prio")
  totalMedPrio    Int                 @default(0) @map("total_med_prio")
  errorMessage    String?             @map("error_message")
  startedAt       DateTime?           @map("started_at")
  completedAt     DateTime?           @map("completed_at")
  createdAt       DateTime            @default(now()) @map("created_at")
  companies       DiscoveredCompany[]

  @@map("agent_runs")
}

model DiscoveredCompany {
  id               String          @id @default(uuid())
  agentRunId       String          @map("agent_run_id")
  agentRun         AgentRun        @relation(fields: [agentRunId], references: [id], onDelete: Cascade)
  name             String
  website          String?
  country          String
  industry         String?
  employeeRange    String?         @map("employee_range")
  revenueRange     String?         @map("revenue_range")
  description      String?
  productsImported String?         @map("products_imported")
  asiaConnection   Boolean         @default(false) @map("asia_connection")
  indiaConnection  Boolean         @default(false) @map("india_connection")
  sourceUrl        String?         @map("source_url")
  fitScore         Int?            @map("fit_score")
  scoreDim1        Int?            @map("score_dim1")
  scoreDim2        Int?            @map("score_dim2")
  scoreDim3        Int?            @map("score_dim3")
  scoreDim4        Int?            @map("score_dim4")
  scoreDim5        Int?            @map("score_dim5")
  priorityTier     PriorityTier?   @map("priority_tier")
  rationale        String?
  discardReason    String?         @map("discard_reason")
  contacts         AgentContact[]
  createdAt        DateTime        @default(now()) @map("created_at")

  @@map("discovered_companies")
}

model AgentContact {
  id               String            @id @default(uuid())
  companyId        String            @map("company_id")
  company          DiscoveredCompany @relation(fields: [companyId], references: [id], onDelete: Cascade)
  name             String?
  title            String?
  email            String            // NOT NULL — mandatory field; contacts without verified email are never saved
  emailStatus      String            @map("email_status")   // "valid" | "deliverable" only; others discarded in orchestrator
  emailConfidence  Int?              @map("email_confidence")
  linkedinUrl      String?           @map("linkedin_url")
  isPrimary        Boolean           @default(false) @map("is_primary")
  createdAt        DateTime          @default(now()) @map("created_at")

  @@map("agent_contacts")
}

enum AgentRunStatus {
  pending
  running
  completed
  failed
}

enum PriorityTier {
  High
  Medium
  Low
}
```

Run migration:

```bash
npx prisma migrate dev --name add_agent1_tables
```

---

### Phase 2 — Input Handler · Days 2–3

**File:** `backend/src/agents/agent1/inputHandler.ts`  
**Deliverable:** Validated inputs → 8 search queries ready for Firecrawl.

#### Product Category → Search Query Templates

```typescript
// backend/src/agents/agent1/inputHandler.ts

export const CATEGORY_SEARCH_MAP: Record<string, string[]> = {
  "Organic Food": [
    "organic food importer wholesale",
    "organic produce distributor import",
    "certified organic food buyer sourcing Asia",
    "bio food import wholesaler",
    "natural organic food trading company",
  ],
  "Textiles": [
    "textile fabric importer wholesale",
    "garment clothing importer sourcing India",
    "textile buyer manufacturer India supplier",
    "fabric wholesale importer trading",
    "apparel sourcing company importer",
  ],
  "Seafood": [
    "seafood importer wholesale distributor",
    "frozen fish seafood trading company",
    "seafood buyer India supplier",
    "shrimp prawn importer wholesale",
    "fish seafood importer",
  ],
  "Rice & Grains": [
    "rice importer wholesale basmati",
    "grain commodity importer trading",
    "basmati rice buyer India export",
    "cereal grain import wholesale company",
    "commodity trading food grain importer",
  ],
  "Spices & Herbs": [
    "spice importer wholesale distributor",
    "herbs spices trading company importer",
    "spice buyer India origin supplier",
    "dried spices wholesale import",
    "exotic spice importer food company",
  ],
  "Pulses & Lentils": [
    "pulse lentil importer wholesale",
    "chickpea lentil bean importer trading",
    "legume pulse food importer company",
    "dal lentil importer India sourcing",
    "bean pulse wholesale distributor",
  ],
};

export const COUNTRY_LANGUAGE_HINTS: Record<string, { native: string; searchExtra: string }> = {
  "Germany":      { native: "Deutschland", searchExtra: "importeur lebensmittel" },
  "France":       { native: "France",      searchExtra: "importateur alimentaire" },
  "Netherlands":  { native: "Nederland",   searchExtra: "importeur voedsel" },
  "Italy":        { native: "Italia",      searchExtra: "importatore alimentare" },
  "Spain":        { native: "España",      searchExtra: "importador alimentos" },
  "UK":           { native: "United Kingdom", searchExtra: "food importer wholesale" },
  "UAE":          { native: "UAE Dubai",   searchExtra: "food import trading FZCO" },
  "Saudi Arabia": { native: "Saudi Arabia Riyadh", searchExtra: "food trading import company" },
  "Japan":        { native: "Japan",       searchExtra: "food importer trading" },
  "Singapore":    { native: "Singapore",   searchExtra: "food import distributor" },
};

export const DIRECTORY_SITES = [
  "europages.co.uk",
  "kompass.com",
  "tradekey.com",
];

export function validateInputs(country: string, category: string): {
  valid: boolean;
  error?: string;
  searchQueries: string[];
  directoryQueries: string[];
} {
  if (!country?.trim())
    return { valid: false, error: "Target country is required.", searchQueries: [], directoryQueries: [] };
  if (!category?.trim())
    return { valid: false, error: "Product category is required.", searchQueries: [], directoryQueries: [] };
  if (!CATEGORY_SEARCH_MAP[category])
    return { valid: false, error: `Unknown product category: "${category}"`, searchQueries: [], directoryQueries: [] };

  const baseQueries = CATEGORY_SEARCH_MAP[category];
  const hint = COUNTRY_LANGUAGE_HINTS[country] ?? { native: country, searchExtra: "" };

  const searchQueries = baseQueries.map(q => `${q} ${country}`);
  const directoryQueries = DIRECTORY_SITES.map(site => `site:${site} ${baseQueries[0]} ${country}`);

  if (hint.searchExtra) {
    searchQueries.push(`${hint.native} ${hint.searchExtra}`);
  }

  return { valid: true, searchQueries, directoryQueries };
}
```

**Output of this phase:**

```
searchQueries = [
  "organic food importer wholesale Germany",
  "organic produce distributor import Germany",
  "certified organic food buyer sourcing Asia Germany",
  "bio food import wholesaler Germany",
  "natural organic food trading company Germany",
  "Deutschland importeur lebensmittel",            ← native language
]

directoryQueries = [
  "site:europages.co.uk organic food importer wholesale Germany",
  "site:kompass.com organic food importer wholesale Germany",
  "site:tradekey.com organic food importer wholesale Germany",
]
```

---

### Phase 3 — Company Discovery (Firecrawl) · Days 3–6

**File:** `backend/src/agents/agent1/discoveryEngine.ts`  
**Deliverable:** Up to 50 deduplicated, enriched company profiles.

#### 3.1 — Search (Firecrawl Search API)

```typescript
// backend/src/agents/agent1/discoveryEngine.ts

import FirecrawlApp from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });

export interface RawCompany {
  name: string;
  website: string;
  description: string;
  sourceUrl: string;
}

export async function searchCompanies(
  queries: string[],
  maxResults = 50
): Promise<RawCompany[]> {
  const seen = new Set<string>();
  const companies: RawCompany[] = [];

  for (const query of queries) {
    if (companies.length >= maxResults) break;

    try {
      const results = await firecrawl.search(query, {
        limit: 10,
        scrapeOptions: { formats: ["markdown"] },
      });

      for (const result of results.data ?? []) {
        const domain = extractDomain(result.url ?? "");
        if (!domain || seen.has(domain)) continue;
        seen.add(domain);

        const company = extractCompanyFromResult(result);
        if (company) companies.push(company);
        if (companies.length >= maxResults) break;
      }

      await sleep(1200); // Firecrawl free tier: ~1 req/sec
    } catch (err) {
      console.error(`[Agent1] Search failed: "${query}"`, err);
    }
  }

  return companies.slice(0, maxResults);
}

function extractCompanyFromResult(result: any): RawCompany | null {
  const url = result.url ?? "";
  const domain = extractDomain(url);
  if (!domain) return null;

  const name =
    result.metadata?.ogSiteName ??
    result.metadata?.title?.split("|")[0]?.trim() ??
    domain;

  return {
    name,
    website: `https://${domain}`,
    description: result.markdown?.slice(0, 500) ?? result.metadata?.description ?? "",
    sourceUrl: url,
  };
}
```

#### 3.2 — Enrichment (Firecrawl Scrape API)

Scrapes each company's homepage to extract richer signals — products, employee count, Asia/India mentions:

```typescript
export interface EnrichedCompanyProfile {
  name: string;
  website: string;
  description: string;
  products: string;
  employeeRange: string;
  revenueRange: string;
  asiaConnection: boolean;
  indiaConnection: boolean;
  country: string;
  sourceUrl: string;
}

export async function enrichCompanyFromWebsite(
  company: RawCompany,
  targetCountry: string
): Promise<EnrichedCompanyProfile> {
  try {
    const result = await firecrawl.scrapeUrl(company.website, {
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 10000,
    });

    const content = (result.markdown ?? "").slice(0, 3000);
    const lower = content.toLowerCase();

    const ASIA_KEYWORDS  = ["china", "india", "vietnam", "bangladesh", "thailand", "indonesia", "asia", "south asia", "far east"];
    const INDIA_KEYWORDS = ["india", "indian", "subcontinent", "south asia"];

    return {
      ...company,
      description: content,
      products: extractProductMentions(lower),
      employeeRange: extractEmployeeRange(content),
      revenueRange: "",
      asiaConnection: ASIA_KEYWORDS.some(kw => lower.includes(kw)),
      indiaConnection: INDIA_KEYWORDS.some(kw => lower.includes(kw)),
      country: targetCountry,
    };
  } catch {
    // Scrape failed — return thin profile; scoring will penalise missing data
    return {
      ...company,
      description: company.description,
      products: "",
      employeeRange: "",
      revenueRange: "",
      asiaConnection: false,
      indiaConnection: false,
      country: targetCountry,
    };
  }
}
```

#### 3.3 — Helpers

```typescript
function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return ""; }
}

function extractProductMentions(text: string): string {
  const keywords = [
    "organic", "food", "textile", "fabric", "seafood", "spice",
    "rice", "grain", "pulse", "lentil", "import", "export",
    "wholesale", "distribute", "source", "supply",
  ];
  return keywords.filter(kw => text.includes(kw)).slice(0, 10).join(", ");
}

function extractEmployeeRange(text: string): string {
  const patterns = [
    /(\d+)\s*[-–]\s*(\d+)\s*employees/i,
    /(\d+)\+?\s*employees/i,
    /team of (\d+)/i,
    /(\d{2,})\s*staff/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return "";
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
```

---

### Phase 4 — Email Discovery & Verification (Hunter.io) · Days 6–7

**File:** `backend/src/agents/agent1/emailEngine.ts`  
**Deliverable:** Verified primary contact per company. Companies with no verified email return `shouldDiscard: true` — the orchestrator skips them entirely (no scoring, saved to DB as discarded for audit).

#### 4.1 — Domain Search

Calls Hunter.io and filters results to procurement-relevant job titles only:

```typescript
// backend/src/agents/agent1/emailEngine.ts

import axios from "axios";

const HUNTER_BASE = "https://api.hunter.io/v2";
const HUNTER_KEY  = process.env.HUNTER_API_KEY!;

const PROCUREMENT_TITLES = [
  "procurement", "purchasing", "import", "sourcing", "buying",
  "supply chain", "ceo", "coo", "md", "managing director",
  "owner", "founder", "head of", "director", "manager",
];

export interface FoundEmail {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  confidence: number;
  linkedinUrl: string;
}

export async function findEmailsForDomain(domain: string): Promise<FoundEmail[]> {
  try {
    const { data } = await axios.get(`${HUNTER_BASE}/domain-search`, {
      params: { domain, api_key: HUNTER_KEY, limit: 10 },
    });

    await sleep(500);
    return (data.data?.emails ?? [])
      .filter((e: any) => {
        const title = (e.position ?? "").toLowerCase();
        return PROCUREMENT_TITLES.some(t => title.includes(t));
      })
      .map((e: any) => ({
        email: e.value,
        firstName: e.first_name ?? "",
        lastName: e.last_name ?? "",
        title: e.position ?? "",
        confidence: e.confidence ?? 0,
        linkedinUrl: e.linkedin ?? "",
      }));
  } catch {
    return [];
  }
}
```

#### 4.2 — Email Verification

```typescript
export interface VerifiedEmail {
  email: string;
  status: "valid" | "deliverable" | "risky" | "invalid" | "unknown";
  score: number;
}

export async function verifyEmail(email: string): Promise<VerifiedEmail> {
  try {
    const { data } = await axios.get(`${HUNTER_BASE}/email-verifier`, {
      params: { email, api_key: HUNTER_KEY },
    });
    await sleep(500);
    return {
      email,
      status: data.data?.status ?? "unknown",
      score: data.data?.score ?? 0,
    };
  } catch {
    return { email, status: "unknown", score: 0 };
  }
}
```

#### 4.3 — Combined: Find + Verify

Finds contacts, sorts by confidence, verifies top-1 then top-2 if needed:

```typescript
export async function findAndVerifyContactForCompany(website: string): Promise<{
  contacts: FoundEmail[];
  verifiedPrimary: VerifiedEmail | null;
  shouldDiscard: boolean;   // true = no verified email found → orchestrator must skip this company
  discardReason: string | null;
}> {
  const domain = extractDomain(website);
  if (!domain) return { contacts: [], verifiedPrimary: null, shouldDiscard: true, discardReason: "Invalid domain" };

  const found = await findEmailsForDomain(domain);
  if (found.length === 0)
    return { contacts: [], verifiedPrimary: null, shouldDiscard: true, discardReason: "No email found on domain via Hunter.io" };

  const sorted = found.sort((a, b) => b.confidence - a.confidence);

  // Try top email, then fallback to second
  for (const candidate of sorted.slice(0, 2)) {
    const verified = await verifyEmail(candidate.email);
    if (verified.status === "valid" || verified.status === "deliverable") {
      return { contacts: sorted, verifiedPrimary: verified, shouldDiscard: false, discardReason: null };
    }
  }

  // Emails found but none verified — mandatory field not met, discard
  return { contacts: sorted, verifiedPrimary: null, shouldDiscard: true, discardReason: "Email found but verification failed (risky/invalid)" };
}

function extractDomain(url: string): string {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", ""); }
  catch { return ""; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
```

---

### Phase 5 — AI Scoring Engine · Days 7–9

**File:** `backend/src/agents/agent1/scoringEngine.ts`  
**Deliverable:** Score (0–100), tier, and 2–3 line rationale per company.

#### 5.1 — AI Client (Groq now, Claude later)

```typescript
// backend/src/agents/agent1/scoringEngine.ts

import Groq from "groq-sdk";

const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY! });
const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

// ── PRODUCTION SWAP ─────────────────────────────────────────────
// Replace the 3 lines above with these 3:
//
//   import Anthropic from "@anthropic-ai/sdk";
//   const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
//   const MODEL  = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
//
// Then replace the groq.chat.completions.create() call below with:
//
//   const response = await claude.messages.create({
//     model: MODEL, max_tokens: 400,
//     messages: [{ role: "user", content: prompt }],
//   });
//   const text = (response.content[0] as any).text;
// ─────────────────────────────────────────────────────────────────
```

#### 5.2 — Scoring Prompt

```typescript
function buildScoringPrompt(
  profile: EnrichedCompanyProfile,
  contact: FoundEmail | null,
  hasVerifiedEmail: boolean,
  productCategory: string,
  targetCountry: string
): string {
  return `You are an expert B2B lead scorer for Elan Exports Company (EEC).
EEC is an India-based commodity and textile sourcing intermediary.

EEC's Ideal Customer Profile (ICP):
- Imports: food / organic produce / textiles / seafood / spices / rice / pulses
- Geography: Europe, Middle East, or Asia
- Size: $10M–$200M revenue OR 50–500 employees
- Signal: sources or is open to sourcing from India / South Asia
- Contact: reachable procurement or buying decision-maker

CURRENT SEARCH TARGET: ${productCategory} importers in ${targetCountry}

COMPANY PROFILE:
  Name:                ${profile.name}
  Website:             ${profile.website}
  Country:             ${profile.country}
  Products Mentioned:  ${profile.products || "—"}
  Employee Range:      ${profile.employeeRange || "unknown"}
  Asia Connection:     ${profile.asiaConnection}
  India Connection:    ${profile.indiaConnection}
  Contact Found:       ${contact ? `${contact.title} <${contact.email}>` : "None"}
  Email Verified:      ${hasVerifiedEmail}
  Description (first 1500 chars):
  ${profile.description.slice(0, 1500)}

Score on EXACTLY 5 dimensions, 0–20 points each:

D1 Product Category Match (0-20)
  Does this company import ${productCategory} or closely related products?
  20=perfect 10=adjacent 5=possible 0=none

D2 Asia/India Sourcing Signal (0-20)
  Evidence of sourcing from India, South Asia, or broader Asia?
  20=confirmed India 15=confirmed Asia 8=possible 0=no signal

D3 Company Size ICP Fit (0-20)
  Revenue $10M–$200M OR 50–500 employees?
  20=clearly in range 12=likely 5=unclear 0=clearly out of range

D4 Decision-Maker Reachability (0-20)
  Is a procurement/buying contact reachable?
  20=verified email 10=contact found unverified 5=name only 0=none

D5 Geography Alignment (0-20)
  Is this company in EEC's target markets?
  20=core market 12=secondary 5=adjacent 0=wrong geography

Return ONLY valid JSON. No other text. No markdown.
{
  "d1": <0-20>,
  "d2": <0-20>,
  "d3": <0-20>,
  "d4": <0-20>,
  "d5": <0-20>,
  "total": <sum>,
  "rationale": "<2-3 plain English sentences citing specific signals found>"
}`;
}
```

#### 5.3 — Score + Tier Assignment

```typescript
import type { EnrichedCompanyProfile } from "./discoveryEngine";
import type { FoundEmail } from "./emailEngine";

export interface ScoreResult {
  fitScore: number;
  d1: number; d2: number; d3: number; d4: number; d5: number;
  priorityTier: "High" | "Medium" | "Low" | "Discard";
  rationale: string;
}

export async function scoreCompany(
  profile: EnrichedCompanyProfile,
  contact: FoundEmail | null,
  hasVerifiedEmail: boolean,
  productCategory: string,
  targetCountry: string
): Promise<ScoreResult> {
  const prompt = buildScoringPrompt(profile, contact, hasVerifiedEmail, productCategory, targetCountry);

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const raw   = JSON.parse(response.choices[0].message.content ?? "{}");
    const total = Math.min(100, [raw.d1, raw.d2, raw.d3, raw.d4, raw.d5].reduce((s, v) => s + (v ?? 0), 0));

    return {
      fitScore: total,
      d1: raw.d1 ?? 0, d2: raw.d2 ?? 0, d3: raw.d3 ?? 0,
      d4: raw.d4 ?? 0, d5: raw.d5 ?? 0,
      priorityTier: total >= 70 ? "High" : total >= 45 ? "Medium" : total >= 30 ? "Low" : "Discard",
      rationale: raw.rationale ?? "Insufficient data to score.",
    };
  } catch {
    return { fitScore: 0, d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, priorityTier: "Discard", rationale: "Scoring error." };
  }
}
```

---

### Phase 6 — Agent Orchestrator · Days 9–10

**File:** `backend/src/agents/agent1/agent1.ts`  
**Deliverable:** Single `runAgent1()` function — fires async, returns `runId` immediately.

```typescript
// backend/src/agents/agent1/agent1.ts

import { prisma } from "../../lib/prisma";
import { validateInputs }                      from "./inputHandler";
import { searchCompanies, enrichCompanyFromWebsite } from "./discoveryEngine";
import { findAndVerifyContactForCompany }      from "./emailEngine";
import { scoreCompany }                        from "./scoringEngine";

export async function runAgent1(params: {
  country: string;
  productCategory: string;
  triggeredBy: string;
}): Promise<{ runId: string; message: string }> {
  const { country, productCategory, triggeredBy } = params;

  const validation = validateInputs(country, productCategory);
  if (!validation.valid) throw new Error(validation.error);

  const run = await prisma.agentRun.create({
    data: { country, productCategory, triggeredBy, status: "running", startedAt: new Date() },
  });

  // Fire async — caller gets runId immediately and polls for status
  executeRun(run.id, country, productCategory, validation.searchQueries, validation.directoryQueries)
    .catch(async (err) => {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { status: "failed", errorMessage: String(err.message), completedAt: new Date() },
      });
    });

  return { runId: run.id, message: "Agent 1 started." };
}

async function executeRun(
  runId: string,
  country: string,
  productCategory: string,
  searchQueries: string[],
  directoryQueries: string[]
): Promise<void> {
  const allQueries  = [...searchQueries, ...directoryQueries];
  const rawCompanies = await searchCompanies(allQueries, 50);

  await prisma.agentRun.update({ where: { id: runId }, data: { totalFound: rawCompanies.length } });

  let highCount = 0, medCount = 0, scoredCount = 0;

  for (const raw of rawCompanies) {
    const profile = await enrichCompanyFromWebsite(raw, country);
    const { contacts, verifiedPrimary, shouldDiscard, discardReason } =
      await findAndVerifyContactForCompany(raw.website);

    // MANDATORY FIELD CHECK: no verified email = discard immediately, skip scoring
    if (shouldDiscard) {
      await prisma.discoveredCompany.create({
        data: {
          agentRunId:   runId,
          name:         profile.name,
          website:      profile.website,
          country:      profile.country,
          sourceUrl:    profile.sourceUrl,
          priorityTier: null,
          discardReason,
        },
      });
      await sleep(500);
      continue; // ← skip enrichment, skip scoring, skip contacts
    }

    const primary = contacts[0] ?? null;
    const score   = await scoreCompany(profile, primary, true, productCategory, country);

    const company = await prisma.discoveredCompany.create({
      data: {
        agentRunId:       runId,
        name:             profile.name,
        website:          profile.website,
        country:          profile.country,
        description:      profile.description.slice(0, 2000),
        productsImported: profile.products,
        asiaConnection:   profile.asiaConnection,
        indiaConnection:  profile.indiaConnection,
        sourceUrl:        profile.sourceUrl,
        employeeRange:    profile.employeeRange,
        fitScore:         score.fitScore,
        scoreDim1: score.d1, scoreDim2: score.d2, scoreDim3: score.d3,
        scoreDim4: score.d4, scoreDim5: score.d5,
        priorityTier:  score.priorityTier === "Discard" ? null : (score.priorityTier as any),
        rationale:     score.rationale,
        discardReason: score.priorityTier === "Discard" ? "Score below 30" : null,
      },
    });

    // Save contacts (email verified — mandatory field already confirmed above)
    for (const c of contacts) {
      await prisma.agentContact.create({
        data: {
          companyId:       company.id,
          name:            `${c.firstName} ${c.lastName}`.trim(),
          title:           c.title,
          email:           c.email,
          emailStatus:     verifiedPrimary?.email === c.email ? verifiedPrimary!.status : "unverified",
          emailConfidence: c.confidence,
          linkedinUrl:     c.linkedinUrl,
          isPrimary:       verifiedPrimary?.email === c.email,
        },
      });
    }

    if (score.priorityTier === "High")    highCount++;
    if (score.priorityTier === "Medium")  medCount++;
    if (score.priorityTier !== "Discard") scoredCount++;

    await sleep(500);
  }

  await prisma.agentRun.update({
    where: { id: runId },
    data: { status: "completed", totalScored: scoredCount, totalHighPrio: highCount, totalMedPrio: medCount, completedAt: new Date() },
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
```

---

### Phase 7 — API Routes · Days 9–10

**File:** `backend/src/routes/agent1.routes.ts`  
**Deliverable:** 4 REST endpoints wired into Express.

```typescript
// backend/src/routes/agent1.routes.ts

import { Router }    from "express";
import { authenticate } from "../middleware/auth";
import { runAgent1 } from "../agents/agent1/agent1";
import { prisma }    from "../lib/prisma";

const router = Router();
router.use(authenticate);

router.post("/run", async (req, res) => {
  try {
    const { country, productCategory } = req.body;
    const result = await runAgent1({ country, productCategory, triggeredBy: (req as any).user.id });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/runs", async (_req, res) => {
  const runs = await prisma.agentRun.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  res.json(runs);
});

router.get("/runs/:runId", async (req, res) => {
  const run = await prisma.agentRun.findUnique({ where: { id: req.params.runId } });
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(run);
});

router.get("/runs/:runId/results", async (req, res) => {
  const companies = await prisma.discoveredCompany.findMany({
    where: {
      agentRunId: req.params.runId,
      fitScore:   { gt: 30 },
      // Mandatory: only return companies that have a verified primary email
      contacts: { some: { isPrimary: true, emailStatus: { in: ["valid", "deliverable"] } } },
    },
    include: { contacts: { where: { isPrimary: true } } },
    orderBy: { fitScore: "desc" },
  });
  res.json(companies);
});

export default router;
```

Register in `backend/src/index.ts`:

```typescript
import agent1Routes from "./routes/agent1.routes";
app.use("/api/agent1", agent1Routes);
```

---

### Phase 8 — Frontend UI · Days 11–13

**Files:** `frontend/src/pages/Agent1Page.tsx` + `frontend/src/components/agent1/`

#### Screen 1 — Trigger Form

```
┌──────────────────────────────────────────────────────┐
│  Discover & Rank Buyers                              │
│  Agent 1 · Powered by Firecrawl + Hunter + Groq     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Target Country                                      │
│  ┌──────────────────────────────────┐               │
│  │  Germany                      ▼ │               │
│  └──────────────────────────────────┘               │
│                                                      │
│  Product Category                                    │
│  ┌──────────────────────────────────┐               │
│  │  Organic Food                 ▼ │               │
│  └──────────────────────────────────┘               │
│                                                      │
│  [ Run Agent 1 ]          Est. 8–12 minutes         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Screen 2 — Progress Tracker (polls /runs/:runId every 5s)

```
┌──────────────────────────────────────────────────────┐
│  Agent 1 Running · Germany / Organic Food            │
│  Started 2:34 PM · Elapsed 4m 12s                   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [✓]  Inputs validated                              │
│  [✓]  9 search queries built                        │
│  [✓]  Discovery complete · 48 companies found       │
│  [~]  Enriching & scoring (31 / 48)...              │
│  [ ]  Email verification                            │
│  [ ]  Final ranking                                 │
│                                                      │
│  ████████████████████░░░░░░░░░  65%                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Screen 3 — Results Table

```
Germany · Organic Food · 48 discovered · 31 had verified email · 12 High · 14 Medium · 5 Low
(17 discarded before scoring — no verified email found)

[ Export CSV ]  [ Add High Priority to CRM ]

┌────┬──────────────────────┬────────────┬──────────────────────┬──────────────────────┬───────┬──────┐
│ #  │ Company              │ Country    │ Contact              │ Email (verified)     │ Score │ Tier │
├────┼──────────────────────┼────────────┼──────────────────────┼──────────────────────┼───────┼──────┤
│  1 │ Bioland GmbH         │ Germany    │ Klaus H. · Proc. Dir │ k.huber@bioland.de   │ 87    │ HIGH │
│  2 │ NaturKost AG         │ Germany    │ Anna S. · Import Mgr │ a.schulz@naturkost…  │ 74    │ HIGH │
│  3 │ BioWholesale GmbH    │ Germany    │ P.Weber · Sourcing   │ p.weber@biowhole…    │ 68    │ HIGH │
│  4 │ GreenSource Ltd      │ Germany    │ Marc L. · CEO        │ m.lee@greensource…   │ 61    │ MED  │
│  5 │ EcoTrade KG          │ Germany    │ R.Fischer · Director │ r.fischer@ecotrade…  │ 52    │ MED  │
└────┴──────────────────────┴────────────┴──────────────────────┴──────────────────────┴───────┴──────┘
All rows guaranteed to have a verified email · Click any row to open detail drawer →
```

#### Screen 4 — Company Detail Drawer

```
┌────────────────────────────────────────────┐
│  Bioland GmbH                          [X] │
│  bioland.de · Germany                      │
├────────────────────────────────────────────┤
│  FIT SCORE   87 / 100   HIGH PRIORITY      │
│                                            │
│  D1 Product Match    ████████████████  18  │
│  D2 Asia Signal      ████████░░░░░░░░  10  │
│  D3 Company Size     ████████████████  18  │
│  D4 Reachability     ████████████████  20  │
│  D5 Geography        ████████████░░░░  21← │
│                                            │ ← capped at 20
│  WHY THIS SCORE                            │
│  Bioland is a certified organic food       │
│  distributor in Germany importing from     │
│  multiple countries including India.       │
│  Procurement director email verified.      │
│  Size (~180 employees) fits ICP perfectly. │
├────────────────────────────────────────────┤
│  CONTACT                                   │
│  Klaus Huber · Procurement Director        │
│  k.huber@bioland.de   verified             │
│  linkedin.com/in/klaushuber               │
├────────────────────────────────────────────┤
│  [ Add to Buyers CRM ]  [ Send to Agent 2 ]│
└────────────────────────────────────────────┘
```

---

## 7. File Structure

```
backend/
└── src/
    ├── agents/
    │   └── agent1/
    │       ├── agent1.ts           ← orchestrator: runAgent1() + executeRun()
    │       ├── inputHandler.ts     ← validate + build search queries
    │       ├── discoveryEngine.ts  ← Firecrawl search + scrape + enrich
    │       ├── emailEngine.ts      ← Hunter.io domain search + verify
    │       ├── scoringEngine.ts    ← Groq/Claude prompt + score + tier
    │       └── types.ts            ← shared TypeScript interfaces
    └── routes/
        └── agent1.routes.ts        ← 4 Express endpoints

frontend/
└── src/
    ├── pages/
    │   └── Agent1Page.tsx          ← top-level page, routing entry
    └── components/
        └── agent1/
            ├── TriggerForm.tsx     ← country + category selects + submit
            ├── RunProgress.tsx     ← polls /runs/:id, shows progress bar
            ├── ResultsTable.tsx    ← ranked table with tier badges
            └── CompanyDrawer.tsx   ← slide-in detail: scores + contact + actions
```

---

## 8. Database Schema

```
agent_runs
┌─────────────────┬─────────────┬────────────────────────────────┐
│ Column          │ Type        │ Notes                          │
├─────────────────┼─────────────┼────────────────────────────────┤
│ id              │ UUID PK     │                                │
│ triggered_by    │ UUID FK     │ → users.id                     │
│ country         │ TEXT        │ e.g. "Germany"                 │
│ product_category│ TEXT        │ e.g. "Organic Food"            │
│ status          │ ENUM        │ pending/running/completed/failed│
│ total_found     │ INT         │ companies found by Firecrawl   │
│ total_scored    │ INT         │ companies scored (not discarded)│
│ total_high_prio │ INT         │ score ≥ 70                     │
│ total_med_prio  │ INT         │ score 45–69                    │
│ error_message   │ TEXT?       │ set on failure                 │
│ started_at      │ TIMESTAMP?  │                                │
│ completed_at    │ TIMESTAMP?  │                                │
│ created_at      │ TIMESTAMP   │                                │
└─────────────────┴─────────────┴────────────────────────────────┘

discovered_companies
┌─────────────────┬─────────────┬────────────────────────────────┐
│ Column          │ Type        │ Notes                          │
├─────────────────┼─────────────┼────────────────────────────────┤
│ id              │ UUID PK     │                                │
│ agent_run_id    │ UUID FK     │ → agent_runs.id (CASCADE DEL)  │
│ name            │ TEXT        │                                │
│ website         │ TEXT?       │                                │
│ country         │ TEXT        │                                │
│ industry        │ TEXT?       │                                │
│ employee_range  │ TEXT?       │ extracted from scrape          │
│ description     │ TEXT?       │ max 2000 chars                 │
│ products_imported│ TEXT?      │ keyword list from scrape       │
│ asia_connection │ BOOLEAN     │ keyword detection              │
│ india_connection│ BOOLEAN     │ keyword detection              │
│ source_url      │ TEXT?       │ Firecrawl result URL           │
│ fit_score       │ INT?        │ 0–100                          │
│ score_dim1–5    │ INT?        │ 0–20 each                      │
│ priority_tier   │ ENUM?       │ High / Medium / Low (null=disc)│
│ rationale       │ TEXT?       │ 2–3 line AI explanation        │
│ discard_reason  │ TEXT?       │ "Score below 30" / "No email found" / "Email verification failed" │
│ created_at      │ TIMESTAMP   │                                │
└─────────────────┴─────────────┴────────────────────────────────┘

agent_contacts
┌─────────────────┬─────────────┬────────────────────────────────┐
│ Column          │ Type        │ Notes                          │
├─────────────────┼─────────────┼────────────────────────────────┤
│ id              │ UUID PK     │                                │
│ company_id      │ UUID FK     │ → discovered_companies.id      │
│ name            │ TEXT?       │ first + last name              │
│ title           │ TEXT?       │ job title from Hunter          │
│ email           │ TEXT        │ NOT NULL — mandatory field     │
│ email_status    │ TEXT        │ "valid" or "deliverable" only  │
│                 │             │ (others never reach DB)        │
│ email_confidence│ INT?        │ Hunter confidence score 0–100  │
│ linkedin_url    │ TEXT?       │                                │
│ is_primary      │ BOOLEAN     │ best verified contact          │
│ created_at      │ TIMESTAMP   │                                │
└─────────────────┴─────────────┴────────────────────────────────┘
```

---

## 9. API Contract

### POST /api/agent1/run

**Request:**
```json
{
  "country": "Germany",
  "productCategory": "Organic Food"
}
```

**Response 200:**
```json
{
  "runId": "b3c7d921-...",
  "message": "Agent 1 started."
}
```

**Response 400 (validation error):**
```json
{
  "error": "Product category is required."
}
```

---

### GET /api/agent1/runs/:runId

**Response (in-progress):**
```json
{
  "id": "b3c7d921-...",
  "country": "Germany",
  "productCategory": "Organic Food",
  "status": "running",
  "totalFound": 31,
  "totalScored": 14,
  "totalHighPrio": 4,
  "totalMedPrio": 8,
  "startedAt": "2026-06-26T09:34:00Z",
  "completedAt": null
}
```

**Response (completed):**
```json
{
  "status": "completed",
  "totalFound": 48,
  "totalScored": 41,
  "totalHighPrio": 12,
  "totalMedPrio": 21,
  "completedAt": "2026-06-26T09:47:22Z"
}
```

---

### GET /api/agent1/runs/:runId/results

**Response:** Array sorted by `fitScore` descending, score > 30 only.

```json
[
  {
    "id": "c91a...",
    "name": "Bioland GmbH",
    "website": "https://bioland.de",
    "country": "Germany",
    "fitScore": 87,
    "scoreDim1": 18,
    "scoreDim2": 10,
    "scoreDim3": 18,
    "scoreDim4": 20,
    "scoreDim5": 21,
    "priorityTier": "High",
    "rationale": "Bioland is a certified organic food distributor...",
    "asiaConnection": true,
    "indiaConnection": true,
    "contacts": [
      {
        "name": "Klaus Huber",
        "title": "Procurement Director",
        "email": "k.huber@bioland.de",
        "emailStatus": "valid",
        "isPrimary": true
      }
    ]
  }
]
```

---

## 10. Rate Limits & Costs

```
┌─────────────────┬──────────────────────────────┬─────────────────┬──────────────────────┐
│ Service         │ Free Tier                    │ Usage per Run   │ Upgrade               │
├─────────────────┼──────────────────────────────┼─────────────────┼──────────────────────┤
│ Firecrawl       │ 500 scrapes/month            │ ~100            │ Hobby: $16/mo         │
│                 │                              │ (9 search +     │ (3000 scrapes)        │
│                 │                              │  ~50 page       │                       │
│                 │                              │  scrapes)       │                       │
├─────────────────┼──────────────────────────────┼─────────────────┼──────────────────────┤
│ Hunter.io       │ 25 searches + 50 verifs/mo   │ ~50 searches    │ Starter: $49/mo       │
│                 │                              │ + 50-100 verifs │ (500 searches)        │
├─────────────────┼──────────────────────────────┼─────────────────┼──────────────────────┤
│ Groq API        │ Free (rate limited)          │ ~50 calls       │ Stay free in testing  │
├─────────────────┼──────────────────────────────┼─────────────────┼──────────────────────┤
│ Claude API      │ Pay per token (production)   │ ~$0.10–$0.20    │ Already on Anthropic  │
│ (claude-s-4-6)  │                              │ per full run    │                       │
└─────────────────┴──────────────────────────────┴─────────────────┴──────────────────────┘
```

**Estimated run time:** 8–15 minutes  
(Rate-limit sleeps: ~1.2s/Firecrawl query × 9 + ~0.5s/Hunter call × 100+ + ~0.5s/Groq call × 50)

**Practical limit on free tiers:** ~1 full run/month  
**Practical limit on paid tiers (Firecrawl Hobby + Hunter Starter):** ~10–15 runs/month for ~$65/mo total

---

## 11. Switching to Claude (Production)

Only `backend/src/agents/agent1/scoringEngine.ts` changes. Everything else — prompts, JSON parsing, scoring logic, tier assignment — is identical.

```typescript
// BEFORE — Groq (testing)
import Groq from "groq-sdk";
const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY! });
const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

const response = await groq.chat.completions.create({
  model:           MODEL,
  messages:        [{ role: "user", content: prompt }],
  temperature:     0.1,
  max_tokens:      400,
  response_format: { type: "json_object" },
});
const text = response.choices[0].message.content;


// AFTER — Claude (production)  ← 5-line swap
import Anthropic from "@anthropic-ai/sdk";
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL  = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

const response = await claude.messages.create({
  model:      MODEL,
  max_tokens: 400,
  messages:   [{ role: "user", content: prompt }],
});
const text = (response.content[0] as any).text;
```

Install Claude SDK when ready:
```bash
npm install @anthropic-ai/sdk
```

---

## 12. Testing Checklist

**Phase 3 — Discovery**
- [ ] Run with `Germany` + `Organic Food` — expect 40–50 company URLs found
- [ ] Verify Firecrawl returns real company domains (not Wikipedia, ads, or news articles)
- [ ] Verify deduplication — same domain not counted twice across queries
- [ ] Test with `Saudi Arabia` + `Spices & Herbs` — verify graceful handling of thin results

**Phase 4 — Email Engine**
- [ ] Hunter.io returns at least 1 contact for 30%+ of domains
- [ ] Email verification returns `valid` or `deliverable` for real addresses
- [ ] Companies with no Hunter.io result → `shouldDiscard: true`, saved to DB with `discardReason`, never scored
- [ ] Companies with emails found but all risky/invalid → `shouldDiscard: true`, same discard path
- [ ] Only companies with `shouldDiscard: false` proceed to the scoring step

**Phase 5 — Scoring**
- [ ] Groq returns valid JSON (no markdown wrappers, no extra text)
- [ ] All dimension scores are 0–20
- [ ] `total` equals sum of d1+d2+d3+d4+d5 (capped at 100)
- [ ] Companies scoring < 30 get `priorityTier = null` and `discardReason = "Score below 30"`
- [ ] Results API returns ONLY companies with `fitScore > 30` AND a verified primary contact email

**Phase 6–7 — Orchestrator & API**
- [ ] `POST /run` returns `runId` in < 1 second
- [ ] `GET /runs/:runId` status transitions: `running` → `completed`
- [ ] `GET /runs/:runId/results` returns only score > 30, sorted by score desc
- [ ] Run failure (e.g. bad API key) sets `status: "failed"` with `errorMessage`

**Phase 8 — Frontend**
- [ ] Progress bar updates every 5s during a live run
- [ ] Results table shows High / Medium / Low badges in correct colours
- [ ] Company drawer shows score breakdown bars
- [ ] Results table shows only rows with a verified email — no blank email cells ever appear

---

## 13. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Firecrawl returns news/blog URLs instead of company homepages | Medium | High — wastes scrape quota | Add domain filter: skip `.org`, news sites, Wikipedia, LinkedIn |
| Hunter free tier runs out mid-run (25 searches/mo) | High | High — companies fail email gate, result count drops | Upgrade to Starter ($49/mo) before first real run. Monitor `total_found` vs result count ratio. |
| High discard rate (email gate removes 60%+ of companies) | Medium | Medium — fewer final results | Tune search queries to target companies more likely to have public emails (importers / distributors typically do). Consider increasing discovery cap from 50 → 80 to compensate. |
| Groq JSON response malformed / extra text | Low | Medium — scoring fails for that company | Wrap in try/catch; fallback score = 0 / Discard |
| Firecrawl scrape blocked by target site (403) | Medium | Low — thin profile, lower score | Already handled: returns bare profile, scoring penalises missing data |
| Search queries return non-importer companies | Medium | Medium — noisy results, more email-gate discards | Scoring D1 will penalise; Discard tier filters them out |
| Run takes > 15 min, user thinks it crashed | Low | Medium | Progress polling every 5s + elapsed timer in UI |

---

## 14. Phases Summary Table

```
┌───────┬────────────────────────────────────────┬────────────┬──────────┐
│ Phase │ Task                                   │ Days       │ Status   │
├───────┼────────────────────────────────────────┼────────────┼──────────┤
│   1   │ Install deps · env vars · DB migration │ 1 – 2      │ TODO     │
│   2   │ Input handler (validate + queries)     │ 2 – 3      │ TODO     │
│   3   │ Firecrawl discovery + enrichment       │ 3 – 6      │ TODO     │
│   4   │ Hunter.io email engine                 │ 6 – 7      │ TODO     │
│   5   │ Groq scoring engine                    │ 7 – 9      │ TODO     │
│   6   │ Agent orchestrator                     │ 9 – 10     │ TODO     │
│   7   │ Express API routes                     │ 9 – 10     │ TODO     │
│   8   │ Frontend UI (4 screens)               │ 11 – 13    │ TODO     │
│   9   │ End-to-end test (Germany/Organic Food) │ 13 – 14    │ TODO     │
│  10   │ Swap Groq → Claude for production      │ Post-test  │ TODO     │
└───────┴────────────────────────────────────────┴────────────┴──────────┘
Total: ~14 development days
```

---

*Next step → Agent 2 (Email Personalizer) reads the High + Medium companies from each AgentRun and generates personalised outreach emails. Agent 3 (Reply Handler) classifies inbound replies and drafts responses.*
