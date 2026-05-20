import { useState, useEffect, useMemo } from "react";
import { DEAL_STAGE_CONFIG, type StageConfig } from "@/lib/dealStages";
import { getCustomDealStages } from "@/lib/customDealStages";
import {
  Plus, LayoutGrid, List, X, Pencil, Trash2, ChevronRight, TrendingUp,
  BarChart2, AlertTriangle, CheckCircle2, Circle, Save, ChevronDown, ChevronUp,
  Filter, Clock, DollarSign, ArrowUpDown, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

// ─── Types ────────────────────────────────────────────────────
interface Deal {
  id: string;
  title: string;
  buyer?: string;
  supplier?: string;
  product?: string;
  hsCode?: string;
  volume?: string;
  price?: number;
  expectedRevenue?: number;
  margin?: number;
  stage: string;
  probability?: number;
  category?: string;
  riskScore?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  stageEnteredAt?: string;
  creatorName?: string;
}

type SortKey = "value" | "daysInStage" | "lastActivity" | "title";
type SortDir = "asc" | "desc";

// ─── Helpers ──────────────────────────────────────────────────
function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function stageConf(id: string, stages: StageConfig[]) {
  return stages.find((s) => s.id === id) ?? { id, label: id, color: "#94a3b8", bg: "#f8fafc", text: "#475569" };
}

function daysInStage(deal: Deal): number {
  const base = deal.stageEnteredAt ?? deal.updatedAt ?? deal.createdAt;
  return Math.floor((Date.now() - new Date(base).getTime()) / 86_400_000);
}

function agingBadge(days: number) {
  if (days <= 7) return { label: `${days}d`, color: "#10b981", bg: "#dcfce7", title: "Fresh" };
  if (days <= 21) return { label: `${days}d`, color: "#f59e0b", bg: "#fef9c3", title: "Aging" };
  return { label: `${days}d`, color: "#ef4444", bg: "#fee2e2", title: "Stale" };
}

function fmtMoney(v?: number | null) {
  if (!v) return null;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function initials(name?: string | null) {
  if (!name) return "—";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const emptyForm = (): Partial<Deal> => ({
  title: "", buyer: "", supplier: "", product: "", hsCode: "",
  volume: "", expectedRevenue: undefined, stage: "Communication", notes: "",
});

// ─── Main Page ────────────────────────────────────────────────
export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "table">("kanban");

  const [buyerOptions, setBuyerOptions] = useState<string[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<string[]>([]);

  const [showNewDeal, setShowNewDeal] = useState(false);
  const [form, setForm] = useState<Partial<Deal>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Deal>>({});

  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [dragOver, setDragOver] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterBuyer, setFilterBuyer] = useState("");
  const [filterManager, setFilterManager] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [customStageIds] = useState<string[]>(() => getCustomDealStages());

  const allStages = useMemo<StageConfig[]>(() => [
    ...DEAL_STAGE_CONFIG,
    ...customStageIds
      .filter((id) => !DEAL_STAGE_CONFIG.some((s) => s.id === id))
      .map((id) => ({ id, label: id, color: "#94a3b8", bg: "#f8fafc", text: "#475569" })),
  ], [customStageIds]);

  // ─── Fetch ───────────────────────────────────────────────────
  async function fetchDeals() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/deals`, { headers: authHeader() });
      const data = await res.json();
      setDeals(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load deals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDeals();
    fetch(`${API_BASE}/buyers?limit=200`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => {
        const names: string[] = Array.isArray(d.data)
          ? d.data.map((b: any) => b.company).filter(Boolean)
          : [];
        setBuyerOptions([...new Set(names)].sort());
      })
      .catch(() => {});
    fetch(`${API_BASE}/suppliers?limit=200`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => {
        const names: string[] = Array.isArray(d.data)
          ? d.data.map((s: any) => s.company).filter(Boolean)
          : [];
        setSupplierOptions([...new Set(names)].sort());
      })
      .catch(() => {});
  }, []);

  // ─── Derived filter options ──────────────────────────────────
  const managerOptions = useMemo(() => {
    const names = deals.map((d) => d.creatorName).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [deals]);

  const categoryOptions = useMemo(() => {
    const cats = deals.map((d) => d.category).filter(Boolean) as string[];
    return [...new Set(cats)].sort();
  }, [deals]);

  // ─── Stats ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = deals.length;
    const pipeline = deals.reduce((s, d) => s + (d.expectedRevenue ?? 0), 0);
    const weighted = deals.reduce(
      (s, d) => s + (d.expectedRevenue ?? 0) * ((d.probability ?? 20) / 100), 0,
    );
    const daysArr = deals.map((d) => daysInStage(d));
    const avgDays = daysArr.length ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length) : 0;
    const staleCount = daysArr.filter((d) => d >= 22).length;
    return { total, pipeline, weighted, avgDays, staleCount };
  }, [deals]);

  // ─── Filtered + sorted deals ─────────────────────────────────
  const filteredDeals = useMemo(() => {
    let result = [...deals];

    // Search across key fields
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((d) =>
        d.title.toLowerCase().includes(q) ||
        (d.buyer ?? "").toLowerCase().includes(q) ||
        (d.supplier ?? "").toLowerCase().includes(q) ||
        (d.product ?? "").toLowerCase().includes(q)
      );
    }

    if (filterBuyer) result = result.filter((d) => d.buyer === filterBuyer);
    if (filterManager) result = result.filter((d) => d.creatorName === filterManager);
    if (filterStage) result = result.filter((d) => d.stage === filterStage);
    if (filterCategory) result = result.filter((d) => d.category === filterCategory);
    if (filterDateFrom) result = result.filter((d) => new Date(d.createdAt) >= new Date(filterDateFrom));
    if (filterDateTo) result = result.filter((d) => new Date(d.createdAt) <= new Date(filterDateTo));

    result.sort((a, b) => {
      let aVal: number, bVal: number;
      if (sortKey === "value") {
        aVal = a.expectedRevenue ?? 0;
        bVal = b.expectedRevenue ?? 0;
      } else if (sortKey === "daysInStage") {
        aVal = daysInStage(a);
        bVal = daysInStage(b);
      } else if (sortKey === "lastActivity") {
        aVal = new Date(a.updatedAt ?? a.createdAt).getTime();
        bVal = new Date(b.updatedAt ?? b.createdAt).getTime();
      } else {
        return sortDir === "asc"
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [deals, searchQuery, filterBuyer, filterManager, filterStage, filterCategory, filterDateFrom, filterDateTo, sortKey, sortDir]);

  const activeFilterCount = [filterBuyer, filterManager, filterStage, filterCategory, filterDateFrom, filterDateTo].filter(Boolean).length;

  function clearFilters() {
    setFilterBuyer(""); setFilterManager(""); setFilterStage("");
    setFilterCategory(""); setFilterDateFrom(""); setFilterDateTo("");
  }

  // ─── CRUD ─────────────────────────────────────────────────────
  async function handleCreate() {
    if (!form.title?.trim()) { toast.error("Title is required"); return; }
    if (!form.expectedRevenue || form.expectedRevenue <= 0) {
      toast.error("Deal value is required — enter the expected revenue to proceed");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      await fetchDeals();
      setShowNewDeal(false);
      setForm(emptyForm());
      toast.success("Deal created!");
    } catch {
      toast.error("Failed to create deal");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!selectedDeal) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/deals/${selectedDeal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSelectedDeal(updated);
      setEditMode(false);
      toast.success("Deal updated!");
    } catch {
      toast.error("Failed to update deal");
    } finally {
      setSaving(false);
    }
  }

  async function moveStage(dealId: string, newStage: string) {
    try {
      const res = await fetch(`${API_BASE}/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      if (selectedDeal?.id === dealId) setSelectedDeal(updated);
    } catch {
      toast.error("Failed to move deal");
    }
  }

  async function handleDelete(deal: Deal) {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/deals/${deal.id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error();
      setDeals((prev) => prev.filter((d) => d.id !== deal.id));
      setDeleteTarget(null);
      if (selectedDeal?.id === deal.id) setSelectedDeal(null);
      toast.success("Deal deleted");
    } catch {
      toast.error("Failed to delete deal");
    } finally {
      setDeleting(false);
    }
  }

  function openDeal(deal: Deal) {
    setSelectedDeal(deal);
    setEditMode(false);
    setEditForm({ ...deal });
  }

  function handleDragStart(e: React.DragEvent, dealId: string) {
    e.dataTransfer.setData("dealId", dealId);
  }

  function handleDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("dealId");
    if (!dealId) return;
    const deal = deals.find((d) => d.id === dealId);
    if (deal && deal.stage !== stageId) moveStage(dealId, stageId);
    setDragOver(null);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-brand-500" />
            Deals Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track and manage your export deals across all stages
          </p>
        </div>
        <Button
          onClick={() => { setShowNewDeal(true); setForm(emptyForm()); }}
          className="bg-brand-600 hover:bg-brand-700 text-white gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Deal
        </Button>
      </div>

      {/* ── Pipeline Metrics Bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-4">
        <MetricCard
          icon={<DollarSign className="h-4 w-4 text-brand-600" />}
          label="Pipeline Value"
          value={fmtMoney(stats.pipeline) ?? "$0"}
          sub={`${fmtMoney(stats.weighted) ?? "$0"} weighted`}
          bg="bg-brand-50"
        />
        <MetricCard
          icon={<BarChart2 className="h-4 w-4 text-slate-600" />}
          label="Total Deals"
          value={stats.total.toString()}
          sub={`across ${allStages.filter(s => deals.some(d => d.stage === s.id)).length} stages`}
          bg="bg-slate-100"
        />
        <MetricCard
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          label="Avg Days / Stage"
          value={`${stats.avgDays}d`}
          sub="time in current stage"
          bg="bg-amber-50"
        />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
          label="Stale Deals"
          value={stats.staleCount.toString()}
          sub="22+ days without progress"
          bg="bg-red-50"
          valueColor={stats.staleCount > 0 ? "text-red-600" : undefined}
        />
      </div>

      {/* ── Search Bar ── */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search deals by title, buyer, supplier or product…"
          className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 shadow-sm placeholder:text-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── View Toggle + Sort + Filter Controls ── */}
      <div className="flex items-center gap-2 pb-3 flex-wrap">
        <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          <button
            onClick={() => setView("kanban")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${view === "kanban" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <LayoutGrid className="h-4 w-4" /> Kanban
          </button>
          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${view === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <List className="h-4 w-4" /> Table
          </button>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-xs text-slate-400 font-medium">Sort:</span>
          {(["title", "value", "daysInStage", "lastActivity"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => toggleSort(k)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1 ${
                sortKey === k
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-500 border-slate-200 hover:border-brand-300"
              }`}
            >
              {{ title: "Name", value: "Value", daysInStage: "Days", lastActivity: "Activity" }[k]}
              {sortKey === k && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            activeFilterCount > 0 || showFilters
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white text-slate-500 border-slate-200 hover:border-brand-300"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-white text-brand-700 rounded-full px-1.5 py-0 text-[10px] font-bold">{activeFilterCount}</span>
          )}
        </button>
        <span className="text-xs text-slate-400">
          {filteredDeals.length}{deals.length !== filteredDeals.length ? `/${deals.length}` : ""} deal{filteredDeals.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Filter Bar ── */}
      {showFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 flex flex-wrap gap-3 items-end">
          <FilterSelect label="Buyer" value={filterBuyer} onChange={setFilterBuyer} options={buyerOptions} />
          <FilterSelect label="Account Manager" value={filterManager} onChange={setFilterManager} options={managerOptions} />
          <FilterSelect label="Stage" value={filterStage} onChange={setFilterStage}
            options={allStages.map((s) => s.id)} labelMap={Object.fromEntries(allStages.map((s) => [s.id, s.label]))} />
          <FilterSelect label="Product Category" value={filterCategory} onChange={setFilterCategory} options={categoryOptions} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">From</label>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
              className="h-8 px-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">To</label>
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
              className="h-8 px-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 self-end">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      {/* ── Content Area ── */}
      <div className="flex gap-5 flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-8 w-8 rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
          ) : view === "kanban" ? (
            <KanbanBoard
              deals={filteredDeals}
              allDeals={deals}
              stages={allStages}
              onCardClick={openDeal}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragOver={(id) => setDragOver(id)}
              dragOver={dragOver}
            />
          ) : (
            <TableView
              deals={filteredDeals}
              stages={allStages}
              onRowClick={openDeal}
              onDelete={(d) => setDeleteTarget(d)}
              onEdit={(d) => { openDeal(d); setEditMode(true); }}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />
          )}
        </div>

        {selectedDeal && (
          <DetailPanel
            deal={selectedDeal}
            stages={allStages}
            editMode={editMode}
            editForm={editForm}
            setEditForm={setEditForm}
            saving={saving}
            buyerOptions={buyerOptions}
            supplierOptions={supplierOptions}
            onClose={() => { setSelectedDeal(null); setEditMode(false); }}
            onEdit={() => { setEditMode(true); setEditForm({ ...selectedDeal }); }}
            onSave={handleUpdate}
            onDelete={() => setDeleteTarget(selectedDeal)}
            onStageChange={(s) => moveStage(selectedDeal.id, s)}
          />
        )}
      </div>

      {/* ── New Deal Modal ── */}
      {showNewDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-brand-600" /> New Deal
              </h2>
              <button onClick={() => setShowNewDeal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FormField label="Deal Title *" placeholder="e.g. US Organic Lentils Q2"
                    value={form.title ?? ""} onChange={(v) => setForm({ ...form, title: v })} />
                </div>
                <div className="col-span-2">
                  <FormField
                    label="Expected Revenue (USD) *"
                    placeholder="e.g. 25000"
                    type="number"
                    value={form.expectedRevenue?.toString() ?? ""}
                    onChange={(v) => setForm({ ...form, expectedRevenue: parseFloat(v) || undefined })}
                    hint="Required — enter the deal value in USD"
                    highlight
                  />
                </div>
                <SelectField label="Buyer" value={form.buyer ?? ""} onChange={(v) => setForm({ ...form, buyer: v })} options={buyerOptions} />
                <SelectField label="Supplier" value={form.supplier ?? ""} onChange={(v) => setForm({ ...form, supplier: v })} options={supplierOptions} />
                <FormField label="Product" placeholder="e.g. Organic Red Lentils"
                  value={form.product ?? ""} onChange={(v) => setForm({ ...form, product: v })} />
                <FormField label="HS Code" placeholder="e.g. 0713.40"
                  value={form.hsCode ?? ""} onChange={(v) => setForm({ ...form, hsCode: v })} />
                <SelectField label="Stage" value={form.stage ?? "Communication"}
                  onChange={(v) => setForm({ ...form, stage: v })}
                  options={allStages.map((s) => s.id)} labelMap={Object.fromEntries(allStages.map((s) => [s.id, s.label]))} />
                <FormField label="Product Category" placeholder="e.g. Pulses"
                  value={form.category ?? ""} onChange={(v) => setForm({ ...form, category: v })} />
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</label>
                  <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3} className="border-slate-200 text-sm resize-none" placeholder="Additional notes..." />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <Button variant="ghost" onClick={() => setShowNewDeal(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white gap-2">
                {saving ? <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Save className="h-4 w-4" />}
                Save Deal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-red-100 p-2.5">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Delete Deal</h3>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-5">
              Are you sure you want to delete <span className="font-semibold">"{deleteTarget.title}"</span>?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={deleting}
                onClick={() => handleDelete(deleteTarget)}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, bg, valueColor }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; bg: string; valueColor?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 flex items-center gap-3 shadow-sm">
      <div className={`rounded-lg p-2.5 ${bg} flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
        <p className={`text-xl font-bold ${valueColor ?? "text-slate-800"}`}>{value}</p>
        {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Filter helpers ───────────────────────────────────────────
function FilterSelect({ label, value, onChange, options, labelMap }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; labelMap?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="h-8 pl-2 pr-7 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none min-w-[120px]">
          <option value="">All</option>
          {options.map((o) => <option key={o} value={o}>{labelMap ? labelMap[o] ?? o : o}</option>)}
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text", hint, highlight }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string; highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-semibold uppercase tracking-wide ${highlight ? "text-brand-600" : "text-slate-500"}`}>{label}</label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className={`border-slate-200 text-sm ${highlight ? "border-brand-300 focus:ring-brand-500" : ""}`} />
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, labelMap }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; labelMap?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 pr-8">
          <option value="">Select {label}</option>
          {options.map((o) => <option key={o} value={o}>{labelMap ? labelMap[o] ?? o : o}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────
function KanbanBoard({ deals, allDeals, stages, onCardClick, onDragStart, onDrop, onDragOver, dragOver }: {
  deals: Deal[]; allDeals: Deal[];
  stages: StageConfig[];
  onCardClick: (d: Deal) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragOver: (id: string) => void;
  dragOver: string | null;
}) {
  // Show stages that have deals in the full (unfiltered) set, in defined order
  const visibleStages = stages.filter((s) => allDeals.some((d) => d.stage === s.id));

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 h-full" style={{ minHeight: 400 }}>
      {visibleStages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage.id);
        const stageValue = stageDeals.reduce((s, d) => s + (d.expectedRevenue ?? 0), 0);
        return (
          <div
            key={stage.id}
            className={`flex-shrink-0 w-64 flex flex-col rounded-xl border transition-all ${
              dragOver === stage.id ? "border-brand-400 bg-brand-50/60" : "border-slate-200 bg-slate-50"
            }`}
            onDragOver={(e) => { e.preventDefault(); onDragOver(stage.id); }}
            onDrop={(e) => onDrop(e, stage.id)}
          >
            {/* Column Header */}
            <div className="px-3 pt-2.5 pb-2 rounded-t-xl" style={{ borderTop: `3px solid ${stage.color}`, background: stage.bg }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider truncate" style={{ color: stage.text }}>{stage.label}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: stage.color + "22", color: stage.color }}>
                  {stageDeals.length}
                </span>
              </div>
              {stageValue > 0 && (
                <p className="text-xs font-semibold" style={{ color: stage.text + "cc" }}>
                  {fmtMoney(stageValue)}
                </p>
              )}
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
              {stageDeals.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-6 border-2 border-dashed border-slate-200 rounded-lg">
                  Drop here
                </div>
              ) : (
                stageDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} onClick={() => onCardClick(deal)} onDragStart={onDragStart} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Deal Card ────────────────────────────────────────────────
function DealCard({ deal, onClick, onDragStart }: {
  deal: Deal; onClick: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  const days = daysInStage(deal);
  const badge = agingBadge(days);
  const value = fmtMoney(deal.expectedRevenue);
  const ownerInit = initials(deal.creatorName);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onClick={onClick}
      className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-300 cursor-pointer transition-all group"
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2 group-hover:text-brand-700 transition-colors">
          {deal.title}
        </p>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 mt-0.5 group-hover:text-brand-500 transition-colors" />
      </div>

      {deal.product && <p className="text-xs text-slate-500 mb-2 truncate">{deal.product}</p>}

      {/* Value + aging badge row */}
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <div className="flex items-center gap-1.5">
          {value && (
            <span className="text-xs font-bold text-slate-700">{value}</span>
          )}
          {!value && <span className="text-xs text-slate-400 italic">No value</span>}
        </div>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: badge.bg, color: badge.color }}
          title={badge.title}
        >
          {badge.label}
        </span>
      </div>

      {/* Owner + last activity row */}
      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-100">
        <div className="flex items-center gap-1">
          <div className="h-5 w-5 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-700">
            {ownerInit}
          </div>
          {deal.creatorName && (
            <span className="text-[11px] text-slate-400 truncate max-w-[70px]">{deal.creatorName.split(" ")[0]}</span>
          )}
        </div>
        <span className="text-[10px] text-slate-400">{relativeTime(deal.updatedAt)}</span>
      </div>
    </div>
  );
}

// ─── Table View ───────────────────────────────────────────────
function TableView({ deals, stages, onRowClick, onDelete, onEdit, sortKey, sortDir, onSort }: {
  deals: Deal[]; stages: StageConfig[];
  onRowClick: (d: Deal) => void; onDelete: (d: Deal) => void; onEdit: (d: Deal) => void;
  sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void;
}) {
  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
        <TrendingUp className="h-12 w-12 text-slate-200" />
        <p className="text-sm">No deals match the current filters.</p>
      </div>
    );
  }

  function SortBtn({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <button onClick={() => onSort(col)} className="flex items-center gap-1 group">
        {label}
        <span className={`transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
          {active && sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {!active && <ArrowUpDown className="h-3 w-3" />}
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm flex flex-col flex-1 min-h-0">
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                <SortBtn col="title" label="Deal" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Buyer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Supplier</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Product</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                <SortBtn col="value" label="Value" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Manager</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                <SortBtn col="daysInStage" label="Days" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                <SortBtn col="lastActivity" label="Last Activity" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal, i) => {
              const sc = stageConf(deal.stage, stages);
              const days = daysInStage(deal);
              const badge = agingBadge(days);
              return (
                <tr
                  key={deal.id}
                  className={`border-b border-slate-100 hover:bg-brand-50/40 cursor-pointer transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                  onClick={() => onRowClick(deal)}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 hover:text-brand-700 whitespace-nowrap">{deal.title}</p>
                    {deal.hsCode && <p className="text-xs text-slate-400">HS: {deal.hsCode}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{deal.buyer || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{deal.supplier || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap max-w-[140px] truncate">{deal.product || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                      style={{ background: sc.bg, color: sc.text }}>
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                    {fmtMoney(deal.expectedRevenue) ?? <span className="text-slate-400 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-700">
                        {initials(deal.creatorName)}
                      </div>
                      <span className="text-xs text-slate-500">{deal.creatorName?.split(" ")[0] ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{relativeTime(deal.updatedAt)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => onEdit(deal)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onDelete(deal)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────
function DetailPanel({
  deal, stages, editMode, editForm, setEditForm, saving,
  buyerOptions, supplierOptions, onClose, onEdit, onSave, onDelete, onStageChange,
}: {
  deal: Deal; stages: StageConfig[];
  editMode: boolean; editForm: Partial<Deal>; setEditForm: (v: Partial<Deal>) => void;
  saving: boolean; buyerOptions: string[]; supplierOptions: string[];
  onClose: () => void; onEdit: () => void; onSave: () => void;
  onDelete: () => void; onStageChange: (s: string) => void;
}) {
  const days = daysInStage(deal);
  const badge = agingBadge(days);

  return (
    <div className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-100">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-base truncate">{deal.title}</h3>
          {deal.product && <p className="text-xs text-slate-500 mt-0.5 truncate">{deal.product}</p>}
          {deal.hsCode && <p className="text-xs text-slate-400">HS: {deal.hsCode}</p>}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 ml-2 flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick stats strip */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-3 text-xs">
        {deal.expectedRevenue && (
          <span className="font-bold text-slate-700">{fmtMoney(deal.expectedRevenue)}</span>
        )}
        <span className="font-bold px-1.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}
          title={badge.title}>
          {badge.label} in stage
        </span>
        {deal.creatorName && (
          <span className="ml-auto text-slate-500 truncate">{deal.creatorName}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Stage Stepper */}
        <div className="p-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pipeline Stage</p>
          <div className="flex flex-col gap-1.5">
            {stages.map((s, idx) => {
              const currentIdx = stages.findIndex((x) => x.id === deal.stage);
              const isPast = idx < currentIdx;
              const isCurrent = s.id === deal.stage;
              return (
                <button key={s.id} onClick={() => onStageChange(s.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isCurrent ? "text-white shadow-sm" : isPast ? "text-slate-500 hover:bg-slate-100" : "text-slate-400 hover:bg-slate-50"
                  }`}
                  style={isCurrent ? { background: s.color } : {}}>
                  {isCurrent ? <CheckCircle2 className="h-3.5 w-3.5" /> : isPast
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" /> : <Circle className="h-3.5 w-3.5" />}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Deal Info */}
        <div className="p-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Deal Info</p>
          {editMode ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-slate-400 font-medium">Buyer</label>
                <div className="relative">
                  <select value={(editForm.buyer as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, buyer: e.target.value })}
                    className="w-full appearance-none h-8 text-xs border border-slate-200 rounded-md px-2 pr-7 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="">Select Buyer</option>
                    {buyerOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-slate-400 font-medium">Supplier</label>
                <div className="relative">
                  <select value={(editForm.supplier as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                    className="w-full appearance-none h-8 text-xs border border-slate-200 rounded-md px-2 pr-7 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="">Select Supplier</option>
                    {supplierOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-slate-400 font-medium">Expected Revenue (USD)</label>
                <input type="number" value={(editForm.expectedRevenue as number) ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, expectedRevenue: parseFloat(e.target.value) || undefined })}
                  className="h-8 px-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-slate-400 font-medium">Product</label>
                <input type="text" value={(editForm.product as string) ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, product: e.target.value })}
                  className="h-8 px-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: "Buyer", value: deal.buyer },
                { label: "Supplier", value: deal.supplier },
                { label: "Value", value: fmtMoney(deal.expectedRevenue) },
                { label: "Product", value: deal.product },
                { label: "Last Activity", value: relativeTime(deal.updatedAt) },
                { label: "Account Manager", value: deal.creatorName },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{value || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</p>
          {editMode ? (
            <Textarea value={(editForm.notes as string) ?? ""}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={4} className="text-xs border-slate-200 resize-none" placeholder="Add notes..." />
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed">{deal.notes || "No notes added."}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2">
        {editMode ? (
          <>
            <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => setEditForm({ ...deal })}>Cancel</Button>
            <Button size="sm" className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-xs gap-1" disabled={saving} onClick={onSave}>
              {saving ? <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50" onClick={onEdit}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50" onClick={onDelete}>
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
