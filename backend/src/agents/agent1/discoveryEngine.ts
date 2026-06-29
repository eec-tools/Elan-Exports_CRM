import axios from "axios";
import type { RawCompany, EnrichedCompanyProfile } from "./types.js";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

function getFirecrawlKey(): string | null {
  return process.env.FIRECRAWL_API_KEY ?? null;
}

// Domains to skip — not real company homepages
const SKIP_DOMAINS = new Set([
  "wikipedia.org", "linkedin.com", "facebook.com", "twitter.com",
  "instagram.com", "youtube.com", "reddit.com", "amazon.com",
  "alibaba.com", "ebay.com", "trustpilot.com", "glassdoor.com",
  "bloomberg.com", "reuters.com", "ft.com", "forbes.com",
]);

const ASIA_KEYWORDS = [
  "china", "india", "vietnam", "bangladesh", "thailand",
  "indonesia", "asia", "south asia", "far east", "indian subcontinent",
];
const INDIA_KEYWORDS = ["india", "indian", "subcontinent", "south asia"];

// ── Firecrawl search → returns [{url, title, description}, ...] ──────────────
async function firecrawlSearch(query: string, limit = 10): Promise<any[]> {
  const key = getFirecrawlKey();
  if (!key) return [];

  try {
    const { data } = await axios.post(
      `${FIRECRAWL_BASE}/search`,
      { query, limit },
      {
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        timeout: 30000,
      }
    );
    if (!data.success) return [];
    return Array.isArray(data.data) ? data.data : [];
  } catch (err: any) {
    console.error(`[Agent1] Firecrawl search error for "${query}":`, err?.response?.data ?? err?.message);
    return [];
  }
}

// ── Firecrawl scrape → returns markdown string ────────────────────────────────
async function firecrawlScrape(url: string): Promise<string> {
  const key = getFirecrawlKey();
  if (!key) return "";

  try {
    const { data } = await axios.post(
      `${FIRECRAWL_BASE}/scrape`,
      { url, formats: ["markdown"], onlyMainContent: true },
      {
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        timeout: 15000,
      }
    );
    if (!data.success) return "";
    return data.data?.markdown ?? "";
  } catch (err: any) {
    console.error(`[Agent1] Firecrawl scrape error for ${url}:`, err?.response?.data ?? err?.message);
    return "";
  }
}

export async function searchCompanies(
  queries: string[],
  maxResults = 50
): Promise<RawCompany[]> {
  if (!getFirecrawlKey()) {
    console.warn("[Agent1] FIRECRAWL_API_KEY not configured; skipping discovery search.");
    return [];
  }

  const seen = new Set<string>();
  const companies: RawCompany[] = [];

  for (const query of queries) {
    if (companies.length >= maxResults) break;

    console.log(`[Agent1] Searching: "${query}"`);
    const results = await firecrawlSearch(query, 10);
    console.log(`[Agent1] "${query}" → ${results.length} raw results`);

    for (const item of results) {
      const url: string = item.url ?? item.link ?? "";
      const domain = extractDomain(url);
      if (!domain || seen.has(domain) || SKIP_DOMAINS.has(domain)) continue;
      seen.add(domain);

      const company = extractCompanyFromResult(item);
      if (company) {
        companies.push(company);
        console.log(`[Agent1] Found: ${company.name} (${domain})`);
      }
      if (companies.length >= maxResults) break;
    }

    await sleep(800);
  }

  console.log(`[Agent1] Discovery complete — ${companies.length} unique companies`);
  return companies.slice(0, maxResults);
}

export async function enrichCompanyFromWebsite(
  company: RawCompany,
  targetCountry: string
): Promise<EnrichedCompanyProfile> {
  if (!company.website) return fallbackProfile(company, targetCountry);

  const content = (await firecrawlScrape(company.website)).slice(0, 3000);
  const lower = content.toLowerCase();

  return {
    ...company,
    description: content || company.description,
    products: extractProductMentions(lower),
    employeeRange: extractEmployeeRange(content),
    revenueRange: "",
    asiaConnection: ASIA_KEYWORDS.some((kw) => lower.includes(kw)),
    indiaConnection: INDIA_KEYWORDS.some((kw) => lower.includes(kw)),
    country: targetCountry,
  };
}

function fallbackProfile(company: RawCompany, targetCountry: string): EnrichedCompanyProfile {
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

function extractCompanyFromResult(result: any): RawCompany | null {
  const url: string = result.url ?? result.link ?? "";
  const domain = extractDomain(url);
  if (!domain) return null;

  // Firecrawl search returns title directly; fall back to domain
  const name =
    result.title?.split("|")[0]?.trim() ||
    result.title?.split("-")[0]?.trim() ||
    domain;

  return {
    name: name || domain,
    website: `https://${domain}`,
    description: result.description ?? result.snippet ?? "",
    sourceUrl: url,
  };
}

function extractProductMentions(text: string): string {
  const keywords = [
    "organic", "food", "textile", "fabric", "seafood", "spice",
    "rice", "grain", "pulse", "lentil", "import", "export",
    "wholesale", "distribute", "source", "supply", "trade",
  ];
  return keywords.filter((kw) => text.includes(kw)).slice(0, 10).join(", ");
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

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
