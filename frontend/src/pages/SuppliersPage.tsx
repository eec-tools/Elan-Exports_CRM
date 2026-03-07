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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    queryKey: ["suppliers", search, page],
    queryFn: () =>
      api
        .get("/suppliers", { params: { search, page, limit: 20 } })
        .then((r) => r.data),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground mt-1">
            Manage supplier relationships and contracts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <PermissionGate permission="suppliers" editOnly>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          No suppliers found
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-neutral-300 dark:border-neutral-700">
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Company Name
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Country
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Contact Person
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Email
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Products
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Contract Buyer
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Certifications
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Remarks
                </TableHead>
                {canEdit && (
                  <TableHead className="w-24 border-r border-neutral-300 dark:border-neutral-700">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s: Supplier) => (
                <TableRow
                  key={s.id}
                  className="border-b border-neutral-300 dark:border-neutral-700 last:border-0 hover:bg-muted/30"
                >
                  <TableCell className="font-medium border-r border-neutral-300 dark:border-neutral-700">
                    <Link
                      to={`/suppliers/signed-contract/${s.id}`}
                      className="text-primary hover:underline"
                    >
                      {s.company}
                    </Link>
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    {s.country}
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    {s.contactPerson}
                  </TableCell>
                  <TableCell className="text-muted-foreground border-r border-neutral-300 dark:border-neutral-700">
                    {s.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground border-r border-neutral-300 dark:border-neutral-700 max-w-[200px] truncate">
                    {s.products}
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    {s.contractBuyer}
                  </TableCell>
                  <TableCell className="text-muted-foreground border-r border-neutral-300 dark:border-neutral-700 max-w-[180px] truncate">
                    {s.certifications}
                  </TableCell>
                  <TableCell className="text-muted-foreground border-r border-neutral-300 dark:border-neutral-700 max-w-[200px] truncate">
                    {s.remarks}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSupplierToDelete(s);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages} ({pagination.total}{" "}
            total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.pages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Edit Supplier" : "Add Supplier"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  {(catalogFile || form.productCatalogShared) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        setCatalogFile(null);
                        setForm({ ...form, productCatalogShared: "" });
                        const el = document.getElementById("catalog-upload") as HTMLInputElement;
                        if (el) el.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {form.productCatalogShared && !catalogFile && (
                  <p className="text-xs text-muted-foreground truncate">
                    <a
                      href={form.productCatalogShared}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View current catalog file
                    </a>
                  </p>
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
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending || uploadCatalogMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editing?.id ? "Update" : "Create"}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete supplier</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium">
              {supplierToDelete?.company || "this supplier"}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (supplierToDelete) {
                  deleteMutation.mutate(supplierToDelete.id);
                }
                setDeleteDialogOpen(false);
                setSupplierToDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
