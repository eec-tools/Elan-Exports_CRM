import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FolderOpen,
  FolderPlus,
  Home,
  ChevronRight,
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Building2,
  Loader2,
  X,
  AlertCircle,
  Users,
  ChevronLeft,
  Package,
  Leaf,
  Wheat,
  ShoppingBag,
  Factory,
  Layers,
  Globe,
  Tag,
  Database,
  Box,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

// ─── Types ───────────────────────────────────────────

interface VaultFolder {
  id: string;
  name: string;
  createdBy: string | null;
  creator: { fullName: string } | null;
  createdAt: string;
  supplierCount: number;
}

interface SourcingVaultSupplierItem {
  id: string;
  folderId: string;
  company: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  country?: string;
  product?: string;
  notes?: string;
  emailStatus: string;
  createdAt: string;
  creator?: { fullName: string } | null;
}

interface GmailAccount {
  email: string;
  connected: boolean;
  label: string;
}

interface BulkRow {
  company: string;
  email: string;
  phone: string;
  contactPerson: string;
  country: string;
  product: string;
  notes: string;
}

// ─── Folder icon palette ──────────────────────────────

const ICONS = [
  Package,
  Leaf,
  Wheat,
  ShoppingBag,
  Factory,
  Layers,
  Globe,
  Tag,
  Database,
  Box,
];
const GRADIENTS = [
  "from-amber-500 to-orange-500",
  "from-blue-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-purple-500 to-violet-500",
  "from-rose-500 to-pink-500",
  "from-sky-500 to-cyan-500",
  "from-teal-500 to-green-500",
  "from-orange-500 to-red-500",
  "from-indigo-500 to-purple-500",
  "from-green-500 to-emerald-500",
];

function folderStyle(name: string) {
  const idx =
    Math.abs(name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) %
    ICONS.length;
  return { Icon: ICONS[idx], gradient: GRADIENTS[idx] };
}

function emptyBulkRow(): BulkRow {
  return {
    company: "",
    email: "",
    phone: "",
    contactPerson: "",
    country: "",
    product: "",
    notes: "",
  };
}

const BULK_COLS: {
  key: keyof BulkRow;
  label: string;
  required?: boolean;
  width: string;
}[] = [
  { key: "company", label: "Company Name *", required: true, width: "180px" },
  { key: "email", label: "Email *", required: true, width: "180px" },
  { key: "phone", label: "Phone", width: "130px" },
  { key: "contactPerson", label: "Contact Person", width: "150px" },
  { key: "country", label: "Country", width: "120px" },
  { key: "product", label: "Product", width: "150px" },
  { key: "notes", label: "Notes", width: "180px" },
];

// ─── Main Page ────────────────────────────────────────

export default function SourcingVaultPage() {
  const { hasEditPermission } = useAuth();
  const canEdit =
    hasEditPermission("suppliers") || hasEditPermission("sourcing_suppliers");
  const queryClient = useQueryClient();

  const [currentFolder, setCurrentFolder] = useState<VaultFolder | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sourcedByFilter, setSourcedByFilter] = useState("all");

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<VaultFolder | null>(null);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);

  // ─── Root: folders query ───────────────────────────
  const { data: folders = [], isLoading: foldersLoading } = useQuery<
    VaultFolder[]
  >({
    queryKey: ["sourcing-vault-folders"],
    queryFn: async () => {
      const res = await api.get("/sourcing-vault");
      return res.data;
    },
  });

  // ─── Folder view: creators query ──────────────────
  const { data: creators = [] } = useQuery<{ id: string; fullName: string }[]>({
    queryKey: ["sourcing-vault-creators", currentFolder?.id],
    queryFn: async () => {
      const res = await api.get(
        `/sourcing-vault/${currentFolder!.id}/creators`,
      );
      return res.data;
    },
    enabled: !!currentFolder,
  });

  // ─── Folder view: vault suppliers query ───────────
  const PAGE_SIZE = 20;
  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: [
      "sourcing-vault-suppliers",
      currentFolder?.id,
      search,
      page,
      sourcedByFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ search });
      if (sourcedByFilter !== "all") params.set("createdBy", sourcedByFilter);
      const res = await api.get(
        `/sourcing-vault/${currentFolder!.id}/suppliers?${params}`,
      );
      // backend returns a flat array; do client-side pagination
      const all: SourcingVaultSupplierItem[] = res.data;
      const total = all.length;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const data = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      return { data, pagination: { total, pages } };
    },
    enabled: !!currentFolder,
  });

  const suppliers = suppliersData?.data ?? [];
  const pagination = suppliersData?.pagination;

  // ─── Create folder mutation ────────────────────────
  const createFolderMutation = useMutation({
    mutationFn: (name: string) => api.post("/sourcing-vault", { name }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-vault-folders"] });
      toast.success(`Folder "${res.data.name}" created`);
      setNewFolderOpen(false);
      setNewFolderName("");
      setCurrentFolder(res.data as VaultFolder);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? "Failed to create folder");
    },
  });

  // ─── Delete folder mutation ────────────────────────
  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sourcing-vault/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-vault-folders"] });
      toast.success("Folder deleted");
      setDeleteFolderTarget(null);
    },
    onError: () => toast.error("Failed to delete folder"),
  });

  function openFolder(folder: VaultFolder) {
    setCurrentFolder(folder);
    setSearch("");
    setPage(1);
    setSourcedByFilter("all");
  }

  function goToRoot() {
    setCurrentFolder(null);
    setSearch("");
    setPage(1);
    setSourcedByFilter("all");
  }

  const isAtRoot = currentFolder === null;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            Sourcing Vault
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organised supplier database by category
          </p>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            {isAtRoot ? (
              <Button
                variant="outline"
                onClick={() => setNewFolderOpen(true)}
                className="gap-2"
              >
                <FolderPlus className="h-4 w-4" />
                New Folder
              </Button>
            ) : (
              <Button
                onClick={() => setAddSupplierOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Suppliers
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        <button
          onClick={goToRoot}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
            isAtRoot
              ? "text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Home className="h-3.5 w-3.5" />
          Sourcing Vault
        </button>
        {currentFolder && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="px-2 py-1 rounded-md text-foreground font-semibold">
              {currentFolder.name}
            </span>
          </>
        )}
      </div>

      {/* Back + Search + Sourced By filter */}
      <div className="flex items-center gap-3">
        {!isAtRoot && (
          <Button
            variant="ghost"
            size="sm"
            onClick={goToRoot}
            className="gap-1 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        {!isAtRoot && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search in ${currentFolder?.name}…`}
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        {!isAtRoot && creators.length > 0 && (
          <select
            value={sourcedByFilter}
            onChange={(e) => {
              setSourcedByFilter(e.target.value);
              setPage(1);
            }}
            className="border border-border rounded-md text-sm px-3 h-9 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Employees</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Root view: folders grid ── */}
      {isAtRoot && (
        <>
          {foldersLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading…
            </div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <FolderOpen className="h-10 w-10 opacity-30" />
              <p className="text-sm">No folders yet</p>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNewFolderOpen(true)}
                  className="gap-1"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Create your first folder
                </Button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Folders
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {folders.map((folder) => {
                  const { Icon, gradient } = folderStyle(folder.name);
                  return (
                    <div key={folder.id} className="group relative">
                      <button
                        onClick={() => openFolder(folder)}
                        className="w-full flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-4 text-center transition-all hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <div
                          className={`rounded-xl p-3 bg-gradient-to-br ${gradient} shadow-sm`}
                        >
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="min-w-0 w-full">
                          <p className="text-sm font-semibold truncate leading-tight">
                            {folder.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {folder.supplierCount} supplier
                            {folder.supplierCount !== 1 ? "s" : ""}
                          </p>
                          {folder.creator && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                              by {folder.creator.fullName}
                            </p>
                          )}
                        </div>
                      </button>

                      {canEdit && (
                        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-red-50 hover:text-red-600"
                            title="Delete folder"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteFolderTarget(folder);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Folder view: vault suppliers list ── */}
      {!isAtRoot && (
        <>
          {suppliersLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading…
            </div>
          ) : suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Building2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">No suppliers in this folder yet</p>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => setAddSupplierOpen(true)}
                  className="gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Suppliers
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Company
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Contact
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Country
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Product
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Email Status
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Sourced By
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Date Added
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {suppliers.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {s.company}
                        </div>
                        {s.email && (
                          <div className="text-xs text-muted-foreground">
                            {s.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">
                          {s.contactPerson ?? "—"}
                        </div>
                        {s.phone && (
                          <div className="text-xs text-muted-foreground">
                            {s.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.country ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.product ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            s.emailStatus === "Sent"
                              ? "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700"
                              : "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700"
                          }
                        >
                          {s.emailStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.creator ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <Users className="h-3 w-3 text-emerald-600" />
                            </div>
                            <span className="text-sm text-foreground">
                              {s.creator.fullName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {pagination.pages} · {pagination.total}{" "}
                    suppliers
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= pagination.pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── New Folder Dialog ── */}
      <Dialog
        open={newFolderOpen}
        onOpenChange={(v) => {
          if (!v) {
            setNewFolderOpen(false);
            setNewFolderName("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>Folder Name</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Toys, Food & Beverages, Textiles…"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFolderName.trim()) {
                    createFolderMutation.mutate(newFolderName.trim());
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewFolderOpen(false);
                setNewFolderName("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
              onClick={() => createFolderMutation.mutate(newFolderName.trim())}
            >
              {createFolderMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Folder Confirm ── */}
      <AlertDialog
        open={!!deleteFolderTarget}
        onOpenChange={(v) => !v && setDeleteFolderTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete "{deleteFolderTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The folder and all its staged suppliers will be permanently
              removed. Suppliers already in the Sourcing Suppliers pipeline are
              not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                deleteFolderTarget &&
                deleteFolderMutation.mutate(deleteFolderTarget.id)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk Add Dialog ── */}
      {currentFolder && (
        <BulkAddDialog
          open={addSupplierOpen}
          folder={currentFolder}
          onClose={() => setAddSupplierOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ["sourcing-vault-suppliers"],
            });
            queryClient.invalidateQueries({
              queryKey: ["sourcing-vault-folders"],
            });
            queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers"] });
            queryClient.invalidateQueries({
              queryKey: ["sourcing-suppliers-stats"],
            });
          }}
        />
      )}
    </div>
  );
}

// ─── Bulk Add Dialog ─────────────────────────────────

function BulkAddDialog({
  open,
  folder,
  onClose,
  onSuccess,
}: {
  open: boolean;
  folder: VaultFolder;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<BulkRow[]>(() =>
    Array.from({ length: 5 }, emptyBulkRow),
  );
  const [sharedGmail, setSharedGmail] = useState("");
  const [sharedTemplateId, setSharedTemplateId] = useState("");
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const [sendingEmail, setSendingEmail] = useState(false);
  const [addingToList, setAddingToList] = useState(false);

  const { data: gmailAccounts = [] } = useQuery<GmailAccount[]>({
    queryKey: ["gmail-accounts"],
    queryFn: async () => {
      const res = await api.get("/gmail/accounts");
      return res.data;
    },
    enabled: open,
  });
  const connectedAccounts = gmailAccounts.filter((a) => a.connected);

  const { data: templates = [] } = useQuery<
    { id: string; name: string; isDefault: boolean }[]
  >({
    queryKey: ["supplier-form-templates"],
    queryFn: async () => {
      const res = await api.get("/supplier-form-templates");
      return res.data;
    },
    enabled: open,
  });

  const updateCell = useCallback(
    (rowIdx: number, col: keyof BulkRow, value: string) => {
      setRows((prev) => {
        const next = [...prev];
        next[rowIdx] = { ...next[rowIdx], [col]: value };
        return next;
      });
      setErrors((prev) => {
        const n = new Set(prev);
        n.delete(rowIdx);
        return n;
      });
    },
    [],
  );

  const handlePaste = useCallback(
    (
      e: React.ClipboardEvent<HTMLInputElement>,
      rowIdx: number,
      colIdx: number,
    ) => {
      const text = e.clipboardData.getData("text");
      if (!text.includes("\t") && !text.includes("\n")) return;
      e.preventDefault();

      const pastedRows = text
        .split("\n")
        .map((l) => l.trimEnd())
        .filter((l) => l.length > 0)
        .map((l) => l.split("\t"));

      setRows((prev) => {
        const next = [...prev];
        pastedRows.forEach((cells, ri) => {
          const targetRow = rowIdx + ri;
          while (next.length <= targetRow) next.push(emptyBulkRow());
          cells.forEach((cell, ci) => {
            const targetCol = colIdx + ci;
            if (targetCol < BULK_COLS.length) {
              next[targetRow] = {
                ...next[targetRow],
                [BULK_COLS[targetCol].key]: cell.trim(),
              };
            }
          });
        });
        return next;
      });
    },
    [],
  );

  const addRows = () =>
    setRows((prev) => [...prev, ...Array.from({ length: 5 }, emptyBulkRow)]);

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setErrors((prev) => {
      const n = new Set<number>();
      prev.forEach((e) => {
        if (e < idx) n.add(e);
        else if (e > idx) n.add(e - 1);
      });
      return n;
    });
  };

  const handleClose = () => {
    setRows(Array.from({ length: 5 }, emptyBulkRow));
    setSharedGmail("");
    setSharedTemplateId("");
    setErrors(new Set());
    onClose();
  };

  function validateAndGetRows(): BulkRow[] | null {
    const newErrors = new Set<number>();
    rows.forEach((r, i) => {
      const hasAnyData = Object.values(r).some((v) => v.trim());
      if (hasAnyData && (!r.company.trim() || !r.email.trim())) newErrors.add(i);
    });

    if (newErrors.size > 0) {
      setErrors(newErrors);
      toast.error("Highlighted rows are missing Company Name or Email");
      return null;
    }

    const validRows = rows.filter((r) => r.company.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in at least one supplier");
      return null;
    }

    // Ensure all filled rows have email
    const missingEmail = validRows.some((r) => !r.email.trim());
    if (missingEmail) {
      const newErr = new Set<number>();
      rows.forEach((r, i) => {
        if (r.company.trim() && !r.email.trim()) newErr.add(i);
      });
      setErrors(newErr);
      toast.error("All suppliers must have an Email address");
      return null;
    }

    return validRows;
  }

  async function handleAddToList() {
    const validRows = validateAndGetRows();
    if (!validRows) return;

    setAddingToList(true);
    try {
      const res = await api.post(`/sourcing-vault/${folder.id}/suppliers`, {
        suppliers: validRows.map((r) => ({
          company: r.company.trim(),
          email: r.email.trim() || undefined,
          phone: r.phone.trim() || undefined,
          contactPerson: r.contactPerson.trim() || undefined,
          country: r.country.trim() || undefined,
          product: r.product.trim() || undefined,
          notes: r.notes.trim() || undefined,
        })),
      });
      toast.success(
        `Added ${res.data.added} supplier${res.data.added !== 1 ? "s" : ""} to list`,
      );
      onSuccess();
      handleClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(msg ?? "Failed to add to list");
    } finally {
      setAddingToList(false);
    }
  }

  async function handleSendBulkEmail() {
    const validRows = validateAndGetRows();
    if (!validRows) return;

    setSendingEmail(true);
    try {
      const res = await api.post(
        `/sourcing-vault/${folder.id}/suppliers/send`,
        {
          suppliers: validRows.map((r) => ({
            company: r.company.trim(),
            email: r.email.trim() || undefined,
            phone: r.phone.trim() || undefined,
            contactPerson: r.contactPerson.trim() || undefined,
            country: r.country.trim() || undefined,
            product: r.product.trim() || undefined,
            notes: r.notes.trim() || undefined,
          })),
          assignedGmailAccount: sharedGmail || undefined,
          formTemplateId: sharedTemplateId || undefined,
        },
      );
      toast.success(
        `Sent emails to ${res.data.added} supplier${res.data.added !== 1 ? "s" : ""}`,
      );
      onSuccess();
      handleClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(msg ?? "Failed to send bulk email");
    } finally {
      setSendingEmail(false);
    }
  }

  const filledCount = rows.filter((r) => r.company.trim()).length;
  const isWorking = sendingEmail || addingToList;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-[1200px] w-full max-h-[95vh] flex flex-col p-4">
        <DialogHeader>
          <DialogTitle>Add Suppliers to "{folder.name}"</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Fill in rows or paste a table from SpreadSheets — columns auto-fill
            on paste.
          </p>
        </DialogHeader>

        {/* Shared settings: Gmail + Form Template */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">
              Campaign Email Account
            </Label>
            {connectedAccounts.length === 0 ? (
              <span className="text-xs text-amber-600">
                No Gmail connected.{" "}
                <a href="/settings/gmail" className="underline">
                  Connect one
                </a>
              </span>
            ) : (
              <select
                value={sharedGmail}
                onChange={(e) => setSharedGmail(e.target.value)}
                className="border border-border rounded-md text-sm px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select account (optional)…</option>
                {connectedAccounts.map((a) => (
                  <option key={a.email} value={a.email}>
                    {a.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">
              Form Template
            </Label>
            <select
              value={sharedTemplateId}
              onChange={(e) => setSharedTemplateId(e.target.value)}
              className="border border-border rounded-md text-sm px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Default form</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault ? " (Default)" : ""}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-muted-foreground ml-auto">
            Used only when sending emails
          </span>
        </div>

        {/* Spreadsheet grid */}
        <div className="overflow-auto flex-1 rounded-lg border border-border">
          <table className="w-max text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="w-8 px-2 py-2 text-center text-muted-foreground font-normal text-xs">
                  #
                </th>
                {BULK_COLS.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left font-semibold text-muted-foreground text-xs border-l border-border whitespace-nowrap"
                    style={{ minWidth: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="w-8 px-2 py-2 border-l border-border" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const hasError = errors.has(ri);
                return (
                  <tr
                    key={ri}
                    className={`border-b border-border/60 ${hasError ? "bg-red-50" : ri % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                  >
                    <td className="px-2 py-1 text-center text-muted-foreground text-xs">
                      {ri + 1}
                    </td>
                    {BULK_COLS.map((col, ci) => (
                      <td
                        key={col.key}
                        className="px-1 py-1 border-l border-border/60"
                      >
                        <input
                          type="text"
                          className={`w-full px-2 py-1.5 rounded text-sm outline-none focus:ring-2 bg-transparent ${
                            hasError && col.required
                              ? "ring-2 ring-red-400 bg-red-50 placeholder-red-300"
                              : "focus:ring-primary/40 focus:bg-background"
                          }`}
                          placeholder={col.required ? "Required" : ""}
                          value={row[col.key]}
                          onChange={(e) =>
                            updateCell(ri, col.key, e.target.value)
                          }
                          onPaste={(e) => handlePaste(e, ri, ci)}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1 border-l border-border/60">
                      <button
                        onClick={() => removeRow(ri)}
                        tabIndex={-1}
                        className="p-1 rounded hover:bg-red-50 text-muted-foreground/40 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {errors.size > 0 && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Rows in red are missing Company Name or Email.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRows}
              disabled={isWorking}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add 5 Rows
            </Button>
            <span className="text-xs text-muted-foreground">
              {filledCount > 0
                ? `${filledCount} supplier${filledCount !== 1 ? "s" : ""} ready`
                : "Fill Company Name and Email to continue"}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isWorking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddToList}
              disabled={isWorking || filledCount === 0}
            >
              {addingToList ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Adding…
                </>
              ) : (
                "Add to List"
              )}
            </Button>
            <Button
              onClick={handleSendBulkEmail}
              disabled={isWorking || filledCount === 0}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Sending…
                </>
              ) : (
                "Send Bulk Email"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
