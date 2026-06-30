import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AgentRun {
  id: string;
  country: string;
  productCategory: string;
  status: "pending" | "running" | "completed" | "failed";
  totalFound: number;
  totalScored: number;
  totalHighPrio: number;
  totalMedPrio: number;
  errorMessage?: string | null;
  startedAt?: string | null;
}

interface Props {
  run: AgentRun;
}

type StepStatus = "done" | "active" | "pending";

interface Step {
  label: string | ((run: AgentRun) => string);
  getStatus: (run: AgentRun) => StepStatus;
}

const STEPS: Step[] = [
  {
    label: "Inputs validated",
    getStatus: () => "done",
  },
  {
    label: () => `Apollo search params built`,
    getStatus: () => "done",
  },
  {
    label: (run: AgentRun) =>
      run.totalFound > 0
        ? `Apollo discovery complete · ${run.totalFound} leads found`
        : "Querying Apollo (2 API calls)…",
    getStatus: (run: AgentRun) => (run.totalFound > 0 ? "done" : "active"),
  },
  {
    label: (run: AgentRun) =>
      run.totalScored > 0
        ? `Email verification & scoring (${run.totalScored} / ${run.totalFound || "?"})`
        : "Verifying emails & scoring…",
    getStatus: (run: AgentRun) => {
      if (run.status === "completed") return "done";
      if (run.totalFound > 0) return "active";
      return "pending";
    },
  },
  {
    label: "Final ranking complete",
    getStatus: (run: AgentRun) => (run.status === "completed" ? "done" : "pending"),
  },
];

function getLabel(step: Step, run: AgentRun): string {
  return typeof step.label === "function" ? step.label(run) : step.label;
}

function useElapsed(startedAt?: string | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return elapsed;
}

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function RunProgress({ run }: Props) {
  const elapsed = useElapsed(run.startedAt);
  const progress =
    run.status === "completed"
      ? 100
      : run.totalFound > 0 && run.totalScored > 0
      ? Math.min(95, Math.round((run.totalScored / run.totalFound) * 100))
      : run.totalFound > 0
      ? 30
      : 10;

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              {run.country} · {run.productCategory}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {run.startedAt
                ? `Started ${new Date(run.startedAt).toLocaleTimeString()} · Elapsed ${formatElapsed(elapsed)}`
                : "Starting…"}
            </p>
          </div>
          {run.status === "running" && (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          )}
          {run.status === "completed" && (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          )}
          {run.status === "failed" && (
            <XCircle className="h-5 w-5 text-rose-500" />
          )}
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-3">
          {STEPS.map((step, i) => {
            const status: StepStatus = step.getStatus(run);
            const label = getLabel(step, run);
            return (
              <div key={i} className="flex items-center gap-3">
                {status === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : status === "active" ? (
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-300 shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    status === "done"
                      ? "text-slate-700"
                      : status === "active"
                      ? "text-blue-600 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}

          {run.status === "failed" && run.errorMessage && (
            <div className="flex items-start gap-3 mt-2">
              <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="text-sm text-rose-600">{run.errorMessage}</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-6 pb-5">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-slate-400 text-right mt-1">{progress}%</p>
        </div>
      </div>
    </div>
  );
}
