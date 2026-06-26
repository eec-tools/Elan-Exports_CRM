import prisma from "../../config/db.js";
import { validateInputs } from "./inputHandler.js";
import { searchCompanies, enrichCompanyFromWebsite } from "./discoveryEngine.js";
import { findAndVerifyContactForCompany } from "./emailEngine.js";
import { scoreCompany } from "./scoringEngine.js";

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
    validation.searchQueries,
    validation.directoryQueries
  ).catch(async (err) => {
    console.error(`[Agent1] Run ${run.id} failed:`, err);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: String(err?.message ?? err),
        completedAt: new Date(),
      },
    });
  });

  return { runId: run.id, message: "Agent 1 started. Poll /api/agent1/runs/" + run.id + " for status." };
}

async function executeRun(
  runId: string,
  country: string,
  productCategory: string,
  searchQueries: string[],
  directoryQueries: string[]
): Promise<void> {
  const allQueries = [...searchQueries, ...directoryQueries];

  console.log(`[Agent1] Run ${runId} — starting discovery with ${allQueries.length} queries`);

  const rawCompanies = await searchCompanies(allQueries, 50);
  console.log(`[Agent1] Run ${runId} — found ${rawCompanies.length} companies`);

  await prisma.agentRun.update({
    where: { id: runId },
    data: { totalFound: rawCompanies.length },
  });

  let highCount = 0;
  let medCount = 0;
  let scoredCount = 0;

  for (const raw of rawCompanies) {
    try {
      const profile = await enrichCompanyFromWebsite(raw, country);
      const { contacts, verifiedPrimary, shouldDiscard, discardReason } =
        await findAndVerifyContactForCompany(raw.website);

      // Mandatory field gate: no verified email → discard, save record, skip scoring
      if (shouldDiscard) {
        await prisma.discoveredCompany.create({
          data: {
            agentRunId:   runId,
            name:         profile.name,
            website:      profile.website,
            country:      profile.country,
            sourceUrl:    profile.sourceUrl,
            discardReason,
          },
        });
        await sleep(300);
        continue;
      }

      const primary = contacts[0] ?? null;
      const score = await scoreCompany(profile, primary, true, productCategory, country);

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

      // Save all found contacts — only verified ones reach this point
      for (const c of contacts) {
        await prisma.agentContact.create({
          data: {
            companyId:       company.id,
            name:            `${c.firstName} ${c.lastName}`.trim() || null,
            title:           c.title || null,
            email:           c.email,
            emailStatus:     verifiedPrimary?.email === c.email ? verifiedPrimary!.status : "unverified",
            emailConfidence: c.confidence,
            linkedinUrl:     c.linkedinUrl || null,
            isPrimary:       verifiedPrimary?.email === c.email,
          },
        });
      }

      if (score.priorityTier === "High")   highCount++;
      if (score.priorityTier === "Medium") medCount++;
      if (score.priorityTier !== "Discard") scoredCount++;

      console.log(`[Agent1] ${profile.name} → score ${score.fitScore} (${score.priorityTier})`);
    } catch (err) {
      console.error(`[Agent1] Failed to process company "${raw.name}":`, err);
    }

    await sleep(300);
  }

  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status:        "completed",
      totalScored:   scoredCount,
      totalHighPrio: highCount,
      totalMedPrio:  medCount,
      completedAt:   new Date(),
    },
  });

  console.log(`[Agent1] Run ${runId} complete — ${scoredCount} scored, ${highCount} HIGH, ${medCount} MED`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
