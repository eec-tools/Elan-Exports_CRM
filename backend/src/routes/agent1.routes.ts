import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { runAgent1 } from "../agents/agent1/agent1.js";
import prisma from "../config/db.js";
import type { AuthRequest } from "../types/index.js";

const router = Router();
router.use(authenticate);

// POST /api/agent1/run — trigger a new discovery run
router.post("/run", async (req: AuthRequest, res) => {
  try {
    const { country, productCategory } = req.body;
    if (!country || !productCategory) {
      res.status(400).json({ error: "country and productCategory are required." });
      return;
    }
    const result = await runAgent1({
      country,
      productCategory,
      triggeredBy: req.user!.id,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/agent1/runs — list last 20 runs
router.get("/runs", async (_req, res) => {
  const runs = await prisma.agentRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json(runs);
});

// GET /api/agent1/runs/:runId — poll status of a specific run
router.get("/runs/:runId", async (req, res) => {
  const run = await prisma.agentRun.findUnique({
    where: { id: req.params.runId },
  });
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json(run);
});

// GET /api/agent1/runs/:runId/results — fetch ranked results
// Shows all companies that passed the email gate (priorityTier not null) and scored > 0.
// We do NOT re-filter on emailStatus here — the pipeline's email gate already decided what passes.
// Scraped emails get status "unknown" from Hunter (they come from website pages, not Hunter DB),
// so filtering on ["valid","deliverable"] would incorrectly exclude them.
router.get("/runs/:runId/results", async (req, res) => {
  const companies = await prisma.discoveredCompany.findMany({
    where: {
      agentRunId: req.params.runId,
      priorityTier: { not: null },   // passed the email gate AND scored ≥ 30
      discardReason: null,
    },
    include: {
      contacts: {
        where: { isPrimary: true },
      },
    },
    orderBy: { fitScore: "desc" },
  });
  res.json(companies);
});

// DELETE /api/agent1/runs/:runId — delete a run and all its companies/contacts
router.delete("/runs/:runId", async (req, res) => {
  const { runId } = req.params;
  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  // Cascade deletes DiscoveredCompany → AgentContact via schema onDelete: Cascade
  await prisma.agentRun.delete({ where: { id: runId } });
  res.json({ success: true });
});

export default router;
