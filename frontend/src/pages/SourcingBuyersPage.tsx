import { useState } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
  Mail,
  Send,
  ExternalLink,
  CheckCircle2,
  Zap,
  UserSearch,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";
import BuyersTabBar from "@/components/BuyersTabBar";

const BUYER_GMAIL = "partners@eectrade.com";

interface SourcingBuyer {
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
  emailTemplateId?: string | null;
  emailCampaign?: {
    status: string;
    currentStep: number;
    nextFollowupDue?: string | null;
    introEmailSentAt?: string;
    followup1SentAt?: string;
    followup2SentAt?: string;
    followup3SentAt?: string;
  } | null;
  createdBy?: string | null;
  creator?: { fullName: string } | null;
  createdAt: string;
}

interface Stats {
  total: number;
  activeCampaigns: number;
  responseReceived: number;
  converted: number;
  noResponse: number;
  invalidEmails: number;
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending:           { label: "Pending",           class: "bg-slate-100 text-slate-700" },
  intro_sent:        { label: "Intro Sent",         class: "bg-blue-100 text-blue-700" },
  followup1_sent:    { label: "Follow-up 1 Sent",   class: "bg-amber-100 text-amber-700" },
  followup2_sent:    { label: "Follow-up 2 Sent",   class: "bg-orange-100 text-orange-700" },
  followup3_sent:    { label: "Follow-up 3 Sent",   class: "bg-red-100 text-red-700" },
  response_received: { label: "Responded",          class: "bg-green-100 text-green-700" },
  no_response:       { label: "No Response",        class: "bg-red-100 text-red-700" },
  converted_to_buyer:{ label: "Converted",          class: "bg-purple-100 text-purple-700" },
  invalid:           { label: "Invalid Email",      class: "bg-rose-100 text-rose-700" },
};

const STATUS_FILTER_OPTIONS = [
  { value: "pending_reply",      label: "Reply Pending" },
  { value: "pending",            label: "Pending" },
  { value: "intro_sent",         label: "Intro Sent" },
  { value: "followup1_sent",     label: "Follow-up 1 Sent" },
  { value: "followup2_sent",     label: "Follow-up 2 Sent" },
  { value: "followup3_sent",     label: "Follow-up 3 Sent" },
  { value: "response_received",  label: "Responded" },
  { value: "no_response",        label: "No Response" },
  { value: "converted_to_buyer", label: "Converted" },
  { value: "invalid",            label: "Invalid Email" },
];

export default function SourcingBuyersPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [runningScheduler, setRunningScheduler] = useState(false);
  const [retryingPending, setRetryingPending] = useState(false);

  const { data: gmailStatus } = useQuery({
    queryKey: ["buyer-gmail-status"],
    queryFn: async () => {
      const res = await api.get("/buyer-campaigns/admin/gmail-status");
      return res.data as { account: string; rateLimited: boolean; cooldownUntil: string | null };
    },
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  async function runSchedulerNow() {
    setRunningScheduler(true);
    try {
      await api.post("/buyer-campaigns/admin/run-scheduler");
      toast.success("Scheduler triggered — all overdue buyer follow-ups are being sent now.");
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["sourcing-buyers"] }), 3000);
    } catch {
      toast.error("Failed to trigger scheduler.");
    } finally {
      setRunningScheduler(false);
    }
  }

  async function retryPendingCampaigns() {
    setRetryingPending(true);
    try {
      const res = await api.post("/buyer-campaigns/admin/retry-pending");
      const { total } = res.data as { total: number };
      if (total === 0) {
        toast.info("No pending buyers without a campaign found.");
      } else {
        toast.success(`Sending intro emails to ${total} pending buyer${total !== 1 ? "s" : ""} in the background.`);
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["sourcing-buyers"] }), 5000);
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["sourcing-buyers"] }), 15000);
      }
    } catch {
      toast.error("Failed to retry pending campaigns.");
    } finally {
      setRetryingPending(false);
    }
  }

  // ─── Filter state ───────────────────────────────────
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterContact, setFilterContact] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterSourcedBy, setFilterSourcedBy] = useState("all");

  // ─── Dialog state ───────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"single" | "vault">("single");
  const [form, setForm] = useState({ company: "", email: "" });
  const [createEmailTemplateId, setCreateEmailTemplateId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SourcingBuyer | null>(null);
  const [confirmAction, setConfirmAction] = useState<"single" | "vault" | null>(null);

  // From-folder state
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState("");

  const hasActiveFilters =
    statusFilter !== "all" || filterCompany !== "all" || filterContact !== "all" ||
    filterCountry !== "all" || filterProduct !== "all" || filterSourcedBy !== "all";

  function resetAllFilters() {
    setStatusFilter("all"); setFilterCompany("all"); setFilterContact("all");
    setFilterCountry("all"); setFilterProduct("all"); setFilterSourcedBy("all");
    setPage(1);
  }

  // ─── Queries ────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["sourcing-buyers", search, page, statusFilter, filterCompany, filterContact, filterCountry, filterProduct, filterSourcedBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        search, page: String(page), limit: "20",
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(filterCompany !== "all" && { company: filterCompany }),
        ...(filterContact !== "all" && { contactPerson: filterContact }),
        ...(filterCountry !== "all" && { country: filterCountry }),
        ...(filterProduct !== "all" && { product: filterProduct }),
        ...(filterSourcedBy !== "all" && { createdBy: filterSourcedBy }),
      });
      const res = await api.get(`/sourcing-buyers?${params}`);
      return res.data as {
        data: SourcingBuyer[];
        pagination: { total: number; pages: number };
        pendingReplyIds: string[];
        pendingReplyInfo: { id: string; respondedAt: string }[];
      };
    },
  });

  const { data: allBuyersData } = useQuery({
    queryKey: ["sourcing-buyers-all"],
    queryFn: async () => {
      const res = await api.get("/sourcing-buyers?limit=9999");
      return res.data as { data: SourcingBuyer[] };
    },
  });
  const allBuyers = allBuyersData?.data ?? [];
  const uniqueCompanies = [...new Set(allBuyers.map((b) => b.company).filter(Boolean))].sort();
  const uniqueContacts  = [...new Set(allBuyers.map((b) => b.contactPerson ?? "").filter(Boolean))].sort();
  const uniqueCountries = [...new Set(allBuyers.map((b) => b.country ?? "").filter(Boolean))].sort();
  const uniqueProducts  = [...new Set(allBuyers.map((b) => b.product ?? "").filter(Boolean))].sort();
  const uniqueCreators  = allBuyers.reduce<{ id: string; name: string }[]>((acc, b) => {
    if (b.createdBy && b.creator?.fullName && !acc.find((x) => x.id === b.createdBy)) {
      acc.push({ id: b.createdBy, name: b.creator.fullName });
    }
    return acc;
  }, []).sort((a, b) => a.name.localeCompare(b.name));

  const { data: stats } = useQuery({
    queryKey: ["sourcing-buyers-stats"],
    queryFn: async () => {
      const res = await api.get("/sourcing-buyers/stats");
      return res.data as Stats;
    },
  });

  const { data: emailTemplates = [] } = useQuery({
    queryKey: ["buyer-email-campaign-templates"],
    queryFn: async () => {
      const res = await api.get("/buyer-email-templates");
      return res.data as { id: string; name: string; isDefault: boolean }[];
    },
  });

  const { data: vaultFolders = [] } = useQuery({
    queryKey: ["buyers-vault-folders"],
    queryFn: async () => {
      const res = await api.get("/buyers-vault");
      return res.data as { id: string; name: string; supplierCount: number }[];
    },
    enabled: createOpen,
  });

  const { data: notSentContacts = [], isLoading: notSentLoading } = useQuery({
    queryKey: ["buyer-vault-not-sent", selectedFolderId],
    queryFn: async () => {
      const res = await api.get(`/sourcing-buyers/from-folder?folderId=${selectedFolderId}`);
      return res.data as { id: string; company: string; email?: string; country?: string; product?: string }[];
    },
    enabled: !!selectedFolderId && createOpen,
  });

  // ─── Mutations ──────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: { company: string; email: string; emailTemplateId?: string }) =>
      api.post("/sourcing-buyers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers-all"] });
      setCreateOpen(false);
      setForm({ company: "", email: "" });
      setCreateEmailTemplateId("");
      toast.success("Sourcing buyer added and intro email sent via partners@eectrade.com");
    },
    onError: () => toast.error("Failed to create sourcing buyer"),
  });

  const addFromFolderMutation = useMutation({
    mutationFn: () =>
      api.post("/sourcing-buyers/from-folder", {
        folderId: selectedFolderId,
        emailTemplateId: selectedEmailTemplateId || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers-all"] });
      queryClient.invalidateQueries({ queryKey: ["buyers-vault-folders"] });
      setCreateOpen(false);
      setSelectedFolderId("");
      setSelectedEmailTemplateId("");
      const { added } = res.data as { added: number };
      toast.success(`${added} buyer${added !== 1 ? "s" : ""} added — intro emails being sent via partners@eectrade.com`);
    },
    onError: () => toast.error("Failed to add buyers from vault"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sourcing-buyers/${id}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers-stats"] });
      setDeleteTarget(null);
      const msg = res.data?.deletedFromVault
        ? "Buyer deleted from pipeline and Buyers Vault"
        : "Buyer deleted";
      toast.success(msg);
    },
    onError: () => toast.error("Failed to delete buyer"),
  });

  const startCampaignMutation = useMutation({
    mutationFn: (id: string) => api.post(`/buyer-campaigns/${id}/start`),
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers-stats"] });
      const buyer = data?.data.find((b) => b.id === id);
      toast.success(`Intro email sent to ${buyer?.company ?? "buyer"}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? "Failed to start campaign";
      toast.error(msg);
    },
  });

  const sendFollowupMutation = useMutation({
    mutationFn: (id: string) => api.post(`/buyer-campaigns/${id}/send-followup`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers-stats"] });
      toast.success("Follow-up email sent");
    },
    onError: () => toast.error("Failed to send follow-up"),
  });

  const markResponseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/buyer-campaigns/${id}/mark-response`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyers-stats"] });
      const newId = res.data?.newBuyerId;
      toast.success("Response recorded — buyer added to Buyers Directory");
      if (newId) navigate(`/buyers/${newId}`);
    },
    onError: () => toast.error("Failed to record response"),
  });

  const isOverdue = (dateStr?: string | null) => !!dateStr && new Date(dateStr) <= new Date();

  const buyers = data?.data ?? [];
  const pagination = data?.pagination;
  const pendingReplySet = new Set(data?.pendingReplyIds ?? []);
  const pendingReplyMap = new Map((data?.pendingReplyInfo ?? []).map((r) => [r.id, r.respondedAt]));

  const daysAgo = (dateStr?: string | null): number =>
    dateStr ? Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="p-6 space-y-6">
      <BuyersTabBar />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sourcing Buyers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Outreach campaigns to potential buyers · sent via{" "}
            <span className="font-medium text-slate-700">{BUYER_GMAIL}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline" size="sm"
            onClick={() => navigate("/buyers/email-templates")}
            className="gap-1.5 border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50"
          >
            <FileText className="h-4 w-4" />
            Email Templates
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="outline" size="sm"
                onClick={runSchedulerNow} disabled={runningScheduler}
                className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300"
              >
                {runningScheduler ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {runningScheduler ? "Sending…" : "Send Overdue Now"}
              </Button>
              <div className="flex flex-col items-end gap-0.5">
                <Button
                  variant="outline" size="sm"
                  onClick={retryPendingCampaigns}
                  disabled={retryingPending || !!gmailStatus?.rateLimited}
                  className="gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
                  title={gmailStatus?.rateLimited && gmailStatus.cooldownUntil
                    ? `Gmail rate limited — retry after ${new Date(gmailStatus.cooldownUntil).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
                    : undefined}
                >
                  {retryingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {retryingPending ? "Sending…" : "Retry Pending"}
                </Button>
                {gmailStatus?.rateLimited && gmailStatus.cooldownUntil && (
                  <span className="text-xs text-amber-600">
                    Rate limited · retry after {new Date(gmailStatus.cooldownUntil).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                  </span>
                )}
              </div>
            </>
          )}
          <PermissionGate permission="sourcing_buyers" editOnly>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Sourcing Buyer
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {[
            { label: "Total",            value: stats.total,            color: "text-slate-700" },
            { label: "Active Campaigns", value: stats.activeCampaigns,  color: "text-blue-700" },
            { label: "Responded",        value: stats.responseReceived, color: "text-green-700" },
            { label: "Converted",        value: stats.converted,        color: "text-purple-700" },
            { label: "No Response",      value: stats.noResponse,       color: "text-red-700" },
            { label: "Invalid Emails",   value: stats.invalidEmails,    color: "text-rose-700" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by company, email, product…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {uniqueCompanies.length > 0 && (
            <select value={filterCompany} onChange={(e) => { setFilterCompany(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="all">All Companies</option>
              {uniqueCompanies.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {uniqueContacts.length > 0 && (
            <select value={filterContact} onChange={(e) => { setFilterContact(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="all">All Contacts</option>
              {uniqueContacts.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {uniqueCountries.length > 0 && (
            <select value={filterCountry} onChange={(e) => { setFilterCountry(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="all">All Countries</option>
              {uniqueCountries.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {uniqueProducts.length > 0 && (
            <select value={filterProduct} onChange={(e) => { setFilterProduct(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="all">All Products</option>
              {uniqueProducts.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">All Statuses</option>
            {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {uniqueCreators.length > 0 && (
            <select value={filterSourcedBy} onChange={(e) => { setFilterSourcedBy(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="all">All Employees</option>
              {uniqueCreators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {hasActiveFilters && (
            <button onClick={resetAllFilters}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors">
              <span className="text-base leading-none">&times;</span> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : buyers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <UserSearch className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium">No sourcing buyers found</p>
            <p className="text-sm mt-1">Add your first buyer to start tracking outreach</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Company</th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Contact</th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Product</th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Sourced By</th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Status</th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">Next Follow-up</th>
                  <th className="text-right font-medium text-slate-500 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buyers.map((b) => {
                  const statusCfg = STATUS_CONFIG[b.status] ?? { label: b.status, class: "bg-slate-100 text-slate-700" };
                  const campaign = b.emailCampaign;
                  const due = campaign?.nextFollowupDue;
                  const overdue = isOverdue(due);
                  const replyPending = pendingReplySet.has(b.id);
                  const respondedAt = pendingReplyMap.get(b.id);
                  const daysSinceReply = daysAgo(respondedAt);

                  return (
                    <tr key={b.id} className={`transition-colors group ${replyPending && daysSinceReply >= 1 ? "bg-red-50 hover:bg-red-100" : replyPending ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-slate-50"}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/buyers/sourcing/${b.id}`)}
                          className="font-medium text-slate-900 hover:text-brand-600 text-left"
                        >
                          {b.company}
                        </button>
                        {b.country && <div className="text-xs text-slate-400">{b.country}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{b.contactPerson ?? "—"}</div>
                        {b.email && <div className="text-xs text-slate-400">{b.email}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{b.product ?? "—"}</div>
                        {b.productCategory && <div className="text-xs text-slate-400">{b.productCategory}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {b.creator ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Users className="h-3 w-3 text-blue-600" />
                            </div>
                            <span className="text-sm text-slate-700">{b.creator.fullName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.class}`}>
                            {statusCfg.label}
                          </span>
                          {replyPending && (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${daysSinceReply >= 1 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                              {daysSinceReply === 0 ? "Reply Pending · Today" : `Reply Pending · ${daysSinceReply}d`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {due ? (
                          <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-slate-600"}`}>
                            {overdue ? "Overdue · " : ""}
                            {new Date(due).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                          {/* Start campaign */}
                          {!campaign && b.status !== "converted_to_buyer" && b.status !== "no_response" && (
                            <Button
                              size="sm" variant="outline"
                              className={`h-7 px-2 text-xs ${!b.email ? "opacity-50 cursor-not-allowed" : ""}`}
                              title={!b.email ? "Add an email address first" : "Send intro email"}
                              onClick={() => {
                                if (!b.email) { toast.error("No email address — open buyer details to set one"); return; }
                                startCampaignMutation.mutate(b.id);
                              }}
                              disabled={startCampaignMutation.isPending}
                            >
                              <Mail className="h-3.5 w-3.5 mr-1" />
                              Start
                            </Button>
                          )}

                          {/* Send next follow-up */}
                          {campaign?.status === "active" && campaign.currentStep < 4 && (
                            <Button
                              size="sm" variant="outline"
                              className={`h-7 px-2 text-xs ${overdue ? "border-amber-400 text-amber-700 hover:bg-amber-50" : ""}`}
                              onClick={() => sendFollowupMutation.mutate(b.id)}
                              disabled={sendFollowupMutation.isPending}
                            >
                              <Mail className="h-3.5 w-3.5 mr-1" />
                              Send FU{campaign.currentStep}
                            </Button>
                          )}

                          {/* Mark responded */}
                          {campaign?.status === "active" && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 px-2 text-xs border-green-400 text-green-700 hover:bg-green-50"
                              onClick={() => markResponseMutation.mutate(b.id)}
                              disabled={markResponseMutation.isPending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Responded
                            </Button>
                          )}

                          {/* Delete */}
                          <PermissionGate permission="sourcing_buyers" editOnly>
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 px-2 text-xs text-red-500 hover:bg-red-50"
                              onClick={() => setDeleteTarget(b)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGate>

                          {/* View details */}
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => navigate(`/buyers/sourcing/${b.id}`)}
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
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
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

      {/* ── Create Dialog ────────────────────────────────── */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          if (!v) {
            setSelectedFolderId(""); setSelectedEmailTemplateId("");
            setForm({ company: "", email: "" }); setCreateEmailTemplateId("");
            setCreateMode("single");
          }
          setCreateOpen(v);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>Add Sourcing Buyer</DialogTitle>
          <DialogDescription className="sr-only">
            Add a single buyer or import from the Buyers Vault.
          </DialogDescription>

          {/* Gmail account notice */}
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-1">
            <Mail className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-xs text-blue-700">
              All buyer outreach emails are sent via{" "}
              <span className="font-semibold">{BUYER_GMAIL}</span> with its email signature.
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-slate-200 mt-3 mb-4">
            {(["single", "vault"] as const).map((mode) => (
              <button
                key={mode}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  createMode === mode
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => setCreateMode(mode)}
              >
                {mode === "single" ? "Single Buyer" : "From Buyers Vault"}
              </button>
            ))}
          </div>

          {createMode === "single" ? (
            <div className="space-y-3">
              <div>
                <Label>Company Name *</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="e.g. Global Foods GmbH"
                  className="mt-1" autoFocus
                />
              </div>
              <div>
                <Label>Buyer Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="buyer@example.com"
                  className="mt-1"
                />
                <p className="text-xs text-slate-400 mt-1">Campaign emails will be sent to this address</p>
              </div>
              <div>
                <Label>Email Template</Label>
                <select
                  value={createEmailTemplateId}
                  onChange={(e) => setCreateEmailTemplateId(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-md text-sm px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Default buyer outreach emails</option>
                  {emailTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (Default)" : ""}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Customise the intro and follow-up email content</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  disabled={!form.company.trim() || !form.email.trim() || createMutation.isPending}
                  onClick={() => setConfirmAction("single")}
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Add Buyer
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Select Buyers Vault Folder *</Label>
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-md text-sm px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Choose a vault folder…</option>
                  {vaultFolders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {selectedFolderId && (
                <div>
                  <Label className="text-xs text-slate-500 uppercase tracking-wide">Buyers to be added</Label>
                  {notSentLoading ? (
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-400 py-3">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : notSentContacts.length === 0 ? (
                    <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      No "Not Sent" contacts in this folder. Use the Buyers Vault to add contacts first.
                    </div>
                  ) : (
                    <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
                      {notSentContacts.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 truncate">{c.company}</p>
                            <p className="text-xs text-slate-400 truncate">
                              {[c.email, c.country, c.product].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {notSentContacts.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      {notSentContacts.length} buyer{notSentContacts.length !== 1 ? "s" : ""} will be added to the pipeline
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label>Email Template</Label>
                <select
                  value={selectedEmailTemplateId}
                  onChange={(e) => setSelectedEmailTemplateId(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-md text-sm px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Default buyer outreach emails</option>
                  {emailTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (Default)" : ""}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  disabled={!selectedFolderId || notSentContacts.length === 0 || notSentLoading || addFromFolderMutation.isPending}
                  onClick={() => setConfirmAction("vault")}
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Add Bulk Buyers
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirmation Dialog ──────────────────────────── */}
      <AlertDialog open={!!confirmAction} onOpenChange={(v) => !v && setConfirmAction(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-11 w-11 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <AlertDialogTitle className="text-base leading-snug">
                {confirmAction === "single"
                  ? "Add buyer & send intro email?"
                  : "Add buyers & start automation?"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600 pt-1">
                <p className="font-medium text-slate-700">
                  Clicking <strong>Confirm &amp; Send</strong> will:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>
                      {confirmAction === "single" ? (
                        <>Add <strong>{form.company}</strong> to the Sourcing Buyers pipeline</>
                      ) : (
                        <>Add <strong>{notSentContacts.length} buyer{notSentContacts.length !== 1 ? "s" : ""}</strong> to the pipeline</>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>
                      Send intro email{confirmAction === "vault" ? "s" : ""} <strong>immediately</strong> via{" "}
                      <strong>{BUYER_GMAIL}</strong> with its email signature
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>Start the email automation sequence — 3 follow-ups sent automatically</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>When a buyer responds, they are added to the Buyers Directory</span>
                  </li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={createMutation.isPending || addFromFolderMutation.isPending}
              onClick={() => {
                if (confirmAction === "single") {
                  createMutation.mutate({ company: form.company, email: form.email, emailTemplateId: createEmailTemplateId || undefined });
                } else {
                  addFromFolderMutation.mutate();
                }
                setConfirmAction(null);
              }}
            >
              {(createMutation.isPending || addFromFolderMutation.isPending)
                ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                : <Send className="h-4 w-4 mr-1.5" />}
              Confirm &amp; Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Confirm ───────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Buyer?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{deleteTarget?.company}</strong> and any associated campaign data.
            If a matching entry exists in the Buyers Vault it will also be removed. This cannot be undone.
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
