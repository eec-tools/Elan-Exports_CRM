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
  Users,
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
  createdBy?: string | null;
  creator?: { fullName: string } | null;
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
  pending: { label: "Pending", class: "bg-slate-100 text-slate-700" },
  intro_sent: { label: "Intro Sent", class: "bg-blue-100 text-blue-700" },
  followup1_sent: {
    label: "Follow-up 1 Sent",
    class: "bg-amber-100 text-amber-700",
  },
  followup2_sent: {
    label: "Follow-up 2 Sent",
    class: "bg-orange-100 text-orange-700",
  },
  followup3_sent: {
    label: "Follow-up 3 Sent",
    class: "bg-red-100 text-red-700",
  },
  response_received: {
    label: "Responded",
    class: "bg-green-100 text-green-700",
  },
  no_response: { label: "No Response", class: "bg-red-100 text-red-700" },
  converted_to_new: {
    label: "Converted",
    class: "bg-purple-100 text-purple-700",
  },
  // 'converted' is a legacy alias — same display as converted_to_new
  converted: { label: "Converted", class: "bg-purple-100 text-purple-700" },
};

// Deduplicated status options for the filter dropdown
const STATUS_FILTER_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "intro_sent", label: "Intro Sent" },
  { value: "followup1_sent", label: "Follow-up 1 Sent" },
  { value: "followup2_sent", label: "Follow-up 2 Sent" },
  { value: "followup3_sent", label: "Follow-up 3 Sent" },
  { value: "response_received", label: "Responded" },
  { value: "no_response", label: "No Response" },
  { value: "converted_to_new", label: "Converted" },
];

export default function SourcingSupplierPage() {
  const { hasEditPermission } = useAuth();
  const canEdit =
    hasEditPermission("suppliers") || hasEditPermission("sourcing_suppliers");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterContact, setFilterContact] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterSourcedBy, setFilterSourcedBy] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SourcingSupplier | null>(
    null,
  );

  const hasActiveFilters =
    statusFilter !== "all" ||
    filterCompany !== "all" ||
    filterContact !== "all" ||
    filterCountry !== "all" ||
    filterProduct !== "all" ||
    filterSourcedBy !== "all";

  function resetAllFilters() {
    setStatusFilter("all");
    setFilterCompany("all");
    setFilterContact("all");
    setFilterCountry("all");
    setFilterProduct("all");
    setFilterSourcedBy("all");
    setPage(1);
  }

  // From-folder create state
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedGmailAccount, setSelectedGmailAccount] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // ─── Queries ────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["sourcing-suppliers", search, page, statusFilter, filterCompany, filterContact, filterCountry, filterProduct, filterSourcedBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        page: String(page),
        limit: "20",
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(filterCompany !== "all" && { company: filterCompany }),
        ...(filterContact !== "all" && { contactPerson: filterContact }),
        ...(filterCountry !== "all" && { country: filterCountry }),
        ...(filterProduct !== "all" && { product: filterProduct }),
        ...(filterSourcedBy !== "all" && { createdBy: filterSourcedBy }),
      });
      const res = await api.get(`/sourcing-suppliers?${params}`);
      return res.data as {
        data: SourcingSupplier[];
        pagination: { total: number; pages: number };
      };
    },
  });

  // Fetch all suppliers (no filters) to derive unique dropdown values
  const { data: allSuppliersData } = useQuery({
    queryKey: ["sourcing-suppliers-all"],
    queryFn: async () => {
      const res = await api.get("/sourcing-suppliers?limit=9999");
      return res.data as { data: SourcingSupplier[] };
    },
  });
  const allSuppliers = allSuppliersData?.data ?? [];
  const uniqueCompanies = [...new Set(allSuppliers.map((s) => s.company).filter(Boolean))].sort();
  const uniqueContacts = [...new Set(allSuppliers.map((s) => s.contactPerson ?? "").filter(Boolean))].sort();
  const uniqueCountries = [...new Set(allSuppliers.map((s) => s.country ?? "").filter(Boolean))].sort();
  const uniqueProducts = [...new Set(allSuppliers.map((s) => s.product ?? "").filter(Boolean))].sort();
  const uniqueCreators = allSuppliers.reduce<{ id: string; name: string }[]>((acc, s) => {
    if (s.createdBy && s.creator?.fullName && !acc.find((x) => x.id === s.createdBy)) {
      acc.push({ id: s.createdBy, name: s.creator.fullName });
    }
    return acc;
  }, []).sort((a, b) => a.name.localeCompare(b.name));

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

  // ─── Vault folder queries (for create dialog) ──────
  const { data: vaultFolders = [] } = useQuery({
    queryKey: ["sourcing-vault-folders"],
    queryFn: async () => {
      const res = await api.get("/sourcing-vault");
      return res.data as { id: string; name: string; supplierCount: number }[];
    },
    enabled: createOpen,
  });

  const { data: notSentSuppliers = [], isLoading: notSentLoading } = useQuery({
    queryKey: ["vault-not-sent", selectedFolderId],
    queryFn: async () => {
      const res = await api.get(
        `/sourcing-suppliers/from-folder?folderId=${selectedFolderId}`,
      );
      return res.data as {
        id: string;
        company: string;
        email?: string;
        country?: string;
        product?: string;
      }[];
    },
    enabled: !!selectedFolderId && createOpen,
  });

  // ─── Mutations ──────────────────────────────────────
  const addFromFolderMutation = useMutation({
    mutationFn: () =>
      api.post("/sourcing-suppliers/from-folder", {
        folderId: selectedFolderId,
        assignedGmailAccount: selectedGmailAccount || undefined,
        formTemplateId: selectedTemplateId || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-vault-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-vault-folders"] });
      setCreateOpen(false);
      setSelectedFolderId("");
      setSelectedGmailAccount("");
      setSelectedTemplateId("");
      toast.success(
        `Added ${res.data.added} supplier${res.data.added !== 1 ? "s" : ""} to pipeline`,
      );
    },
    onError: () => toast.error("Failed to add suppliers"),
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
    mutationFn: (id: string) =>
      api.post(`/sourcing-campaigns/${id}/send-followup`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers-stats"] });
      toast.success("Follow-up email sent");
    },
    onError: () => toast.error("Failed to send follow-up"),
  });

  const markResponseMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/sourcing-campaigns/${id}/mark-response`),
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
          <h1 className="text-2xl font-bold text-slate-900">
            Sourcing Suppliers
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track outreach campaigns and manage supplier introduction forms
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/suppliers/form-templates")}
          >
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
            {
              label: "Active Campaigns",
              value: stats.activeCampaigns,
              color: "text-blue-700",
            },
            {
              label: "Responded",
              value: stats.responseReceived,
              color: "text-green-700",
            },
            {
              label: "Converted",
              value: stats.converted,
              color: "text-purple-700",
            },
            {
              label: "No Response",
              value: stats.noResponse,
              color: "text-red-700",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-slate-200 px-4 py-3"
            >
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        {/* Text search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by company, email, product..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9"
          />
        </div>

        {/* Column filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {uniqueCompanies.length > 0 && (
            <select
              value={filterCompany}
              onChange={(e) => { setFilterCompany(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Companies</option>
              {uniqueCompanies.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {uniqueContacts.length > 0 && (
            <select
              value={filterContact}
              onChange={(e) => { setFilterContact(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Contacts</option>
              {uniqueContacts.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {uniqueCountries.length > 0 && (
            <select
              value={filterCountry}
              onChange={(e) => { setFilterCountry(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Countries</option>
              {uniqueCountries.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {uniqueProducts.length > 0 && (
            <select
              value={filterProduct}
              onChange={(e) => { setFilterProduct(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Products</option>
              {uniqueProducts.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          <select
            className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Statuses</option>
            {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {uniqueCreators.length > 0 && (
            <select
              value={filterSourcedBy}
              onChange={(e) => { setFilterSourcedBy(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-md text-sm px-3 h-8 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Employees</option>
              {uniqueCreators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
            >
              <span className="text-base leading-none">&times;</span>
              Clear filters
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
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Building2 className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium">No sourcing suppliers found</p>
            <p className="text-sm mt-1">
              Add your first supplier to start tracking outreach
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left font-medium text-slate-500 px-4 py-3">
                    Company
                  </th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">
                    Contact
                  </th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">
                    Product
                  </th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">
                    Sourced By
                  </th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">
                    Status
                  </th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">
                    Next Follow-up
                  </th>
                  <th className="text-right font-medium text-slate-500 px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => {
                  const statusCfg = STATUS_CONFIG[s.status] ?? {
                    label: s.status,
                    class: "bg-slate-100 text-slate-700",
                  };
                  const campaign = s.emailCampaign;
                  const due = campaign?.nextFollowupDue;
                  const overdue = isOverdue(due);

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      {/* Company */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            navigate(`/suppliers/sourcing/${s.id}`)
                          }
                          className="font-medium text-slate-900 hover:text-brand-600 text-left"
                        >
                          {s.company}
                        </button>
                        {s.country && (
                          <div className="text-xs text-slate-400">
                            {s.country}
                          </div>
                        )}
                        {s.assignedGmailAccount && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-400 truncate max-w-35">
                              {s.assignedGmailAccount}
                            </span>
                          </div>
                        )}
                        {!s.assignedGmailAccount && s.status === "pending" && (
                          <div className="text-xs text-amber-500 mt-0.5">
                            No email account
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        <div className="text-slate-700">
                          {s.contactPerson ?? "—"}
                        </div>
                        {s.email && (
                          <div className="text-xs text-slate-400">
                            {s.email}
                          </div>
                        )}
                      </td>

                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{s.product ?? "—"}</div>
                        {s.productCategory && (
                          <div className="text-xs text-slate-400">
                            {s.productCategory}
                          </div>
                        )}
                      </td>

                      {/* Sourced By */}
                      <td className="px-4 py-3">
                        {s.creator ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <Users className="h-3 w-3 text-emerald-600" />
                            </div>
                            <span className="text-sm text-slate-700">
                              {s.creator.fullName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.class}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Next follow-up */}
                      <td className="px-4 py-3">
                        {due ? (
                          <span
                            className={`text-xs font-medium ${overdue ? "text-red-600" : "text-slate-600"}`}
                          >
                            {overdue ? "Overdue · " : ""}
                            {new Date(due).toLocaleDateString()}
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
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => copyFormLink(s)}
                            >
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              Form Link
                            </Button>
                          )}

                          {canEdit && (
                            <>
                              {/* Start campaign */}
                              {!campaign &&
                                s.status !== "converted" &&
                                s.status !== "converted_to_new" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={`h-7 px-2 text-xs ${!s.assignedGmailAccount ? "opacity-50 cursor-not-allowed" : ""}`}
                                    title={
                                      !s.assignedGmailAccount
                                        ? "Assign a Gmail account first (open supplier details)"
                                        : "Send intro email"
                                    }
                                    onClick={() => {
                                      if (!s.assignedGmailAccount) {
                                        toast.error(
                                          "No Gmail account assigned — open supplier details to set one",
                                        );
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
                              {campaign?.status === "active" &&
                                campaign.currentStep < 4 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={`h-7 px-2 text-xs ${overdue ? "border-amber-400 text-amber-700 hover:bg-amber-50" : ""}`}
                                    onClick={() =>
                                      markSentMutation.mutate(s.id)
                                    }
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
                                  onClick={() =>
                                    markResponseMutation.mutate(s.id)
                                  }
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
                            onClick={() =>
                              navigate(`/suppliers/sourcing/${s.id}`)
                            }
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
            Showing {(page - 1) * 20 + 1}–
            {Math.min(page * 20, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.pages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Create Dialog ─────────────────────────────── */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          if (!v) {
            setSelectedFolderId("");
            setSelectedGmailAccount("");
            setSelectedTemplateId("");
          }
          setCreateOpen(v);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>Add Sourcing Supplier</DialogTitle>
          <DialogDescription>
            Select a Sourcing Vault folder to pull in all "Not Sent" staged
            suppliers.
          </DialogDescription>

          <div className="mt-3 space-y-4">
            {/* Folder selector */}
            <div>
              <Label>Select Folder *</Label>
              <select
                value={selectedFolderId}
                onChange={(e) => {
                  setSelectedFolderId(e.target.value);
                }}
                className="mt-1 w-full border border-slate-200 rounded-md text-sm px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Choose a vault folder…</option>
                {vaultFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview of not-sent suppliers */}
            {selectedFolderId && (
              <div>
                <Label className="text-xs text-slate-500 uppercase tracking-wide">
                  Suppliers to be added
                </Label>
                {notSentLoading ? (
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-400 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : notSentSuppliers.length === 0 ? (
                  <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    No "Not Sent" suppliers in this folder. Use the Sourcing
                    Vault to add suppliers first.
                  </div>
                ) : (
                  <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
                    {notSentSuppliers.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {s.company}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {[s.email, s.country, s.product]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {notSentSuppliers.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    {notSentSuppliers.length} supplier
                    {notSentSuppliers.length !== 1 ? "s" : ""} will be added to
                    the pipeline
                  </p>
                )}
              </div>
            )}

            {/* Campaign Email Account */}
            <div>
              <Label>Campaign Email Account</Label>
              {connectedAccounts.length === 0 ? (
                <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  No Gmail accounts connected.{" "}
                  <a href="/settings/gmail" className="underline font-medium">
                    Connect one
                  </a>{" "}
                  before starting campaigns.
                </div>
              ) : (
                <select
                  value={selectedGmailAccount}
                  onChange={(e) => setSelectedGmailAccount(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-md text-sm px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select sending account (optional)…</option>
                  {connectedAccounts.map((a) => (
                    <option key={a.email} value={a.email}>
                      {a.email}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Form Template */}
            <div>
              <Label>Form Template</Label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md text-sm px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Default form</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Overrides the template used during vault staging
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !selectedFolderId ||
                notSentSuppliers.length === 0 ||
                notSentLoading ||
                addFromFolderMutation.isPending
              }
              onClick={() => addFromFolderMutation.mutate()}
            >
              {addFromFolderMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Add Supplier{notSentSuppliers.length > 1 ? "s" : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Supplier?</DialogTitle>
          <DialogDescription>
            This will permanently delete{" "}
            <strong>{deleteTarget?.company}</strong> and any associated campaign
            data. This action cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
