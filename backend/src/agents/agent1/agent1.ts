import prisma from "../../config/db.js";
import { validateInputs } from "./inputHandler.js";
import { searchApolloLeads, employeeCountToRange, revenueToRange } from "./apolloEngine.js";
import { searchCompanies, enrichCompanyFromWebsite, firecrawlScrape } from "./discoveryEngine.js";
import { verifyEmail, findAndVerifyContactForCompany } from "./emailEngine.js";
import { scoreCompany } from "./scoringEngine.js";
import type {
  ApolloLead,
  EnrichedCompanyProfile,
  FoundEmail,
} from "./types.js";

export async function runAgent1(params: {
  country: string;
  productCategory: string;
  triggeredBy: string;
}): Promise<{ runId: string; message: string }> {
  const { country, productCategory, triggeredBy } = params;

  const validation = validateInputs(country, productCategory);
  if (!validation.valid) throw new Error(validation.error);

  const run = await prisma.agentRun.create({
    data: {
      country,
      productCategory,
      triggeredBy,
      status: "running",
      startedAt: new Date(),
    },
  });

  // Fire-and-forget — caller gets runId immediately, polls for status
  executeRun(
    run.id,
    country,
    productCategory,
    validation.apolloBuyerTitles,
    validation.apolloKeywords,
    validation.searchQueries,
    validation.directoryQueries,
  ).catch(async (err) => {
    console.error(`[Agent1] Run ${run.id} crashed:`, err);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: String(err?.message ?? err),
        completedAt: new Date(),
      },
    });
  });

  return {
    runId: run.id,
    message: `Agent 1 started. Poll /api/agent1/runs/${run.id} for status.`,
  };
}

// ── Core pipeline ─────────────────────────────────────────────────────────────

async function executeRun(
  runId: string,
  country: string,
  productCategory: string,
  apolloBuyerTitles: string[],
  apolloKeywords: string[],
  searchQueries: string[],
  directoryQueries: string[],
): Promise<void> {
  let highCount = 0;
  let medCount  = 0;
  let scored    = 0;

  // ── Step 1: Apollo search (2 API calls) ───────────────────────────────────
  console.log(`[Agent1] Run ${runId} — Apollo discovery start (${country} · ${productCategory})`);
  const apolloLeads = await searchApolloLeads(
    country, productCategory, apolloBuyerTitles, apolloKeywords
  );

  if (apolloLeads.length > 0) {
    // ── Apollo path: structured leads with company + contact data ─────────
    console.log(`[Agent1] Apollo path — ${apolloLeads.length} leads`);
    await prisma.agentRun.update({ where: { id: runId }, data: { totalFound: apolloLeads.length } });

    for (const lead of apolloLeads) {
      try {
        await processApolloLead(lead, runId, country, productCategory);
        const last = await prisma.discoveredCompany.findFirst({
          where: { agentRunId: runId, name: lead.organization.name },
          orderBy: { createdAt: "desc" },
        });
        if (last?.priorityTier === "High")   highCount++;
        if (last?.priorityTier === "Medium") medCount++;
        if (last?.priorityTier)              scored++;
      } catch (err) {
        console.error(`[Agent1] Apollo lead failed "${lead.organization.name}":`, err);
      }
      await sleep(300);
    }
  } else {
    // ── Firecrawl fallback: Apollo plan doesn't allow search ──────────────
    console.log(`[Agent1] Apollo returned 0 — falling back to Firecrawl search`);
    const allQueries = [...searchQueries, ...directoryQueries];
    const rawCompanies = await searchCompanies(allQueries, 50);
    console.log(`[Agent1] Firecrawl found ${rawCompanies.length} companies`);

    await prisma.agentRun.update({ where: { id: runId }, data: { totalFound: rawCompanies.length } });

    for (const raw of rawCompanies) {
      try {
        const tier = await processFirecrawlCompany(raw, runId, country, productCategory);
        if (tier === "High")   highCount++;
        if (tier === "Medium") medCount++;
        if (tier)              scored++;
      } catch (err) {
        console.error(`[Agent1] Firecrawl company failed "${raw.name}":`, err);
      }
      await sleep(300);
    }
  }

  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status:        "completed",
      totalScored:   scored,
      totalHighPrio: highCount,
      totalMedPrio:  medCount,
      completedAt:   new Date(),
    },
  });

  console.log(`[Agent1] Run ${runId} complete — ${scored} scored, ${highCount} HIGH, ${medCount} MED`);
}

// ── Apollo lead processor ─────────────────────────────────────────────────────

async function processApolloLead(
  lead: ApolloLead,
  runId: string,
  country: string,
  productCategory: string
): Promise<void> {
  const org = lead.organization;

  // ── Email resolution: 3 paths, no wasted API calls ────────────────────────
  //
  // Path A — Apollo gave us a verified email  → use directly, 0 Hunter calls
  // Path B — Apollo email present but unverified → 1 Hunter verify call
  // Path C — No Apollo email                 → Hunter domain search
  // Discard if no verified email found in any path  (MANDATORY field)

  const resolved = await resolveEmail(lead);

  if (!resolved.email) {
    // Save discard record (counts toward totalFound, not totalScored)
    await prisma.discoveredCompany.create({
      data: {
        agentRunId:   runId,
        name:         org.name,
        website:      org.website,
        country,
        industry:     org.industry || null,
        description:  org.description.slice(0, 500) || null,
        sourceUrl:    "Apollo.io",
        discardReason: "No verified email found",
      },
    });
    console.log(`[Agent1] Discarded "${org.name}" — no verified email`);
    return;
  }

  // ── Build enriched profile from Apollo structured data ────────────────────
  const profile = buildProfile(lead, country);

  // ── Optional: Firecrawl scrape only when Apollo description is thin ────────
  // Saves Firecrawl credits — Apollo's short_description is usually enough.
  if (profile.description.length < 200 && org.domain) {
    console.log(`[Agent1] Thin description for "${org.name}" — scraping website`);
    const scraped = await firecrawlScrape(org.website);
    if (scraped) {
      profile.description = scraped.slice(0, 2000);
      // Re-run Asia/India signal detection on scraped content
      const lower = scraped.toLowerCase();
      profile.asiaConnection = ASIA_KW.some((kw) => lower.includes(kw));
      profile.indiaConnection = INDIA_KW.some((kw) => lower.includes(kw));
    }
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  const primaryFoundEmail: FoundEmail = {
    email:      resolved.email,
    firstName:  resolved.firstName,
    lastName:   resolved.lastName,
    title:      resolved.title,
    confidence: resolved.emailConfidence,
    linkedinUrl: resolved.linkedinUrl,
  };

  const score = await scoreCompany(
    profile,
    primaryFoundEmail,
    true,
    productCategory,
    country
  );

  // ── Persist company ───────────────────────────────────────────────────────
  const company = await prisma.discoveredCompany.create({
    data: {
      agentRunId:       runId,
      name:             profile.name,
      website:          profile.website,
      country:          profile.country,
      industry:         org.industry || null,
      description:      profile.description.slice(0, 2000),
      productsImported: profile.products || null,
      employeeRange:    profile.employeeRange || null,
      revenueRange:     profile.revenueRange || null,
      asiaConnection:   profile.asiaConnection,
      indiaConnection:  profile.indiaConnection,
      sourceUrl:        "Apollo.io",
      fitScore:         score.fitScore,
      scoreDim1:        score.d1,
      scoreDim2:        score.d2,
      scoreDim3:        score.d3,
      scoreDim4:        score.d4,
      scoreDim5:        score.d5,
      priorityTier:     score.priorityTier === "Discard" ? null : (score.priorityTier as any),
      rationale:        score.rationale,
      discardReason:    score.priorityTier === "Discard" ? "Score below 30" : null,
    },
  });

  // ── Persist contacts ──────────────────────────────────────────────────────
  // Primary contact (mandatory verified email)
  await prisma.agentContact.create({
    data: {
      companyId:       company.id,
      name:            `${resolved.firstName} ${resolved.lastName}`.trim() || null,
      title:           resolved.title || null,
      email:           resolved.email,
      emailStatus:     resolved.emailStatus,
      emailConfidence: resolved.emailConfidence,
      linkedinUrl:     resolved.linkedinUrl || null,
      isPrimary:       true,
    },
  });

  // Secondary contacts from Hunter (if domain search was used — Path C)
  for (const extra of resolved.extraContacts) {
    await prisma.agentContact.create({
      data: {
        companyId:       company.id,
        name:            `${extra.firstName} ${extra.lastName}`.trim() || null,
        title:           extra.title || null,
        email:           extra.email,
        emailStatus:     "valid",
        emailConfidence: extra.confidence,
        linkedinUrl:     extra.linkedinUrl || null,
        isPrimary:       false,
      },
    });
  }

  console.log(
    `[Agent1] ✓ ${profile.name} → score ${score.fitScore} (${score.priorityTier}) | ${resolved.email}`
  );
}

// ── Firecrawl fallback processor ─────────────────────────────────────────────
// Returns the priorityTier string ("High" | "Medium" | "Low" | null) for counters.

import type { RawCompany } from "./types.js";

async function processFirecrawlCompany(
  raw: RawCompany,
  runId: string,
  country: string,
  productCategory: string
): Promise<string | null> {
  // Email gate first — discard immediately if no verified email
  const emailResult = await findAndVerifyContactForCompany(raw.website);

  if (emailResult.shouldDiscard) {
    await prisma.discoveredCompany.create({
      data: {
        agentRunId:    runId,
        name:          raw.name,
        website:       raw.website,
        country,
        sourceUrl:     raw.sourceUrl,
        discardReason: emailResult.discardReason,
      },
    });
    console.log(`[Agent1] Discarded "${raw.name}" — ${emailResult.discardReason}`);
    return null;
  }

  // Enrich via Firecrawl scrape
  const profile = await enrichCompanyFromWebsite(raw, country);
  const primary = emailResult.contacts[0] ?? null;
  const score   = await scoreCompany(profile, primary, true, productCategory, country);

  const company = await prisma.discoveredCompany.create({
    data: {
      agentRunId:       runId,
      name:             profile.name,
      website:          profile.website,
      country:          profile.country,
      description:      profile.description.slice(0, 2000),
      productsImported: profile.products || null,
      employeeRange:    profile.employeeRange || null,
      asiaConnection:   profile.asiaConnection,
      indiaConnection:  profile.indiaConnection,
      sourceUrl:        raw.sourceUrl,
      fitScore:         score.fitScore,
      scoreDim1:        score.d1,
      scoreDim2:        score.d2,
      scoreDim3:        score.d3,
      scoreDim4:        score.d4,
      scoreDim5:        score.d5,
      priorityTier:     score.priorityTier === "Discard" ? null : (score.priorityTier as any),
      rationale:        score.rationale,
      discardReason:    score.priorityTier === "Discard" ? "Score below 30" : null,
    },
  });

  // Save verified contacts
  for (const [i, c] of emailResult.contacts.entries()) {
    await prisma.agentContact.create({
      data: {
        companyId:       company.id,
        name:            `${c.firstName} ${c.lastName}`.trim() || null,
        title:           c.title || null,
        email:           c.email,
        emailStatus:     emailResult.verifiedPrimary?.email === c.email
                           ? (emailResult.verifiedPrimary!.status)
                           : "unverified",
        emailConfidence: c.confidence,
        linkedinUrl:     c.linkedinUrl || null,
        isPrimary:       i === 0,
      },
    });
  }

  const tier = score.priorityTier === "Discard" ? null : score.priorityTier;
  console.log(`[Agent1] ✓ ${profile.name} → score ${score.fitScore} (${score.priorityTier}) | ${primary?.email}`);
  return tier;
}

// ── Email resolution ──────────────────────────────────────────────────────────

interface ResolvedEmail {
  email: string | null;
  emailStatus: string;
  emailConfidence: number;
  firstName: string;
  lastName: string;
  title: string;
  linkedinUrl: string;
  extraContacts: FoundEmail[];  // additional Hunter contacts (not primary)
}

async function resolveEmail(lead: ApolloLead): Promise<ResolvedEmail> {
  const c = lead.contact;
  const baseContact = {
    firstName:  c.firstName,
    lastName:   c.lastName,
    title:      c.title,
    linkedinUrl: c.linkedinUrl ?? "",
    extraContacts: [] as FoundEmail[],
  };

  // ── Path A: Apollo verified email — no Hunter call needed ─────────────────
  if (c.email && c.emailStatus === "verified") {
    console.log(`[Email] Path A (Apollo verified): ${c.email}`);
    return {
      ...baseContact,
      email:           c.email,
      emailStatus:     "valid",
      emailConfidence: 95,
    };
  }

  // ── Path B: Apollo email exists but status is not "verified" ──────────────
  // Use 1 Hunter verify call to confirm deliverability.
  if (c.email) {
    const v = await verifyEmail(c.email);
    if (v.status === "valid" || v.status === "deliverable") {
      console.log(`[Email] Path B (Hunter verified Apollo email): ${c.email}`);
      return {
        ...baseContact,
        email:           c.email,
        emailStatus:     v.status,
        emailConfidence: v.score,
      };
    }
    // Email risky/invalid — fall through to domain search
    console.log(`[Email] Path B failed (${v.status}) — trying domain search`);
  }

  // ── Path C: No Apollo email (or B failed) — Hunter domain search ──────────
  const hunterResult = await findAndVerifyContactForCompany(lead.organization.website);
  if (!hunterResult.shouldDiscard && hunterResult.contacts.length > 0) {
    const primary = hunterResult.contacts[0];
    console.log(`[Email] Path C (Hunter domain): ${primary.email}`);
    return {
      firstName:   primary.firstName,
      lastName:    primary.lastName,
      title:       primary.title,
      linkedinUrl: primary.linkedinUrl ?? "",
      email:           primary.email,
      emailStatus:     hunterResult.verifiedPrimary?.status ?? "valid",
      emailConfidence: primary.confidence,
      extraContacts:   hunterResult.contacts.slice(1),  // rest are non-primary
    };
  }

  // ── All paths exhausted — discard ─────────────────────────────────────────
  return {
    ...baseContact,
    email:           null,
    emailStatus:     "none",
    emailConfidence: 0,
  };
}

// ── Apollo → EnrichedCompanyProfile ──────────────────────────────────────────

const ASIA_KW  = ["china", "india", "vietnam", "bangladesh", "thailand", "indonesia", "asia", "south asia", "far east"];
const INDIA_KW = ["india", "indian", "subcontinent", "south asia"];

const PRODUCT_KW = [
  "organic", "food", "textile", "fabric", "seafood", "spice", "rice",
  "grain", "pulse", "lentil", "import", "wholesale", "trade", "distribute",
  "garment", "apparel", "fresh", "frozen", "commodity",
];

function buildProfile(lead: ApolloLead, country: string): EnrichedCompanyProfile {
  const org = lead.organization;

  const allText = [
    org.description,
    org.industry,
    org.keywords.join(" "),
  ].join(" ").toLowerCase();

  // Build a rich description from Apollo's structured fields
  const descParts = [
    org.description,
    org.industry  ? `Industry: ${org.industry}` : "",
    org.keywords.length ? `Focus areas: ${org.keywords.slice(0, 10).join(", ")}` : "",
  ].filter(Boolean);

  return {
    name:          org.name,
    website:       org.website,
    description:   descParts.join(". "),
    products:      org.keywords.filter((kw) => PRODUCT_KW.some((pk) => kw.toLowerCase().includes(pk))).join(", "),
    employeeRange: org.employeeCount ? employeeCountToRange(org.employeeCount) : "",
    revenueRange:  org.annualRevenue  ? revenueToRange(org.annualRevenue)       : "",
    asiaConnection:  ASIA_KW.some((kw) => allText.includes(kw)),
    indiaConnection: INDIA_KW.some((kw) => allText.includes(kw)),
    country,
    sourceUrl: "Apollo.io",
  };
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
