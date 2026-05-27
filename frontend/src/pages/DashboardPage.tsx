import { useState, useMemo, useEffect } from "react";
import { getCustomDealStages } from "@/lib/customDealStages";
import { DEAL_STAGE_CONFIG } from "@/lib/dealStages";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  TrendingUp,
  Users,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  CheckSquare,
  Bell,
  ArrowUpRight,
  CheckCircle2,
  Mail,
  Search,
  Building2,
  ShieldCheck,
  ExternalLink,
  Video,
  HardDrive,
  MessageSquare,
  FileText,
  Calendar,
  Layout,
  Link as LinkIcon,
  Zap,
  Settings,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

// ─── Types ──────────────────────────────────────────────────────────
interface RecentDeal {
  id: string;
  title: string;
  buyer?: string;
  supplier?: string;
  product?: string;
  category?: string;
  stage: string;
  expectedRevenue?: number;
  createdAt: string;
  updatedAt?: string;
  creatorName?: string;
}

interface DashboardStats {
  totalBuyers: number;
  totalSuppliers: number;
  activeUsers: number;
  totalReports: number;
  totalDeals: number;
  totalVaultDocs: number;
  pendingTasks: number;
  taskAnalytics: TaskAnalyticsOwner[];
  recentDeals: RecentDeal[];
  invalidSourcingEmails: number;
}

interface TaskAnalyticsOwner {
  owner: string;
  pending: number;
  inProgress: number;
  completed: number;
  closed: number;
  total: number;
}

interface DueCampaign {
  sourcingId: string;
  currentStep: number;
  nextFollowupDue: string;
  sourcingSupplier: {
    id: string;
    company: string;
    email: string | null;
    contactPerson: string | null;
    assignedGmailAccount: string | null;
  };
}

interface Deal {
  id: string;
  title: string;
  buyer?: string;
  supplier?: string;
  product?: string;
  category?: string;
  stage: string;
  expectedRevenue?: number;
  updatedAt: string;
  createdAt: string;
  creatorName?: string;
}

interface Supplier {
  id: string;
  company: string;
  country?: string;
  products?: string;
  certifications?: string;
  currentStatus?: string;
  supplierStage?: string;
}

const STAGES = DEAL_STAGE_CONFIG;

function fmtMoney(v?: number) {
  if (!v) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDateLong(date: Date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isStale(dateStr?: string, days = 21) {
  if (!dateStr) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(dateStr) < cutoff;
}

function getStageBadge(stage: string): { label: string; textClass: string; bgClass: string } {
  const s = stage.toLowerCase();
  if (s.includes("communication") || s.includes("lead"))
    return { label: "Supplier Mapping", textClass: "text-slate-700", bgClass: "bg-slate-100" };
  if (s.includes("sampling") || s.includes("sample"))
    return { label: "Samples Sent", textClass: "text-blue-700", bgClass: "bg-blue-100" };
  if (s.includes("price approval") || s.includes("price approv"))
    return { label: "Price Approval", textClass: "text-violet-700", bgClass: "bg-violet-100" };
  if (s.includes("negotiation"))
    return { label: "Negotiation", textClass: "text-amber-700", bgClass: "bg-amber-100" };
  if (s.includes("orders confirmed") || s.includes("order confirm"))
    return { label: "Orders Confirmed", textClass: "text-green-700", bgClass: "bg-green-100" };
  if (s.includes("shipment") || s.includes("dispatched"))
    return { label: "In Transit", textClass: "text-cyan-700", bgClass: "bg-cyan-100" };
  if (s.includes("delivered") || s.includes("goods delivered"))
    return { label: "Delivered", textClass: "text-emerald-700", bgClass: "bg-emerald-100" };
  if (s.includes("quotation"))
    return { label: "Quotation", textClass: "text-indigo-700", bgClass: "bg-indigo-100" };
  return { label: stage.length > 18 ? stage.slice(0, 17) + "…" : stage, textClass: "text-slate-600", bgClass: "bg-slate-100" };
}

function getSupplierStatusStyle(status?: string): { label: string; textClass: string } {
  const s = (status ?? "").toLowerCase();
  if (s.includes("approved") || s.includes("active"))
    return { label: "Approved", textClass: "text-emerald-600" };
  if (s.includes("review") || s.includes("pending"))
    return { label: "Under Review", textClass: "text-amber-500" };
  if (s.includes("sampling"))
    return { label: "Sampling", textClass: "text-blue-500" };
  if (s.includes("inactive") || s.includes("rejected"))
    return { label: "Inactive", textClass: "text-red-500" };
  return { label: status ?? "—", textClass: "text-slate-500" };
}

// ─── Quick Links helpers ─────────────────────────────────────────────
interface QuickLink { id: string; title: string; url: string; }

const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { id: "1", title: "Google Meet", url: "https://meet.google.com/pqs-znoa-jwk?authuser=0" },
  { id: "2", title: "Google Drive", url: "https://drive.google.com/drive/folders/1GfVddDUKMlzeoiQ_vFpuFptukawWnbwW" },
];

function getIconForLink(title: string) {
  const t = title.toLowerCase();
  if (t.includes("meet") || t.includes("zoom") || t.includes("video") || t.includes("teams")) return Video;
  if (t.includes("drive") || t.includes("dropbox") || t.includes("files") || t.includes("storage")) return HardDrive;
  if (t.includes("slack") || t.includes("chat") || t.includes("discord")) return MessageSquare;
  if (t.includes("doc") || t.includes("sheet") || t.includes("notion")) return FileText;
  if (t.includes("calendar")) return Calendar;
  if (t.includes("board") || t.includes("trello") || t.includes("jira") || t.includes("asana")) return Layout;
  return LinkIcon;
}

function getColorForLink(title: string) {
  const t = title.toLowerCase();
  if (t.includes("meet") || t.includes("youtube") || t.includes("video"))
    return { text: "text-red-600", bg: "bg-red-50", hover: "group-hover:bg-red-100", border: "hover:border-red-200" };
  if (t.includes("drive") || t.includes("zoom"))
    return { text: "text-blue-600", bg: "bg-blue-50", hover: "group-hover:bg-blue-100", border: "hover:border-blue-200" };
  if (t.includes("slack") || t.includes("discord") || t.includes("teams"))
    return { text: "text-indigo-600", bg: "bg-indigo-50", hover: "group-hover:bg-indigo-100", border: "hover:border-indigo-200" };
  if (t.includes("board") || t.includes("trello") || t.includes("jira"))
    return { text: "text-emerald-600", bg: "bg-emerald-50", hover: "group-hover:bg-emerald-100", border: "hover:border-emerald-200" };
  if (t.includes("calendar"))
    return { text: "text-amber-600", bg: "bg-amber-50", hover: "group-hover:bg-amber-100", border: "hover:border-amber-200" };
  return { text: "text-slate-600", bg: "bg-slate-100", hover: "group-hover:bg-slate-200", border: "hover:border-slate-300" };
}

// ─── Component ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, hasPermission, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [customStageIds] = useState<string[]>(() => getCustomDealStages());
  const allStages = useMemo(() => [
    ...STAGES,
    ...customStageIds
      .filter((id) => !STAGES.some((s) => s.id === id))
      .map((id) => ({ id, label: id, color: "#94a3b8", bg: "#f8fafc", text: "#475569" })),
  ], [customStageIds]);

  const [searchQuery, setSearchQuery] = useState("");
  const [editLinksOpen, setEditLinksOpen] = useState(false);
  const [editingLinks, setEditingLinks] = useState<QuickLink[]>([]);

  // ── Queries ──────────────────────────────────────────────────────
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats").then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: dueCampaignsRaw } = useQuery<DueCampaign[]>({
    queryKey: ["sourcing-campaigns-due"],
    queryFn: () => api.get("/sourcing-campaigns/due").then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: dealsRaw } = useQuery<Deal[]>({
    queryKey: ["deals-dashboard"],
    queryFn: () => api.get("/deals").then((r) => r.data),
    enabled: hasPermission("deals"),
    refetchInterval: 120_000,
  });

  const { data: suppliersRaw } = useQuery<Supplier[]>({
    queryKey: ["suppliers-dashboard"],
    queryFn: () =>
      api.get("/suppliers").then((r) =>
        Array.isArray(r.data) ? r.data : (r.data?.data ?? [])
      ),
    enabled: hasPermission("signed_suppliers") || hasPermission("suppliers"),
    refetchInterval: 120_000,
  });

  const { data: quickLinks } = useQuery<QuickLink[]>({
    queryKey: ["custom-quick-links"],
    queryFn: async () => {
      try {
        const res = await api.get("/settings/custom_quick_links");
        if (res.data?.value) {
          const parsed = JSON.parse(res.data.value);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed as QuickLink[];
        }
      } catch { /* ignore */ }
      return DEFAULT_QUICK_LINKS;
    },
  });

  const updateLinksMutation = useMutation({
    mutationFn: async (links: QuickLink[]) => {
      await api.put("/settings/custom_quick_links", { value: JSON.stringify(links) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-quick-links"] });
      setEditLinksOpen(false);
      toast.success("Quick links updated");
    },
    onError: () => toast.error("Failed to update links"),
  });

  useEffect(() => {
    if (editLinksOpen && quickLinks) setEditingLinks([...quickLinks]);
  }, [editLinksOpen, quickLinks]);

  // ── All useMemo hooks must live ABOVE any conditional return ────────
  const deals = Array.isArray(dealsRaw) ? dealsRaw : [];
  const suppliers = Array.isArray(suppliersRaw) ? suppliersRaw : [];

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const src = deals.length > 0 ? deals : (stats?.recentDeals ?? []);
    for (const deal of src) {
      counts[deal.stage] = (counts[deal.stage] ?? 0) + 1;
    }
    return counts;
  }, [deals, stats?.recentDeals]);

  const supplierHealth = useMemo(() => {
    const active = suppliers.filter((sup) => {
      const st = (sup.currentStatus ?? "").toLowerCase();
      return st.includes("approv") || st.includes("active") || st === "";
    }).length;
    const underReview = suppliers.filter((sup) => {
      const st = (sup.currentStatus ?? "").toLowerCase();
      return st.includes("review") || st.includes("pending");
    }).length;
    const sampling = suppliers.filter((sup) => {
      const st = (sup.currentStatus ?? "").toLowerCase();
      return st.includes("sampling");
    }).length;
    return { active, underReview, sampling, total: suppliers.length };
  }, [suppliers]);

  // ── Loading ──────────────────────────────────────────────────────
  if (isLoading || !stats) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    );
  }

  // ── Derived data (non-hook) ──────────────────────────────────────
  const s: DashboardStats = {
    totalBuyers: stats.totalBuyers ?? 0,
    totalSuppliers: stats.totalSuppliers ?? 0,
    activeUsers: stats.activeUsers ?? 0,
    totalReports: stats.totalReports ?? 0,
    totalDeals: stats.totalDeals ?? 0,
    totalVaultDocs: stats.totalVaultDocs ?? 0,
    pendingTasks: stats.pendingTasks ?? 0,
    taskAnalytics: stats.taskAnalytics ?? [],
    recentDeals: stats.recentDeals ?? [],
    invalidSourcingEmails: stats.invalidSourcingEmails ?? 0,
  };

  const dueCampaigns = dueCampaignsRaw?.slice(0, 5) ?? [];

  // Stale deals (not updated in 21+ days)
  const staleDeals = deals.filter((d) => isStale(d.updatedAt, 21));

  // Pipeline value
  const pipelineValue = deals.reduce((sum, d) => sum + (d.expectedRevenue ?? 0), 0);

  const maxStageCount = Math.max(...Object.values(stageCounts), 1);

  // Top 5 stages by count
  const topStages = allStages
    .filter((st) => (stageCounts[st.id] ?? 0) > 0)
    .sort((a, b) => (stageCounts[b.id] ?? 0) - (stageCounts[a.id] ?? 0))
    .slice(0, 5);

  // Live buyer requirements: most recent deals
  const liveRequirements = deals.length > 0
    ? [...deals].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()).slice(0, 5)
    : s.recentDeals.slice(0, 5);

  // Preview suppliers
  const supplierPreview = suppliers.slice(0, 3);

  // Task max
  const maxTaskCount = Math.max(...(s.taskAnalytics?.map((t) => t.total) ?? [1]), 1);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/buyers?search=${encodeURIComponent(searchQuery)}`);
  };

  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-slate-50">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="bg-brand-600 px-6 py-5">
        <div className="flex items-center gap-4 max-w-400 mx-auto">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-white leading-tight tracking-tight">
              Executive Dashboard
            </h1>
            <p className="text-sm text-blue-200/80 mt-0.5 font-medium">
              Centralised view of sourcing operations and deal flow.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-200/60 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search buyers, suppliers, RFQs..."
                className="w-full h-9 pl-9 pr-4 text-sm rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-blue-200/60 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-colors"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 shrink-0">
            {hasPermission("quotations") && (
              <Link
                to="/quotations"
                className="inline-flex items-center gap-1.5 h-8 px-4 text-xs font-bold text-brand-700 bg-white rounded-lg hover:bg-blue-50 transition-colors shadow-sm mr-2"
              >
                <Plus className="h-3.5 w-3.5" /> New RFQ
              </Link>
            )}
            <a
              href="/settings/gmail"
              className="flex items-center justify-center h-9 w-9 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </a>
            <NotificationBell triggerClassName="relative h-9 w-9 text-white/70 hover:text-white hover:bg-white/15 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="px-6 py-5 max-w-400 mx-auto space-y-5">
        {/* ── Quick Links ──────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-slate-100 p-1.5">
                <Zap className="h-4 w-4 text-slate-500" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Quick Links</span>
            </div>
            {(quickLinks ?? DEFAULT_QUICK_LINKS).map((link) => {
              const Icon = getIconForLink(link.title);
              const colors = getColorForLink(link.title);
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 ${colors.border}`}
                >
                  <div className={`rounded-md ${colors.bg} p-1 ${colors.hover} transition-colors`}>
                    <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                  </div>
                  <span className="text-slate-700">{link.title}</span>
                  <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </a>
              );
            })}
          </div>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditLinksOpen(true)}
              className="h-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 shrink-0"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Links
            </Button>
          )}
        </div>

        {/* ── Greeting ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {getGreeting()}, {firstName} 👋
            </h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              {formatDateLong(new Date())} — here's your trade intelligence for today
            </p>
          </div>
        </div>

        {/* ── Stale deals alert ────────────────────────────────── */}
        {staleDeals.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800 flex-1 min-w-0">
              <span className="font-semibold">{staleDeals.length} deal{staleDeals.length > 1 ? "s" : ""}</span>
              {" "}have had no activity in 21+ days —{" "}
              {staleDeals
                .slice(0, 3)
                .map((d) => d.buyer || d.title)
                .join(", ")}
              {staleDeals.length > 3 ? ` +${staleDeals.length - 3} more` : ""}.
            </p>
            <Link
              to="/deals"
              className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1"
            >
              Review now <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* ── Quick action cards ───────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "View All Buyers", sub: "Active buyer accounts", to: "/buyers", icon: Users, color: "text-blue-600", bg: "bg-blue-100", border: "hover:border-blue-300", accent: "group-hover:bg-blue-600" },
            { label: "Supplier Database", sub: "Signed & sourcing suppliers", to: "/suppliers/signed-contract", icon: Building2, color: "text-violet-600", bg: "bg-violet-100", border: "hover:border-violet-300", accent: "group-hover:bg-violet-600" },
            { label: "Open RFQs", sub: "Quotation requests", to: "/quotations", icon: ClipboardListIcon, color: "text-emerald-600", bg: "bg-emerald-100", border: "hover:border-emerald-300", accent: "group-hover:bg-emerald-600" },
          ].map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className={`group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 hover:shadow-md transition-all ${card.border}`}
            >
              <div className={`rounded-lg p-2.5 ${card.bg} shrink-0 transition-colors ${card.accent}`}>
                <card.icon className={`h-5 w-5 ${card.color} group-hover:text-white transition-colors`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{card.label}</p>
                <p className="text-xs text-slate-500 truncate font-medium">{card.sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 ml-auto shrink-0 transition-colors" />
            </Link>
          ))}
        </div>

        {/* ── Big stats row ────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Active Buyers",
              value: s.totalBuyers.toLocaleString(),
              sub: `${s.activeUsers} active users`,
              icon: Users,
              iconBg: "bg-blue-100",
              iconColor: "text-blue-600",
              accent: "border-t-4 border-t-blue-500",
              trend: null,
            },
            {
              label: "Suppliers Onboarded",
              value: s.totalSuppliers.toLocaleString(),
              sub: `${supplierHealth.underReview} under review`,
              icon: Building2,
              iconBg: "bg-violet-100",
              iconColor: "text-violet-600",
              accent: "border-t-4 border-t-violet-500",
              trend: null,
            },
            {
              label: "Open Deals",
              value: s.totalDeals.toLocaleString(),
              sub: `${topStages.length} active stages`,
              icon: TrendingUp,
              iconBg: "bg-emerald-100",
              iconColor: "text-emerald-600",
              accent: "border-t-4 border-t-emerald-500",
              trend: null,
            },
            {
              label: "Pipeline Value",
              value: fmtMoney(pipelineValue) === "—" ? (s.totalDeals > 0 ? "Fill values" : "—") : fmtMoney(pipelineValue),
              sub: pipelineValue === 0 && s.totalDeals > 0 ? "Add revenue to deals" : `Across ${s.totalDeals} deals`,
              icon: DollarSign,
              iconBg: "bg-amber-100",
              iconColor: "text-amber-600",
              accent: "border-t-4 border-t-amber-500",
              trend: pipelineValue === 0 && s.totalDeals > 0 ? "warning" : null,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow ${stat.accent}`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{stat.label}</p>
                <div className={`rounded-lg p-2 ${stat.iconBg} shrink-0`}>
                  <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
              </div>
              <p className={`text-3xl font-extrabold leading-tight ${stat.trend === "warning" ? "text-amber-500 text-lg" : "text-slate-900"}`}>
                {stat.value}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-medium">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Secondary stats row ──────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { label: "Vault Docs", value: s.totalVaultDocs.toString(), sub: "Documents stored", alert: false },
            { label: "Reports", value: s.totalReports.toString(), sub: "Report records", alert: false },
            { label: "Pending Tasks", value: s.pendingTasks.toString(), sub: "Awaiting action", alert: s.pendingTasks > 0 },
            { label: "Follow-ups Due", value: (dueCampaignsRaw?.length ?? 0).toString(), sub: "Email campaigns", alert: (dueCampaignsRaw?.length ?? 0) > 0 },
            { label: "Active Suppliers", value: supplierHealth.active.toString(), sub: "Supplier health", alert: false },
            { label: "Team Members", value: s.activeUsers.toString(), sub: "Active users", alert: false },
            { label: "Invalid Emails", value: (s.invalidSourcingEmails ?? 0).toString(), sub: "Bounced / undelivered", alert: (s.invalidSourcingEmails ?? 0) > 0 },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${stat.alert ? "border-amber-300 bg-amber-50/50" : "border-slate-200"}`}
            >
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate">{stat.label}</p>
              <p className={`text-2xl font-extrabold mt-1 ${stat.alert ? "text-amber-600" : "text-slate-800"}`}>
                {stat.value}
              </p>
              <p className="text-[11px] text-slate-400 truncate font-medium">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Main 2-column section ────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* Left col (3/5) */}
          <div className="xl:col-span-3 space-y-5">
            {/* Live Buyer Requirements */}
            {hasPermission("deals") && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight">Live Buyer Requirements</h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">Active sourcing and negotiation activities.</p>
                  </div>
                  <Link
                    to="/deals"
                    className="text-xs font-semibold text-brand-600 border border-brand-200 rounded-lg px-3 py-1.5 hover:bg-brand-50 transition-colors"
                  >
                    Export Report
                  </Link>
                </div>
                {liveRequirements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <TrendingUp className="h-7 w-7 text-slate-200 mb-2" />
                    <p className="text-sm text-slate-400">No active deals</p>
                    <Link to="/deals" className="mt-1.5 text-xs text-blue-600 hover:underline">
                      Create your first deal →
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Buyer</th>
                          <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500">Category</th>
                          <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500">Requirement</th>
                          <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500">Status</th>
                          <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500">Assignee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {liveRequirements.map((deal) => {
                          const badge = getStageBadge(deal.stage);
                          return (
                            <tr key={deal.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3">
                                <p className="font-semibold text-slate-800 text-sm truncate max-w-35">
                                  {deal.buyer || "—"}
                                </p>
                              </td>
                              <td className="px-3 py-3">
                                <span className="text-slate-500 text-sm truncate max-w-25 block">
                                  {deal.category || "—"}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className="text-slate-600 text-sm truncate max-w-30 block">
                                  {deal.product || deal.title || "—"}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bgClass} ${badge.textClass}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className="text-slate-500 text-sm">
                                  {deal.creatorName?.split(" ")[0] || "—"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Deal pipeline by stage */}
            {hasPermission("deals") && Object.keys(stageCounts).length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">Deal Pipeline by Stage</h3>
                  <Link to="/deals" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="px-5 py-4 space-y-2">
                  {/* Stacked bar */}
                  <div className="flex h-3 rounded-full overflow-hidden gap-px bg-slate-100 mb-4">
                    {allStages
                      .filter((st) => (stageCounts[st.id] ?? 0) > 0)
                      .map((st) => {
                        const pct = ((stageCounts[st.id] ?? 0) / s.totalDeals) * 100;
                        return (
                          <div
                            key={st.id}
                            style={{ width: `${pct}%`, backgroundColor: st.color }}
                            title={`${st.label}: ${stageCounts[st.id]}`}
                            className="transition-all"
                          />
                        );
                      })}
                  </div>
                  {/* Legend grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                    {allStages
                      .filter((st) => (stageCounts[st.id] ?? 0) > 0)
                      .sort((a, b) => (stageCounts[b.id] ?? 0) - (stageCounts[a.id] ?? 0))
                      .map((st) => (
                        <div key={st.id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: st.color }} />
                            <span className="text-xs text-slate-600 truncate">{st.label}</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-800 shrink-0">
                            {stageCounts[st.id]}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Email Follow-ups */}
            {hasPermission("analytics") && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight">Email Follow-ups Due</h3>
                    {dueCampaignsRaw && dueCampaignsRaw.length > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold h-4.5 min-w-4.5 px-1">
                        {dueCampaignsRaw.length}
                      </span>
                    )}
                  </div>
                  <Link to="/suppliers/sourcing" className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1">
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {dueCampaigns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="h-7 w-7 text-emerald-300 mb-2" />
                    <p className="text-sm font-medium text-slate-600">No follow-ups due today</p>
                    <p className="text-xs text-slate-400 mt-0.5">All sourcing campaigns are on track</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {dueCampaigns.map((c) => {
                      const overdue = new Date(c.nextFollowupDue) < new Date(new Date().setHours(0, 0, 0, 0));
                      return (
                        <div key={c.sourcingId} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`rounded-full p-1.5 shrink-0 ${overdue ? "bg-red-100" : "bg-amber-100"}`}>
                              <Mail className={`h-3.5 w-3.5 ${overdue ? "text-red-500" : "text-amber-600"}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{c.sourcingSupplier.company}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {c.sourcingSupplier.contactPerson ?? c.sourcingSupplier.email ?? "—"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4 shrink-0">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${overdue ? "text-red-700 bg-red-50 border border-red-200" : "text-amber-700 bg-amber-50 border border-amber-200"}`}>
                              {overdue ? "Overdue · " : ""}FU {c.currentStep}
                            </span>
                            <Link to={`/suppliers/sourcing/${c.sourcingSupplier.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                              Open →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                    {dueCampaignsRaw && dueCampaignsRaw.length > 5 && (
                      <div className="px-5 py-2.5 text-center">
                        <Link to="/suppliers/sourcing" className="text-xs text-blue-600 hover:underline font-medium">
                          +{dueCampaignsRaw.length - 5} more — view all →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right col (2/5) */}
          <div className="xl:col-span-2 space-y-5">
            {/* Pipeline stages */}
            {hasPermission("deals") && topStages.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">Pipeline Stages</h3>
                </div>
                <div className="px-5 py-4 space-y-3">
                  {topStages.map((st) => {
                    const count = stageCounts[st.id] ?? 0;
                    const pct = (count / maxStageCount) * 100;
                    return (
                      <div key={st.id} className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 w-28 shrink-0 truncate" title={st.label}>
                          {st.label.length > 16 ? st.label.slice(0, 15) + "…" : st.label}
                        </span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: st.color }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700 w-5 text-right shrink-0">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mx-5 mb-4 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-800 leading-snug">
                    Supplier commissions are the primary revenue stream.
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1 leading-snug">
                    CRM tracks commissions by successful buyer introductions and confirmed orders.
                  </p>
                </div>
              </div>
            )}

            {/* Supplier Database */}
            {(hasPermission("signed_suppliers") || hasPermission("suppliers")) && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight">Supplier Database</h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">Compliance and sourcing overview.</p>
                  </div>
                  <Link
                    to="/suppliers/signed-contract"
                    className="text-xs font-semibold text-brand-600 border border-brand-200 rounded-lg px-3 py-1.5 hover:bg-brand-50 transition-colors"
                  >
                    Add Supplier
                  </Link>
                </div>
                {supplierPreview.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Building2 className="h-7 w-7 text-slate-200 mb-2" />
                    <p className="text-sm text-slate-400">No suppliers yet</p>
                    <Link to="/suppliers/signed-contract" className="mt-1.5 text-xs text-blue-600 hover:underline">
                      Add your first supplier →
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {supplierPreview.map((sup) => {
                      const statusStyle = getSupplierStatusStyle(sup.currentStatus);
                      const certs = sup.certifications
                        ? sup.certifications.split(/[,;]/).map((c) => c.trim()).filter(Boolean).slice(0, 2)
                        : [];
                      return (
                        <Link
                          key={sup.id}
                          to={`/suppliers/signed-contract/${sup.id}`}
                          className="flex items-start justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors truncate">
                              {sup.company}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {[sup.country, sup.products].filter(Boolean).join(" · ") || "—"}
                            </p>
                            {certs.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {certs.map((cert) => (
                                  <span key={cert} className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 rounded px-1.5 py-0.5">
                                    <ShieldCheck className="h-2.5 w-2.5 text-slate-400" />
                                    {cert}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className={`text-xs font-semibold shrink-0 mt-0.5 ${statusStyle.textClass}`}>
                            {statusStyle.label}
                          </span>
                        </Link>
                      );
                    })}
                    {suppliers.length > 3 && (
                      <div className="px-5 py-3">
                        <Link to="/suppliers/signed-contract" className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1">
                          View all {suppliers.length} suppliers <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Supplier health */}
            {suppliers.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">Supplier Health</h3>
                  <Link to="/suppliers/signed-contract" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                    Full report <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="px-5 py-4 space-y-3">
                  {[
                    { label: "Active", count: supplierHealth.active, color: "bg-emerald-500" },
                    { label: "Under review", count: supplierHealth.underReview, color: "bg-amber-400" },
                    { label: "Sampling", count: supplierHealth.sampling, color: "bg-blue-400" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-24 shrink-0">{row.label}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${row.color}`}
                          style={{ width: `${Math.min((row.count / (supplierHealth.total || 1)) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 w-5 text-right shrink-0">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending follow-ups card */}
            {(dueCampaignsRaw?.length ?? 0) > 0 && (
              <div className="rounded-xl bg-brand-600 px-5 py-5 text-white shadow-md">
                <p className="text-xs text-blue-200/70 font-bold uppercase tracking-widest">TODAY</p>
                <p className="text-2xl font-extrabold mt-1 tracking-tight">
                  {dueCampaignsRaw!.length} Follow Up{dueCampaignsRaw!.length > 1 ? "s" : ""} Pending
                </p>
                <p className="text-blue-100/80 text-sm mt-1.5 font-medium">
                  Buyers waiting for quotations and supplier confirmations.
                </p>
                <Link
                  to="/suppliers/sourcing"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
                >
                  View sourcing <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Task Analytics ──────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">Task Analytics</h3>
            </div>
            <Link to="/daily-tasks" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="p-5">
            {s.taskAnalytics && s.taskAnalytics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {s.taskAnalytics.map((ta) => {
                  const total = ta.total || 1;
                  const completedPct = Math.round((ta.completed / total) * 100);
                  const inProgressPct = Math.round((ta.inProgress / total) * 100);
                  const closedPct = Math.round((ta.closed / total) * 100);
                  const pendingPct = Math.round((ta.pending / total) * 100);
                  const totalPct = Math.round((ta.total / maxTaskCount) * 100);

                  return (
                    <div key={ta.owner} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800 capitalize">{ta.owner}</span>
                        <span className="text-xs text-slate-500 font-medium">{ta.total} task{ta.total !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div className="flex h-full rounded-full overflow-hidden" style={{ width: `${totalPct || 1}%` }}>
                          <div style={{ width: `${completedPct}%` }} className="bg-blue-500" title={`Completed: ${ta.completed}`} />
                          <div style={{ width: `${inProgressPct}%` }} className="bg-amber-400" title={`In Progress: ${ta.inProgress}`} />
                          <div style={{ width: `${closedPct}%` }} className="bg-slate-400" title={`Closed: ${ta.closed}`} />
                          <div style={{ width: `${pendingPct}%` }} className="bg-red-400" title={`Pending: ${ta.pending}`} />
                        </div>
                      </div>
                      <div className="space-y-1.5 text-[11px] font-semibold">
                        {ta.completed > 0 && (
                          <div className="flex items-center justify-between text-blue-700">
                            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Completed</span>
                            <span>{ta.completed}</span>
                          </div>
                        )}
                        {ta.inProgress > 0 && (
                          <div className="flex items-center justify-between text-amber-600">
                            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />In Progress</span>
                            <span>{ta.inProgress}</span>
                          </div>
                        )}
                        {ta.pending > 0 && (
                          <div className="flex items-center justify-between text-red-600">
                            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />Pending</span>
                            <span>{ta.pending}</span>
                          </div>
                        )}
                        {ta.closed > 0 && (
                          <div className="flex items-center justify-between text-slate-500">
                            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Closed</span>
                            <span>{ta.closed}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckSquare className="h-7 w-7 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">No active tasks</p>
                <Link to="/daily-tasks" className="mt-1.5 text-xs text-blue-600 hover:underline">
                  Add tasks to track →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Quick Links Modal ──────────────────────────────── */}
      {editLinksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Edit Quick Links</h2>
            <form
              onSubmit={(e) => { e.preventDefault(); updateLinksMutation.mutate(editingLinks); }}
              className="space-y-4 max-h-[70vh] flex flex-col"
            >
              <div className="space-y-3 overflow-y-auto pr-1">
                {editingLinks.map((link, idx) => (
                  <div key={link.id} className="flex items-start gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text" required value={link.title}
                        onChange={(e) => { const nl = [...editingLinks]; nl[idx].title = e.target.value; setEditingLinks(nl); }}
                        className="w-full h-8 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:border-slate-400"
                        placeholder="Link title (e.g. Google Meet)"
                      />
                      <input
                        type="url" required value={link.url}
                        onChange={(e) => { const nl = [...editingLinks]; nl[idx].url = e.target.value; setEditingLinks(nl); }}
                        className="w-full h-8 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:border-slate-400"
                        placeholder="URL (e.g. https://...)"
                      />
                    </div>
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => setEditingLinks(editingLinks.filter((l) => l.id !== link.id))}
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {editingLinks.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No quick links configured.</p>
                )}
              </div>
              <Button
                type="button" variant="outline" size="sm"
                className="w-full gap-2 border-dashed border-2 py-5 text-slate-600 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50"
                onClick={() => setEditingLinks([...editingLinks, { id: Date.now().toString(), title: "", url: "" }])}
              >
                <Plus className="h-4 w-4" /> Add Link
              </Button>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
                <button type="button" onClick={() => setEditLinksOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={updateLinksMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                  {updateLinksMutation.isPending ? "Saving…" : "Save Links"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline icon alias to avoid import issues
function ClipboardListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}
