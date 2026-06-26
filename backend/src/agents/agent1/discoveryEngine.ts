import { ScrapeGraphAI } from "scrapegraph-js";
import type { RawCompany, EnrichedCompanyProfile } from "./types.js";

let sgai: ReturnType<typeof ScrapeGraphAI> | null = null;

function getScrapeGraphClient() {
  const apiKey = process.env.SGAI_API_KEY;
  if (!apiKey) return null;
  if (!sgai) {
    sgai = ScrapeGraphAI({ apiKey });
  }
  return sgai;
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

// ── Timeout helper — prevents any single API call from hanging forever ──────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[Agent1] Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

export async function searchCompanies(
  queries: string[],
  maxResults = 50
): Promise<RawCompany[]> {
  const client = getScrapeGraphClient();
  if (!client) {
    console.warn("[Agent1] SGAI_API_KEY not configured; skipping discovery search.");
    return [];
  }

  const seen = new Set<string>();
  const companies: RawCompany[] = [];

  for (const query of queries) {
    if (companies.length >= maxResults) break;

    try {
      const result = await withTimeout(
        client.search({
          query,
          numResults: 10,
          format: "markdown",
          mode: "reader",
        }),
        30000,
        `search "${query}"`
      );

      if (result.status !== "success" || !result.data) {
        console.error(`[Agent1] ScrapeGraphAI search failed for "${query}":`, result.error);
        continue;
      }

      // Parse the search results — ScrapeGraphAI returns an array of result objects
      const searchResults = Array.isArray(result.data) ? result.data : (result.data as any)?.results ?? [];

      for (const item of searchResults) {
        const url = item.url ?? item.link ?? "";
        const domain = extractDomain(url);
        if (!domain || seen.has(domain) || SKIP_DOMAINS.has(domain)) continue;
        seen.add(domain);

        const company = extractCompanyFromResult(item);
        if (company) companies.push(company);
        if (companies.length >= maxResults) break;
      }

      await sleep(1200);
    } catch (err) {
      console.error(`[Agent1] ScrapeGraphAI search error: "${query}"`, err);
    }
  }

  return companies.slice(0, maxResults);
}

export async function enrichCompanyFromWebsite(
  company: RawCompany,
  targetCountry: string
): Promise<EnrichedCompanyProfile> {
  const client = getScrapeGraphClient();
  if (!client) {
    return fallbackProfile(company, targetCountry);
  }

  try {
    const result = await withTimeout(
      client.scrape({
        url: company.website,
        formats: [{ type: "markdown", mode: "reader" }],
      }),
      15000,
      `scrape ${company.website}`
    );

    if (result.status !== "success" || !result.data) {
      console.warn(`[Agent1] Scrape failed for ${company.website}:`, result.error);
      return fallbackProfile(company, targetCountry);
    }

    // Extract markdown content from the response
    const content = (
      (result.data as any)?.results?.markdown?.data ??
      (result.data as any)?.markdown ??
      ""
    ).slice(0, 3000);

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
  } catch {
    return fallbackProfile(company, targetCountry);
  }
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
  const url = result.url ?? result.link ?? "";
  const domain = extractDomain(url);
  if (!domain) return null;

  const name =
    result.title?.split("|")[0]?.trim() ??
    result.title?.split("-")[0]?.trim() ??
    domain;

  return {
    name: name || domain,
    website: `https://${domain}`,
    description: result.description ?? result.snippet ?? result.content?.slice(0, 500) ?? "",
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
