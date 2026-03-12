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
  Upload,
  X,
  Filter,
  Building2,
  AlertCircle,
  FileCheck2,
  CheckCircle2,
  PauseCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";

interface Supplier {
  id: string;
  company: string;
  lidlFactoryId?: string;
  commissionPercent?: string;
  contractBuyer?: string;
  approvedConfirmPercent?: string;
  products?: string;
  country?: string;
  contactPerson?: string;
  phone?: string;
  companyAddress?: string;
  email?: string;
  website?: string;
  productCatalogShared?: string;
  productionCapacity?: string;
  factoryVideosShared?: string;
  warehouseVideosShared?: string;
  exportingCountries?: string;
  samplePolicy?: string;
  certifications?: string;
  workingWithOurBrands?: string;
  otherBrands?: string;
  remarks?: string;
  currentStatus?: string;
}

const EMPTY_SUPPLIER: Partial<Supplier> = {
  company: "",
  contactPerson: "",
  email: "",
  currentStatus: "Active",
};

export default function SuppliersPage() {
  const { hasEditPermission } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = hasEditPermission("suppliers");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
  const [form, setForm] = useState<Partial<Supplier>>(EMPTY_SUPPLIER);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
    null,
  );

  const [catalogFile, setCatalogFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", search, statusFilter, page],
    queryFn: () =>
      api
        .get("/suppliers", {
          params: { search, status: statusFilter !== "all" ? statusFilter : undefined, page, limit: 20 },
        })
        .then((r) => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ["supplier-stats"],
    queryFn: () => api.get("/suppliers/stats").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: Partial<Supplier>) => api.post("/suppliers", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDialogOpen(false);
      toast.success("Supplier created");
    },
    onError: () => toast.error("Failed to create supplier"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<Supplier> }) =>
      api.put(`/suppliers/${id}`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDialogOpen(false);
      toast.success("Supplier updated");
    },
    onError: () => toast.error("Failed to update supplier"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Supplier deleted");
    },
    onError: () => toast.error("Failed to delete supplier"),
  });

  const uploadCatalogMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/suppliers/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onError: () => toast.error("Failed to upload product catalog"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let catalogUrl = form.productCatalogShared;

    if (catalogFile) {
      try {
        const uploadRes = await uploadCatalogMutation.mutateAsync(catalogFile);
        catalogUrl = uploadRes.url;
      } catch {
        return; // error already handled by onError in mutation
      }
    }

    const payload = { ...form, productCatalogShared: catalogUrl };

    if (editing?.id) {
      updateMutation.mutate({ id: editing.id, d: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_SUPPLIER);
    setCatalogFile(null);
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm(s);
    setCatalogFile(null);
    setDialogOpen(true);
  };

  const handleExport = async () => {
    try {
      const res = await api.get("/suppliers/export/csv", {
        params: { search },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `suppliers_export.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Export failed");
    }
  };

  const suppliers = data?.data ?? [];
  const pagination = data?.pagination;

  const statusStyles = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "text-brand-700 bg-brand-100 border-brand-200";
      case "signed":
        return "text-indigo-700 bg-indigo-100 border-indigo-200";
      case "under review":
        return "text-amber-700 bg-amber-100 border-amber-200";
      case "inactive":
        return "text-rose-700 bg-rose-100 border-rose-200";
      default:
        return "text-slate-600 bg-slate-100 border-slate-200";
    }
  };

  const StatusIcon = ({ status, className }: { status?: string, className?: string }) => {
    switch (status?.toLowerCase()) {
      case "active": return <CheckCircle2 className={className} />;
      case "signed": return <FileCheck2 className={className} />;
      case "under review": return <Loader2 className={className} />;
      case "inactive": return <PauseCircle className={className} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-brand-500" />
            Supplier Directory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage supplier relationships and contracts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2 bg-white hover:bg-slate-50 text-slate-700 shadow-sm border-slate-200 h-9">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <PermissionGate permission="suppliers" editOnly>
            <Button onClick={openCreate} className="gap-2 bg-brand-600 hover:bg-brand-700 text-white shadow-sm h-9">
              <Plus className="h-4 w-4" /> Add Supplier
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 py-5">
        {[
          { icon: <Building2 className="h-5 w-5 text-blue-600" />, label: "Total Suppliers", value: stats?.total ?? 0, bg: "bg-blue-50" },
          { icon: <FileCheck2 className="h-5 w-5 text-indigo-600" />, label: "Signed", value: stats?.signed ?? 0, bg: "bg-indigo-50" },
          { icon: <CheckCircle2 className="h-5 w-5 text-brand-600" />, label: "Active", value: stats?.active ?? 0, bg: "bg-brand-50" },
          { icon: <Loader2 className="h-5 w-5 text-amber-600" />, label: "Under Review", value: stats?.underReview ?? 0, bg: "bg-amber-50" },
          { icon: <PauseCircle className="h-5 w-5 text-rose-600" />, label: "Inactive", value: stats?.inactive ?? 0, bg: "bg-rose-50" },
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

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-5 flex flex-wrap items-center gap-3">
        <div className="items-center gap-2 px-2 text-slate-400 border-r border-slate-100 pr-4 mr-1 hidden md:flex">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-semibold text-slate-600">Filters</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search suppliers..."
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
              <SelectItem value="Signed">Signed</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Under Review">Under Review</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
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

      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left border-collapse min-w-max">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Company Name</th>
                <th className="px-5 py-3.5 font-semibold">Country</th>
                <th className="px-5 py-3.5 font-semibold">Contact Person</th>
                <th className="px-5 py-3.5 font-semibold">Email</th>
                <th className="px-5 py-3.5 font-semibold">Products</th>
                <th className="px-5 py-3.5 font-semibold">Contract Buyer</th>
                <th className="px-5 py-3.5 font-semibold">Certifications</th>
                <th className="px-5 py-3.5 font-semibold">Remarks</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                {canEdit && <th className="px-5 py-3.5 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading && suppliers.length === 0 ? (
                 <tr>
                 <td colSpan={canEdit ? 10 : 9} className="h-32 text-center">
                   <div className="flex justify-center">
                     <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                   </div>
                 </td>
               </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 10 : 9} className="px-5 py-16 text-center shadow-[inset_0_1px_0_#f1f5f9]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2">
                        <Building2 className="h-6 w-6 text-slate-300" />
                      </div>
                      <p className="text-slate-600 font-medium text-base">No suppliers found</p>
                      <p className="text-slate-400 text-sm max-w-[250px]">
                        {(search || statusFilter !== "all") ? "Try adjusting your search or filters." : "You have not added any suppliers yet."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map((s: Supplier) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-3.5 border-r border-slate-100 font-medium">
                      <Link
                        to={`/suppliers/signed-contract/${s.id}`}
                        className="text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        {s.company}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 border-r border-slate-100">{s.country}</td>
                    <td className="px-5 py-3.5 border-r border-slate-100">{s.contactPerson}</td>
                    <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">{s.email}</td>
                    <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[200px] truncate" title={s.products}>{s.products}</td>
                    <td className="px-5 py-3.5 border-r border-slate-100">{s.contractBuyer}</td>
                    <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[180px] truncate" title={s.certifications}>{s.certifications}</td>
                    <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[200px] truncate" title={s.remarks}>{s.remarks}</td>
                    <td className="px-5 py-3.5 border-r border-slate-100">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyles(s.currentStatus)} capitalize`}>
                          <StatusIcon status={s.currentStatus} className="h-3 w-3 mr-1.5" />
                          {s.currentStatus || "Active"}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3.5 text-right font-medium">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                            onClick={() => openEdit(s)}
                            title="Edit Supplier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              setSupplierToDelete(s);
                              setDeleteDialogOpen(true);
                            }}
                            title="Delete Supplier"
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

        {pagination && pagination.pages > 1 && (
          <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium px-2">
              Showing page <span className="text-slate-900">{pagination.page}</span> of <span className="text-slate-900">{pagination.pages}</span> <span className="text-slate-400">({pagination.total} suppliers)</span>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-white rounded-xl shadow-2xl border-none custom-scrollbar-light">
          <div className="flex items-center gap-4 mb-2">
             <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0 border border-brand-200">
                 <Building2 className="h-5 w-5 text-brand-600" />
             </div>
             <div>
                 <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                   {editing?.id ? "Edit Supplier" : "Register New Supplier"}
                 </DialogTitle>
                 <DialogDescription className="text-slate-500 mt-1">
                   Fill in the details below to {editing?.id ? "update the" : "create a new"} supplier record.
                 </DialogDescription>
             </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Company *</Label>
                <Input
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input
                  value={form.contactPerson ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, contactPerson: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="text"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={form.country ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={form.website ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Contract Buyer</Label>
                <Input
                  value={form.contractBuyer ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, contractBuyer: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Commission %</Label>
                <Input
                  value={form.commissionPercent ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, commissionPercent: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Approved Confirm %</Label>
                <Input
                  value={form.approvedConfirmPercent ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, approvedConfirmPercent: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Lidl Factory ID</Label>
                <Input
                  value={form.lidlFactoryId ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, lidlFactoryId: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Certifications</Label>
                <Input
                  value={form.certifications ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, certifications: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Production Capacity</Label>
                <Input
                  value={form.productionCapacity ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, productionCapacity: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Sample Policy</Label>
                <Input
                  value={form.samplePolicy ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, samplePolicy: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Product Catalog (PDF)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    id="catalog-upload"
                    onChange={(e) => setCatalogFile(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("catalog-upload")?.click()}
                    className="w-full justify-start truncate"
                  >
                    <Upload className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {catalogFile
                        ? catalogFile.name
                        : form.productCatalogShared
                        ? "Change catalog file"
                        : "Upload product catalog (PDF)"}
                    </span>
                  </Button>
                  {catalogFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground"
                      title="Cancel selected file"
                      onClick={() => {
                        setCatalogFile(null);
                        const el = document.getElementById("catalog-upload") as HTMLInputElement;
                        if (el) el.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {form.productCatalogShared && !catalogFile && (
                  <div className="flex items-center justify-between text-xs mt-1.5">
                    <p className="text-muted-foreground truncate">
                      <a
                        href={form.productCatalogShared}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View current catalog file
                      </a>
                    </p>
                    <button
                      type="button"
                      className="text-destructive hover:underline font-medium"
                      onClick={() => setForm({ ...form, productCatalogShared: "" })}
                    >
                      Remove current PDF
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Current Status</Label>
                <Select
                  value={form.currentStatus ?? "Active"}
                  onValueChange={(v) => setForm({ ...form, currentStatus: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Signed">Signed</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company Address</Label>
              <Textarea
                value={form.companyAddress ?? ""}
                onChange={(e) =>
                  setForm({ ...form, companyAddress: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Products</Label>
              <Textarea
                value={form.products ?? ""}
                onChange={(e) =>
                  setForm({ ...form, products: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Exporting Countries</Label>
              <Textarea
                value={form.exportingCountries ?? ""}
                onChange={(e) =>
                  setForm({ ...form, exportingCountries: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Working With Our Brands</Label>
              <Textarea
                value={form.workingWithOurBrands ?? ""}
                onChange={(e) =>
                  setForm({ ...form, workingWithOurBrands: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Other Brands</Label>
              <Textarea
                value={form.otherBrands ?? ""}
                onChange={(e) =>
                  setForm({ ...form, otherBrands: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks ?? ""}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                rows={3}
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
                {(createMutation.isPending || updateMutation.isPending || uploadCatalogMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editing?.id ? "Update Supplier" : "Create Supplier"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete supplier confirmation */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setSupplierToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md p-6 bg-white rounded-xl shadow-2xl border-none">
          <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                  <DialogTitle className="text-lg font-bold text-slate-900">Delete Supplier</DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1">This will permanently remove the record.</DialogDescription>
              </div>
          </div>
          {supplierToDelete?.company && (
              <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100 mb-6 font-medium">
                  Company: <span className="font-bold">{supplierToDelete.company}</span>
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
                  if (supplierToDelete) {
                    deleteMutation.mutate(supplierToDelete.id);
                  }
                  setDeleteDialogOpen(false);
                  setSupplierToDelete(null);
                }}
               >
                  Yes, delete supplier
              </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
