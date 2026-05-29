import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
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
  Pencil,
  Building2,
  Loader2,
  X,
  AlertCircle,
  Users,
  ChevronLeft,
  Mail,
  CheckCircle2,
  Send,
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
  FileDown,
  Upload,
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
import BuyersTabBar from "@/components/BuyersTabBar";

// ─── Types ───────────────────────────────────────────

interface VaultFolder {
  id: string;
  name: string;
  createdBy: string | null;
  creator: { fullName: string } | null;
  createdAt: string;
  supplierCount: number;
}

interface BuyerVaultContactItem {
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
  createdBy?: string | null;
  creator?: { fullName: string } | null;
}

interface GmailAccount {
  email: string;
  connected: boolean;
  label: string;
}

interface BulkRow {
  name: string;
  company: string;
  products: string;
  certifications: string;
  email: string;
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
    name: "",
    company: "",
    products: "",
    certifications: "",
    email: "",
  };
}

const BULK_COLS: {
  key: keyof BulkRow;
  label: string;
  required?: boolean;
  width: string;
}[] = [
  { key: "name", label: "Name *", required: true, width: "160px" },
  { key: "company", label: "Company *", required: true, width: "180px" },
  { key: "products", label: "Products", width: "180px" },
  { key: "certifications", label: "Certifications", width: "180px" },
  { key: "email", label: "Email *", required: true, width: "260px" },
];

// ─── Main Page ────────────────────────────────────────

export default function BuyersSourcingVaultPage() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission("sourcing_buyers");
  const queryClient = useQueryClient();

  const [currentFolder, setCurrentFolder] = useState<VaultFolder | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [folderSearch, setFolderSearch] = useState("");

  // ── Per-column filters (folder view) ──────────────
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterContact, setFilterContact] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterEmailStatus, setFilterEmailStatus] = useState("all");
  const [sourcedByFilter, setSourcedByFilter] = useState("all");

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<VaultFolder | null>(null);
  const [addContactOpen, setAddContactOpen] = useState(false);

  // ── Vault contact edit / delete ──────────────────
  const [deleteVaultContactTarget, setDeleteVaultContactTarget] =
    useState<BuyerVaultContactItem | null>(null);
  const [editVaultContactTarget, setEditVaultContactTarget] =
    useState<BuyerVaultContactItem | null>(null);
  const [editForm, setEditForm] = useState({
    company: "", email: "", phone: "", contactPerson: "",
    country: "", product: "", notes: "",
  });

  // ─── Root: folders query ───────────────────────────
  const { data: folders = [], isLoading: foldersLoading } = useQuery<
    VaultFolder[]
  >({
    queryKey: ["buyers-vault-folders"],
    queryFn: async () => {
      const res = await api.get("/buyers-vault");
      return res.data;
    },
  });

  // ─── Folder view: creators query ──────────────────
  const { data: creators = [] } = useQuery<{ id: string; fullName: string }[]>({
    queryKey: ["buyers-vault-creators", currentFolder?.id],
    queryFn: async () => {
      const res = await api.get(
        `/buyers-vault/${currentFolder!.id}/creators`,
      );
      return res.data;
    },
    enabled: !!currentFolder,
  });

  // ─── Folder view: vault contacts query (fetches all, filters client-side) ───
  const PAGE_SIZE = 20;
  const { data: allContacts = [], isLoading: contactsLoading } = useQuery<BuyerVaultContactItem[]>({
    queryKey: ["buyers-vault-contacts", currentFolder?.id],
    queryFn: async () => {
      const res = await api.get(`/buyers-vault/${currentFolder!.id}/suppliers`);
      return res.data;
    },
    enabled: !!currentFolder,
  });

  // ── Derive unique values for each filter dropdown ──
  const uniqueCompanies = [...new Set(allContacts.map((s) => s.company).filter(Boolean))].sort();
  const uniqueContacts = [...new Set(allContacts.map((s) => s.contactPerson ?? "").filter(Boolean))].sort();
  const uniqueCountries = [...new Set(allContacts.map((s) => s.country ?? "").filter(Boolean))].sort();
  const uniqueProducts = [...new Set(allContacts.map((s) => s.product ?? "").filter(Boolean))].sort();
  const uniqueEmailStatuses = [...new Set(allContacts.map((s) => s.emailStatus).filter(Boolean))].sort();

  // ── Apply all filters then paginate ───────────────
  const filteredContacts = allContacts.filter((s) => {
    const q = search.toLowerCase();
    if (q && ![
      s.company, s.email, s.contactPerson, s.country, s.product, s.notes,
    ].some((v) => v?.toLowerCase().includes(q))) return false;
    if (filterCompany !== "all" && s.company !== filterCompany) return false;
    if (filterContact !== "all" && (s.contactPerson ?? "") !== filterContact) return false;
    if (filterCountry !== "all" && (s.country ?? "") !== filterCountry) return false;
    if (filterProduct !== "all" && (s.product ?? "") !== filterProduct) return false;
    if (filterEmailStatus !== "all" && s.emailStatus !== filterEmailStatus) return false;
    if (sourcedByFilter !== "all") {
      const creatorName = creators.find((c) => c.id === sourcedByFilter)?.fullName;
      if (s.creator?.fullName !== creatorName) return false;
    }
    return true;
  });

  const totalFiltered = filteredContacts.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const contacts = filteredContacts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagination = { total: totalFiltered, pages: totalPages };

  const hasActiveFilters = filterCompany !== "all" || filterContact !== "all" ||
    filterCountry !== "all" || filterProduct !== "all" ||
    filterEmailStatus !== "all" || sourcedByFilter !== "all";

  function resetAllFilters() {
    setFilterCompany("all");
    setFilterContact("all");
    setFilterCountry("all");
    setFilterProduct("all");
    setFilterEmailStatus("all");
    setSourcedByFilter("all");
    setPage(1);
  }

  // ─── Vault contact mutations ──────────────────────
  const deleteVaultContactMutation = useMutation({
    mutationFn: (s: BuyerVaultContactItem) =>
      api.delete(`/buyers-vault/${s.folderId}/suppliers/${s.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers-vault-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["buyers-vault-folders"] });
      setDeleteVaultContactTarget(null);
      toast.success("Contact deleted from Buyers Vault");
    },
    onError: () => toast.error("Failed to delete contact"),
  });

  const updateVaultContactMutation = useMutation({
    mutationFn: (data: { s: BuyerVaultContactItem; form: typeof editForm }) =>
      api.put(`/buyers-vault/${data.s.folderId}/suppliers/${data.s.id}`, data.form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers-vault-contacts"] });
      setEditVaultContactTarget(null);
      toast.success("Contact updated");
    },
    onError: () => toast.error("Failed to update contact"),
  });

  // ─── Create folder mutation ────────────────────────
  const createFolderMutation = useMutation({
    mutationFn: (name: string) => api.post("/buyers-vault", { name }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["buyers-vault-folders"] });
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
    mutationFn: (id: string) => api.delete(`/buyers-vault/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers-vault-folders"] });
      toast.success("Folder deleted");
      setDeleteFolderTarget(null);
    },
    onError: () => toast.error("Failed to delete folder"),
  });

  function openFolder(folder: VaultFolder) {
    setCurrentFolder(folder);
    setSearch("");
    setPage(1);
    resetAllFilters();
  }

  function goToRoot() {
    setCurrentFolder(null);
    setSearch("");
    setPage(1);
    resetAllFilters();
  }

  const isAtRoot = currentFolder === null;

  return (
    <div className="space-y-5 p-6">
      <BuyersTabBar />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            Sourcing Vault
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organised buyer contact database by category
          </p>
        </div>

        <div className="flex gap-2">
          {!isAtRoot && (
            <Button
              variant="outline"
              size="sm"
              onClick={goToRoot}
              className="gap-1.5 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Folders
            </Button>
          )}
          {canEdit && (
            <>
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
                  onClick={() => setAddContactOpen(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  List/Bulk Email Buyers
                </Button>
              )}
            </>
          )}
        </div>
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

      {/* Root: folder search bar */}
      {isAtRoot && folders.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search folders…"
            className="pl-9"
            value={folderSearch}
            onChange={(e) => setFolderSearch(e.target.value)}
          />
          {folderSearch && (
            <button
              onClick={() => setFolderSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Folder view: search + column filters */}
      {!isAtRoot && (
        <div className="space-y-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search in ${currentFolder?.name}…`}
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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

          <div className="flex flex-wrap items-center gap-2">
            {uniqueCompanies.length > 0 && (
              <select
                value={filterCompany}
                onChange={(e) => { setFilterCompany(e.target.value); setPage(1); }}
                className="border border-border rounded-md text-sm px-3 h-8 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Companies</option>
                {uniqueCompanies.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
            {uniqueContacts.length > 0 && (
              <select
                value={filterContact}
                onChange={(e) => { setFilterContact(e.target.value); setPage(1); }}
                className="border border-border rounded-md text-sm px-3 h-8 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Contacts</option>
                {uniqueContacts.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
            {uniqueCountries.length > 0 && (
              <select
                value={filterCountry}
                onChange={(e) => { setFilterCountry(e.target.value); setPage(1); }}
                className="border border-border rounded-md text-sm px-3 h-8 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Countries</option>
                {uniqueCountries.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
            {uniqueProducts.length > 0 && (
              <select
                value={filterProduct}
                onChange={(e) => { setFilterProduct(e.target.value); setPage(1); }}
                className="border border-border rounded-md text-sm px-3 h-8 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Products</option>
                {uniqueProducts.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
            {uniqueEmailStatuses.length > 0 && (
              <select
                value={filterEmailStatus}
                onChange={(e) => { setFilterEmailStatus(e.target.value); setPage(1); }}
                className="border border-border rounded-md text-sm px-3 h-8 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                {uniqueEmailStatuses.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
            {creators.length > 0 && (
              <select
                value={sourcedByFilter}
                onChange={(e) => { setSourcedByFilter(e.target.value); setPage(1); }}
                className="border border-border rounded-md text-sm px-3 h-8 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Employees</option>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </select>
            )}
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

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
                Folders {folderSearch && `· ${folders.filter((f) => f.name.toLowerCase().includes(folderSearch.toLowerCase())).length} result${folders.filter((f) => f.name.toLowerCase().includes(folderSearch.toLowerCase())).length !== 1 ? "s" : ""}`}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {folders.filter((f) => f.name.toLowerCase().includes(folderSearch.toLowerCase())).map((folder) => {
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
                            {folder.supplierCount} contact
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

      {/* ── Folder view: vault contacts list ── */}
      {!isAtRoot && (
        <>
          {contactsLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading…
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Building2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">No contacts in this folder yet</p>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => setAddContactOpen(true)}
                  className="gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Contacts
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
                      Added By
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Date Added
                    </th>
                    {canEdit && (
                      <th className="text-right font-medium text-muted-foreground px-4 py-3">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contacts.map((s) => (
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
                            <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Users className="h-3 w-3 text-blue-600" />
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
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {s.emailStatus !== "Sent" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setEditVaultContactTarget(s);
                                  setEditForm({
                                    company: s.company,
                                    email: s.email ?? "",
                                    phone: s.phone ?? "",
                                    contactPerson: s.contactPerson ?? "",
                                    country: s.country ?? "",
                                    product: s.product ?? "",
                                    notes: s.notes ?? "",
                                  });
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setDeleteVaultContactTarget(s)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {pagination.pages} · {pagination.total}{" "}
                    contacts
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

      {/* ── Delete Vault Contact Confirm ── */}
      <AlertDialog
        open={!!deleteVaultContactTarget}
        onOpenChange={(v) => !v && setDeleteVaultContactTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete "{deleteVaultContactTarget?.company}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <strong>{deleteVaultContactTarget?.company}</strong> from the
              Buyers Sourcing Vault. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteVaultContactMutation.isPending}
              onClick={() =>
                deleteVaultContactTarget &&
                deleteVaultContactMutation.mutate(deleteVaultContactTarget)
              }
            >
              {deleteVaultContactMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Edit Vault Contact Dialog ── */}
      <Dialog
        open={!!editVaultContactTarget}
        onOpenChange={(v) => !v && setEditVaultContactTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {(["company", "email", "phone", "contactPerson", "country", "product", "notes"] as const).map((field) => (
              <div key={field}>
                <Label className="capitalize text-xs">
                  {field === "contactPerson" ? "Contact Person" : field}
                  {field === "company" ? " *" : ""}
                </Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={editForm[field]}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, [field]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditVaultContactTarget(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={!editForm.company.trim() || updateVaultContactMutation.isPending}
              onClick={() =>
                editVaultContactTarget &&
                updateVaultContactMutation.mutate({
                  s: editVaultContactTarget,
                  form: editForm,
                })
              }
            >
              {updateVaultContactMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                placeholder="e.g. US Buyers, Europe, Retail Chains…"
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
              The folder and all its staged contacts will be permanently removed.
              This action cannot be undone.
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
          open={addContactOpen}
          folder={currentFolder}
          onClose={() => setAddContactOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ["buyers-vault-contacts"],
            });
            queryClient.invalidateQueries({
              queryKey: ["buyers-vault-folders"],
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
  const [sharedEmailTemplateId, setSharedEmailTemplateId] = useState("");
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const [sendingEmail, setSendingEmail] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDownloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Name", "Company", "Products", "Certifications", "Email"],
    ]);
    ws["!cols"] = [
      { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Buyers");
    XLSX.writeFile(wb, "buyer_import_template.xlsx");
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (raw.length < 2) { toast.error("File has no data rows"); return; }

        const headers = (raw[0] as string[]).map((h) => String(h ?? "").toLowerCase().trim());
        const colMap: Record<number, keyof BulkRow> = {};
        headers.forEach((h, i) => {
          if (h.includes("name"))                                    colMap[i] = "name";
          else if (h.includes("company"))                            colMap[i] = "company";
          else if (h.includes("product"))                            colMap[i] = "products";
          else if (h.includes("certif"))                             colMap[i] = "certifications";
          else if (h.includes("email"))                              colMap[i] = "email";
        });

        const parsed: BulkRow[] = raw
          .slice(1)
          .filter((row) => row.some((c) => String(c).trim()))
          .map((row) => {
            const r = emptyBulkRow();
            Object.entries(colMap).forEach(([ci, key]) => {
              const val = row[Number(ci)];
              if (val != null) r[key] = String(val).trim();
            });
            return r;
          });

        if (parsed.length === 0) { toast.error("No valid rows found in file"); return; }

        const padded = parsed.length < 5
          ? [...parsed, ...Array.from({ length: 5 - parsed.length }, emptyBulkRow)]
          : parsed;
        setRows(padded);
        setErrors(new Set());
        toast.success(`Imported ${parsed.length} row${parsed.length !== 1 ? "s" : ""} from file`);
      } catch {
        toast.error("Failed to read file — make sure it's a valid Excel or CSV file");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [pendingRows, setPendingRows] = useState<BulkRow[]>([]);

  const { data: gmailAccounts = [] } = useQuery<GmailAccount[]>({
    queryKey: ["gmail-accounts"],
    queryFn: async () => {
      const res = await api.get("/gmail/accounts");
      return res.data;
    },
    enabled: open,
  });
  const connectedAccounts = gmailAccounts.filter(
    (a) => a.connected && !/procurement[12]/i.test(a.email),
  );

  const { data: emailTemplates = [] } = useQuery<
    { id: string; name: string; isDefault: boolean }[]
  >({
    queryKey: ["buyer-email-campaign-templates"],
    queryFn: async () => {
      const res = await api.get("/buyer-email-templates");
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
    setSharedEmailTemplateId("");
    setErrors(new Set());
    onClose();
  };

  function validateAndGetRows(): BulkRow[] | null {
    const newErrors = new Set<number>();
    rows.forEach((r, i) => {
      const hasAnyData = Object.values(r).some((v) => v.trim());
      if (hasAnyData && (!r.name.trim() || !r.company.trim() || !r.email.trim()))
        newErrors.add(i);
    });

    if (newErrors.size > 0) {
      setErrors(newErrors);
      toast.error("Highlighted rows are missing Name, Company, or Email");
      return null;
    }

    const validRows = rows.filter((r) => r.name.trim() || r.company.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in at least one contact");
      return null;
    }

    const missingRequired = validRows.some((r) => !r.name.trim() || !r.company.trim() || !r.email.trim());
    if (missingRequired) {
      const newErr = new Set<number>();
      rows.forEach((r, i) => {
        if ((r.name.trim() || r.company.trim()) && (!r.name.trim() || !r.company.trim() || !r.email.trim()))
          newErr.add(i);
      });
      setErrors(newErr);
      toast.error("All contacts must have a Name, Company, and Email");
      return null;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmailRows = new Set<number>();
    rows.forEach((r, i) => {
      if (!validRows.includes(r)) return;
      const parts = r.email.trim().split(";").map((e) => e.trim()).filter(Boolean);
      if (parts.some((e) => !emailRegex.test(e))) invalidEmailRows.add(i);
    });
    if (invalidEmailRows.size > 0) {
      setErrors(invalidEmailRows);
      toast.error("One or more email addresses are invalid. Use semicolons to separate multiple emails.");
      return null;
    }

    return validRows;
  }

  async function handleAddToList() {
    const validRows = validateAndGetRows();
    if (!validRows) return;

    setAddingToList(true);
    try {
      const res = await api.post(`/buyers-vault/${folder.id}/suppliers`, {
        suppliers: validRows.map((r) => ({
          contactPerson: r.name.trim() || undefined,
          company: r.company.trim(),
          product: r.products.trim() || undefined,
          notes: r.certifications.trim() || undefined,
          email: r.email.trim() || undefined,
        })),
      });
      toast.success(
        `Added ${res.data.added} contact${res.data.added !== 1 ? "s" : ""} to list`,
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

  function handleSendBulkEmailClick() {
    const validRows = validateAndGetRows();
    if (!validRows) return;
    setPendingRows(validRows);
    setConfirmSendOpen(true);
  }

  async function handleSendBulkEmailConfirmed() {
    setConfirmSendOpen(false);
    setSendingEmail(true);
    try {
      const res = await api.post(
        `/buyers-vault/${folder.id}/suppliers/send`,
        {
          suppliers: pendingRows.map((r) => ({
            contactPerson: r.name.trim() || undefined,
            company: r.company.trim(),
            product: r.products.trim() || undefined,
            notes: r.certifications.trim() || undefined,
            email: r.email.trim() || undefined,
          })),
          assignedGmailAccount: sharedGmail || undefined,
          emailTemplateId: sharedEmailTemplateId || undefined,
        },
      );
      const { added } = res.data;
      toast.success(`${added} contact${added !== 1 ? "s" : ""} added — emails sending in background`);
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

  const filledCount = rows.filter((r) => r.name.trim() || r.company.trim()).length;
  const isWorking = sendingEmail || addingToList;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-[1200px] w-full max-h-[95vh] flex flex-col p-4">
        <DialogHeader>
          <DialogTitle>Add Contacts to "{folder.name}"</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Fill in rows or paste a table from SpreadSheets — columns auto-fill
            on paste.
          </p>
        </DialogHeader>

        {/* Shared settings: Gmail + Email Template */}
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
              Email Template
            </Label>
            <select
              value={sharedEmailTemplateId}
              onChange={(e) => setSharedEmailTemplateId(e.target.value)}
              className="border border-border rounded-md text-sm px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">System default</option>
              {emailTemplates.map((t) => (
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

        {/* Import / Template buttons */}
        <div className="flex items-center gap-2 py-1">
          <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <FileDown className="h-4 w-4 mr-1.5" />
            Download Template
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1.5" />
            Import Excel / CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <span className="text-xs text-muted-foreground ml-1">
            Download the template first, fill it in, then import.
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
                          placeholder={col.key === "email" ? "abc@xyz.com; def@xyz.com" : col.required ? "Required" : ""}
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
                ? `${filledCount} contact${filledCount !== 1 ? "s" : ""} ready`
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
              onClick={handleSendBulkEmailClick}
              disabled={isWorking || filledCount === 0 || !sharedGmail || !sharedEmailTemplateId}
              title={
                !sharedGmail
                  ? "Select a campaign email account first"
                  : !sharedEmailTemplateId
                  ? "Select an email template first"
                  : undefined
              }
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  Send Bulk Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* ── Send Bulk Email confirmation ── */}
      <AlertDialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-11 w-11 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <AlertDialogTitle className="text-base leading-snug">
                Send bulk emails to buyers?
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
                      Add <strong>{pendingRows.length} contact{pendingRows.length !== 1 ? "s" : ""}</strong> to the Buyers Sourcing Vault
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>
                      Send intro emails <strong>immediately</strong>
                      {sharedGmail ? <> via <strong>{sharedGmail}</strong></> : ""}
                    </span>
                  </li>
                </ul>
                {!sharedGmail && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    No Gmail account selected — contacts will be added to the vault but <strong>no emails will be sent</strong>.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendBulkEmailConfirmed}>
              <Send className="h-4 w-4 mr-1.5" />
              Confirm &amp; Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
