import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
          params: { search, status: statusFilter, page, limit: 20 },
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
      toast.success("Buyer created");
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
      toast.success("Buyer updated");
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
    setForm(buyer);
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
      toast.success("CSV exported");
    } catch {
      toast.error("Export failed");
    }
  };

  const buyers = buyersData?.data ?? [];
  const pagination = buyersData?.pagination;

  const statusColor = (status?: string) => {
    switch (status) {
      case "Active":
        return "default" as const;
      case "Pending":
        return "secondary" as const;
      case "Suspended":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buyers</h1>
          <p className="text-muted-foreground mt-1">
            Manage your buyer contacts and relationships
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <PermissionGate permission="buyers" editOnly>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Buyer
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Status tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({stats?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="Active">
            Active ({stats?.active ?? 0})
          </TabsTrigger>
          <TabsTrigger value="Pending">
            Pending ({stats?.pending ?? 0})
          </TabsTrigger>
          <TabsTrigger value="Suspended">
            Suspended ({stats?.suspended ?? 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search buyers..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-10"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : buyers.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          No buyers found
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-neutral-300 dark:border-neutral-700">
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Company
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Contact
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Email
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Country
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Status
                </TableHead>
                {canEdit && (
                  <TableHead className="w-24 border-r border-neutral-300 dark:border-neutral-700">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {buyers.map((buyer: Buyer) => (
                <TableRow
                  key={buyer.id}
                  className="border-b border-neutral-300 dark:border-neutral-700 last:border-0 hover:bg-muted/30"
                >
                  <TableCell className="font-medium border-r border-neutral-300 dark:border-neutral-700">
                    {buyer.company}
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    {buyer.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground border-r border-neutral-300 dark:border-neutral-700">
                    {buyer.email}
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    {buyer.country}
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    <Badge variant={statusColor(buyer.status)}>
                      {buyer.status}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(buyer)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setBuyerToDelete(buyer);
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

      {/* Pagination */}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBuyer?.id ? "Edit Buyer" : "Add Buyer"}
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
                <Label>Contact Person *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
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
                <Label>Country *</Label>
                <Input
                  value={form.country}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Region</Label>
                <Select
                  value={form.region ?? ""}
                  onValueChange={(v) => setForm({ ...form, region: v })}
                >
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status ?? "Pending"}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Risk Rating</Label>
                <Select
                  value={form.riskRating ?? ""}
                  onValueChange={(v) => setForm({ ...form, riskRating: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Strategic Value</Label>
                <Select
                  value={form.strategicValue ?? ""}
                  onValueChange={(v) => setForm({ ...form, strategicValue: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lead Source</Label>
                <Input
                  value={form.leadSource ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, leadSource: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input
                  value={form.paymentTerms ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, paymentTerms: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Incoterms</Label>
                <Select
                  value={form.incoterms ?? ""}
                  onValueChange={(v) => setForm({ ...form, incoterms: v })}
                >
                  <SelectTrigger>
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
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {editingBuyer?.id ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete buyer confirmation */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setBuyerToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete buyer</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium">
              {buyerToDelete?.company || "this buyer"}
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
                if (buyerToDelete) {
                  deleteMutation.mutate(buyerToDelete.id);
                }
                setDeleteDialogOpen(false);
                setBuyerToDelete(null);
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
