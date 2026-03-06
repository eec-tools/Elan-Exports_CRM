import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Search,
  ChevronDown,
  Pencil,
  Trash2,
  X,
  DollarSign,
  Globe,
  Award,
  BarChart2,
  Database,
  File,
  Image,
  FileSpreadsheet,
  ExternalLink,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface VaultDocument {
  id: string;
  name: string;
  category: string;
  region: string;
  fileUrl: string;
  publicId: string;
  fileType: string;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
  uploader?: { fullName: string; email: string } | null;
}

interface CategoryStat {
  category: string;
  count: number;
}

// ─── Category colours & icons ────────────────────────

const CATEGORY_META: Record<
  string,
  { color: string; bg: string; Icon: React.FC<{ className?: string }> }
> = {
  Pricing: {
    color: "text-rose-500",
    bg: "bg-rose-100",
    Icon: DollarSign,
  },
  "Trade Rules": {
    color: "text-blue-500",
    bg: "bg-blue-100",
    Icon: Globe,
  },
  Certifications: {
    color: "text-amber-500",
    bg: "bg-amber-100",
    Icon: Award,
  },
  "HS Codes": {
    color: "text-violet-500",
    bg: "bg-violet-100",
    Icon: BarChart2,
  },
  "FTA Database": {
    color: "text-emerald-500",
    bg: "bg-emerald-100",
    Icon: Database,
  },
};

const FALLBACK_META = {
  color: "text-sky-500",
  bg: "bg-sky-100",
  Icon: FileText,
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? FALLBACK_META;
}

// ─── File-type icon ──────────────────────────────────

function FileTypeIcon({
  fileType,
  className,
}: {
  fileType: string;
  className?: string;
}) {
  if (fileType === "image") return <Image className={className} />;
  if (fileType === "sheet") return <FileSpreadsheet className={className} />;
  if (fileType === "pdf" || fileType === "doc")
    return <FileText className={className} />;
  return <File className={className} />;
}

// ─── Default categories shown in the header row ──────

const DEFAULT_CATEGORIES = [
  "Pricing",
  "Trade Rules",
  "Certifications",
  "HS Codes",
  "FTA Database",
];

// ─── Main Page ───────────────────────────────────────

export default function VaultPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: "",
    category: "",
    region: "Global",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit dialog
  const [editDoc, setEditDoc] = useState<VaultDocument | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "",
    region: "",
  });

  // Delete dialog
  const [deleteDoc, setDeleteDoc] = useState<VaultDocument | null>(null);

  // ─── Queries ────────────────────────────────────────

  const { data: documents = [], isLoading: docsLoading } = useQuery<
    VaultDocument[]
  >({
    queryKey: ["vault-documents", activeCategory, search],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (activeCategory !== "all") params.category = activeCategory;
      if (search) params.search = search;
      const res = await api.get("/vault", { params });
      return res.data;
    },
  });

  const { data: categoryStats = [] } = useQuery<CategoryStat[]>({
    queryKey: ["vault-categories"],
    queryFn: async () => {
      const res = await api.get("/vault/categories");
      return res.data;
    },
  });

  // Build category count map
  const catCountMap: Record<string, number> = {};
  categoryStats.forEach((s) => {
    catCountMap[s.category] = s.count;
  });

  // Show default list + any extras from actual data
  const allCategories = [
    ...DEFAULT_CATEGORIES,
    ...categoryStats
      .map((s) => s.category)
      .filter((c) => !DEFAULT_CATEGORIES.includes(c)),
  ];

  // ─── Upload mutation ─────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const res = await api.post("/vault/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      queryClient.invalidateQueries({ queryKey: ["vault-categories"] });
      setUploadOpen(false);
      setUploadForm({ name: "", category: "", region: "Global" });
      setUploadFile(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? "Upload failed");
    },
  });

  // ─── Edit mutation ───────────────────────────────────

  const editMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name: string; category: string; region: string };
    }) => {
      const res = await api.put(`/vault/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Document updated");
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      queryClient.invalidateQueries({ queryKey: ["vault-categories"] });
      setEditDoc(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? "Update failed");
    },
  });

  // ─── Delete mutation ─────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/vault/${id}`);
    },
    onSuccess: () => {
      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      queryClient.invalidateQueries({ queryKey: ["vault-categories"] });
      setDeleteDoc(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? "Delete failed");
    },
  });

  // ─── Upload handlers ─────────────────────────────────

  function handleFileSelect(file: File | null) {
    if (file) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "") || file.name;
      setUploadForm((prev) => {
        const prevExtracted = uploadFile
          ? uploadFile.name.replace(/\.[^/.]+$/, "") || uploadFile.name
          : "";
        if (!prev.name || prev.name === prevExtracted) {
          return { ...prev, name: nameWithoutExt };
        }
        return prev;
      });
    }
    setUploadFile(file);
  }

  function handleUploadSubmit() {
    if (!uploadFile) {
      toast.error("Please select a file");
      return;
    }
    if (!uploadForm.name || !uploadForm.category) {
      toast.error("Name and category are required");
      return;
    }
    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("name", uploadForm.name);
    fd.append("category", uploadForm.category);
    fd.append("region", uploadForm.region);
    uploadMutation.mutate(fd);
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  // ─── Edit handlers ───────────────────────────────────

  function openEdit(doc: VaultDocument) {
    setEditDoc(doc);
    setEditForm({ name: doc.name, category: doc.category, region: doc.region });
  }

  function handleEditSubmit() {
    if (!editDoc) return;
    editMutation.mutate({ id: editDoc.id, data: editForm });
  }

  // ─── Formatters ──────────────────────────────────────

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vault</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Centralised storage for documents, certifications, and media files
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        )}
      </div>

      {/* Search + Category filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="gap-2 min-w-[160px] justify-between"
            >
              {activeCategory === "all" ? "All Categories" : activeCategory}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[180px]">
            <DropdownMenuItem onClick={() => setActiveCategory("all")}>
              All Categories
            </DropdownMenuItem>
            {allCategories.map((cat) => (
              <DropdownMenuItem
                key={cat}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-sm text-muted-foreground ml-auto">
          {documents.length} document{documents.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {allCategories.map((cat) => {
          const { color, bg, Icon } = getCategoryMeta(cat);
          const count = catCountMap[cat] ?? 0;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() =>
                setActiveCategory(activeCategory === cat ? "all" : cat)
              }
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:shadow-md ${
                isActive
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className={`rounded-lg p-2.5 ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs font-semibold leading-tight">{cat}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {count} doc{count !== 1 ? "s" : ""}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Document list / table */}
      <div className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-card overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[minmax(0,1fr)_160px_160px_200px_80px] items-stretch border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="px-4 py-2.5 border-r border-neutral-300 dark:border-neutral-700">
            Document
          </span>
          <span className="px-4 py-2.5 border-r border-neutral-300 dark:border-neutral-700">
            Category
          </span>
          <span className="px-4 py-2.5 border-r border-neutral-300 dark:border-neutral-700">
            Region
          </span>
          <span className="px-4 py-2.5 border-r border-neutral-300 dark:border-neutral-700">
            Last Updated
          </span>
          <span className="px-4 py-2.5 text-right">Actions</span>
        </div>

        {docsLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin mr-2" />
            Loading…
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">No documents found</p>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setUploadOpen(true)}
                className="gap-1"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload your first document
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {documents.map((doc) => {
              const {
                color,
                bg,
                Icon: CatIcon,
              } = getCategoryMeta(doc.category);
              return (
                <div
                  key={doc.id}
                  className="grid grid-cols-[minmax(0,1fr)_160px_160px_200px_80px] items-stretch border-b hover:bg-muted/30 transition-colors group last:border-0"
                >
                  {/* Name + type icon */}
                  <div className="flex items-center gap-3 min-w-0 px-4 py-3 border-r border-neutral-300 dark:border-neutral-700">
                    <div className={`shrink-0 rounded-lg p-2 ${bg}`}>
                      <FileTypeIcon
                        fileType={doc.fileType}
                        className={`h-4 w-4 ${color}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm truncate hover:underline flex items-center gap-1 group/link"
                        title={doc.name}
                      >
                        <span className="truncate">{doc.name}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                      </a>
                      {doc.uploader && (
                        <p className="text-xs text-muted-foreground truncate">
                          {doc.uploader.fullName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="flex items-center gap-1.5 px-4 py-3 border-r border-neutral-300 dark:border-neutral-700">
                    <CatIcon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                    <span className={`text-sm font-medium ${color}`}>
                      {doc.category}
                    </span>
                  </div>

                  {/* Region */}
                  <span className="flex items-center px-4 py-3 text-sm text-muted-foreground border-r border-neutral-300 dark:border-neutral-700">
                    {doc.region}
                  </span>

                  {/* Date */}
                  <span className="flex items-center px-4 py-3 text-xs text-muted-foreground border-r border-neutral-300 dark:border-neutral-700">
                    {formatDate(doc.updatedAt)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 px-4 py-3">
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit"
                          onClick={() => openEdit(doc)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          title="Delete"
                          onClick={() => setDeleteDoc(doc)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Upload Dialog ─────────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Document
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip"
              />
              {uploadFile ? (
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium truncate max-w-[250px]">
                    {uploadFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileSelect(null);
                    }}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    Click or drag & drop a file
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOC, Excel, Images — up to 50 MB
                  </p>
                </>
              )}
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Document Name *</Label>
              <Input
                placeholder="e.g. India-EU FTA Tariff Schedule"
                value={uploadForm.name}
                onChange={(e) =>
                  setUploadForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <div className="flex gap-2 flex-wrap mb-1">
                {DEFAULT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setUploadForm((f) => ({ ...f, category: cat }))
                    }
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      uploadForm.category === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Or type a custom category"
                value={uploadForm.category}
                onChange={(e) =>
                  setUploadForm((f) => ({ ...f, category: e.target.value }))
                }
              />
            </div>

            {/* Region */}
            <div className="space-y-1.5">
              <Label>Region</Label>
              <Input
                placeholder="Global, EU, North America…"
                value={uploadForm.region}
                onChange={(e) =>
                  setUploadForm((f) => ({ ...f, region: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadOpen(false)}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={uploadMutation.isPending}
              className="gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ───────────────────────────────── */}
      <Dialog open={!!editDoc} onOpenChange={(o) => !o && setEditDoc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit Document
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Document Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category *</Label>
              <div className="flex gap-2 flex-wrap mb-1">
                {DEFAULT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setEditForm((f) => ({ ...f, category: cat }))
                    }
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      editForm.category === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Or type a custom category"
                value={editForm.category}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, category: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Region</Label>
              <Input
                value={editForm.region}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, region: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDoc(null)}
              disabled={editMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={editMutation.isPending}
              className="gap-2"
            >
              {editMutation.isPending ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ────────────────────────────── */}
      <AlertDialog
        open={!!deleteDoc}
        onOpenChange={(o) => !o && setDeleteDoc(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteDoc?.name}</strong> will be permanently removed
              from Cloudinary and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDoc && deleteMutation.mutate(deleteDoc.id)}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
