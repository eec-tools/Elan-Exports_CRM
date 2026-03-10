import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  LayoutGrid,
  List,
  X,
  Pencil,
  Trash2,
  ChevronRight,
  TrendingUp,
  DollarSign,
  BarChart2,
  Percent,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Save,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

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
}

// ─── Stage Config ─────────────────────────────────────────────
const STAGES = [
  { id: "LEAD",        label: "LEAD",        color: "#64748b", bg: "#f1f5f9", text: "#334155" },
  { id: "RFQ",         label: "RFQ",         color: "#3b82f6", bg: "#eff6ff", text: "#1d4ed8" },
  { id: "NEGOTIATION", label: "NEGOTIATION", color: "#f59e0b", bg: "#fffbeb", text: "#b45309" },
  { id: "SAMPLING",    label: "SAMPLING",    color: "#8b5cf6", bg: "#f5f3ff", text: "#6d28d9" },
  { id: "CONFIRMED",   label: "CONFIRMED",   color: "#10b981", bg: "#ecfdf5", text: "#065f46" },
  { id: "SHIPPED",     label: "SHIPPED",     color: "#06b6d4", bg: "#ecfeff", text: "#0e7490" },
  { id: "CLOSED",      label: "CLOSED",      color: "#16a34a", bg: "#f0fdf4", text: "#14532d" },
];

const RISK_OPTIONS = ["Low", "Medium", "High"];
const CATEGORY_OPTIONS = ["Food", "Textiles", "Electronics", "Chemicals", "Machinery", "Other"];

// ─── Helpers ──────────────────────────────────────────────────
function stageConfig(id: string) {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

function riskColor(risk?: string) {
  if (risk === "Low") return "#10b981";
  if (risk === "High") return "#ef4444";
  return "#f59e0b";
}

function fmtMoney(v?: number) {
  if (!v) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Empty form ───────────────────────────────────────────────
const emptyForm = (): Partial<Deal> => ({
  title: "",
  buyer: "",
  supplier: "",
  product: "",
  hsCode: "",
  volume: "",
  price: undefined,
  expectedRevenue: undefined,
  margin: 15,
  stage: "LEAD",
  probability: 20,
  category: "",
  riskScore: "Medium",
  notes: "",
});

// ─── Main Page ────────────────────────────────────────────────
export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "table">("kanban");

  // Buyer / Supplier options fetched from real data
  const [buyerOptions, setBuyerOptions] = useState<string[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<string[]>([]);

  // Modal states
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [form, setForm] = useState<Partial<Deal>>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Detail panel
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Deal>>({});

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Drag-over state for kanban
  const [dragOver, setDragOver] = useState<string | null>(null);

  // ─── Fetch ───────────────────────────────────────────────────
  async function fetchDeals() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/deals`, { headers: authHeader() });
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
    // Fetch buyer & supplier names for dropdowns
    fetch(`${API_BASE}/api/buyers?limit=200`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => {
        const names: string[] = Array.isArray(d.data)
          ? d.data.map((b: any) => b.company).filter(Boolean)
          : [];
        setBuyerOptions([...new Set(names)].sort());
      })
      .catch(() => {});
    fetch(`${API_BASE}/api/suppliers?limit=200`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => {
        const names: string[] = Array.isArray(d.data)
          ? d.data.map((s: any) => s.company).filter(Boolean)
          : [];
        setSupplierOptions([...new Set(names)].sort());
      })
      .catch(() => {});
  }, []);

  // ─── Stats ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = deals.length;
    const pipeline = deals.reduce((s, d) => s + (d.expectedRevenue ?? 0), 0);
    const weighted = deals.reduce(
      (s, d) => s + (d.expectedRevenue ?? 0) * ((d.probability ?? 20) / 100),
      0
    );
    const avgMargin =
      deals.length > 0
        ? deals.reduce((s, d) => s + (d.margin ?? 15), 0) / deals.length
        : 0;
    return { total, pipeline, weighted, avgMargin };
  }, [deals]);

  // ─── Create ──────────────────────────────────────────────────
  async function handleCreate() {
    if (!form.title?.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/deals`, {
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

  // ─── Update ──────────────────────────────────────────────────
  async function handleUpdate() {
    if (!selectedDeal) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/deals/${selectedDeal.id}`, {
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

  // ─── Stage move ──────────────────────────────────────────────
  async function moveStage(dealId: string, newStage: string) {
    try {
      const res = await fetch(`${API_BASE}/api/deals/${dealId}`, {
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

  // ─── Delete ──────────────────────────────────────────────────
  async function handleDelete(deal: Deal) {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/deals/${deal.id}`, {
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

  // ─── Open detail ─────────────────────────────────────────────
  function openDeal(deal: Deal) {
    setSelectedDeal(deal);
    setEditMode(false);
    setEditForm({ ...deal });
  }

  // ─── Drag & Drop for Kanban ──────────────────────────────────
  function handleDragStart(e: React.DragEvent, dealId: string) {
    e.dataTransfer.setData("dealId", dealId);
  }

  function handleDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("dealId");
    if (!dealId) return;
    const deal = deals.find((d) => d.id === dealId);
    if (deal && deal.stage !== stageId) {
      moveStage(dealId, stageId);
    }
    setDragOver(null);
  }

  // ─── Field helper ────────────────────────────────────────────
  function field(
    label: string,
    key: keyof Deal,
    type: string,
    state: Partial<Deal>,
    setState: (v: Partial<Deal>) => void,
    opts?: { placeholder?: string; options?: string[] }
  ) {
    const val = state[key] ?? "";
    if (opts?.options) {
      return (
        <div key={key} className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
          <div className="relative">
            <select
              value={val as string}
              onChange={(e) => setState({ ...state, [key]: e.target.value })}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
            >
              <option value="">Select {label}</option>
              {opts.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      );
    }
    return (
      <div key={key} className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
        <Input
          type={type}
          value={val as string | number}
          placeholder={opts?.placeholder}
          onChange={(e) =>
            setState({ ...state, [key]: type === "number" ? parseFloat(e.target.value) || undefined : e.target.value })
          }
          className="border-slate-200 text-sm"
        />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-500" />
            Deals Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and manage your export deals across all stages</p>
        </div>
        <Button
          onClick={() => { setShowNewDeal(true); setForm(emptyForm()); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Deal
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-5">
        {[
          {
            icon: <BarChart2 className="h-5 w-5 text-emerald-600" />,
            label: "Total Deals",
            value: stats.total.toString(),
            bg: "bg-emerald-50",
          },
          {
            icon: <DollarSign className="h-5 w-5 text-blue-600" />,
            label: "Pipeline Value",
            value: fmtMoney(stats.pipeline),
            bg: "bg-blue-50",
          },
          {
            icon: <TrendingUp className="h-5 w-5 text-purple-600" />,
            label: "Weighted Revenue",
            value: fmtMoney(stats.weighted),
            bg: "bg-purple-50",
          },
          {
            icon: <Percent className="h-5 w-5 text-amber-600" />,
            label: "Avg Margin",
            value: `${stats.avgMargin.toFixed(1)}%`,
            bg: "bg-amber-50",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-100 bg-white p-4 flex items-center gap-3 shadow-sm">
            <div className={`rounded-lg p-2.5 ${s.bg}`}>{s.icon}</div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className="text-xl font-bold text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── View Toggle ── */}
      <div className="flex items-center gap-2 pb-4">
        <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          <button
            onClick={() => setView("kanban")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${
              view === "kanban"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </button>
          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${
              view === "table"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <List className="h-4 w-4" />
            Table
          </button>
        </div>
        <span className="text-xs text-slate-400 ml-auto">
          {deals.length} deal{deals.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Content Area ── */}
      <div className="flex gap-5 flex-1 min-h-0 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-8 w-8 rounded-full border-4 border-emerald-500 border-t-transparent" />
            </div>
          ) : view === "kanban" ? (
            <KanbanBoard
              deals={deals}
              onCardClick={openDeal}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragOver={(id) => setDragOver(id)}
              dragOver={dragOver}
            />
          ) : (
            <TableView
              deals={deals}
              onRowClick={openDeal}
              onDelete={(d) => setDeleteTarget(d)}
              onEdit={(d) => { openDeal(d); setEditMode(true); }}
            />
          )}
        </div>

        {/* Detail Panel */}
        {selectedDeal && (
          <DetailPanel
            deal={selectedDeal}
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
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-600" />
                New Deal
              </h2>
              <button onClick={() => setShowNewDeal(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">{field("Title *", "title", "text", form, setForm, { placeholder: "e.g. US Organic Lentils Q2" })}</div>
                {/* Buyer dropdown – real buyers data */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Buyer</label>
                  <div className="relative">
                    <select
                      value={form.buyer ?? ""}
                      onChange={(e) => setForm({ ...form, buyer: e.target.value })}
                      className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
                    >
                      <option value="">Select Buyer</option>
                      {buyerOptions.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                {/* Supplier dropdown – real suppliers data */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier</label>
                  <div className="relative">
                    <select
                      value={form.supplier ?? ""}
                      onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                      className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
                    >
                      <option value="">Select Supplier</option>
                      {supplierOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                {field("Product", "product", "text", form, setForm, { placeholder: "e.g. Organic Red Lentils" })}
                {field("HS Code", "hsCode", "text", form, setForm, { placeholder: "e.g. 0713.40" })}
                {field("Volume", "volume", "text", form, setForm, { placeholder: "e.g. 500 MT" })}
                {field("Price (per unit)", "price", "number", form, setForm, { placeholder: "0.00" })}
                {field("Expected Revenue ($)", "expectedRevenue", "number", form, setForm, { placeholder: "0" })}
                {field("Margin (%)", "margin", "number", form, setForm, { placeholder: "15" })}
                {field("Probability (%)", "probability", "number", form, setForm, { placeholder: "20" })}
                {field("Stage", "stage", "text", form, setForm, { options: STAGES.map((s) => s.id) })}
                {field("Category", "category", "text", form, setForm, { options: CATEGORY_OPTIONS })}
                {field("Risk Score", "riskScore", "text", form, setForm, { options: RISK_OPTIONS })}
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</label>
                  <Textarea
                    value={form.notes ?? ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    className="border-slate-200 text-sm resize-none"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <Button variant="ghost" onClick={() => setShowNewDeal(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
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
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={deleting}
                onClick={() => handleDelete(deleteTarget)}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────
function KanbanBoard({
  deals,
  onCardClick,
  onDragStart,
  onDrop,
  onDragOver,
  dragOver,
}: {
  deals: Deal[];
  onCardClick: (d: Deal) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragOver: (id: string) => void;
  dragOver: string | null;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 h-full" style={{ minHeight: 400 }}>
      {STAGES.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage.id);
        return (
          <div
            key={stage.id}
            className={`flex-shrink-0 w-64 flex flex-col rounded-xl border transition-all ${
              dragOver === stage.id ? "border-emerald-400 bg-emerald-50/60" : "border-slate-200 bg-slate-50"
            }`}
            onDragOver={(e) => { e.preventDefault(); onDragOver(stage.id); }}
            onDrop={(e) => onDrop(e, stage.id)}
          >
            {/* Column Header */}
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-t-xl"
              style={{ borderTop: `3px solid ${stage.color}`, background: stage.bg }}
            >
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: stage.text }}>
                {stage.label}
              </span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: stage.color + "22", color: stage.color }}
              >
                {stageDeals.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
              {stageDeals.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-6 border-2 border-dashed border-slate-200 rounded-lg">
                  Drop here
                </div>
              ) : (
                stageDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    stageColor={stage.color}
                    onClick={() => onCardClick(deal)}
                    onDragStart={onDragStart}
                  />
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
function DealCard({
  deal,
  stageColor,
  onClick,
  onDragStart,
}: {
  deal: Deal;
  stageColor: string;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onClick={onClick}
      className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2 group-hover:text-emerald-700 transition-colors">
          {deal.title}
        </p>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 mt-0.5 group-hover:text-emerald-500 transition-colors" />
      </div>
      {deal.product && (
        <p className="text-xs text-slate-500 mb-2 truncate">{deal.product}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        {deal.expectedRevenue ? (
          <span className="text-sm font-bold" style={{ color: stageColor }}>
            {fmtMoney(deal.expectedRevenue)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">No revenue</span>
        )}
        {deal.probability !== undefined && (
          <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
            {deal.probability}%
          </span>
        )}
      </div>
      {deal.riskScore && (
        <div className="flex items-center gap-1 mt-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: riskColor(deal.riskScore) }}
          />
          <span className="text-xs text-slate-400">{deal.riskScore} risk</span>
        </div>
      )}
    </div>
  );
}

// ─── Table View ───────────────────────────────────────────────
function TableView({
  deals,
  onRowClick,
  onDelete,
  onEdit,
}: {
  deals: Deal[];
  onRowClick: (d: Deal) => void;
  onDelete: (d: Deal) => void;
  onEdit: (d: Deal) => void;
}) {
  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
        <TrendingUp className="h-12 w-12 text-slate-200" />
        <p className="text-sm">No deals yet. Create your first deal!</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["Deal", "Buyer", "Stage", "Revenue", "Margin", "Risk", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map((deal, i) => {
              const sc = stageConfig(deal.stage);
              return (
                <tr
                  key={deal.id}
                  className={`border-b border-slate-100 hover:bg-emerald-50/40 cursor-pointer transition-colors ${
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  }`}
                  onClick={() => onRowClick(deal)}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 hover:text-emerald-700">{deal.title}</p>
                    {deal.product && <p className="text-xs text-slate-400">{deal.product}</p>}
                    {deal.hsCode && <p className="text-xs text-slate-400">HS: {deal.hsCode}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{deal.buyer || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: sc.bg, color: sc.text }}
                    >
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-emerald-600">{fmtMoney(deal.expectedRevenue)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {deal.margin !== undefined ? (
                      <span className="text-emerald-600 font-medium">{deal.margin}%</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: riskColor(deal.riskScore) }} />
                      <span className="text-slate-600 text-xs">{deal.riskScore || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(deal)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(deal)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
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
  deal,
  editMode,
  editForm,
  setEditForm,
  saving,
  buyerOptions,
  supplierOptions,
  onClose,
  onEdit,
  onSave,
  onDelete,
  onStageChange,
}: {
  deal: Deal;
  editMode: boolean;
  editForm: Partial<Deal>;
  setEditForm: (v: Partial<Deal>) => void;
  saving: boolean;
  buyerOptions: string[];
  supplierOptions: string[];
  onClose: () => void;
  onEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onStageChange: (s: string) => void;
}) {
  return (
    <div className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Panel Header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-100">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-base truncate">{deal.title}</h3>
          {deal.product && <p className="text-xs text-slate-500 mt-0.5 truncate">{deal.product}</p>}
          {deal.hsCode && <p className="text-xs text-slate-400">HS: {deal.hsCode}</p>}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors ml-2 flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Stage Stepper */}
        <div className="p-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pipeline Stage</p>
          <div className="flex flex-col gap-1.5">
            {STAGES.map((s, idx) => {
              const currentIdx = STAGES.findIndex((x) => x.id === deal.stage);
              const isPast = idx < currentIdx;
              const isCurrent = s.id === deal.stage;
              return (
                <button
                  key={s.id}
                  onClick={() => onStageChange(s.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isCurrent
                      ? "text-white shadow-sm"
                      : isPast
                      ? "text-slate-500 hover:bg-slate-100"
                      : "text-slate-400 hover:bg-slate-50"
                  }`}
                  style={isCurrent ? { background: s.color } : {}}
                >
                  {isCurrent ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isPast ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info Grid */}
        <div className="p-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Deal Info</p>
          {editMode ? (
            <div className="flex flex-col gap-3">
              {/* Buyer dropdown */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-slate-400 font-medium">Buyer</label>
                <div className="relative">
                  <select
                    value={(editForm.buyer as string) ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, buyer: e.target.value })}
                    className="w-full appearance-none h-8 text-xs border border-slate-200 rounded-md px-2 pr-7 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Buyer</option>
                    {buyerOptions.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                </div>
              </div>
              {/* Supplier dropdown */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-slate-400 font-medium">Supplier</label>
                <div className="relative">
                  <select
                    value={(editForm.supplier as string) ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                    className="w-full appearance-none h-8 text-xs border border-slate-200 rounded-md px-2 pr-7 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Supplier</option>
                    {supplierOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                </div>
              </div>
              {[
                { label: "Revenue ($)", key: "expectedRevenue" as keyof Deal, type: "number" },
                { label: "Margin (%)", key: "margin" as keyof Deal, type: "number" },
                { label: "Probability (%)", key: "probability" as keyof Deal, type: "number" },
                { label: "Volume", key: "volume" as keyof Deal, type: "text" },
              ].map(({ label, key, type }) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <label className="text-xs text-slate-400 font-medium">{label}</label>
                  <Input
                    type={type}
                    value={(editForm[key] as string | number) ?? ""}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        [key]: type === "number" ? parseFloat(e.target.value) || undefined : e.target.value,
                      })
                    }
                    className="h-8 text-xs border-slate-200"
                  />
                </div>
              ))}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-slate-400 font-medium">Risk Score</label>
                <select
                  value={(editForm.riskScore as string) ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, riskScore: e.target.value })}
                  className="h-8 text-xs border border-slate-200 rounded-md px-2"
                >
                  {RISK_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Buyer", value: deal.buyer },
                { label: "Supplier", value: deal.supplier },
                { label: "Revenue", value: fmtMoney(deal.expectedRevenue) },
                { label: "Margin", value: deal.margin !== undefined ? `${deal.margin}%` : "—" },
                { label: "Probability", value: deal.probability !== undefined ? `${deal.probability}%` : "—" },
                { label: "Volume", value: deal.volume },
                { label: "Category", value: deal.category },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{value || "—"}</p>
                </div>
              ))}
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-xs text-slate-400 mb-0.5">Risk</p>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ background: riskColor(deal.riskScore) }} />
                  <p className="text-sm font-semibold text-slate-800">{deal.riskScore || "—"}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</p>
          {editMode ? (
            <Textarea
              value={(editForm.notes as string) ?? ""}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={4}
              className="text-xs border-slate-200 resize-none"
              placeholder="Add notes..."
            />
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed">{deal.notes || "No notes added."}</p>
          )}
        </div>
      </div>

      {/* Panel Actions */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2">
        {editMode ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => { setEditForm({ ...deal }); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
              disabled={saving}
              onClick={onSave}
            >
              {saving ? <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
              onClick={onEdit}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
