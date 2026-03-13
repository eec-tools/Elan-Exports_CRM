import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Factory,
  FileText,
  UserCog,
  Loader2,
  Video,
  HardDrive,
  ExternalLink,
  TrendingUp,
  DollarSign,
  Archive,
  CalendarCheck,
  ArrowRight,
  Zap,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
interface PipelineStage {
  stage: string;
  count: number;
  revenue: number;
}

interface RecentDeal {
  id: string;
  title: string;
  buyer?: string;
  stage: string;
  expectedRevenue?: number;
  probability?: number;
  riskScore?: string;
  createdAt: string;
}

interface DashboardStats {
  totalBuyers: number;
  totalSuppliers: number;
  activeUsers: number;
  totalReports: number;
  totalDeals: number;
  totalVaultDocs: number;
  pendingTasks: number;
  totalPipelineRevenue: number;
  pipeline: PipelineStage[];
  recentDeals: RecentDeal[];
}

// ─── Helpers ────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatCurrency(n: number | null | undefined) {
  const v = n ?? 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function formatDate() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

// ─── Stage config ────────────────────────────────────────────────────
const STAGE_META: Record<string, { label: string; color: string; bar: string }> = {
  LEAD:         { label: "Lead",         color: "text-slate-600",   bar: "bg-slate-400" },
  RFQ:          { label: "RFQ",          color: "text-blue-600",    bar: "bg-blue-500" },
  SAMPLE:       { label: "Sample",       color: "text-violet-600",  bar: "bg-violet-500" },
  NEGOTIATION:  { label: "Negotiation",  color: "text-amber-600",   bar: "bg-amber-500" },
  CONTRACT:     { label: "Contract",     color: "text-emerald-600", bar: "bg-emerald-500" },
  CLOSED_WON:   { label: "Closed Won",   color: "text-green-600",   bar: "bg-green-500" },
  CLOSED_LOST:  { label: "Closed Lost",  color: "text-rose-600",    bar: "bg-rose-400" },
};

const RISK_META: Record<string, { icon: React.ElementType; color: string }> = {
  Low:    { icon: CheckCircle2,  color: "text-emerald-500" },
  Medium: { icon: Clock,         color: "text-amber-500" },
  High:   { icon: AlertTriangle, color: "text-rose-500" },
};

// ─── Component ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats").then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading || !stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    );
  }

  const s: DashboardStats = {
    totalBuyers: stats.totalBuyers ?? 0,
    totalSuppliers: stats.totalSuppliers ?? 0,
    activeUsers: stats.activeUsers ?? 0,
    totalReports: stats.totalReports ?? 0,
    totalDeals: stats.totalDeals ?? 0,
    totalVaultDocs: stats.totalVaultDocs ?? 0,
    pendingTasks: stats.pendingTasks ?? 0,
    totalPipelineRevenue: stats.totalPipelineRevenue ?? 0,
    pipeline: stats.pipeline ?? [],
    recentDeals: stats.recentDeals ?? [],
  };
  const maxPipelineCount = Math.max(...(s.pipeline?.map((p) => p.count) ?? [1]), 1);

  const kpiCards = [
    {
      title: "Total Buyers",
      value: s.totalBuyers,
      icon: Users,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      border: "border-blue-100",
      href: "/buyers",
    },
    {
      title: "Suppliers",
      value: s.totalSuppliers,
      icon: Factory,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      border: "border-emerald-100",
      href: "/suppliers/signed-contract",
    },
    {
      title: "Active Deals",
      value: s.totalDeals,
      icon: TrendingUp,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      border: "border-violet-100",
      href: "/deals",
    },
    {
      title: "Pipeline Revenue",
      value: formatCurrency(s.totalPipelineRevenue),
      icon: DollarSign,
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
      border: "border-green-100",
      href: "/deals",
      isString: true,
    },
    {
      title: "Pending Tasks",
      value: s.pendingTasks,
      icon: CalendarCheck,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      border: "border-amber-100",
      href: "/daily-tasks",
    },
    {
      title: "Vault Documents",
      value: s.totalVaultDocs,
      icon: Archive,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
      border: "border-indigo-100",
      href: "/vault",
    },
  ];

  const secondaryCards = [
    {
      title: "Reports",
      value: s.totalReports,
      icon: FileText,
      color: "text-rose-600",
      bg: "bg-rose-50",
      href: "/reports",
    },
    {
      title: "Active Users",
      value: s.activeUsers,
      icon: UserCog,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      href: "/members",
    },
    {
      title: "Vault Docs",
      value: s.totalVaultDocs,
      icon: Package,
      color: "text-purple-600",
      bg: "bg-purple-50",
      href: "/vault",
    },
    {
      title: "Pipeline Stages",
      value: s.pipeline?.length ?? 0,
      icon: BarChart3,
      color: "text-orange-600",
      bg: "bg-orange-50",
      href: "/deals",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Hero Banner ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-brand-900 via-brand-800 to-brand-700 px-6 py-7 text-white shadow-xl">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 bottom-0 h-32 w-32 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-300">{formatDate()}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {getGreeting()},{" "}
              <span style={{ color: "hsl(42, 85%, 60%)" }}>
                {user?.fullName?.split(" ")[0] ?? "there"}
              </span>{" "}
              👋
            </h1>
            <p className="mt-1 text-sm text-brand-300">
              Here's what's happening at Élan Exports today.
            </p>
          </div>

          <div className="mt-4 flex gap-3 sm:mt-0 flex-wrap">
            <div className="flex flex-col items-center rounded-xl bg-white/10 px-5 py-3 backdrop-blur-sm border border-white/10">
              <span className="text-2xl font-bold text-white">{s.totalDeals}</span>
              <span className="text-[11px] text-brand-300 mt-0.5">Total Deals</span>
            </div>
            <div className="flex flex-col items-center rounded-xl bg-white/10 px-5 py-3 backdrop-blur-sm border border-white/10">
              <span className="text-2xl font-bold" style={{ color: "hsl(42, 85%, 65%)" }}>
                {formatCurrency(s.totalPipelineRevenue)}
              </span>
              <span className="text-[11px] text-brand-300 mt-0.5">Pipeline Value</span>
            </div>
            <div className="flex flex-col items-center rounded-xl bg-white/10 px-5 py-3 backdrop-blur-sm border border-white/10">
              <span className="text-2xl font-bold text-white">{s.pendingTasks}</span>
              <span className="text-[11px] text-brand-300 mt-0.5">Open Tasks</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((card) => (
          <Link
            key={card.title}
            to={card.href}
            className={`group relative overflow-hidden rounded-xl border ${card.border} bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{card.title}</p>
                <p className="mt-1.5 text-2xl font-bold text-slate-900 tracking-tight">
                  {card.isString ? card.value : card.value}
                </p>
              </div>
              <div className={`rounded-lg p-2 ${card.iconBg} shrink-0`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
              <span>View details</span>
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      {/* ── Deal Pipeline + Recent Deals ─────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* Pipeline */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-violet-50 p-1.5">
                <BarChart3 className="h-4 w-4 text-violet-600" />
              </div>
              <h2 className="text-sm font-semibold text-slate-800">Deal Pipeline</h2>
            </div>
            <Link to="/deals" className="text-xs text-brand-600 hover:underline font-medium">
              View all
            </Link>
          </div>

          <div className="p-5 space-y-3">
            {s.pipeline && s.pipeline.length > 0 ? (
              s.pipeline.map((p) => {
                const meta = STAGE_META[p.stage] ?? { label: p.stage, color: "text-slate-600", bar: "bg-slate-400" };
                const pct = Math.round((p.count / maxPipelineCount) * 100);
                return (
                  <div key={p.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                      <span className="text-slate-500">
                        {p.count} deal{p.count !== 1 ? "s" : ""}
                        {p.revenue ? <span className="text-slate-400 ml-1">· {formatCurrency(p.revenue)}</span> : null}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-1.5 rounded-full ${meta.bar} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <TrendingUp className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">No deals yet</p>
                <Link to="/deals" className="mt-2 text-xs text-brand-600 hover:underline">
                  Add your first deal →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Deals */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-blue-50 p-1.5">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <h2 className="text-sm font-semibold text-slate-800">Recent Deals</h2>
            </div>
            <Link to="/deals" className="text-xs text-brand-600 hover:underline font-medium">
              View all
            </Link>
          </div>

          <div className="divide-y divide-slate-50">
            {s.recentDeals && s.recentDeals.length > 0 ? (
              s.recentDeals.map((deal) => {
                const stageM = STAGE_META[deal.stage] ?? { label: deal.stage, color: "text-slate-600", bar: "bg-slate-400" };
                const riskM = deal.riskScore ? (RISK_META[deal.riskScore] ?? RISK_META.Medium) : null;
                const RiskIcon = riskM?.icon;
                return (
                  <div key={deal.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{deal.title}</p>
                      {deal.buyer && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{deal.buyer}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {deal.expectedRevenue ? (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-md px-2 py-0.5">
                          {formatCurrency(deal.expectedRevenue)}
                        </span>
                      ) : null}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 ${stageM.color}`}>
                        {stageM.label}
                      </span>
                      {RiskIcon && (
                        <RiskIcon className={`h-3.5 w-3.5 ${riskM?.color}`} />
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <TrendingUp className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">No deals yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Secondary Stats Row ──────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {secondaryCards.map((card) => (
          <Link
            key={card.title}
            to={card.href}
            className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className={`rounded-lg p-2.5 ${card.bg} shrink-0`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 font-medium">{card.title}</p>
              <p className="text-xl font-bold text-slate-900">{card.value}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        ))}
      </div>

      {/* ── Quick Links ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="rounded-md bg-slate-100 p-1.5">
            <Zap className="h-4 w-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-semibold text-slate-700">Quick Links</h2>
        </div>
        <div className="flex gap-3 flex-wrap">
          <a
            href="https://meet.google.com/pqs-znoa-jwk?authuser=0"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-red-200"
          >
            <div className="rounded-lg bg-red-50 p-1.5 group-hover:bg-red-100 transition-colors">
              <Video className="h-4 w-4 text-red-600" />
            </div>
            <span className="text-slate-700">Google Meet</span>
            <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
          </a>
          <a
            href="https://drive.google.com/drive/folders/1GfVddDUKMlzeoiQ_vFpuFptukawWnbwW"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200"
          >
            <div className="rounded-lg bg-blue-50 p-1.5 group-hover:bg-blue-100 transition-colors">
              <HardDrive className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-slate-700">Google Drive</span>
            <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
          </a>
        </div>
      </div>

    </div>
  );
}
