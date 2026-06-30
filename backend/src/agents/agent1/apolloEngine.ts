// Apollo.io REST API — exactly 2 search calls per run, no per-contact email reveals.
// Credits consumed: search credits only (no enrichment, no email reveal endpoints).

import axios from "axios";
import type { ApolloLead } from "./types.js";

const APOLLO_BASE = "https://api.apollo.io/v1";

function getKey(): string | null {
  return process.env.APOLLO_API_KEY || null;
}

// ── Middleware detection ──────────────────────────────────────────────────────
// These industry strings come from Apollo's taxonomy. Match lowercase.
const MIDDLEWARE_INDUSTRIES = new Set([
  "staffing and recruiting",
  "freight service",
  "logistics and supply chain",
  "transportation/trucking/railroad",
  "transportation, logistics, supply chain and storage",
  "insurance",
  "banking",
  "financial services",
  "management consulting",
  "business consulting and services",
  "outsourcing and offshoring consulting",
  "information technology and services",
  "computer software",
  "internet",
  "information services",
  "market research",
]);

// Company name patterns that reveal broker/agent nature
const MIDDLEWARE_NAME_RE =
  /\b(freight|forwarding|forwarder|broker|brokerage|logistics|advisory|consultanc[y]|customs\s+agent|staffing|recruitment|courier|clearing\s+agent)\b/i;

function isMiddleware(orgName: string, industry: string): boolean {
  if (MIDDLEWARE_NAME_RE.test(orgName)) return true;
  if (MIDDLEWARE_INDUSTRIES.has((industry ?? "").toLowerCase())) return true;
  return false;
}

function extractDomain(url: string): string {
  if (!url) return "";
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

// ── Single Apollo people search call ─────────────────────────────────────────
async function apolloPeopleSearch(
  apiKey: string,
  params: Record<string, unknown>
): Promise<any[]> {
  try {
    const { data } = await axios.post(
      `${APOLLO_BASE}/mixed_people/search`,
      params,
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apiKey,
        },
        timeout: 30000,
      }
    );
    const people: any[] = data.people ?? [];
    console.log(`[Apollo] ← ${people.length} people returned`);
    return people;
  } catch (err: any) {
    console.error(
      "[Apollo] Search error:",
      err?.response?.data ?? err?.message
    );
    return [];
  }
}

// ── Main export — 2 API calls total per run ───────────────────────────────────
export async function searchApolloLeads(
  country: string,
  productCategory: string,
  buyerTitles: string[],
  industryKeywords: string[]
): Promise<ApolloLead[]> {
  const key = getKey();
  if (!key) {
    console.warn("[Apollo] APOLLO_API_KEY not configured — 0 leads discovered.");
    return [];
  }

  const seen = new Set<string>();
  const leads: ApolloLead[] = [];

  // ── Call 1: Decision-maker title search ──────────────────────────────────
  // Targets people by job title within the country. Seniority filter ensures
  // we reach actual buyers, not junior staff.
  console.log(
    `[Apollo] Call 1 — title search (${buyerTitles.length} titles, country: ${country})`
  );
  const call1 = await apolloPeopleSearch(key, {
    page: 1,
    per_page: 25,
    person_titles: buyerTitles,
    person_seniorities: ["manager", "director", "vp", "c_suite", "owner", "partner"],
    organization_locations: [country],
    contact_email_status: ["verified", "likely to engage"],
  });

  // 1 s gap between calls — Apollo rate limit is 10 req/min on basic plans
  await sleep(1200);

  // ── Call 2: Industry keyword sweep ───────────────────────────────────────
  // Casts a wider net by matching company keyword tags, catching buyers whose
  // titles weren't in the first list.
  console.log(
    `[Apollo] Call 2 — keyword sweep (${industryKeywords.length} keywords, country: ${country})`
  );
  const call2 = await apolloPeopleSearch(key, {
    page: 1,
    per_page: 25,
    q_organization_keyword_tags: industryKeywords,
    person_seniorities: ["manager", "director", "vp", "c_suite", "owner", "partner"],
    organization_locations: [country],
    contact_email_status: ["verified", "likely to engage"],
    organization_num_employees_ranges: ["51,2000"],
  });

  // ── Merge, deduplicate by domain, filter middlewares ─────────────────────
  for (const person of [...call1, ...call2]) {
    if (leads.length >= 50) break;

    const org = person.organization;

    // MANDATORY: company name must exist
    if (!org?.name?.trim()) continue;

    // Resolve domain — prefer primary_domain (Apollo-verified)
    const domain =
      (org.primary_domain as string | null)?.trim().toLowerCase() ||
      extractDomain(org.website_url ?? "");

    // MANDATORY: domain needed for email fallback + dedup
    if (!domain) continue;
    if (seen.has(domain)) continue;

    // Discard middleware / broker companies
    if (isMiddleware(org.name, org.industry ?? "")) {
      console.log(`[Apollo] Middleware skipped: "${org.name}" (${org.industry})`);
      continue;
    }

    seen.add(domain);

    leads.push({
      contact: {
        firstName:   (person.first_name  as string) ?? "",
        lastName:    (person.last_name   as string) ?? "",
        name:        (person.name        as string) ?? "",
        title:       (person.title       as string) ?? "",
        email:       (person.email       as string | null) ?? null,
        emailStatus: (person.email_status as string | null) ?? null,
        linkedinUrl: (person.linkedin_url as string | null) ?? null,
      },
      organization: {
        name:          org.name as string,
        domain,
        website:       `https://${domain}`,
        industry:      (org.industry as string) ?? "",
        employeeCount: (org.estimated_num_employees as number | null) ?? null,
        annualRevenue:  (org.annual_revenue as number | null) ?? null,
        description:   (org.short_description as string) ?? "",
        keywords:      Array.isArray(org.keywords) ? (org.keywords as string[]) : [],
        linkedinUrl:   (org.linkedin_url as string | null) ?? null,
      },
    });
  }

  console.log(
    `[Apollo] ${leads.length} unique end-buyer leads for ${productCategory} in ${country} after dedup + middleware filter`
  );
  return leads;
}

// ── Profile helpers used by agent1.ts ─────────────────────────────────────────

export function employeeCountToRange(n: number): string {
  if (n <= 10)   return "1–10";
  if (n <= 50)   return "11–50";
  if (n <= 200)  return "51–200";
  if (n <= 500)  return "201–500";
  if (n <= 1000) return "501–1000";
  if (n <= 5000) return "1001–5000";
  return "5000+";
}

export function revenueToRange(r: number): string {
  if (r < 1_000_000)       return "<$1M";
  if (r < 10_000_000)      return "$1M–$10M";
  if (r < 50_000_000)      return "$10M–$50M";
  if (r < 200_000_000)     return "$50M–$200M";
  if (r < 1_000_000_000)   return "$200M–$1B";
  return "$1B+";
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
