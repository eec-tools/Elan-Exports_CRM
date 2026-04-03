import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Video,
  HardDrive,
  ExternalLink,
  TrendingUp,
  Zap,
  CheckCircle2,
  CheckSquare,
  Pencil,
  Plus,
  Trash2,
  Link as LinkIcon,
  MessageSquare,
  Calendar,
  Layout,
  Bell,
  Mail,
} from "lucide-react";

// ─── Types & Configuration ──────────────────────────────────────────
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

interface TaskAnalyticsOwner {
  owner: string;
  pending: number;
  inProgress: number;
  completed: number;
  closed: number;
  total: number;
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
}



interface QuickLink {
  id: string;
  title: string;
  url: string;
}

interface DueCampaign {
  supplierId: string;
  currentStep: number;
  nextFollowupDue: string;
  supplier: {
    id: string;
    company: string;
    email: string | null;
    contactPerson: string | null;
  };
}

const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { id: "1", title: "Google Meet", url: "https://meet.google.com/pqs-znoa-jwk?authuser=0" },
  { id: "2", title: "Google Drive", url: "https://drive.google.com/drive/folders/1GfVddDUKMlzeoiQ_vFpuFptukawWnbwW" },
];

const getIconForLink = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes("meet") || t.includes("zoom") || t.includes("video") || t.includes("teams")) return Video;
  if (t.includes("drive") || t.includes("dropbox") || t.includes("files") || t.includes("storage")) return HardDrive;
  if (t.includes("slack") || t.includes("chat") || t.includes("messages") || t.includes("discord")) return MessageSquare;
  if (t.includes("doc") || t.includes("sheet") || t.includes("notion")) return FileText;
  if (t.includes("calendar")) return Calendar;
  if (t.includes("board") || t.includes("trello") || t.includes("jira") || t.includes("asana")) return Layout;
  return LinkIcon;
};

const getColorForLink = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes("meet") || t.includes("youtube") || t.includes("video")) return { text: "text-red-600", bg: "bg-red-50", hover: "group-hover:bg-red-100", borderHover: "hover:border-red-200" };
  if (t.includes("drive") || t.includes("zoom") || t.includes("blue")) return { text: "text-blue-600", bg: "bg-blue-50", hover: "group-hover:bg-blue-100", borderHover: "hover:border-blue-200" };
  if (t.includes("slack") || t.includes("discord") || t.includes("teams")) return { text: "text-indigo-600", bg: "bg-indigo-50", hover: "group-hover:bg-indigo-100", borderHover: "hover:border-indigo-200" };
  if (t.includes("board") || t.includes("trello") || t.includes("jira")) return { text: "text-emerald-600", bg: "bg-emerald-50", hover: "group-hover:bg-emerald-100", borderHover: "hover:border-emerald-200" };
  if (t.includes("calendar")) return { text: "text-amber-600", bg: "bg-amber-50", hover: "group-hover:bg-amber-100", borderHover: "hover:border-amber-200" };
  return { text: "text-slate-600", bg: "bg-slate-50", hover: "group-hover:bg-slate-100", borderHover: "hover:border-slate-300" };
};

const STAGES = [
  { id: "Communication", label: "Communication", color: "#64748b", bg: "#f1f5f9", text: "#334155" },
  { id: "Sampling", label: "Sampling", color: "#8b5cf6", bg: "#f5f3ff", text: "#6d28d9" },
  { id: "Quotation", label: "Quotation", color: "#3b82f6", bg: "#eff6ff", text: "#1d4ed8" },
  { id: "Negotiation with EEC", label: "Negotiation with EEC", color: "#f59e0b", bg: "#fffbeb", text: "#b45309" },
  { id: "Price quotation to Buyer after EEC approval", label: "Price quotation to Buyer", color: "#06b6d4", bg: "#ecfeff", text: "#0e7490" },
  { id: "Negotiation with buyer", label: "Negotiation with buyer", color: "#f97316", bg: "#fff7ed", text: "#c2410c" },
  { id: "Price approval by buyer", label: "Price approval by buyer", color: "#10b981", bg: "#ecfdf5", text: "#065f46" },
  { id: "Quotation send to the supplier from buyer end", label: "Quotation to supplier", color: "#14b8a6", bg: "#f0fdfa", text: "#115e59" },
  { id: "Orders confirmed from buyers end", label: "Orders confirmed", color: "#16a34a", bg: "#f0fdf4", text: "#14532d" },
  { id: "Timeline (Product shipping.. etc) should be established from suppliers end", label: "Timeline established", color: "#22c55e", bg: "#f0fdf4", text: "#166534" },
];

// ─── Component ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Quick Links State
  const [editLinksOpen, setEditLinksOpen] = useState(false);
  const [editingLinks, setEditingLinks] = useState<QuickLink[]>([]);

  const { data: quickLinks } = useQuery({
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

  useEffect(() => {
    if (editLinksOpen && quickLinks) {
      setEditingLinks([...quickLinks]);
    }
  }, [editLinksOpen, quickLinks]);

  const updateLinksMutation = useMutation({
    mutationFn: async (links: QuickLink[]) => {
      await api.put("/settings/custom_quick_links", { value: JSON.stringify(links) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-quick-links"] });
      setEditLinksOpen(false);
      toast.success("Quick links updated successfully");
    },
    onError: () => toast.error("Failed to update links"),
  });

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats").then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: dueCampaigns } = useQuery<DueCampaign[]>({
    queryKey: ["intro-campaigns-due"],
    queryFn: () => api.get("/intro-campaigns/due").then((r) => r.data),
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
    taskAnalytics: stats.taskAnalytics ?? [],
    recentDeals: stats.recentDeals ?? [],
  };
  const maxTaskCount = Math.max(...(s.taskAnalytics?.map((t) => t.total) ?? [1]), 1);



  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Quick Links ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-slate-100 p-1.5">
              <Zap className="h-4 w-4 text-slate-500" />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Quick Links</h2>
          </div>
          {user?.roles?.includes("admin") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditLinksOpen(true)}
              className="h-8 text-slate-500 hover:text-brand-600 hover:bg-brand-50"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit Links
            </Button>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          {(quickLinks || []).map((link) => {
            const Icon = getIconForLink(link.title);
            const colors = getColorForLink(link.title);
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 ${colors.borderHover}`}
              >
                <div className={`rounded-lg ${colors.bg} p-1.5 ${colors.hover} transition-colors`}>
                  <Icon className={`h-4 w-4 ${colors.text}`} />
                </div>
                <span className="text-slate-700">{link.title}</span>
                <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </a>
            );
          })}
        </div>
      </div>
      {/* ── Email Follow-ups Due Today ───────────────────────────── */}
      <div className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-amber-100 px-5 py-4 bg-amber-50">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-amber-100 p-1.5">
              <Bell className="h-4 w-4 text-amber-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-800">Email Follow-ups Due Today</h2>
            {dueCampaigns && dueCampaigns.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold h-5 min-w-[20px] px-1.5">
                {dueCampaigns.length}
              </span>
            )}
          </div>
          <Link to="/suppliers/signed-contract" className="text-xs text-brand-600 hover:underline font-medium">
            View all suppliers →
          </Link>
        </div>
        {!dueCampaigns || dueCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-300 mb-2" />
            <p className="text-sm font-medium text-slate-600">No follow-ups due today</p>
            <p className="text-xs text-slate-400 mt-0.5">All email campaigns are on track</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dueCampaigns.map((c) => (
              <div key={c.supplierId} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-full bg-amber-100 p-1.5 shrink-0">
                    <Mail className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.supplier.company}</p>
                    <p className="text-xs text-slate-500 truncate">{c.supplier.contactPerson ?? c.supplier.email ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                    Follow-up {c.currentStep}
                  </span>
                  <Link
                    to={`/suppliers/signed-contract/${c.supplier.id}`}
                    className="text-xs text-brand-600 hover:underline font-medium"
                  >
                    Open →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Latest Deals ──────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-emerald-50 p-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-800">Latest Deals</h2>
          </div>
          <Link to="/deals" className="text-xs text-brand-600 hover:underline font-medium">
            View all
          </Link>
        </div>

        <div className="p-5 overflow-x-auto">
          {s.recentDeals && s.recentDeals.length > 0 ? (
            <div className="flex gap-4 min-w-max pb-2">
              {(() => {
                const deals = s.recentDeals.slice(0, 3);
                const activeStageIds = new Set(deals.map(d => d.stage));
                const activeStages = STAGES.filter(stage => activeStageIds.has(stage.id));

                return activeStages.map(stage => {
                  const stageDeals = deals.filter(d => d.stage === stage.id);
                  return (
                    <div key={stage.id} className="w-64 flex flex-col rounded-xl border border-slate-200 bg-slate-50 flex-shrink-0">
                      <div
                        className="flex items-center justify-between px-3 py-2.5 rounded-t-xl"
                        style={{ borderTop: `3px solid ${stage.color}`, background: stage.bg }}
                      >
                        <span className="text-xs font-bold uppercase tracking-wider truncate mr-2" style={{ color: stage.text }} title={stage.label}>
                          {stage.label}
                        </span>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: stage.color + "22", color: stage.color }}
                        >
                          {stageDeals.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 p-2 min-h-[100px]">
                        {stageDeals.map(deal => (
                          <div key={deal.id} className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm transition-all group">
                            <p className="text-sm font-semibold text-slate-800 leading-tight mb-1">{deal.title}</p>
                            {deal.buyer && <p className="text-xs text-slate-500 mb-2 truncate">{deal.buyer}</p>}
                            <div className="flex items-center justify-between mt-2">
                              {deal.expectedRevenue ? (
                                <span className="text-sm font-bold" style={{ color: stage.color }}>${deal.expectedRevenue >= 1_000_000 ? (deal.expectedRevenue / 1_000_000).toFixed(1) + 'M' : deal.expectedRevenue >= 1_000 ? (deal.expectedRevenue / 1_000).toFixed(0) + 'K' : deal.expectedRevenue.toLocaleString()}</span>
                              ) : <span className="text-xs text-slate-400">No revenue</span>}
                              {deal.probability !== undefined && (
                                <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{deal.probability}%</span>
                              )}
                            </div>
                            {deal.riskScore && (
                              <div className="flex items-center gap-1 mt-1.5">
                                <span className="text-[10px] uppercase font-bold text-slate-400" style={{ color: deal.riskScore === 'Low' ? '#10b981' : deal.riskScore === 'High' ? '#ef4444' : '#f59e0b' }}>{deal.riskScore} RISK</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center h-full">
              <TrendingUp className="h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No deals yet</p>
              <Link to="/deals" className="mt-2 text-xs text-brand-600 hover:underline">
                Add your first deal →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Task Analytics ──────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-amber-50 p-1.5">
              <CheckSquare className="h-4 w-4 text-amber-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-800">Task Analytics</h2>
          </div>
          <Link to="/daily-tasks" className="text-xs text-brand-600 hover:underline font-medium">
            View all
          </Link>
        </div>

        <div className="p-5">
          {s.taskAnalytics && s.taskAnalytics.filter(ta => ta.owner.toLowerCase() !== 'fahad').length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {s.taskAnalytics.filter(ta => ta.owner.toLowerCase() !== 'fahad').map((ta) => {
                const totalPct = Math.round((ta.total / maxTaskCount) * 100);
                const completedPct = ta.total > 0 ? Math.round((ta.completed / ta.total) * 100) : 0;
                const inProgressPct = ta.total > 0 ? Math.round((ta.inProgress / ta.total) * 100) : 0;
                const closedPct = ta.total > 0 ? Math.round((ta.closed / ta.total) * 100) : 0;
                const pendingPct = ta.total > 0 ? Math.round((ta.pending / ta.total) * 100) : 0;

                return (
                  <div key={ta.owner} className="space-y-1.5 p-4 rounded-lg border border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="font-bold text-slate-800 capitalize text-sm">{ta.owner}</span>
                      <span className="text-slate-500 font-medium">
                        {ta.total} task{ta.total !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {/* The outer bar takes up proportionate width to the max owner tasks */}
                    <div className="h-2 w-full rounded-full bg-slate-100 border border-slate-200">
                      <div className="flex h-full rounded-full overflow-hidden" style={{ width: `${totalPct === 0 ? 1 : totalPct}%` }}>
                        <div style={{ width: `${completedPct}%` }} className="bg-brand-500" title={`Completed: ${ta.completed}`} />
                        <div style={{ width: `${inProgressPct}%` }} className="bg-amber-400" title={`In Progress: ${ta.inProgress}`} />
                        <div style={{ width: `${closedPct}%` }} className="bg-slate-500" title={`Closed: ${ta.closed}`} />
                        <div style={{ width: `${pendingPct}%` }} className="bg-red-500" title={`Pending: ${ta.pending}`} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 text-[11px] font-semibold mt-3">
                      {ta.completed > 0 && <span className="text-brand-700 flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>Completed</span> <span>{ta.completed}</span></span>}
                      {ta.inProgress > 0 && <span className="text-amber-600 flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>In Progress</span> <span>{ta.inProgress}</span></span>}
                      {ta.pending > 0 && <span className="text-red-600 flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>Pending</span> <span>{ta.pending}</span></span>}
                      {ta.closed > 0 && <span className="text-slate-600 flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>Closed</span> <span>{ta.closed}</span></span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CheckSquare className="h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No active tasks</p>
              <Link to="/daily-tasks" className="mt-2 text-xs text-brand-600 hover:underline">
                Add tasks to track →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Quick Links Modal ── */}
      {editLinksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Edit Quick Links</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateLinksMutation.mutate(editingLinks);
              }}
              className="space-y-4 max-h-[70vh] flex flex-col"
            >
              <div className="space-y-3 overflow-y-auto pr-1">
                {editingLinks.map((link, idx) => (
                  <div key={link.id} className="flex items-start gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 relative group">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        required
                        value={link.title}
                        onChange={(e) => {
                          const newLinks = [...editingLinks];
                          newLinks[idx].title = e.target.value;
                          setEditingLinks(newLinks);
                        }}
                        className="w-full h-8 rounded-md border border-slate-200 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                        placeholder="Link Title (e.g. Google Meet)"
                      />
                      <input
                        type="url"
                        required
                        value={link.url}
                        onChange={(e) => {
                          const newLinks = [...editingLinks];
                          newLinks[idx].url = e.target.value;
                          setEditingLinks(newLinks);
                        }}
                        className="w-full h-8 rounded-md border border-slate-200 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                        placeholder="URL (e.g. https://...)"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingLinks(editingLinks.filter(l => l.id !== link.id))}
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
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2 border-dashed border-2 py-5 text-slate-600 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50"
                onClick={() => setEditingLinks([...editingLinks, { id: Date.now().toString(), title: "", url: "" }])}
              >
                <Plus className="h-4 w-4" /> Add Link
              </Button>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditLinksOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateLinksMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm disabled:opacity-50"
                >
                  {updateLinksMutation.isPending ? "Saving..." : "Save Links"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
