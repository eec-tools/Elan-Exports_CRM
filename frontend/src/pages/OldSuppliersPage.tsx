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
  Plus,
  Search,
  Pencil,
  Trash2,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";

interface Supplier {
  id: string;
  company: string;
  country?: string;
  website?: string;
  email?: string;
  products?: string;
  notes?: string;
}

const EMPTY_SUPPLIER: Partial<Supplier> = {
  company: "",
  country: "",
  website: "",
  email: "",
  products: "",
  notes: "",
};

export default function OldSuppliersPage() {
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
    queryKey: ["old-suppliers", search, page],
    queryFn: () =>
      api
        .get("/old-suppliers", { params: { search, page, limit: 20 } })
        .then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: Partial<Supplier>) => api.post("/old-suppliers", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["old-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDialogOpen(false);
      toast.success("Supplier created");
    },
    onError: () => toast.error("Failed to create supplier"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<Supplier> }) =>
      api.put(`/old-suppliers/${id}`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["old-suppliers"] });
      setDialogOpen(false);
      toast.success("Supplier updated");
    },
    onError: () => toast.error("Failed to update supplier"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/old-suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["old-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Supplier deleted");
    },
    onError: () => toast.error("Failed to delete supplier"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      const res = await api.get("/old-suppliers/export/csv", {
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
          <h1 className="text-3xl font-bold tracking-tight">Old Suppliers</h1>
          <p className="text-muted-foreground mt-1">
            Manage old supplier records
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
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Notes</TableHead>
                {canEdit && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s: Supplier) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.company}</TableCell>
                  <TableCell>{s.country}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.website ? (
                      <a
                        href={
                          s.website.startsWith("http")
                            ? s.website
                            : `https://${s.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {s.website}
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.products}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {s.notes}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
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
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Products</Label>
                <Input
                  value={form.products ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, products: e.target.value })
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
                {(createMutation.isPending || updateMutation.isPending) && (
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
