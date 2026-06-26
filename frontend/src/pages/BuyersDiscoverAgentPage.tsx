import { useState, useEffect, useCallback } from "react";
import { Bot, History, ChevronRight, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import apiClient from "@/api/client";
import { TriggerForm } from "@/components/agent1/TriggerForm";
import { RunProgress } from "@/components/agent1/RunProgress";
import { ResultsTable, type DiscoveredCompany } from "@/components/agent1/ResultsTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RunStatus = "pending" | "running" | "completed" | "failed";

interface AgentRun {
  id: string;
  country: string;
  productCategory: string;
  status: RunStatus;
  totalFound: number;
  totalScored: number;
  totalHighPrio: number;
  totalMedPrio: number;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

type PageView = "trigger" | "progress" | "results";

const TIER_BADGE: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  running:   "bg-blue-50 text-blue-700 border-blue-200",
  failed:    "bg-rose-50 text-rose-700 border-rose-200",
  pending:   "bg-slate-100 text-slate-600 border-slate-200",
};

export default function BuyersDiscoverAgentPage() {
  const queryClient = useQueryClient();

  const [view, setView] = useState<PageView>("trigger");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);

  // Fetch all past runs
  const { data: runs = [], isLoading: runsLoading } = useQuery<AgentRun[]>({
    queryKey: ["agent1-runs"],
    queryFn: async () => {
      const res = await apiClient.get("/agent1/runs");
      return res.data;
    },
    refetchInterval: pollingEnabled ? false : 30000,
  });

  // Poll active run status every 5 seconds
  const { data: activeRun } = useQuery<AgentRun>({
    queryKey: ["agent1-run", activeRunId],
    queryFn: async () => {
      const res = await apiClient.get(`/agent1/runs/${activeRunId}`);
      return res.data;
    },
    enabled: !!activeRunId && pollingEnabled,
    refetchInterval: 5000,
  });

  // Fetch results once run is completed
  const { data: results = [] } = useQuery<DiscoveredCompany[]>({
    queryKey: ["agent1-results", activeRunId],
    queryFn: async () => {
      const res = await apiClient.get(`/agent1/runs/${activeRunId}/results`);
      return res.data;
    },
    enabled: !!activeRunId && activeRun?.status === "completed",
  });

  // Watch for completion / failure
  useEffect(() => {
    if (!activeRun) return;

    if (activeRun.status === "completed") {
      setPollingEnabled(false);
      setView("results");
      queryClient.invalidateQueries({ queryKey: ["agent1-runs"] });
      toast.success(
        `Discovery complete — ${activeRun.totalHighPrio} HIGH, ${activeRun.totalMedPrio} MED priority leads found`
      );
    } else if (activeRun.status === "failed") {
      setPollingEnabled(false);
      setView("trigger");
      toast.error(`Agent run failed: ${activeRun.errorMessage ?? "Unknown error"}`);
    }
  }, [activeRun?.status]);

  // Trigger new run
  const startMutation = useMutation({
    mutationFn: async ({ country, category }: { country: string; category: string }) => {
      const res = await apiClient.post("/agent1/run", { country, productCategory: category });
      return res.data as { runId: string; message: string };
    },
    onSuccess: (data) => {
      setActiveRunId(data.runId);
      setPollingEnabled(true);
      setView("progress");
      queryClient.invalidateQueries({ queryKey: ["agent1-runs"] });
      toast.info("Agent 1 started — this will take 8–12 minutes");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? "Failed to start agent");
    },
  });

  const handleTrigger = useCallback(
    (country: string, category: string) => {
      startMutation.mutate({ country, category });
    },
    [startMutation]
  );

  const handleViewRun = (run: AgentRun) => {
    setActiveRunId(run.id);
    if (run.status === "running" || run.status === "pending") {
      setPollingEnabled(true);
      setView("progress");
    } else if (run.status === "completed") {
      setPollingEnabled(false);
      setView("results");
    }
  };

  const handleNewRun = () => {
    setActiveRunId(null);
    setPollingEnabled(false);
    setView("trigger");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base">Buyers Discover Agent</h1>
              <p className="text-xs text-slate-400">AI-powered buyer discovery & ranking pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view !== "trigger" && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleNewRun}>
                <RefreshCw className="h-3.5 w-3.5" />
                New Run
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main panel ── */}
        <div className="lg:col-span-2">
          {view === "trigger" && (
            <TriggerForm
              onSubmit={handleTrigger}
              isLoading={startMutation.isPending}
            />
          )}

          {view === "progress" && activeRun && (
            <RunProgress run={activeRun} />
          )}

          {view === "results" && activeRun && (
            <ResultsTable companies={results} run={activeRun} />
          )}
        </div>

        {/* ── Run history sidebar ── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              <h3 className="font-semibold text-slate-700 text-sm">Run History</h3>
            </div>

            {runsLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">Loading…</div>
            ) : runs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs px-4">
                No runs yet. Start your first agent run.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => handleViewRun(run)}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                      activeRunId === run.id ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-700 truncate">
                          {run.country}
                        </span>
                        <span className="text-slate-300 text-xs">·</span>
                        <span className="text-xs text-slate-500 truncate">{run.productCategory}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          className={`${TIER_BADGE[run.status]} border text-[10px] font-medium py-0 px-1.5`}
                        >
                          {run.status}
                        </Badge>
                        {run.status === "completed" && (
                          <span className="text-[10px] text-slate-400">
                            {run.totalHighPrio}H · {run.totalMedPrio}M
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(run.createdAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
