import { useState, useRef, useEffect } from "react";
import { copyToClipboard } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  ClipboardList,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";

// ─── Types ──────────────────────────────────────────
interface Quotation {
  id: string;
  supplierName: string;
  supplierWebsite?: string;
  product?: string;
  hsCode?: string;
  status: string;
  formToken?: string;
  fieldConfig: Record<string, { sentToSupplier: boolean; mandatory: boolean }>;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  pending: number;
  formSent: number;
  responseReceived: number;
  negotiating: number;
  finalized: number;
}

interface SupplierSuggestion {
  id: string;
  company: string;
  email?: string;
  supplierType: "new" | "signed";
}

// ─── All quotation fields with defaults ─────────────
const QUOTATION_FIELDS: {
  key: string;
  label: string;
  defaultSent: boolean;
  defaultMandatory: boolean;
}[] = [
  { key: "supplierName",          label: "Supplier",                     defaultSent: true,  defaultMandatory: true  },
  { key: "supplierWebsite",       label: "Website",                      defaultSent: true,  defaultMandatory: false },
  { key: "date",                  label: "Date",                         defaultSent: true,  defaultMandatory: true  },
  { key: "hsCode",                label: "HS Code",                      defaultSent: true,  defaultMandatory: false },
  { key: "product",               label: "Product",                      defaultSent: true,  defaultMandatory: true  },
  { key: "fclDetails",            label: "FCL Details",                  defaultSent: true,  defaultMandatory: false },
  { key: "fobSupplierPrice",      label: "FOB — Supplier's Price",       defaultSent: true,  defaultMandatory: false },
  { key: "fobCommissionPercent",  label: "FOB — Commission %",           defaultSent: false, defaultMandatory: false },
  { key: "fobWithCommission",     label: "FOB — With Commission",        defaultSent: false, defaultMandatory: false },
  { key: "cifSupplierPrice",      label: "CIF — Supplier's Price",       defaultSent: true,  defaultMandatory: false },
  { key: "cifWithCommission",     label: "CIF — With Commission",        defaultSent: false, defaultMandatory: false },
  { key: "loadability",           label: "Loadability",                  defaultSent: true,  defaultMandatory: false },
  { key: "packing",               label: "Packing",                      defaultSent: true,  defaultMandatory: false },
  { key: "paymentTerms",          label: "Payment Terms",                defaultSent: true,  defaultMandatory: false },
  { key: "origin",                label: "Origin",                       defaultSent: true,  defaultMandatory: false },
  { key: "priceValidity",         label: "Price Validity",               defaultSent: true,  defaultMandatory: false },
  { key: "supplierCertifications",label: "Supplier Certifications",      defaultSent: true,  defaultMandatory: false },
  { key: "leadTime",              label: "Lead Time",                    defaultSent: true,  defaultMandatory: false },
  { key: "supplierComments",      label: "Supplier Comments on Specs",   defaultSent: true,  defaultMandatory: false },
];

function buildDefaultFieldConfig() {
  const config: Record<string, { sentToSupplier: boolean; mandatory: boolean }> = {};
  for (const f of QUOTATION_FIELDS) {
    config[f.key] = { sentToSupplier: f.defaultSent, mandatory: f.defaultMandatory };
  }
  return config;
}

// ─── Status config ──────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending:           { label: "Pending",           class: "bg-slate-100 text-slate-700" },
  form_sent:         { label: "Form Sent",         class: "bg-blue-100 text-blue-700" },
  response_received: { label: "Responded",         class: "bg-green-100 text-green-700" },
  negotiating:       { label: "Negotiating",       class: "bg-amber-100 text-amber-700" },
  finalized:         { label: "Finalized",         class: "bg-purple-100 text-purple-700" },
};

export default function QuotationsPage() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission("suppliers");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [formLinkDialog, setFormLinkDialog] = useState<{ open: boolean; link: string; company: string }>({
    open: false, link: "", company: "",
  });

  // ─── Create form state ───────────────────────────
  const [supplierQuery, setSupplierQuery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSuggestion | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [fieldConfig, setFieldConfig] = useState(buildDefaultFieldConfig());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Queries ─────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["quotations", search, page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        search, page: String(page), limit: "20",
        ...(statusFilter !== "all" && { status: statusFilter }),
      });
      const res = await api.get(`/quotations?${params}`);
      return res.data as { data: Quotation[]; pagination: { total: number; pages: number } };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["quotations-stats"],
    queryFn: async () => {
      const res = await api.get("/quotations/stats");
      return res.data as Stats;
    },
  });

  const { data: supplierSuggestions = [] } = useQuery({
    queryKey: ["quotation-supplier-search", supplierQuery],
    queryFn: async () => {
      if (!supplierQuery.trim()) return [];
      const res = await api.get(`/quotations/search-suppliers?q=${encodeURIComponent(supplierQuery)}`);
      return res.data as SupplierSuggestion[];
    },
    enabled: supplierQuery.length > 0,
  });

  // ─── Mutations ────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/quotations", {
        supplierName: selectedSupplier?.company ?? supplierQuery,
        linkedSupplierId: selectedSupplier?.id ?? null,
        linkedSupplierType: selectedSupplier?.supplierType ?? null,
        fieldConfig,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-stats"] });
      setCreateOpen(false);
      resetCreateForm();
      const created = res.data;
      if (created?.formToken) {
        const link = `${window.location.origin}/quotation-form/${created.formToken}`;
        setFormLinkDialog({ open: true, link, company: created.supplierName });
      } else {
        toast.success("Quotation created");
      }
    },
    onError: () => toast.error("Failed to create quotation"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quotations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-stats"] });
      setDeleteTarget(null);
      toast.success("Quotation deleted");
    },
    onError: () => toast.error("Failed to delete quotation"),
  });

  function resetCreateForm() {
    setSupplierQuery("");
    setSelectedSupplier(null);
    setShowDropdown(false);
    setFieldConfig(buildDefaultFieldConfig());
  }

  function toggleSent(key: string, value: boolean) {
    setFieldConfig((prev) => ({
      ...prev,
      [key]: {
        sentToSupplier: value,
        mandatory: value ? prev[key].mandatory : false,
      },
    }));
  }

  function toggleMandatory(key: string, value: boolean) {
    setFieldConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], mandatory: value },
    }));
  }

  const quotations = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-brand-600" />
            Quotations
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Send customisable quotation forms to suppliers and collect pricing.</p>
        </div>
        <PermissionGate permission="suppliers" editOnly>
          <Button onClick={() => { resetCreateForm(); setCreateOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> New Quotation
          </Button>
        </PermissionGate>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total",     value: stats?.total,             color: "text-slate-700" },
          { label: "Pending",   value: stats?.pending,           color: "text-slate-500" },
          { label: "Form Sent", value: stats?.formSent,          color: "text-blue-600" },
          { label: "Responded", value: stats?.responseReceived,  color: "text-green-600" },
          { label: "Negotiating",value: stats?.negotiating,      color: "text-amber-600" },
          { label: "Finalized", value: stats?.finalized,         color: "text-purple-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value ?? "—"}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search supplier, product, HS code…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No quotations yet</p>
            <p className="text-sm mt-1">Create your first quotation to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Supplier", "Product", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotations.map((q) => {
                const statusCfg = STATUS_CONFIG[q.status] ?? { label: q.status, class: "bg-slate-100 text-slate-700" };
                const formLink = q.formToken ? `${window.location.origin}/quotation-form/${q.formToken}` : null;
                return (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        className="font-medium text-slate-900 hover:text-brand-600 transition-colors text-left"
                        onClick={() => navigate(`/quotations/${q.id}`)}
                      >
                        {q.supplierName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{q.product ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.class}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(q.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {formLink && (
                          <Button
                            size="sm" variant="ghost"
                            title="Copy form link"
                            onClick={() => { copyToClipboard(formLink); toast.success("Form link copied"); }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {formLink && (
                          <Button size="sm" variant="ghost" title="Open supplier form in new tab"
                            onClick={() => window.open(formLink, "_blank")}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button size="sm" variant="ghost" title="Delete" onClick={() => setDeleteTarget(q)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50 text-sm text-slate-600">
            <span>
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Create Quotation Dialog ─────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetCreateForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>New Quotation</DialogTitle>
          <DialogDescription>
            Select a supplier and configure which fields will appear in the supplier's web form.
          </DialogDescription>

          <div className="space-y-5 pt-2">
            {/* Supplier autocomplete */}
            <div className="relative" ref={dropdownRef}>
              <Label className="mb-1.5 block">Supplier <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search existing suppliers…"
                  value={selectedSupplier ? selectedSupplier.company : supplierQuery}
                  onChange={(e) => {
                    setSelectedSupplier(null);
                    setSupplierQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => { if (supplierQuery) setShowDropdown(true); }}
                />
              </div>
              {showDropdown && supplierSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {supplierSuggestions.map((s) => (
                    <button
                      key={`${s.supplierType}-${s.id}`}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between"
                      onClick={() => {
                        setSelectedSupplier(s);
                        setSupplierQuery(s.company);
                        setShowDropdown(false);
                      }}
                    >
                      <span className="font-medium text-slate-800">{s.company}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.supplierType === "signed"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {s.supplierType === "signed" ? "Signed" : "New"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && supplierQuery.length > 0 && supplierSuggestions.length === 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm text-slate-400">
                  No suppliers found. The name will be used as entered.
                </div>
              )}
            </div>

            {/* Field configuration */}
            <div>
              <Label className="mb-2 block text-sm font-semibold">Form Field Configuration</Label>
              <p className="text-xs text-slate-500 mb-3">
                Choose which fields appear in the supplier's web form and which are mandatory.
                Fields not sent to the supplier can still be filled internally.
              </p>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Field</th>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-center w-32">Send to Supplier</th>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-center w-24">Mandatory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {QUOTATION_FIELDS.map((f) => {
                      const cfg = fieldConfig[f.key];
                      return (
                        <tr key={f.key} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 text-slate-700 font-medium">{f.label}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Switch
                              checked={cfg.sentToSupplier}
                              onCheckedChange={(v: boolean) => toggleSent(f.key, v)}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Switch
                              checked={cfg.mandatory}
                              disabled={!cfg.sentToSupplier}
                              onCheckedChange={(v: boolean) => toggleMandatory(f.key, v)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>
                Cancel
              </Button>
              <Button
                disabled={(!selectedSupplier && !supplierQuery.trim()) || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create & Get Form Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Form Link Dialog ────────────────────────── */}
      <Dialog open={formLinkDialog.open} onOpenChange={(o) => setFormLinkDialog((p) => ({ ...p, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogTitle>Quotation Form Created</DialogTitle>
          <DialogDescription>
            Share this link with <strong>{formLinkDialog.company}</strong> so they can fill in their quotation details.
          </DialogDescription>
          <div className="space-y-4 pt-2">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Form Link</p>
              <p className="text-sm text-slate-800 break-all font-mono">{formLinkDialog.link}</p>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 gap-2"
                onClick={() => { copyToClipboard(formLinkDialog.link); toast.success("Link copied"); }}
              >
                <Copy className="h-4 w-4" /> Copy Link
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => window.open(formLinkDialog.link, "_blank")}
              >
                <ExternalLink className="h-4 w-4" /> Preview
              </Button>
            </div>
            <p className="text-xs text-slate-400 text-center">
              <FileText className="h-3 w-3 inline mr-1" />
              Only fields marked "Send to Supplier" will appear in the form.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ──────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Quotation</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the quotation for <strong>{deleteTarget?.supplierName}</strong>? This cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
