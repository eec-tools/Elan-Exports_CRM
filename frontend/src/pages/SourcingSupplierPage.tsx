import { useState } from "react";
import { copyToClipboard } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Building2,
  Copy,
  CheckCircle2,
  Mail,
  ExternalLink,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";

interface SourcingSupplier {
  id: string;
  company: string;
  country?: string;
  product?: string;
  productCategory?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  notes?: string;
  status: string;
  assignedGmailAccount?: string | null;
  formToken?: string;
  emailCampaign?: {
    status: string;
    currentStep: number;
    nextFollowupDue?: string | null;
    introEmailSentAt?: string;
    followup1SentAt?: string;
    followup2SentAt?: string;
    followup3SentAt?: string;
  } | null;
  createdAt: string;
}

interface GmailAccount {
  email: string;
  connected: boolean;
  label: string;
}

interface Stats {
  total: number;
  activeCampaigns: number;
  responseReceived: number;
  converted: number;
  noResponse: number;
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending:           { label: "Pending",            class: "bg-slate-100 text-slate-700" },
  intro_sent:        { label: "Intro Sent",          class: "bg-blue-100 text-blue-700" },
  followup1_sent:    { label: "Follow-up 1 Sent",    class: "bg-amber-100 text-amber-700" },
  followup2_sent:    { label: "Follow-up 2 Sent",    class: "bg-orange-100 text-orange-700" },
  followup3_sent:    { label: "Follow-up 3 Sent",    class: "bg-red-100 text-red-700" },
  response_received: { label: "Responded",           class: "bg-green-100 text-green-700" },
  no_response:       { label: "No Response",         class: "bg-red-100 text-red-700" },
  converted_to_new:  { label: "Converted",           class: "bg-purple-100 text-purple-700" },
  converted:         { label: "Converted",           class: "bg-purple-100 text-purple-700" },
};

const CAMPAIGN_STEP_LABEL: Record<number, string> = {
  1: "Intro Sent",
  2: "Follow-up 1 Sent",
  3: "Follow-up 2 Sent",
  4: "Follow-up 3 Sent",
};

export default function SourcingSupplierPage() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission("suppliers") || hasEditPermission("sourcing_suppliers");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SourcingSupplier | null>(null);
  const [formLinkDialog, setFormLinkDialog] = useState<{ open: boolean; link: string; company: string; source: "created" | "campaign" }>({
    open: false,
    link: "",
    company: "",
    source: "created",
  });

  // Create form state
  const [form, setForm] = useState({ company: "", email: "", assignedGmailAccount: "" });
  const [createTemplateId, setCreateTemplateId] = useState<string>("");

  // ─── Queries ────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["sourcing-suppliers", search, page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        page: String(page),
        limit: "20",
        ...(statusFilter !== "all" && { status: statusFilter }),
      });
      const res = await api.get(`/sourcing-suppliers?${params}`);
      return res.data as { data: SourcingSupplier[]; pagination: { total: number; pages: number } };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["sourcing-suppliers-stats"],
    queryFn: async () => {
      const res = await api.get("/sourcing-suppliers/stats");
      return res.data as Stats;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["supplier-form-templates"],
    queryFn: async () => {
      const res = await api.get("/supplier-form-templates");
      return res.data as { id: string; name: string; isDefault: boolean }[];
    },
  });

  const { data: gmailAccounts = [] } = useQuery({
    queryKey: ["gmail-accounts"],
    queryFn: async () => {
      const res = await api.get("/gmail/accounts");
      return res.data as GmailAccount[];
    },
  });
  const connectedAccounts = gmailAccounts.filter((a) => a.connected);

  // ─── Mutations ──────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post("/sourcing-suppliers", data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers-stats"] });
      setCreateOpen(false);
      setForm({ company: "", email: "", assignedGmailAccount: "" });
      const created = res.data;
      if (created?.formToken) {
        const base = `${window.location.origin}/supplier-form/${created.formToken}`;
        const link = createTemplateId ? `${base}?t=${createTemplateId}` : base;
        setCreateTemplateId("");
        setFormLinkDialog({ open: true, link, company: created.company, source: "created" });
      } else {
        toast.success("Sourcing supplier created");
      }
    },
    onError: () => toast.error("Failed to create supplier"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sourcing-suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers-stats"] });
      setDeleteTarget(null);
      toast.success("Supplier deleted");
    },
    onError: () => toast.error("Failed to delete supplier"),
  });

  const startCampaignMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sourcing-campaigns/${id}/start`),
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers-stats"] });
      const supplier = data?.data.find((s) => s.id === id);
      toast.success(`Intro email sent to ${supplier?.company ?? "supplier"}`);
    },
    onError: () => toast.error("Failed to start campaign"),
  });

  const markSentMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sourcing-campaigns/${id}/send-followup`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers-stats"] });
      toast.success("Follow-up email sent");
    },
    onError: () => toast.error("Failed to send follow-up"),
  });

  const markResponseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sourcing-campaigns/${id}/mark-response`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers-stats"] });
      const newId = res.data?.newSupplierId;
      toast.success("Response recorded — supplier converted to New Supplier");
      if (newId) navigate(`/suppliers/new/${newId}`);
    },
    onError: () => toast.error("Failed to record response"),
  });


  // ─── Helpers ────────────────────────────────────────
  const copyFormLink = async (supplier: SourcingSupplier) => {
    if (!supplier.formToken) return;
    const link = `${window.location.origin}/supplier-form/${supplier.formToken}`;
    const success = await copyToClipboard(link);
    if (success) {
      toast.success("Form link copied to clipboard");
    } else {
      toast.error("Failed to copy link. Please copy it manually.");
    }
  };

  const isOverdue = (dateStr?: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) <= new Date();
  };

  const suppliers = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sourcing Suppliers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track outreach campaigns and manage supplier introduction forms</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/suppliers/form-templates")}>
            <LayoutTemplate className="h-4 w-4 mr-1.5" />
            Form Templates
          </Button>
          <PermissionGate permission="sourcing_suppliers" editOnly>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Sourcing Supplier
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-slate-700" },
            { label: "Active Campaigns", value: stats.activeCampaigns, color: "text-blue-700" },
            { label: "Responded", value: stats.responseReceived, color: "text-green-700" },
            { label: "Converted", value: stats.converted, color: "text-purple-700" },
            { label: "No Response", value: stats.noResponse, color: "text-red-700" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by company, email, product..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9"
          />
        </div>
        <select
          className="border border-slate-200 rounded-md text-sm px-3 h-9 bg-white text-slate-700"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Building2 className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium">No sourcing suppliers found</p>
            <p className="text-sm mt-1">Add your first supplier to start tracking outreach</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Company</th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Contact</th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Product</th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Status</th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Campaign</th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Next Follow-up</th>
                  <th className="text-right font-medium text-slate-500 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => {
                  const statusCfg = STATUS_CONFIG[s.status] ?? { label: s.status, class: "bg-slate-100 text-slate-700" };
                  const campaign = s.emailCampaign;
                  const due = campaign?.nextFollowupDue;
                  const overdue = isOverdue(due);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                      {/* Company */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/suppliers/sourcing/${s.id}`)}
                          className="font-medium text-slate-900 hover:text-brand-600 text-left"
                        >
                          {s.company}
                        </button>
                        {s.country && <div className="text-xs text-slate-400">{s.country}</div>}
                        {s.assignedGmailAccount && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-400 truncate max-w-35">{s.assignedGmailAccount}</span>
                          </div>
                        )}
                        {!s.assignedGmailAccount && s.status === "pending" && (
                          <div className="text-xs text-amber-500 mt-0.5">No email account</div>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{s.contactPerson ?? "—"}</div>
                        {s.email && <div className="text-xs text-slate-400">{s.email}</div>}
                      </td>

                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{s.product ?? "—"}</div>
                        {s.productCategory && <div className="text-xs text-slate-400">{s.productCategory}</div>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.class}`}>
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Campaign step */}
                      <td className="px-4 py-3 text-slate-500">
                        {campaign ? CAMPAIGN_STEP_LABEL[campaign.currentStep] ?? `Step ${campaign.currentStep}` : "—"}
                      </td>

                      {/* Next follow-up */}
                      <td className="px-4 py-3">
                        {due ? (
                          <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-slate-600"}`}>
                            {overdue ? "Overdue · " : ""}{new Date(due).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                          {/* Copy form link */}
                          {s.formToken && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => copyFormLink(s)}>
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              Form Link
                            </Button>
                          )}

                          {canEdit && (
                            <>
                              {/* Start campaign */}
                              {!campaign && s.status !== "converted" && s.status !== "converted_to_new" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`h-7 px-2 text-xs ${!s.assignedGmailAccount ? "opacity-50 cursor-not-allowed" : ""}`}
                                  title={!s.assignedGmailAccount ? "Assign a Gmail account first (open supplier details)" : "Send intro email"}
                                  onClick={() => {
                                    if (!s.assignedGmailAccount) {
                                      toast.error("No Gmail account assigned — open supplier details to set one");
                                      return;
                                    }
                                    startCampaignMutation.mutate(s.id);
                                  }}
                                  disabled={startCampaignMutation.isPending}
                                >
                                  <Mail className="h-3.5 w-3.5 mr-1" />
                                  Start
                                </Button>
                              )}

                              {/* Send next follow-up (only if campaign active and steps remain) */}
                              {campaign?.status === "active" && campaign.currentStep < 4 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`h-7 px-2 text-xs ${overdue ? "border-amber-400 text-amber-700 hover:bg-amber-50" : ""}`}
                                  onClick={() => markSentMutation.mutate(s.id)}
                                  disabled={markSentMutation.isPending}
                                >
                                  <Mail className="h-3.5 w-3.5 mr-1" />
                                  Send FU{campaign.currentStep}
                                </Button>
                              )}

                              {/* Mark responded — auto-converts to New Supplier */}
                              {campaign?.status === "active" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs border-green-400 text-green-700 hover:bg-green-50"
                                  onClick={() => markResponseMutation.mutate(s.id)}
                                  disabled={markResponseMutation.isPending}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  Responded
                                </Button>
                              )}

                              {/* Delete */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-red-500 hover:bg-red-50"
                                onClick={() => setDeleteTarget(s)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}

                          {/* View details */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => navigate(`/suppliers/sourcing/${s.id}`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
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

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.pages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Create Dialog ─────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Add Sourcing Supplier</DialogTitle>
          <DialogDescription>
            Fill in the required details. A supplier form link will be generated automatically.
          </DialogDescription>

          <div className="mt-3 space-y-3">
            <div>
              <Label>Company Name *</Label>
              <Input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                placeholder="e.g. Spice Farm India Pvt Ltd"
                className="mt-1"
                autoFocus
              />
            </div>

            <div>
              <Label>Supplier Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="supplier@example.com"
                className="mt-1"
              />
              <p className="text-xs text-slate-400 mt-1">Campaign emails (intro + follow-ups) will be sent to this address</p>
            </div>

            <div>
              <Label>Form Template</Label>
              <select
                value={createTemplateId}
                onChange={(e) => setCreateTemplateId(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md text-sm px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Default form</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Choose which sections the supplier sees in their form</p>
            </div>

            <div>
              <Label>Campaign Email Account *</Label>
              {connectedAccounts.length === 0 ? (
                <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  No Gmail accounts connected yet. Connect one in{" "}
                  <a href="/settings/gmail" className="underline font-medium">Gmail Settings</a> before starting campaigns.
                </div>
              ) : (
                <select
                  value={form.assignedGmailAccount}
                  onChange={(e) => setForm((f) => ({ ...f, assignedGmailAccount: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-md text-sm px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select sending account…</option>
                  {connectedAccounts.map((a) => (
                    <option key={a.email} value={a.email}>{a.email}</option>
                  ))}
                </select>
              )}
              <p className="text-xs text-slate-400 mt-1">All emails (intro + 3 follow-ups) will be sent from this account</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.company.trim() || !form.email.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Add Supplier
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Form Link Dialog ──────────────────────────── */}
      <Dialog open={formLinkDialog.open} onOpenChange={(v) => setFormLinkDialog((d) => ({ ...d, open: v }))}>
        <DialogContent className="max-w-md">
          <DialogTitle>{formLinkDialog.source === "created" ? "Supplier Added" : "Campaign Started"}</DialogTitle>
          <DialogDescription>
            {formLinkDialog.source === "created"
              ? <>Supplier <strong>{formLinkDialog.company}</strong> has been created. Copy the form link below and send it to the supplier — they'll fill in their own details.</>
              : <>Intro email marked as sent for <strong>{formLinkDialog.company}</strong>. Share the form link below so the supplier can fill in their details.</>
            }
          </DialogDescription>
          <div className="mt-3 flex gap-2">
            <Input readOnly value={formLinkDialog.link} className="text-xs font-mono" />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const success = await copyToClipboard(formLinkDialog.link);
                if (success) {
                  toast.success("Copied!");
                } else {
                  toast.error("Failed to copy link");
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setFormLinkDialog((d) => ({ ...d, open: false }))}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Supplier?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{deleteTarget?.company}</strong> and any associated campaign data. This action cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
