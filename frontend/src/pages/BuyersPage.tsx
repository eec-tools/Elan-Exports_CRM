import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  Building2,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  Mail,
  MapPin,
  X
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";

interface Buyer {
  id: string;
  company: string;
  name: string;
  email: string;
  phone?: string;
  country: string;
  address?: string;
  website?: string;
  region?: string;
  productCategoryInterest?: string;
  moqRequirements?: string;
  pricingRange?: string;
  certificationRequirements?: string;
  paymentTerms?: string;
  incoterms?: string;
  riskRating?: string;
  strategicValue?: string;
  leadSource?: string;
  lastContactDate?: string;
  dealHistory?: string;
  notes?: string;
  status?: string;
  requiredProducts?: { name: string; current_requirement: boolean }[];
}

const EMPTY_BUYER: Partial<Buyer> = {
  company: "",
  name: "",
  email: "",
  phone: "",
  country: "",
  status: "Pending",
};

export default function BuyersPage() {
  const { hasEditPermission } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = hasEditPermission("buyers");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<Partial<Buyer> | null>(null);
  const [form, setForm] = useState<Partial<Buyer>>(EMPTY_BUYER);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [buyerToDelete, setBuyerToDelete] = useState<Buyer | null>(null);

  const { data: buyersData, isLoading } = useQuery({
    queryKey: ["buyers", search, statusFilter, page],
    queryFn: () =>
      api
        .get("/buyers", {
          params: { search, status: statusFilter !== "all" ? statusFilter : undefined, page, limit: 20 },
        })
        .then((r) => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ["buyer-stats"],
    queryFn: () => api.get("/buyers/stats").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Buyer>) => api.post("/buyers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDialogOpen(false);
      toast.success("Buyer created successfully");
    },
    onError: () => toast.error("Failed to create buyer"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Buyer> }) =>
      api.put(`/buyers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-stats"] });
      setDialogOpen(false);
      toast.success("Buyer updated successfully");
    },
    onError: () => toast.error("Failed to update buyer"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/buyers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Buyer deleted");
    },
    onError: () => toast.error("Failed to delete buyer"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBuyer?.id) {
      updateMutation.mutate({ id: editingBuyer.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openCreate = () => {
    setEditingBuyer(null);
    setForm(EMPTY_BUYER);
    setDialogOpen(true);
  };

  const openEdit = (buyer: Buyer) => {
    setEditingBuyer(buyer);
    setForm({
      ...buyer,
      // Ensure null fields are empty strings for controlled inputs
      phone: buyer.phone || "",
      region: buyer.region || "",
      riskRating: buyer.riskRating || "",
      strategicValue: buyer.strategicValue || "",
      leadSource: buyer.leadSource || "",
      paymentTerms: buyer.paymentTerms || "",
      incoterms: buyer.incoterms || "",
      notes: buyer.notes || "",
    });
    setDialogOpen(true);
  };

  const handleExport = async () => {
    try {
      const res = await api.get("/buyers/export/csv", {
        params: { search },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `buyers_export.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } catch {
      toast.error("Export failed");
    }
  };

  const buyers: Buyer[] = buyersData?.data ?? [];
  const pagination = buyersData?.pagination;

  const statusStyles = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "text-brand-700 bg-brand-100 border-brand-200";
      case "pending":
        return "text-amber-700 bg-amber-100 border-amber-200";
      case "suspended":
        return "text-rose-700 bg-rose-100 border-rose-200";
      default:
        return "text-slate-600 bg-slate-100 border-slate-200";
    }
  };

  const StatusIcon = ({ status, className }: { status?: string, className?: string }) => {
    switch (status?.toLowerCase()) {
      case "active": return <CheckCircle2 className={className} />;
      case "pending": return <Loader2 className={className} />;
      case "suspended": return <PauseCircle className={className} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-500" />
            Buyer Directory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your buyer contacts, relationships, and regional data.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2 bg-white hover:bg-slate-50 text-slate-700 shadow-sm border-slate-200 h-9">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <PermissionGate permission="buyers" editOnly>
            <Button onClick={openCreate} className="gap-2 bg-brand-600 hover:bg-brand-700 text-white shadow-sm h-9">
              <Plus className="h-4 w-4" /> Add Buyer
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-5">
        {[
          { icon: <Users className="h-5 w-5 text-blue-600" />, label: "Total Buyers", value: stats?.total ?? 0, bg: "bg-blue-50" },
          { icon: <CheckCircle2 className="h-5 w-5 text-brand-600" />, label: "Active", value: stats?.active ?? 0, bg: "bg-brand-50" },
          { icon: <Loader2 className="h-5 w-5 text-amber-600" />, label: "Pending", value: stats?.pending ?? 0, bg: "bg-amber-50" },
          { icon: <PauseCircle className="h-5 w-5 text-rose-600" />, label: "Suspended", value: stats?.suspended ?? 0, bg: "bg-rose-50" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-100 bg-white p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className={`rounded-lg p-2.5 ${s.bg}`}>{s.icon}</div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className="text-xl font-bold text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-2 text-slate-400 border-r border-slate-100 pr-4 mr-1 hidden sm:flex">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-semibold text-slate-600">Filters</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search companies, names, emails..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 bg-slate-50 border-slate-200 focus:bg-white focus:ring-brand-500/20 focus:border-brand-500 text-sm"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
          >
            <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-sm focus:ring-brand-500/20 min-w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>

          {(search || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(""); setStatusFilter("all"); setPage(1); }}
              className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 h-9 px-2 gap-1 ml-auto"
            >
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Main Data Table ── */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left border-collapse min-w-max">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="px-5 py-3.5 font-semibold w-[35%]">Company & Contact</th>
                <th className="px-5 py-3.5 font-semibold w-[25%]">Contact Info</th>
                <th className="px-5 py-3.5 font-semibold">Location</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                {canEdit && <th className="px-5 py-3.5 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading && buyers.length === 0 ? (
                 <tr>
                 <td colSpan={canEdit ? 5 : 4} className="h-32 text-center">
                   <div className="flex justify-center">
                     <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                   </div>
                 </td>
               </tr>
              ) : buyers.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-5 py-16 text-center shadow-[inset_0_1px_0_#f1f5f9]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2">
                        <Users className="h-6 w-6 text-slate-300" />
                      </div>
                      <p className="text-slate-600 font-medium text-base">No buyers found</p>
                      <p className="text-slate-400 text-sm max-w-[250px]">
                        {(search || statusFilter !== "all") ? "Try adjusting your search or filters." : "You have not added any buyers yet."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                buyers.map((buyer) => (
                  <tr key={buyer.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-900 truncate tracking-tight">{buyer.company}</span>
                          <span className="text-slate-500 text-sm truncate flex items-center gap-1.5 mt-0.5">
                            {buyer.name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-slate-600 text-[13px] truncate">
                           <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                           <a href={`mailto:${buyer.email}`} className="hover:text-brand-600 truncate">{buyer.email}</a>
                        </div>
                        {buyer.phone && (
                           <div className="text-slate-500 text-[13px] pl-5 truncate">
                             {buyer.phone}
                           </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                       <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          {buyer.country}
                          {buyer.region && <span className="text-slate-400 text-xs ml-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{buyer.region}</span>}
                       </div>
                    </td>
                    <td className="px-5 py-3.5">
                       <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyles(buyer.status)} capitalize`}>
                          <StatusIcon status={buyer.status} className="h-3 w-3 mr-1.5" />
                          {buyer.status || "Pending"}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3.5 text-right font-medium">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                            onClick={() => openEdit(buyer)}
                            title="Edit Buyer"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              setBuyerToDelete(buyer);
                              setDeleteDialogOpen(true);
                            }}
                            title="Delete Buyer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.pages > 1 && (
          <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium px-2">
              Showing page <span className="text-slate-900">{pagination.page}</span> of <span className="text-slate-900">{pagination.pages}</span> <span className="text-slate-400">({pagination.total} buyers)</span>
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600 hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600 hover:bg-slate-100">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Creates / Edit Modal ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-white rounded-xl shadow-2xl border-none custom-scrollbar-light">
          <div className="flex items-center gap-4 mb-2">
             <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0 border border-brand-200">
                 <Building2 className="h-5 w-5 text-brand-600" />
             </div>
             <div>
                 <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                   {editingBuyer?.id ? "Edit Buyer Profile" : "Register New Buyer"}
                 </DialogTitle>
                 <DialogDescription className="text-slate-500 mt-1">
                   Fill in the details below to {editingBuyer?.id ? "update the" : "create a new"} buyer record.
                 </DialogDescription>
             </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
             {/* Base Info Group */}
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Primary Contact Info</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-slate-700">Company Name *</Label>
                    <Input
                      autoFocus
                      className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-700">Contact Person *</Label>
                    <Input
                      className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-700">Email Address *</Label>
                    <Input
                      type="email"
                      className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-700">Phone</Label>
                    <Input
                      className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                      value={form.phone ?? ""}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>
             </div>

             {/* Location & Status Group */}
             <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                 <div className="space-y-1.5">
                  <Label className="text-slate-700">Country *</Label>
                  <Input
                    className="border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Region</Label>
                  <Select
                    value={form.region ?? ""}
                    onValueChange={(v) => setForm({ ...form, region: v })}
                  >
                    <SelectTrigger className="border-slate-200 focus:ring-brand-500/20">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EU">EU</SelectItem>
                      <SelectItem value="UK">UK</SelectItem>
                      <SelectItem value="US">US</SelectItem>
                      <SelectItem value="ME">Middle East</SelectItem>
                      <SelectItem value="Asia">Asia</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Status</Label>
                  <Select
                    value={form.status ?? "Pending"}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger className="border-slate-200 focus:ring-brand-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
             </div>

            {/* Business Details */}
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 mt-6">Business Intelligence</h3>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Risk Rating</Label>
                  <Select
                    value={form.riskRating ?? ""}
                    onValueChange={(v) => setForm({ ...form, riskRating: v })}
                  >
                    <SelectTrigger className="border-slate-200 focus:ring-brand-500/20">
                      <SelectValue placeholder="Select risk" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Strategic Value</Label>
                  <Select
                    value={form.strategicValue ?? ""}
                    onValueChange={(v) => setForm({ ...form, strategicValue: v })}
                  >
                    <SelectTrigger className="border-slate-200 focus:ring-brand-500/20">
                      <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Lead Source</Label>
                  <Input
                    className="border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                    placeholder="e.g. Trade Show, Referral"
                    value={form.leadSource ?? ""}
                    onChange={(e) => setForm({ ...form, leadSource: e.target.value }) }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Incoterms</Label>
                  <Select
                    value={form.incoterms ?? ""}
                    onValueChange={(v) => setForm({ ...form, incoterms: v })}
                  >
                    <SelectTrigger className="border-slate-200 focus:ring-brand-500/20">
                      <SelectValue placeholder="Select incoterm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXW">EXW</SelectItem>
                      <SelectItem value="FOB">FOB</SelectItem>
                      <SelectItem value="CIF">CIF</SelectItem>
                      <SelectItem value="DAP">DAP</SelectItem>
                      <SelectItem value="DDP">DDP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-slate-700">Payment Terms</Label>
                  <Input
                    className="border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                    placeholder="e.g. 50% Advance, 50% LC"
                    value={form.paymentTerms ?? ""}
                    onChange={(e) => setForm({ ...form, paymentTerms: e.target.value }) }
                  />
                </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700">Additional Notes</Label>
              <Textarea
                className="border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                placeholder="Any special requirements, past history, or observations..."
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {editingBuyer?.id ? "Save Changes" : "Create Buyer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setBuyerToDelete(null); }}>
          <DialogContent className="sm:max-w-md p-6 bg-white rounded-xl shadow-2xl border-none">
              <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-6 w-6 text-rose-600" />
                  </div>
                  <div>
                      <DialogTitle className="text-lg font-bold text-slate-900">Delete Buyer</DialogTitle>
                      <DialogDescription className="text-slate-500 mt-1">This will permanently remove the record.</DialogDescription>
                  </div>
              </div>
              {buyerToDelete?.company && (
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100 mb-6 font-medium">
                      Company: <span className="font-bold">{buyerToDelete.company}</span>
                  </p>
              )}
              <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
                      Cancel
                  </Button>
                  <Button 
                     variant="destructive" 
                     className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200"
                     onClick={() => {
                      if (buyerToDelete) {
                        deleteMutation.mutate(buyerToDelete.id);
                      }
                      setDeleteDialogOpen(false);
                      setBuyerToDelete(null);
                    }}
                   >
                      Yes, delete buyer
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
