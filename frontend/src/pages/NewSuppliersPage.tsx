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
    Plus,
    Search,
    Pencil,
    Trash2,
    Download,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Filter,
    Building2,
    AlertCircle,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";

interface Supplier {
    id: string;
    company: string;
    productCategory?: string;
    product?: string;
    country?: string;
    accountManager?: string;
    currentStatus?: string;
    certifications?: string;
    latestQuotation?: string;
    reasonInactive?: string;
    dateMarkedInactive?: string;
    reactivationPotential?: string;
    notes?: string;
    phone?: string;
    email?: string;
}

const EMPTY_SUPPLIER: Partial<Supplier> = {
    company: "",
    productCategory: "",
    product: "",
    country: "",
    accountManager: "",
    currentStatus: "",
    certifications: "",
    latestQuotation: "",
    reasonInactive: "",
    dateMarkedInactive: "",
    reactivationPotential: "",
    notes: "",
    phone: "",
    email: "",
};

export default function NewSuppliersPage() {
    const { hasEditPermission } = useAuth();
    const queryClient = useQueryClient();
    const canEdit = hasEditPermission("suppliers");

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
    const [form, setForm] = useState<Partial<Supplier>>(EMPTY_SUPPLIER);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
        null,
    );

    const { data, isLoading } = useQuery({
        queryKey: ["new-suppliers", search, page],
        queryFn: () =>
            api
                .get("/new-suppliers", { params: { search, page, limit: 20 } })
                .then((r) => r.data),
    });

    const createMutation = useMutation({
        mutationFn: (d: Partial<Supplier>) => api.post("/new-suppliers", d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            setDialogOpen(false);
            toast.success("Supplier created");
        },
        onError: () => toast.error("Failed to create supplier"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, d }: { id: string; d: Partial<Supplier> }) =>
            api.put(`/new-suppliers/${id}`, d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
            setDialogOpen(false);
            toast.success("Supplier updated");
        },
        onError: () => toast.error("Failed to update supplier"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/new-suppliers/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            toast.success("Supplier deleted");
        },
        onError: () => toast.error("Failed to delete supplier"),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Submitting form with payload:", form);
        if (editing?.id) {
            updateMutation.mutate({ id: editing.id, d: form });
        } else {
            createMutation.mutate(form);
        }
    };

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_SUPPLIER);
        setDialogOpen(true);
    };

    const openEdit = (s: Supplier) => {
        setEditing(s);
        setForm(s);
        setDialogOpen(true);
    };

    const handleExport = async () => {
        try {
            const res = await api.get("/new-suppliers/export/csv", {
                params: { search },
                responseType: "blob",
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = `new_suppliers_export.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("CSV exported");
        } catch {
            toast.error("Export failed");
        }
    };

    const suppliers = data?.data ?? [];
    const pagination = data?.pagination;

    return (
        <div className="flex flex-col h-full min-h-0 gap-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-brand-500" />
                        New Suppliers
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Manage new supplier prospects
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

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-5 mt-5 flex flex-wrap items-center gap-3">
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
                    {search && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSearch(""); setPage(1); }}
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
                                <th className="px-5 py-3.5 font-semibold">Product Category</th>
                                <th className="px-5 py-3.5 font-semibold">Product</th>
                                <th className="px-5 py-3.5 font-semibold">Country</th>
                                <th className="px-5 py-3.5 font-semibold">Account Manager</th>
                                <th className="px-5 py-3.5 font-semibold">Phone</th>
                                <th className="px-5 py-3.5 font-semibold">Email</th>
                                <th className="px-5 py-3.5 font-semibold">Current Status</th>
                                <th className="px-5 py-3.5 font-semibold">Certifications</th>
                                <th className="px-5 py-3.5 font-semibold">Reason Inactive</th>
                                <th className="px-5 py-3.5 font-semibold">Reactivation Potential</th>
                                <th className="px-5 py-3.5 font-semibold">Notes</th>
                                {canEdit && <th className="px-5 py-3.5 font-semibold text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {isLoading && suppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={canEdit ? 13 : 12} className="h-32 text-center">
                                        <div className="flex justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                                        </div>
                                    </td>
                                </tr>
                            ) : suppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={canEdit ? 13 : 12} className="px-5 py-16 text-center shadow-[inset_0_1px_0_#f1f5f9]">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2">
                                                <Building2 className="h-6 w-6 text-slate-300" />
                                            </div>
                                            <p className="text-slate-600 font-medium text-base">No suppliers found</p>
                                            <p className="text-slate-400 text-sm max-w-[250px]">
                                                {search ? "Try adjusting your search." : "You have not added any suppliers yet."}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                suppliers.map((s: Supplier) => (
                                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-5 py-3.5 border-r border-slate-100 font-medium">{s.company}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500" title={s.productCategory}>{s.productCategory}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[200px] truncate" title={s.product}>{s.product}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100">{s.country}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">{s.accountManager}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">{s.phone}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">{s.email}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">{s.currentStatus}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[200px] truncate" title={s.certifications}>{s.certifications}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[200px] truncate" title={s.reasonInactive}>{s.reasonInactive}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[200px] truncate" title={s.reactivationPotential}>{s.reactivationPotential}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[200px] truncate" title={s.notes}>{s.notes}</td>
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
                                <Label>Company Name *</Label>
                                <Input
                                    value={form.company}
                                    onChange={(e) =>
                                        setForm({ ...form, company: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Product Category</Label>
                                <Input
                                    value={form.productCategory ?? ""}
                                    onChange={(e) =>
                                        setForm({ ...form, productCategory: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Product</Label>
                                <Input
                                    value={form.product ?? ""}
                                    onChange={(e) =>
                                        setForm({ ...form, product: e.target.value })
                                    }
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
                                <Label>Account Manager</Label>
                                <Input
                                    value={form.accountManager ?? ""}
                                    onChange={(e) =>
                                        setForm({ ...form, accountManager: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone Number</Label>
                                <Input
                                    value={form.phone ?? ""}
                                    onChange={(e) =>
                                        setForm({ ...form, phone: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={form.email ?? ""}
                                    onChange={(e) =>
                                        setForm({ ...form, email: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Current Status</Label>
                                <Input
                                    value={form.currentStatus ?? ""}
                                    onChange={(e) =>
                                        setForm({ ...form, currentStatus: e.target.value })
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
                                <Label>Latest Quotation</Label>
                                <Input
                                    value={form.latestQuotation ?? ""}
                                    onChange={(e) =>
                                        setForm({ ...form, latestQuotation: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Reason Inactive</Label>
                                <Input
                                    value={form.reasonInactive ?? ""}
                                    onChange={(e) =>
                                        setForm({ ...form, reasonInactive: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Date Marked Inactive</Label>
                                <Input
                                    value={form.dateMarkedInactive ?? ""}
                                    onChange={(e) =>
                                        setForm({ ...form, dateMarkedInactive: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Reactivation Potential</Label>
                                <Input
                                    value={form.reactivationPotential ?? ""}
                                    onChange={(e) =>
                                        setForm({ ...form, reactivationPotential: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={form.notes ?? ""}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                                {(createMutation.isPending || updateMutation.isPending) && (
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
