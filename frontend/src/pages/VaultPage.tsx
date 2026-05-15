import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Search,
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
  Folder,
  FolderPlus,
  ChevronRight,
  Home,
  ArrowLeft,
  FolderOpen,
  Package,
  Camera,
  FileSignature,
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

interface VaultDocument {
  id: string;
  name: string;
  category: string;
  region: string;
  fileUrl: string | null;
  publicId: string | null;
  fileType: string | null;
  isFolder: boolean;
  parentId: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
  uploader?: { fullName: string; email: string } | null;
  _count?: { children: number };
}

interface Breadcrumb {
  id: string;
  name: string;
}

// ─── Category colours & icons ────────────────────────

const CATEGORY_META: Record<
  string,
  { color: string; bg: string; gradient: string; Icon: React.FC<{ className?: string }> }
> = {
  Certifications: {
    color: "text-amber-600",
    bg: "bg-amber-50",
    gradient: "from-amber-500 to-orange-500",
    Icon: Award,
  },
  "Product Catalogs": {
    color: "text-blue-600",
    bg: "bg-blue-50",
    gradient: "from-blue-500 to-indigo-500",
    Icon: Package,
  },
  "Warehouse Photos": {
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    gradient: "from-emerald-500 to-teal-500",
    Icon: Camera,
  },
  Contracts: {
    color: "text-purple-600",
    bg: "bg-purple-50",
    gradient: "from-purple-500 to-violet-500",
    Icon: FileSignature,
  },
  Pricing: {
    color: "text-rose-600",
    bg: "bg-rose-50",
    gradient: "from-rose-500 to-pink-500",
    Icon: DollarSign,
  },
  "Trade Rules": {
    color: "text-sky-600",
    bg: "bg-sky-50",
    gradient: "from-sky-500 to-cyan-500",
    Icon: Globe,
  },
  "HS Codes": {
    color: "text-violet-600",
    bg: "bg-violet-50",
    gradient: "from-violet-500 to-purple-500",
    Icon: BarChart2,
  },
  "FTA Database": {
    color: "text-teal-600",
    bg: "bg-teal-50",
    gradient: "from-teal-500 to-green-500",
    Icon: Database,
  },
  Quotation: {
    color: "text-rose-600",
    bg: "bg-rose-50",
    gradient: "from-rose-500 to-pink-500",
    Icon: FileText,
  },
};

const FALLBACK_META = {
  color: "text-slate-600",
  bg: "bg-slate-50",
  gradient: "from-slate-500 to-gray-500",
  Icon: Folder,
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? FALLBACK_META;
}

// ─── File-type icon ──────────────────────────────────

function FileTypeIcon({
  fileType,
  className,
}: {
  fileType: string | null;
  className?: string;
}) {
  if (fileType === "image") return <Image className={className} />;
  if (fileType === "sheet") return <FileSpreadsheet className={className} />;
  if (fileType === "pdf" || fileType === "doc")
    return <FileText className={className} />;
  return <File className={className} />;
}

// ─── Default categories for upload picker ────────────

const UPLOAD_CATEGORIES = [
  "Certifications",
  "Product Catalogs",
  "Warehouse Photos",
  "Contracts",
  "Pricing",
  "Trade Rules",
  "HS Codes",
  "FTA Database",
  "Quotation",
];

// ─── Main Page ───────────────────────────────────────

export default function VaultPage() {
  const { isAdmin, hasEditPermission } = useAuth();
  const canEdit = isAdmin || hasEditPermission("vault");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

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

  // New Folder dialog
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

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
    queryKey: ["vault-documents", currentFolderId, search],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) {
        params.search = search;
      } else if (currentFolderId) {
        params.parentId = currentFolderId;
      }
      const res = await api.get("/vault", { params });
      return res.data;
    },
  });

  const { data: breadcrumbs = [] } = useQuery<Breadcrumb[]>({
    queryKey: ["vault-breadcrumbs", currentFolderId],
    queryFn: async () => {
      if (!currentFolderId) return [];
      const res = await api.get(`/vault/breadcrumbs/${currentFolderId}`);
      return res.data;
    },
    enabled: !!currentFolderId,
  });

  // Separate folders and files
  const folders = documents.filter((d) => d.isFolder);
  const files = documents.filter((d) => !d.isFolder);

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

  // ─── Folder mutation ─────────────────────────────────

  const folderMutation = useMutation({
    mutationFn: async (data: { name: string; parentId: string | null }) => {
      const res = await api.post("/vault/folder", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Folder created");
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      queryClient.invalidateQueries({ queryKey: ["vault-categories"] });
      setFolderOpen(false);
      setFolderName("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? "Create folder failed");
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
      toast.success("Deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      queryClient.invalidateQueries({ queryKey: ["vault-categories"] });
      setDeleteDoc(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? "Delete failed");
    },
  });

  // ─── Handlers ────────────────────────────────────────

  function navigateToFolder(folderId: string | null) {
    setSearch("");
    setCurrentFolderId(folderId);
  }

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
    if (currentFolderId) fd.append("parentId", currentFolderId);
    uploadMutation.mutate(fd);
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function openEdit(doc: VaultDocument) {
    setEditDoc(doc);
    setEditForm({ name: doc.name, category: doc.category, region: doc.region });
  }

  function handleEditSubmit() {
    if (!editDoc) return;
    editMutation.mutate({ id: editDoc.id, data: editForm });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const isAtRoot = currentFolderId === null && !search;

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            Vault
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Google Drive-style document storage with auto-organized supplier files
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setFolderOpen(true)}
              className="gap-2"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </Button>
            <Button onClick={() => setUploadOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        )}
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm">
        <button
          onClick={() => navigateToFolder(null)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
            isAtRoot
              ? "text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Home className="h-3.5 w-3.5" />
          Vault
        </button>
        {breadcrumbs.map((crumb, idx) => (
          <div key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <button
              onClick={() => navigateToFolder(crumb.id)}
              className={`px-2 py-1 rounded-md transition-colors ${
                idx === breadcrumbs.length - 1
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {crumb.name}
            </button>
          </div>
        ))}
      </div>

      {/* Search + Back bar */}
      <div className="flex items-center gap-3">
        {!isAtRoot && !search && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (breadcrumbs.length > 1) {
                navigateToFolder(breadcrumbs[breadcrumbs.length - 2].id);
              } else {
                navigateToFolder(null);
              }
            }}
            className="gap-1 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search all documents..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value) setCurrentFolderId(null);
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
        <span className="text-sm text-muted-foreground ml-auto">
          {folders.length > 0 && (
            <span>
              {folders.length} folder{folders.length !== 1 ? "s" : ""}
              {files.length > 0 && ", "}
            </span>
          )}
          {files.length > 0 && (
            <span>
              {files.length} file{files.length !== 1 ? "s" : ""}
            </span>
          )}
          {folders.length === 0 && files.length === 0 && !docsLoading && "Empty"}
        </span>
      </div>

      {/* Content area */}
      {docsLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <div className="h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin mr-2" />
          Loading…
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          {search ? (
            <>
              <Search className="h-10 w-10 opacity-30" />
              <p className="text-sm">No results for "{search}"</p>
            </>
          ) : (
            <>
              <FolderOpen className="h-10 w-10 opacity-30" />
              <p className="text-sm">This folder is empty</p>
              {canEdit && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFolderOpen(true)}
                    className="gap-1"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    New Folder
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setUploadOpen(true)}
                    className="gap-1"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload File
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Folders Grid */}
          {folders.length > 0 && (
            <div>
              {!search && (
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Folders
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {folders.map((folder) => {
                  const { gradient, Icon } = getCategoryMeta(
                    folder.category
                  );
                  const childCount = folder._count?.children ?? 0;
                  return (
                    <div
                      key={folder.id}
                      className="group relative"
                    >
                      <button
                        onClick={() => navigateToFolder(folder.id)}
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
                            {childCount} item{childCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </button>
                      {/* Folder actions (hover) */}
                      {canEdit && (
                        <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 bg-card/80 backdrop-blur-sm shadow-sm"
                            title="Rename"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(folder);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 bg-card/80 backdrop-blur-sm shadow-sm text-destructive hover:text-destructive"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDoc(folder);
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

          {/* Files Table */}
          {files.length > 0 && (
            <div>
              {!search && folders.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Files
                </p>
              )}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[minmax(0,1fr)_140px_140px_180px_80px] items-stretch border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="px-4 py-2.5 border-r border-border">
                    File
                  </span>
                  <span className="px-4 py-2.5 border-r border-border">
                    Category
                  </span>
                  <span className="px-4 py-2.5 border-r border-border">
                    Region
                  </span>
                  <span className="px-4 py-2.5 border-r border-border">
                    Modified
                  </span>
                  <span className="px-4 py-2.5 text-right">Actions</span>
                </div>

                <div className="divide-y divide-border">
                  {files.map((doc) => {
                    const {
                      color,
                      bg,
                      Icon: CatIcon,
                    } = getCategoryMeta(doc.category);
                    return (
                      <div
                        key={doc.id}
                        className="grid grid-cols-[minmax(0,1fr)_140px_140px_180px_80px] items-stretch hover:bg-muted/30 transition-colors group last:border-0"
                      >
                        {/* Name + type icon */}
                        <div className="flex items-center gap-3 min-w-0 px-4 py-3 border-r border-border">
                          <div className={`shrink-0 rounded-lg p-2 ${bg}`}>
                            <FileTypeIcon
                              fileType={doc.fileType}
                              className={`h-4 w-4 ${color}`}
                            />
                          </div>
                          <div className="min-w-0">
                            {doc.fileUrl ? (
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
                            ) : (
                              <span className="font-medium text-sm truncate">
                                {doc.name}
                              </span>
                            )}
                            {doc.uploader && (
                              <p className="text-xs text-muted-foreground truncate">
                                {doc.uploader.fullName}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Category */}
                        <div className="flex items-center gap-1.5 px-4 py-3 border-r border-border">
                          <CatIcon
                            className={`h-3.5 w-3.5 shrink-0 ${color}`}
                          />
                          <span className={`text-xs font-medium ${color}`}>
                            {doc.category}
                          </span>
                        </div>

                        {/* Region */}
                        <span className="flex items-center px-4 py-3 text-sm text-muted-foreground border-r border-border">
                          {doc.region}
                        </span>

                        {/* Date */}
                        <span className="flex items-center px-4 py-3 text-xs text-muted-foreground border-r border-border">
                          {formatDate(doc.updatedAt)}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1 px-4 py-3">
                          {canEdit && (
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Upload Dialog ─────────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Document
              {currentFolderId && breadcrumbs.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  into {breadcrumbs[breadcrumbs.length - 1]?.name}
                </span>
              )}
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
                onChange={(e) =>
                  handleFileSelect(e.target.files?.[0] ?? null)
                }
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.jfif,.gif,.webp,.zip"
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
                placeholder="e.g. ISO_9001_Certificate"
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
                {UPLOAD_CATEGORIES.map((cat) => (
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

      {/* ─── New Folder Dialog ──────────────────────────── */}
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-4 w-4" />
              New Folder
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Folder Name</Label>
            <Input
              placeholder="e.g. Q4 Reports"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="mt-1.5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && folderName.trim()) {
                  folderMutation.mutate({
                    name: folderName.trim(),
                    parentId: currentFolderId,
                  });
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                folderMutation.mutate({
                  name: folderName.trim(),
                  parentId: currentFolderId,
                })
              }
              disabled={!folderName.trim() || folderMutation.isPending}
              className="gap-2"
            >
              {folderMutation.isPending ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <FolderPlus className="h-4 w-4" />
                  Create
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
              {editDoc?.isFolder ? "Rename Folder" : "Edit Document"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{editDoc?.isFolder ? "Folder Name" : "Document Name"} *</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            {!editDoc?.isFolder && (
              <>
                <div className="space-y-1.5">
                  <Label>Category *</Label>
                  <div className="flex gap-2 flex-wrap mb-1">
                    {UPLOAD_CATEGORIES.map((cat) => (
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
              </>
            )}
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
            <AlertDialogTitle>
              Delete {deleteDoc?.isFolder ? "Folder" : "Document"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteDoc?.name}</strong> will be permanently removed
              {deleteDoc?.isFolder
                ? " along with all its contents"
                : " from Cloudinary"}
              {" and cannot be recovered."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteDoc && deleteMutation.mutate(deleteDoc.id)
              }
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
