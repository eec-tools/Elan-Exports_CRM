import { useState } from "react";
import { Link } from "react-router-dom";
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
  X,
  Upload,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";
import { Separator } from "@/components/ui/separator";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { SelectWithOthers } from "@/components/SelectWithOthers";
import { EntityLinkSelect } from "@/components/EntityLinkSelect";
import type { EntityOption } from "@/components/EntityLinkSelect";

interface SourcingRequirement {
  id: string;
  product: string;
  productVariant: string;
  countryOfOriginPreferred: string;
  organicConventional: string;
  quantityRequired: string;
  frequency: string;
  targetPrice: string;
  currency: string;
  packagingRequirements: string;
  labellingRequirements: string;
  deliveryPort: string;
  incotermPreferred: string;
  sampleRequired: string;
  sampleQuantity: string;
  deadlineToReceiveSamples: string;
  expectedFirstDeliveryDate: string;
  qualityParameters: string;
  requiredCertifications: string;
}

interface AdditionalContact {
  name: string;
  role: string;
  phone: string;
  whatsapp: string;
  email: string;
  isPrimary: boolean;
}

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
  // New fields
  tradeName?: string;
  buyerType?: string;
  city?: string;
  whatsapp?: string;
  contactRole?: string;
  additionalContacts?: AdditionalContact[];
  productCategories?: string;
  marketsServed?: string;
  annualImportVolume?: string;
  annualPurchaseValue?: string;
  currentSuppliersOrigins?: string;
  sourcingRequirements?: SourcingRequirement[];
  preferredCurrency?: string;
  shippingMode?: string;
  portsOfDischarge?: string;
  countryOfFinalDelivery?: string;
  freightForwarder?: string;
  packingRequirements?: string;
  socialEthicalCompliance?: string;
  howHeardAboutUs?: string;
  tradeFairName?: string;
  productCatalog?: string;
  supplierLinks?: { id: string; type: "new" | "signed" }[];
}

const EMPTY_SOURCING_REQ = (): SourcingRequirement => ({
  id: String(Date.now() + Math.random()),
  product: "", productVariant: "", countryOfOriginPreferred: "", organicConventional: "",
  quantityRequired: "", frequency: "", targetPrice: "", currency: "",
  packagingRequirements: "", labellingRequirements: "", deliveryPort: "",
  incotermPreferred: "", sampleRequired: "", sampleQuantity: "",
  deadlineToReceiveSamples: "", expectedFirstDeliveryDate: "",
  qualityParameters: "", requiredCertifications: "",
});

const EMPTY_CONTACT = (): AdditionalContact => ({
  name: "", role: "", phone: "", whatsapp: "", email: "", isPrimary: false,
});

const EMPTY_BUYER: Partial<Buyer> = {
  company: "",
  name: "",
  email: "",
  phone: "",
  country: "",
  status: "Pending",
  additionalContacts: [],
  sourcingRequirements: [],
  supplierLinks: [],
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
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [quotationFiles, setQuotationFiles] = useState<File[]>([]);

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

  const { data: newSuppliersListData, isLoading: newSuppLoading } = useQuery<{ id: string; company: string; type: "new" }[]>({
    queryKey: ["new-suppliers-list"],
    queryFn: () => api.get("/new-suppliers/list").then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: signedSuppliersListData, isLoading: signedSuppLoading } = useQuery<{ id: string; company: string; type: "signed" }[]>({
    queryKey: ["suppliers-list"],
    queryFn: () => api.get("/suppliers/list").then((r) => r.data),
    staleTime: 60_000,
  });

  const suppliersListLoading = newSuppLoading || signedSuppLoading;

  const allSupplierOptions: EntityOption[] = [
    ...(newSuppliersListData ?? []).map((s) => ({ id: s.id, label: `${s.company} (New)`, type: "new" as const })),
    ...(signedSuppliersListData ?? []).map((s) => ({ id: s.id, label: `${s.company} (Signed)`, type: "signed" as const })),
  ];

  const createMutation = useMutation({
    mutationFn: (data: Partial<Buyer>) => api.post("/buyers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["buyers-list"] });
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
      queryClient.invalidateQueries({ queryKey: ["new-supplier"] });
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
      queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
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

  const uploadCatalogMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/buyers/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onError: () => toast.error("Failed to upload product catalog"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let catalogUrl = form.productCatalog;
    if (catalogFile) {
      try {
        const uploadRes = await uploadCatalogMutation.mutateAsync(catalogFile);
        catalogUrl = uploadRes.url;
      } catch {
        return;
      }
    }
    const finalQuotations = [...((form as any).quotations || [])];
    if (quotationFiles.length > 0) {
      for (const file of quotationFiles) {
        try {
          const uploadRes = await uploadCatalogMutation.mutateAsync(file);
          finalQuotations.push({ name: file.name, url: uploadRes.url });
        } catch (error) { console.error('Upload failed', error); }
      }
    }

    const payload = { ...form, productCatalog: catalogUrl, quotations: finalQuotations };
    if (editingBuyer?.id) {
      updateMutation.mutate({ id: editingBuyer.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreate = () => {
    setEditingBuyer(null);
    setForm(EMPTY_BUYER);
    setCatalogFile(null);
    setQuotationFiles([]);
    setDialogOpen(true);
  };

  const openEdit = (buyer: Buyer) => {
    setEditingBuyer(buyer);
    setForm({
      ...buyer,
      phone: buyer.phone || "",
      region: buyer.region || "",
      riskRating: buyer.riskRating || "",
      strategicValue: buyer.strategicValue || "",
      leadSource: buyer.leadSource || "",
      paymentTerms: buyer.paymentTerms || "",
      incoterms: buyer.incoterms || "",
      notes: buyer.notes || "",
      additionalContacts: buyer.additionalContacts || [],
      sourcingRequirements: buyer.sourcingRequirements || [],
    });
    setCatalogFile(null);
    setQuotationFiles([]);
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

  // Sourcing requirements helpers
  const addSourcingReq = () => {
    setForm((f) => ({ ...f, sourcingRequirements: [...(f.sourcingRequirements || []), EMPTY_SOURCING_REQ()] }));
  };
  const removeSourcingReq = (idx: number) => {
    setForm((f) => ({ ...f, sourcingRequirements: (f.sourcingRequirements || []).filter((_, i) => i !== idx) }));
  };
  const updateSourcingReq = (idx: number, field: keyof SourcingRequirement, value: string) => {
    setForm((f) => {
      const next = [...(f.sourcingRequirements || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...f, sourcingRequirements: next };
    });
  };

  // Additional contacts helpers
  const addContact = () => {
    setForm((f) => ({ ...f, additionalContacts: [...(f.additionalContacts || []), EMPTY_CONTACT()] }));
  };
  const removeContact = (idx: number) => {
    setForm((f) => ({ ...f, additionalContacts: (f.additionalContacts || []).filter((_, i) => i !== idx) }));
  };
  const updateContact = (idx: number, field: keyof AdditionalContact, value: string | boolean) => {
    setForm((f) => {
      const next = [...(f.additionalContacts || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...f, additionalContacts: next };
    });
  };

  const buyers: Buyer[] = buyersData?.data ?? [];
  const pagination = buyersData?.pagination;

  const statusStyles = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "active": return "text-brand-700 bg-brand-100 border-brand-200";
      case "pending": return "text-amber-700 bg-amber-100 border-amber-200";
      case "suspended": return "text-rose-700 bg-rose-100 border-rose-200";
      default: return "text-slate-600 bg-slate-100 border-slate-200";
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
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 bg-slate-50 border-slate-200 focus:bg-white focus:ring-brand-500/20 focus:border-brand-500 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setPage(1); }} className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 h-9 px-2 gap-1 ml-auto">
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
                <tr><td colSpan={canEdit ? 5 : 4} className="h-32 text-center"><div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div></td></tr>
              ) : buyers.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-5 py-16 text-center shadow-[inset_0_1px_0_#f1f5f9]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2"><Users className="h-6 w-6 text-slate-300" /></div>
                      <p className="text-slate-600 font-medium text-base">No buyers found</p>
                      <p className="text-slate-400 text-sm max-w-[250px]">{(search || statusFilter !== "all") ? "Try adjusting your search or filters." : "You have not added any buyers yet."}</p>
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
                          <Link to={`/buyers/${buyer.id}`} className="font-semibold text-brand-700 hover:text-brand-900 hover:underline truncate tracking-tight">
                            {buyer.company}
                          </Link>
                          <span className="text-slate-500 text-sm truncate flex items-center gap-1.5 mt-0.5">{buyer.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-slate-600 text-[13px] truncate">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <a href={`mailto:${buyer.email}`} className="hover:text-brand-600 truncate">{buyer.email}</a>
                        </div>
                        {buyer.phone && <div className="text-slate-500 text-[13px] pl-5 truncate">{buyer.phone}</div>}
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-brand-600 hover:bg-brand-50" onClick={() => openEdit(buyer)} title="Edit Buyer">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => { setBuyerToDelete(buyer); setDeleteDialogOpen(true); }} title="Delete Buyer">
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

        {pagination && pagination.pages > 1 && (
          <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium px-2">
              Showing page <span className="text-slate-900">{pagination.page}</span> of <span className="text-slate-900">{pagination.pages}</span> <span className="text-slate-400">({pagination.total} buyers)</span>
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6 bg-white rounded-xl shadow-2xl border-none">
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

            {/* ── Section 1: Company Profile ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Company Profile</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Company Legal Name *</Label><Input value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Trade / Brand Name</Label><Input value={form.tradeName ?? ""} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} placeholder="If different from the legal name e.g. Nike, ZARA" maxLength={80} /></div>
              <div className="space-y-2"><Label>Buyer Type</Label><SelectWithOthers value={form.buyerType ?? ""} onChange={(v) => setForm({ ...form, buyerType: v })} options={["Wholesaler","Retailer","Importer / Distributor","E-Commerce","Supermarket Chain","Private Label Brand","Trader","Food Service / HoReCa"]} placeholder="Select buyer type…" /></div>
              <div className="space-y-2"><Label>Country of Registration *</Label><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} required /></div>
              <div className="space-y-2"><Label>City</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div className="space-y-2"><Label>Region</Label><SelectWithOthers value={form.region ?? ""} onChange={(v) => setForm({ ...form, region: v })} options={["EU","UK","US","Middle East","Asia","Africa","Latin America","Australia / NZ"]} placeholder="Select region…" /></div>
              <div className="space-y-2"><Label>Website</Label><Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
              <div className="space-y-2"><Label>Status</Label>
                <Select value={form.status ?? "Pending"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2"><Label>Registered / Business Address</Label><Textarea value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></div>
            </div></div>

            <Separator />

            {/* ── Section 2: Key Contacts ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Key Contacts</p>
            <p className="text-xs text-slate-400 mb-3">Primary contact</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Contact Name *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Role / Designation</Label><Input value={form.contactRole ?? ""} onChange={(e) => setForm({ ...form, contactRole: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email Address *</Label><Input type="text" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Phone (with country code)</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>WhatsApp</Label><Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="With country code" /></div>
            </div>

            {/* Additional Contacts */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 font-medium">Additional Contacts</p>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addContact}>
                  <Plus className="h-3 w-3" /> Add Contact
                </Button>
              </div>
              {(form.additionalContacts || []).length > 0 && (
                <div className="rounded-md border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50"><tr>
                      <th className="px-2 py-2 text-left font-medium text-slate-500">Name</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-500">Role</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-500">Phone</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-500">WhatsApp</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-500">Email</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-500">Primary?</th>
                      <th className="px-2 py-2"></th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {(form.additionalContacts || []).map((c, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5"><Input className="h-7 text-xs border-slate-200" value={c.name} onChange={(e) => updateContact(i, "name", e.target.value)} /></td>
                          <td className="px-2 py-1.5"><Input className="h-7 text-xs border-slate-200" value={c.role} onChange={(e) => updateContact(i, "role", e.target.value)} /></td>
                          <td className="px-2 py-1.5"><Input className="h-7 text-xs border-slate-200" value={c.phone} onChange={(e) => updateContact(i, "phone", e.target.value)} /></td>
                          <td className="px-2 py-1.5"><Input className="h-7 text-xs border-slate-200" value={c.whatsapp} onChange={(e) => updateContact(i, "whatsapp", e.target.value)} /></td>
                          <td className="px-2 py-1.5"><Input className="h-7 text-xs border-slate-200" value={c.email} onChange={(e) => updateContact(i, "email", e.target.value)} /></td>
                          <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={c.isPrimary} onChange={(e) => updateContact(i, "isPrimary", e.target.checked)} /></td>
                          <td className="px-2 py-1.5"><button type="button" onClick={() => removeContact(i)} className="text-slate-400 hover:text-rose-600"><X className="h-4 w-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div></div>

            <Separator />

            {/* ── Section 3: Current Product Portfolio ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Current Product Portfolio</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Product Categories You Currently Deal In</Label><MultiSelectDropdown value={form.productCategories ?? ""} onChange={(v) => setForm({ ...form, productCategories: v })} options={["Rice","Millet / Grains","Honey","Spices","Pulses / Lentils","Oils / Ghee","Textiles","Handicrafts","Personal Care / Ayurveda","Organic Foods","Snacks / Ready-to-Eat"]} placeholder="Select categories…" /></div>
              <div className="space-y-2"><Label>Annual Import Volume (approx.)</Label><Input value={form.annualImportVolume ?? ""} onChange={(e) => setForm({ ...form, annualImportVolume: e.target.value })} placeholder="e.g. 500 MT" /></div>
              <div className="space-y-2"><Label>Annual Purchase Value (approx.)</Label><Input value={form.annualPurchaseValue ?? ""} onChange={(e) => setForm({ ...form, annualPurchaseValue: e.target.value })} placeholder="e.g. USD 1.2M" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Countries / Markets You Currently Serve</Label><Textarea value={form.marketsServed ?? ""} onChange={(e) => setForm({ ...form, marketsServed: e.target.value })} rows={2} placeholder="List all import markets" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Current Suppliers / Origins</Label><Textarea value={form.currentSuppliersOrigins ?? ""} onChange={(e) => setForm({ ...form, currentSuppliersOrigins: e.target.value })} rows={2} placeholder="Known supplier names or countries of origin" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Product Category Interest (additional notes)</Label><Input value={form.productCategoryInterest ?? ""} onChange={(e) => setForm({ ...form, productCategoryInterest: e.target.value })} /></div>
            </div></div>

            <Separator />

            {/* ── Section 4: Active Sourcing Requirements ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Sourcing Requirements</p>
                  <p className="text-xs text-slate-400 mt-0.5">Add one block per product you wish to source</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={addSourcingReq}>
                  <Plus className="h-3.5 w-3.5" /> Add Product Enquiry
                </Button>
              </div>
              {(form.sourcingRequirements || []).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">No sourcing requirements added yet. Click "Add Product Enquiry" to add one.</p>
              )}
              {(form.sourcingRequirements || []).map((req, i) => (
                <div key={req.id} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700">Product Enquiry #{i + 1}</p>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => removeSourcingReq(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label className="text-xs">Product / Commodity</Label><Input className="h-8 text-sm" value={req.product} onChange={(e) => updateSourcingReq(i, "product", e.target.value)} placeholder="e.g. Organic Basmati Rice" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Product Variant / Specification</Label><Input className="h-8 text-sm" value={req.productVariant} onChange={(e) => updateSourcingReq(i, "productVariant", e.target.value)} placeholder="e.g. 1121 Long Grain, 5% broken" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Country of Origin Preferred</Label><Input className="h-8 text-sm" value={req.countryOfOriginPreferred} onChange={(e) => updateSourcingReq(i, "countryOfOriginPreferred", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Organic / Conventional</Label><SelectWithOthers value={req.organicConventional} onChange={(v) => updateSourcingReq(i, "organicConventional", v)} options={["Organic","Conventional"]} placeholder="Select…" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Quantity Required</Label><Input className="h-8 text-sm" value={req.quantityRequired} onChange={(e) => updateSourcingReq(i, "quantityRequired", e.target.value)} placeholder="e.g. 25 MT" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Frequency</Label><Input className="h-8 text-sm" value={req.frequency} onChange={(e) => updateSourcingReq(i, "frequency", e.target.value)} placeholder="e.g. Per month / Per shipment" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Target Price (per unit)</Label><Input className="h-8 text-sm" value={req.targetPrice} onChange={(e) => updateSourcingReq(i, "targetPrice", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Currency</Label><Input className="h-8 text-sm" value={req.currency} onChange={(e) => updateSourcingReq(i, "currency", e.target.value)} placeholder="e.g. USD, EUR" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Delivery Port & Country</Label><Input className="h-8 text-sm" value={req.deliveryPort} onChange={(e) => updateSourcingReq(i, "deliveryPort", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Incoterm Preferred</Label><SelectWithOthers value={req.incotermPreferred} onChange={(v) => updateSourcingReq(i, "incotermPreferred", v)} options={["CIF","FOB","DDP","EXW","CPT","CNF","FCA"]} placeholder="Select…" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Sample Required Before Order?</Label><SelectWithOthers value={req.sampleRequired} onChange={(v) => updateSourcingReq(i, "sampleRequired", v)} options={["Yes","No"]} placeholder="Select…" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Sample Quantity</Label><Input className="h-8 text-sm" value={req.sampleQuantity} onChange={(e) => updateSourcingReq(i, "sampleQuantity", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Deadline to Receive Samples</Label><Input className="h-8 text-sm" value={req.deadlineToReceiveSamples} onChange={(e) => updateSourcingReq(i, "deadlineToReceiveSamples", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Expected First Delivery Date</Label><Input className="h-8 text-sm" value={req.expectedFirstDeliveryDate} onChange={(e) => updateSourcingReq(i, "expectedFirstDeliveryDate", e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Packaging Requirements</Label><Textarea className="text-sm" value={req.packagingRequirements} onChange={(e) => updateSourcingReq(i, "packagingRequirements", e.target.value)} rows={2} placeholder="e.g. 1kg retail packs in master cartons, private label" /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Labelling Requirements</Label><Textarea className="text-sm" value={req.labellingRequirements} onChange={(e) => updateSourcingReq(i, "labellingRequirements", e.target.value)} rows={2} placeholder="e.g. EU Reg 1169/2011, bilingual English/Arabic" /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Specifications / Quality Parameters</Label><Textarea className="text-sm" value={req.qualityParameters} onChange={(e) => updateSourcingReq(i, "qualityParameters", e.target.value)} rows={2} placeholder="Moisture %, broken %, purity, colour, aroma, etc." /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Required Certifications / Test Reports</Label><Textarea className="text-sm" value={req.requiredCertifications} onChange={(e) => updateSourcingReq(i, "requiredCertifications", e.target.value)} rows={2} placeholder="e.g. USDA Organic, Halal, Pesticide Residue Report, COI" /></div>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* ── Section 5: Commercial & Payment ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Commercial & Payment Preferences</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Preferred Currency</Label><Input value={form.preferredCurrency ?? ""} onChange={(e) => setForm({ ...form, preferredCurrency: e.target.value })} placeholder="e.g. USD, EUR, GBP" /></div>
              <div className="space-y-2"><Label>Pricing Range</Label><Input value={form.pricingRange ?? ""} onChange={(e) => setForm({ ...form, pricingRange: e.target.value })} /></div>
              <div className="space-y-2"><Label>MOQ Requirements</Label><Input value={form.moqRequirements ?? ""} onChange={(e) => setForm({ ...form, moqRequirements: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Payment Terms Preferred</Label><MultiSelectDropdown value={form.paymentTerms ?? ""} onChange={(v) => setForm({ ...form, paymentTerms: v })} options={["T/T Advance (100%)","50% Advance + 50% Against BL","Letter of Credit (L/C at Sight)","L/C Usance (30/60/90 days)","D/P","D/A","Open Account"]} placeholder="Select payment terms…" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Incoterms Preferred</Label><MultiSelectDropdown value={form.incoterms ?? ""} onChange={(v) => setForm({ ...form, incoterms: v })} options={["EXW","FOB","CIF","CNF","CPT","DDP"]} placeholder="Select incoterms…" /></div>
            </div></div>

            <Separator />

            {/* ── Section 6: Shipping & Compliance ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Shipping & Compliance Requirements</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Preferred Shipping Mode</Label><MultiSelectDropdown value={form.shippingMode ?? ""} onChange={(v) => setForm({ ...form, shippingMode: v })} options={["Sea — FCL (Full Container)","Sea — LCL (Less than Container)","Air Freight","Courier / Express","Multimodal"]} placeholder="Select shipping modes…" /></div>
              <div className="space-y-2"><Label>Preferred Ports of Discharge</Label><Input value={form.portsOfDischarge ?? ""} onChange={(e) => setForm({ ...form, portsOfDischarge: e.target.value })} placeholder="List ports / cities" /></div>
              <div className="space-y-2"><Label>Country of Final Delivery</Label><Input value={form.countryOfFinalDelivery ?? ""} onChange={(e) => setForm({ ...form, countryOfFinalDelivery: e.target.value })} /></div>
              <div className="space-y-2"><Label>Preferred Freight Forwarder / Logistics Partner</Label><Input value={form.freightForwarder ?? ""} onChange={(e) => setForm({ ...form, freightForwarder: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Special Packing / Marking / Palletisation Requirements</Label><Textarea value={form.packingRequirements ?? ""} onChange={(e) => setForm({ ...form, packingRequirements: e.target.value })} rows={2} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Certifications Required from Supplier</Label><MultiSelectDropdown value={form.certificationRequirements ?? ""} onChange={(v) => setForm({ ...form, certificationRequirements: v })} options={["HACCP","ISO 22000 / FSSC 22000","BRC / IFS / SQF","USDA Organic (NOP)","EU Organic","JAS Organic","Halal","Kosher","Fair Trade","FDA Registration","FSSAI","TRACES NT (EU)","Phytosanitary Certificate","Health Certificate"]} placeholder="Select certifications…" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Social / Ethical Compliance Requirements</Label><Input value={form.socialEthicalCompliance ?? ""} onChange={(e) => setForm({ ...form, socialEthicalCompliance: e.target.value })} placeholder="e.g. SEDEX, SA8000, Rainforest Alliance" /></div>
            </div></div>

            <Separator />

            {/* ── Section 7: How Did They Hear About Us ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">How Did They Hear About Us?</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Source</Label><SelectWithOthers value={form.howHeardAboutUs ?? ""} onChange={(v) => setForm({ ...form, howHeardAboutUs: v })} options={["Trade Fair / Exhibition","Referral","LinkedIn","Website / Google Search","Cold Outreach from Elan","Existing Network"]} placeholder="Select source…" /></div>
              <div className="space-y-2"><Label>Trade Fair Name (if applicable)</Label><Input value={form.tradeFairName ?? ""} onChange={(e) => setForm({ ...form, tradeFairName: e.target.value })} placeholder="e.g. Anuga 2025, Gulfood 2025" /></div>
            </div></div>

            <Separator />

            {/* ── Section 8: Internal CRM Notes ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Internal CRM Notes</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Risk Rating</Label><SelectWithOthers value={form.riskRating ?? ""} onChange={(v) => setForm({ ...form, riskRating: v })} options={["Low","Medium","High"]} placeholder="Select risk…" /></div>
              <div className="space-y-2"><Label>Strategic Value</Label><SelectWithOthers value={form.strategicValue ?? ""} onChange={(v) => setForm({ ...form, strategicValue: v })} options={["Low","Medium","High"]} placeholder="Select value…" /></div>
              <div className="space-y-2"><Label>Lead Source</Label><Input value={form.leadSource ?? ""} onChange={(e) => setForm({ ...form, leadSource: e.target.value })} placeholder="e.g. Trade Show, Referral" /></div>
              <div className="space-y-2"><Label>Last Contact Date</Label><Input type="date" value={form.lastContactDate ? form.lastContactDate.split("T")[0] : ""} onChange={(e) => setForm({ ...form, lastContactDate: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Deal History</Label><Textarea value={form.dealHistory ?? ""} onChange={(e) => setForm({ ...form, dealHistory: e.target.value })} rows={2} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Additional Notes</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Special requirements, observations, past history…" /></div>
            </div></div>

            <Separator />

            {/* ── Product Catalog ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Product Catalog</p>
              <div className="space-y-2">
                <Label>Product Catalog (PDF)</Label>
                <div className="flex items-center gap-2">
                  <input type="file" accept="application/pdf" className="hidden" id="buyer-catalog-upload" onChange={(e) => setCatalogFile(e.target.files?.[0] || null)} />
                  <Button type="button" variant="outline" onClick={() => document.getElementById("buyer-catalog-upload")?.click()} className="w-full justify-start truncate">
                    <Upload className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{catalogFile ? catalogFile.name : form.productCatalog ? "Change catalog file" : "Upload product catalog (PDF)"}</span>
                  </Button>
                  {catalogFile && (
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => { setCatalogFile(null); const el = document.getElementById("buyer-catalog-upload") as HTMLInputElement; if (el) el.value = ""; }}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {form.productCatalog && !catalogFile && (
                  <div className="flex items-center justify-between text-xs mt-1.5">
                    <a href={form.productCatalog} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> View current catalog
                    </a>
                    <button type="button" className="text-destructive hover:underline font-medium" onClick={() => setForm({ ...form, productCatalog: "" })}>Remove</button>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* ── Quotation ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Quotation</p>
              <div className="flex flex-col gap-2">
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.jfif" multiple className="hidden" id="multi-quotation-upload-buyers" onChange={(e) => { if (e.target.files) setQuotationFiles((prev) => [...prev, ...Array.from(e.target.files || [])]); }} />
                <Button type="button" variant="outline" size="sm" className="gap-2 text-slate-600 border-slate-200 w-fit" onClick={() => document.getElementById("multi-quotation-upload-buyers")?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Upload Quotation Files
                </Button>
                {((form as any).quotations || []).length > 0 && (<div className="flex flex-col gap-1 mt-2">{((form as any).quotations || []).map((doc: any, idx: number) => (<div key={`quot-${idx}`} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 text-sm"><a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-600 hover:underline flex-1 mr-2 text-xs">{doc.name}</a><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => { const updated = [...((form as any).quotations || [])]; updated.splice(idx, 1); setForm({ ...form, quotations: updated } as any); }}><X className="h-3.5 w-3.5" /></button></div>))}</div>)}
                {quotationFiles.length > 0 && (<div className="flex flex-col gap-1 mt-1">{quotationFiles.map((f, idx) => (<div key={`pend-quot-${idx}`} className="flex items-center justify-between bg-amber-50 p-2 rounded border border-amber-100 text-sm"><span className="truncate text-slate-700 text-xs flex-1 mr-2">{f.name} (Pending)</span><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => setQuotationFiles((prev) => prev.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></button></div>))}</div>)}
              </div>
            </div>

            <Separator />

            {/* ── Suppliers in Talks With ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Suppliers in Talks With</p>
              <div className="space-y-2">
                <Label>Supplier(s) in talks with</Label>
                <EntityLinkSelect
                  selectedIds={(form.supplierLinks ?? []).map((l) => l.id)}
                  onChange={(ids) => {
                    const links = ids.map((id) => {
                      const found = allSupplierOptions.find((s) => s.id === id);
                      return { id, type: (found?.type ?? "new") as "new" | "signed" };
                    });
                    setForm({ ...form, supplierLinks: links });
                  }}
                  options={allSupplierOptions}
                  isLoading={suppliersListLoading}
                  placeholder="Select suppliers in talks with this buyer…"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm" disabled={createMutation.isPending || updateMutation.isPending || uploadCatalogMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending || uploadCatalogMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
            <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0"><AlertCircle className="h-6 w-6 text-rose-600" /></div>
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
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</Button>
            <Button variant="destructive" className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200"
              onClick={() => {
                if (buyerToDelete) deleteMutation.mutate(buyerToDelete.id);
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
