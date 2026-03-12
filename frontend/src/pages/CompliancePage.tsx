import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ─────────────────────────────────────────────────────────────────

type ComplianceStatus = "RECEIVED" | "PENDING" | "MISSING";

interface ComplianceDoc {
  id: string;
  dealId: string;
  docType: string;
  status: ComplianceStatus;
  dueDate: string | null;
  notes: string | null;
  deal: { id: string; title: string; buyer: string | null; stage: string };
  createdAt: string;
  updatedAt: string;
}

interface Deal {
  id: string;
  title: string;
  buyer: string | null;
  stage: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const STATUS_CYCLE: ComplianceStatus[] = ["MISSING", "PENDING", "RECEIVED"];

const DOCUMENT_TYPES = [
  "Purchase Order",
  "Commercial Invoice",
  "Packing List",
  "Certificate of Origin",
  "Bill of Lading",
  "Lab Test Report",
  "Organic Certificate",
  "BRC Certificate",
  "GOTS Certificate",
  "Phytosanitary Certificate",
  "Halal Certificate",
  "OEKO-TEX Report",
  "Inspection Certificate",
  "Insurance Certificate",
  "Proforma Invoice",
  "Letter of Credit",
  "Fumigation Certificate",
  "Weight & Measurement Certificate",
  "Health Certificate",
  "Export License",
];

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
  RECEIVED: {
    label: "RECEIVED",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  PENDING: {
    label: "PENDING",
    icon: <Clock className="h-3.5 w-3.5" />,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  MISSING: {
    label: "MISSING",
    icon: <XCircle className="h-3.5 w-3.5" />,
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
};

const DEAL_ICON_BG: Record<string, string> = {
  RECEIVED: "bg-emerald-100",
  PENDING: "bg-amber-100",
  MISSING: "bg-red-100",
  DEFAULT: "bg-teal-100",
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

// ─── Add Document Form ───────────────────────────────────────────────────────

interface AddDocFormProps {
  deals: Deal[];
  onClose: () => void;
  onSuccess: () => void;
}

function AddDocForm({ deals, onClose, onSuccess }: AddDocFormProps) {
  const [form, setForm] = useState({
    dealId: "",
    docType: "",
    status: "MISSING" as ComplianceStatus,
    dueDate: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dealId || !form.docType) {
      toast.error("Please select a deal and document type");
      return;
    }
    setLoading(true);
    try {
      await api.post("/compliance", {
        ...form,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
      });
      toast.success("Document added successfully");
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to add document");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Deal *</Label>
        <Select value={form.dealId} onValueChange={(v) => setForm((f) => ({ ...f, dealId: v }))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a deal…" />
          </SelectTrigger>
          <SelectContent>
            {deals.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.title}
                {d.buyer ? ` — ${d.buyer}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Document Type *</Label>
        <Select value={form.docType} onValueChange={(v) => setForm((f) => ({ ...f, docType: v }))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select document type…" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {DOCUMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Initial Status</Label>
        <Select
          value={form.status}
          onValueChange={(v) => setForm((f) => ({ ...f, status: v as ComplianceStatus }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_CYCLE.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Due Date</Label>
        <Input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
        />
      </div>

      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes</Label>
        <Textarea
          placeholder="Any notes or remarks…"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-brand-600 hover:bg-brand-700 text-white"
        >
          {loading ? "Adding…" : "Add Document"}
        </Button>
      </div>
    </form>
  );
}

// ─── Deal Card ───────────────────────────────────────────────────────────────

interface DealCardProps {
  deal: Deal;
  docs: ComplianceDoc[];
  onUpdate: (id: string, nextStatus: ComplianceStatus) => void;
  onDelete: (id: string) => void;
}

function DealCard({ deal, docs, onUpdate, onDelete }: DealCardProps) {
  const [expanded, setExpanded] = useState(false);

  const received = docs.filter((d) => d.status === "RECEIVED").length;
  const total = docs.length;
  const pct = total === 0 ? 0 : Math.round((received / total) * 100);

  // Icon background based on completion
  const iconBg =
    pct === 100
      ? DEAL_ICON_BG.RECEIVED
      : pct >= 50
      ? DEAL_ICON_BG.PENDING
      : pct > 0
      ? DEAL_ICON_BG.MISSING
      : DEAL_ICON_BG.DEFAULT;

  const iconText =
    pct === 100
      ? "text-emerald-600"
      : pct >= 50
      ? "text-amber-600"
      : pct > 0
      ? "text-red-600"
      : "text-teal-600";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/70 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className={`p-2.5 rounded-lg ${iconBg} shrink-0`}>
          <FileText className={`h-5 w-5 ${iconText}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{deal.title}</p>
          <p className="text-sm text-slate-500">
            {deal.buyer ?? "No buyer"} &nbsp;·&nbsp;
            <span className="capitalize">{deal.stage.toLowerCase()}</span>
          </p>
        </div>
        <div className="text-right shrink-0 mr-3">
          <p className="font-semibold text-slate-800 text-sm">
            {received}/{total}
          </p>
          <p className="text-xs text-slate-500">{pct}% complete</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />
        )}
      </button>

      {/* Document Table */}
      {expanded && (
        <div className="border-t border-slate-100">
          {docs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No documents yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Document
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Due Date
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Notes
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {docs.map((doc) => {
                    const nextIdx =
                      (STATUS_CYCLE.indexOf(doc.status) + 1) % STATUS_CYCLE.length;
                    const nextStatus = STATUS_CYCLE[nextIdx];
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {doc.status === "RECEIVED" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : doc.status === "PENDING" ? (
                              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                            )}
                            <span className="font-medium text-slate-800">
                              {doc.docType}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={doc.status} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {doc.dueDate
                            ? new Date(doc.dueDate).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 max-w-[200px] truncate">
                          {doc.notes ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs font-medium text-slate-600 hover:text-brand-700 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                              onClick={() => onUpdate(doc.id, nextStatus)}
                              title={`Set to ${nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase()}`}
                            >
                              Update
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              onClick={() => onDelete(doc.id)}
                              title="Delete document"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CompliancePage() {
  useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDeal, setFilterDeal] = useState<string>("ALL");

  // Fetch compliance docs
  const { data: docs = [], isLoading } = useQuery<ComplianceDoc[]>({
    queryKey: ["compliance"],
    queryFn: () => api.get("/compliance").then((r) => r.data),
  });

  // Fetch deals for the filter and add-form
  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["deals"],
    queryFn: () => api.get("/deals").then((r) => r.data),
  });

  // Update status mutation
  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ComplianceStatus }) =>
      api.patch(`/compliance/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance"] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/compliance/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance"] });
      toast.success("Document deleted");
    },
    onError: () => toast.error("Failed to delete document"),
  });

  // Stats
  const totalDocs = docs.length;
  const received = docs.filter((d) => d.status === "RECEIVED").length;
  const pending = docs.filter((d) => d.status === "PENDING").length;
  const missing = docs.filter((d) => d.status === "MISSING").length;
  const complianceRate = totalDocs === 0 ? 0 : Math.round((received / totalDocs) * 100);

  // Filtered docs
  const filteredDocs = useMemo(() => {
    return docs.filter((d) => {
      if (filterStatus !== "ALL" && d.status !== filterStatus) return false;
      if (filterDeal !== "ALL" && d.dealId !== filterDeal) return false;
      return true;
    });
  }, [docs, filterStatus, filterDeal]);

  // Group by deal
  const grouped = useMemo(() => {
    const map = new Map<string, { deal: Deal; docs: ComplianceDoc[] }>();
    filteredDocs.forEach((doc) => {
      if (!map.has(doc.dealId)) {
        map.set(doc.dealId, { deal: doc.deal, docs: [] });
      }
      map.get(doc.dealId)!.docs.push(doc);
    });
    return Array.from(map.values());
  }, [filteredDocs]);

  // Deals that have docs (for filter dropdown — also include ALL deals from deals endpoint)
  const dealsWithDocs = useMemo(() => {
    const ids = new Set(docs.map((d) => d.dealId));
    return deals.filter((d) => ids.has(d.id));
  }, [docs, deals]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Compliance &amp; Documentation
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track export documents across all active deals
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Document
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Documents"
          value={totalDocs}
          icon={<FileText className="h-5 w-5 text-brand-600" />}
          color="bg-brand-50"
        />
        <StatCard
          label="Received"
          value={received}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          color="bg-emerald-50"
        />
        <StatCard
          label="Pending"
          value={pending}
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          color="bg-amber-50"
        />
        <StatCard
          label="Missing"
          value={missing}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          color="bg-red-50"
        />
      </div>

      {/* ── Compliance Rate ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-700">Overall Compliance Rate</span>
          <span
            className={`text-sm font-bold ${
              complianceRate >= 80
                ? "text-emerald-600"
                : complianceRate >= 50
                ? "text-amber-600"
                : "text-red-600"
            }`}
          >
            {complianceRate}%
          </span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              complianceRate >= 80
                ? "bg-emerald-500"
                : complianceRate >= 50
                ? "bg-amber-400"
                : "bg-red-400"
            }`}
            style={{ width: `${complianceRate}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
          <span>{received} received</span>
          <span>{missing} missing · {pending} pending</span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 bg-white">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="RECEIVED">Received</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="MISSING">Missing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDeal} onValueChange={setFilterDeal}>
            <SelectTrigger className="flex-1 max-w-xs bg-white">
              <SelectValue placeholder="All Deals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Deals</SelectItem>
              {dealsWithDocs.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-slate-500 self-center shrink-0">
          {filteredDocs.length} document{filteredDocs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Deal Cards ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-semibold text-lg">No compliance documents</p>
          <p className="text-slate-400 text-sm mt-1">
            {filterStatus === "ALL" && filterDeal === "ALL"
              ? "Click «Add Document» to start tracking export documents for your deals."
              : "No documents match the current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ deal, docs: dealDocs }) => (
            <DealCard
              key={deal.id}
              deal={deal}
              docs={dealDocs}
              onUpdate={(id, status) => updateMut.mutate({ id, status })}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* ── Add Document Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Add Compliance Document
            </DialogTitle>
          </DialogHeader>
          <AddDocForm
            deals={deals}
            onClose={() => setAddOpen(false)}
            onSuccess={() => qc.invalidateQueries({ queryKey: ["compliance"] })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
