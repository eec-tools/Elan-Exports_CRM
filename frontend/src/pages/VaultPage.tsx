import { useState, useRef, useEffect } from "react";
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
  Loader2,
  Check,
  AlertCircle,
  Eye,
  History,
  RefreshCw,
  Lock,
  CalendarClock,
  Download,
  LayoutList,
  LayoutGrid,
  Copy,
  Scissors,
  ClipboardPaste,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
  expiryDate: string | null;
  canEdit?: boolean;
  createdAt: string;
  updatedAt: string;
  uploader?: { fullName: string; email: string } | null;
  _count?: { children: number };
}

interface VaultDocumentVersion {
  id: string;
  documentId: string;
  versionNum: number;
  name: string;
  fileUrl: string;
  publicId: string | null;
  fileType: string | null;
  createdAt: string;
  uploader?: { fullName: string; email: string } | null;
}

interface FolderPolicy {
  canRead: boolean;
  canEdit: boolean;
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
    expiryDate: "",
  });
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ file: File; status: "pending" | "uploading" | "done" | "error" }[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview dialog
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null);

  // Regenerate reports
  const [regenerating, setRegenerating] = useState(false);
  async function handleRegenerateReports() {
    setRegenerating(true);
    try {
      await api.post("/cron-reports/run-missed");
      toast.success("Reports are being regenerated — check the vault in ~1 minute.");
    } catch {
      toast.error("Failed to trigger report regeneration.");
    } finally {
      setRegenerating(false);
    }
  }

  // Replace dialog
  const [replaceDoc, setReplaceDoc] = useState<VaultDocument | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceStatus, setReplaceStatus] = useState<"idle" | "uploading" | "saving" | "done" | "error">("idle");
  const replaceFileRef = useRef<HTMLInputElement>(null);

  // Version history sheet
  const [historyDoc, setHistoryDoc] = useState<VaultDocument | null>(null);

  // New Folder dialog
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  // Edit dialog
  const [editDoc, setEditDoc] = useState<VaultDocument | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "",
    region: "",
    expiryDate: "",
  });

  // Delete dialog
  const [deleteDoc, setDeleteDoc] = useState<VaultDocument | null>(null);

  // View mode: list or block
  const [viewMode, setViewMode] = useState<"list" | "block">("list");

  // Drag & drop
  const [draggedItem, setDraggedItem] = useState<VaultDocument | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Clipboard (copy / cut / paste)
  const [clipboard, setClipboard] = useState<{ item: VaultDocument; mode: "copy" | "cut" } | null>(null);

  // Context menu
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; doc: VaultDocument } | null>(null);

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

  // Expiry alerts — certifications expiring within 60 days
  const { data: expiryAlerts = [] } = useQuery<VaultDocument[]>({
    queryKey: ["vault-expiry-alerts"],
    queryFn: async () => {
      const res = await api.get("/vault/expiry-alerts");
      return res.data;
    },
  });
  const [expiryBannerDismissed, setExpiryBannerDismissed] = useState(false);

  // Folder-level policy for current folder
  const { data: folderPolicy } = useQuery<FolderPolicy>({
    queryKey: ["vault-folder-policy", currentFolderId],
    queryFn: async () => {
      const res = await api.get("/vault/folder-policy", {
        params: { folderId: currentFolderId ?? "" },
      });
      return res.data;
    },
  });
  const canEditHere = folderPolicy ? folderPolicy.canEdit : canEdit;

  // Version history for selected doc
  const { data: versions = [], isLoading: versionsLoading } = useQuery<VaultDocumentVersion[]>({
    queryKey: ["vault-versions", historyDoc?.id],
    queryFn: async () => {
      const res = await api.get(`/vault/${historyDoc!.id}/versions`);
      return res.data;
    },
    enabled: !!historyDoc,
  });

  // Upload status: idle | uploading | saving | done | error
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "saving" | "done" | "error">("idle");

  // ─── Upload: direct-to-S3 via presigned URL ──────

  function deriveFileType(mimetype: string): string {
    if (mimetype === "application/pdf") return "pdf";
    if (mimetype.startsWith("image/")) return "image";
    if (mimetype.includes("word") || mimetype.includes("document") || mimetype.includes("wordprocessingml")) return "doc";
    if (mimetype.includes("excel") || mimetype.includes("sheet") || mimetype.includes("spreadsheetml")) return "sheet";
    return "file";
  }

  async function uploadSingleFileToS3(
    file: File,
  ): Promise<{ secure_url: string; public_id: string }> {
    const { data: sig } = await api.get("/vault/upload-signature", {
      params: { filename: file.name, contentType: file.type || "application/octet-stream" },
    });
    const uploadRes = await fetch(sig.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!uploadRes.ok) throw new Error("S3 upload failed");
    return { secure_url: sig.fileUrl, public_id: sig.s3Key };
  }

  async function uploadToS3AndSave() {
    if (uploadFiles.length === 0) { toast.error("Please select at least one file"); return; }
    if (!uploadForm.category) { toast.error("Category is required"); return; }
    if (uploadFiles.length === 1 && !uploadForm.name) { toast.error("Document name is required"); return; }

    const isSingle = uploadFiles.length === 1;
    setUploadStatus("uploading");

    setUploadProgress(uploadFiles.map((f) => ({ file: f, status: "pending" })));

    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        setUploadProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: "uploading" } : p)),
        );

        const { secure_url, public_id } = await uploadSingleFileToS3(file);

        const docName = isSingle
          ? uploadForm.name
          : file.name.replace(/\.[^/.]+$/, "") || file.name;

        const payload: Record<string, any> = {
          name: docName,
          category: uploadForm.category,
          region: uploadForm.region,
          parentId: currentFolderId || undefined,
          fileUrl: secure_url,
          publicId: public_id,
          fileType: deriveFileType(file.type),
        };
        if (uploadForm.category === "Certifications" && uploadForm.expiryDate) {
          payload.expiryDate = uploadForm.expiryDate;
        }

        await api.post("/vault/upload", payload);

        setUploadProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: "done" } : p)),
        );
      }

      setUploadStatus("done");
      toast.success(
        isSingle ? "Document uploaded successfully" : `${uploadFiles.length} files uploaded`,
      );
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      queryClient.invalidateQueries({ queryKey: ["vault-categories"] });
      queryClient.invalidateQueries({ queryKey: ["vault-expiry-alerts"] });
      setTimeout(() => {
        setUploadOpen(false);
        setUploadForm({ name: "", category: "", region: "Global", expiryDate: "" });
        setUploadFiles([]);
        setUploadProgress([]);
        setUploadStatus("idle");
      }, 800);
    } catch (err: any) {
      setUploadStatus("error");
      toast.error(err?.message ?? "Upload failed");
    }
  }

  async function handleReplace() {
    if (!replaceDoc || !replaceFile) return;
    try {
      setReplaceStatus("uploading");
      const { secure_url, public_id } = await uploadSingleFileToS3(replaceFile);
      setReplaceStatus("saving");
      const newName = replaceFile.name.replace(/\.[^/.]+$/, "") || replaceFile.name;
      await api.post(`/vault/${replaceDoc.id}/replace`, {
        fileUrl: secure_url,
        publicId: public_id,
        fileType: deriveFileType(replaceFile.type),
        name: newName,
      });
      setReplaceStatus("done");
      toast.success("File replaced — previous version archived");
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      setTimeout(() => {
        setReplaceDoc(null);
        setReplaceFile(null);
        setReplaceStatus("idle");
      }, 800);
    } catch (err: any) {
      setReplaceStatus("error");
      toast.error(err?.message ?? "Replace failed");
    }
  }

  async function handleRestoreVersion(version: VaultDocumentVersion) {
    if (!historyDoc) return;
    try {
      await api.post(`/vault/${historyDoc.id}/replace`, {
        fileUrl: version.fileUrl,
        publicId: version.publicId,
        fileType: version.fileType,
      });
      toast.success(`Restored to version ${version.versionNum}`);
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      queryClient.invalidateQueries({ queryKey: ["vault-versions", historyDoc.id] });
    } catch (err: any) {
      toast.error(err?.message ?? "Restore failed");
    }
  }

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
      data: { name: string; category: string; region: string; expiryDate?: string };
    }) => {
      const res = await api.put(`/vault/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Document updated");
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      queryClient.invalidateQueries({ queryKey: ["vault-categories"] });
      queryClient.invalidateQueries({ queryKey: ["vault-expiry-alerts"] });
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

  // ─── Move mutation ───────────────────────────────────

  const moveMutation = useMutation({
    mutationFn: async ({ id, targetParentId }: { id: string; targetParentId: string | null }) => {
      const res = await api.put(`/vault/${id}/move`, { targetParentId });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Moved successfully");
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      setDraggedItem(null);
      setDragOverFolderId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? "Move failed");
      setDraggedItem(null);
      setDragOverFolderId(null);
    },
  });

  // ─── Copy mutation ───────────────────────────────────

  const copyMutation = useMutation({
    mutationFn: async ({ id, targetParentId }: { id: string; targetParentId: string | null }) => {
      const res = await api.post(`/vault/${id}/copy`, { targetParentId });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Copied successfully");
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      setClipboard(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? "Copy failed");
    },
  });

  // ─── Handlers ────────────────────────────────────────

  function navigateToFolder(folderId: string | null) {
    setSearch("");
    setCurrentFolderId(folderId);
  }

  function handleFilesSelect(newFiles: FileList | null) {
    if (!newFiles || newFiles.length === 0) return;
    const arr = Array.from(newFiles);
    setUploadFiles(arr);
    if (arr.length === 1) {
      const nameWithoutExt = arr[0].name.replace(/\.[^/.]+$/, "") || arr[0].name;
      setUploadForm((prev) => ({ ...prev, name: prev.name || nameWithoutExt }));
    } else {
      setUploadForm((prev) => ({ ...prev, name: "" }));
    }
  }

  function handleUploadSubmit() {
    uploadToS3AndSave();
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) handleFilesSelect(e.dataTransfer.files);
  }

  function openEdit(doc: VaultDocument) {
    setEditDoc(doc);
    const expiryRaw = doc.expiryDate ? new Date(doc.expiryDate).toISOString().split("T")[0] : "";
    setEditForm({ name: doc.name, category: doc.category, region: doc.region, expiryDate: expiryRaw });
  }

  function handleEditSubmit() {
    if (!editDoc) return;
    const data: { name: string; category: string; region: string; expiryDate?: string } = {
      name: editForm.name,
      category: editForm.category,
      region: editForm.region,
    };
    if (editForm.category === "Certifications") {
      data.expiryDate = editForm.expiryDate || undefined;
    }
    editMutation.mutate({ id: editDoc.id, data });
  }

  // ─── Drag & Drop ─────────────────────────────────────

  function handleDragStart(e: React.DragEvent, item: VaultDocument) {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id);
  }

  function handleDragEnd() {
    setDraggedItem(null);
    setDragOverFolderId(null);
  }

  function handleFolderDragOver(e: React.DragEvent, folderId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverFolderId !== folderId) setDragOverFolderId(folderId);
  }

  function handleFolderDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverFolderId(null);
    }
  }

  function handleFolderDrop(e: React.DragEvent, targetFolderId: string) {
    e.preventDefault();
    setDragOverFolderId(null);
    if (!draggedItem) return;
    if (draggedItem.id === targetFolderId) return;
    moveMutation.mutate({ id: draggedItem.id, targetParentId: targetFolderId });
  }

  // ─── Clipboard ───────────────────────────────────────

  function handlePaste() {
    if (!clipboard) return;
    if (clipboard.mode === "copy") {
      copyMutation.mutate({ id: clipboard.item.id, targetParentId: currentFolderId });
    } else {
      moveMutation.mutate({ id: clipboard.item.id, targetParentId: currentFolderId });
      setClipboard(null);
    }
  }

  // ─── Context Menu ────────────────────────────────────

  function handleContextMenu(e: React.MouseEvent, doc: VaultDocument) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, doc });
  }

  useEffect(() => {
    function closeMenu() { setContextMenu(null); }
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  // ─── Formatting helpers ──────────────────────────────

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getExpiryBadge(expiryDate: string | null) {
    if (!expiryDate) return null;
    const daysLeft = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
    if (daysLeft <= 0) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Expired</Badge>;
    if (daysLeft <= 60) return <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] px-1.5 py-0">Expiring Soon</Badge>;
    return null;
  }

  const isAtRoot = currentFolderId === null && !search;

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="space-y-5 p-6">
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
            {isAdmin && (
              <Button
                variant="outline"
                onClick={handleRegenerateReports}
                disabled={regenerating}
                className="gap-2"
                title="Regenerate any missing CRM reports into the vault"
              >
                <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
                {regenerating ? "Regenerating…" : "Regenerate Reports"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setFolderOpen(true)}
              className="gap-2"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </Button>
            {canEditHere && (
              <Button onClick={() => setUploadOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Expiry alert banner */}
      {expiryAlerts.length > 0 && !expiryBannerDismissed && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <CalendarClock className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="flex-1">
            <strong>{expiryAlerts.length}</strong> certification file{expiryAlerts.length !== 1 ? "s are" : " is"} expiring within 60 days.
          </span>
          <button
            onClick={() => setExpiryBannerDismissed(true)}
            className="text-amber-600 hover:text-amber-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

      {/* Search + Back bar + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
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

        {/* Clipboard indicator */}
        {clipboard && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary">
            {clipboard.mode === "cut" ? <Scissors className="h-3 w-3 shrink-0" /> : <Copy className="h-3 w-3 shrink-0" />}
            <span className="truncate max-w-[100px] font-medium">{clipboard.item.name}</span>
            <button
              onClick={handlePaste}
              className="font-semibold hover:underline whitespace-nowrap"
            >
              Paste here
            </button>
            <button
              onClick={() => setClipboard(null)}
              className="text-muted-foreground hover:text-foreground"
              title="Clear clipboard"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

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

        {/* View toggle */}
        <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <LayoutList className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "block" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("block")}
            title="Block view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
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
              {/* Paste target when clipboard has content */}
              {clipboard && (
                <Button size="sm" variant="outline" onClick={handlePaste} className="gap-1 border-primary/40 text-primary">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Paste "{clipboard.item.name}" here
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Folders Grid — always shown as blocks, draggable + drop targets */}
          {folders.length > 0 && (
            <div>
              {!search && (
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Folders
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {folders.map((folder) => {
                  const { gradient, Icon } = getCategoryMeta(folder.category);
                  const childCount = folder._count?.children ?? 0;
                  const isOver = dragOverFolderId === folder.id;
                  const isDragging = draggedItem?.id === folder.id;
                  const isCut = clipboard?.item.id === folder.id && clipboard.mode === "cut";
                  return (
                    <div
                      key={folder.id}
                      className="group relative"
                      draggable
                      onDragStart={(e) => handleDragStart(e, folder)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                      onDragLeave={handleFolderDragLeave}
                      onDrop={(e) => handleFolderDrop(e, folder.id)}
                      onContextMenu={(e) => handleContextMenu(e, folder)}
                    >
                      <button
                        onClick={() => navigateToFolder(folder.id)}
                        className={`w-full flex flex-col items-center gap-2.5 rounded-xl border bg-card p-4 text-center transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 ${
                          isOver
                            ? "border-primary shadow-lg scale-105 bg-primary/5"
                            : "border-border hover:border-primary/30"
                        } ${isDragging ? "opacity-30" : ""} ${isCut ? "opacity-50 border-dashed" : ""}`}
                      >
                        <div
                          className={`rounded-xl p-3 bg-gradient-to-br ${gradient} shadow-sm ${isOver ? "scale-110" : ""} transition-transform`}
                        >
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="min-w-0 w-full">
                          <p className="text-sm font-semibold truncate leading-tight" title={folder.name}>
                            {folder.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 justify-center">
                            {folder.canEdit === false && (
                              <Lock className="h-2.5 w-2.5 text-muted-foreground/60" />
                            )}
                            {childCount} item{childCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {isOver && (
                          <span className="text-[10px] text-primary font-medium">Drop to move here</span>
                        )}
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

          {/* Files — List or Block view */}
          {files.length > 0 && (
            <div>
              {!search && folders.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Files
                </p>
              )}

              {viewMode === "list" ? (
                /* ── List View (table) ── */
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[minmax(0,1fr)_140px_120px_170px_170px_180px] items-stretch border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="px-4 py-2.5 border-r border-border">File</span>
                    <span className="px-4 py-2.5 border-r border-border">Category</span>
                    <span className="px-4 py-2.5 border-r border-border">Region</span>
                    <span className="px-4 py-2.5 border-r border-border">Uploaded</span>
                    <span className="px-4 py-2.5 border-r border-border">Modified</span>
                    <span className="px-4 py-2.5 text-right">Actions</span>
                  </div>

                  <div className="divide-y divide-border">
                    {files.map((doc) => {
                      const { color, bg, Icon: CatIcon } = getCategoryMeta(doc.category);
                      const fileCanEdit = doc.canEdit !== undefined ? doc.canEdit : canEdit;
                      const isDragging = draggedItem?.id === doc.id;
                      const isCut = clipboard?.item.id === doc.id && clipboard.mode === "cut";
                      return (
                        <div
                          key={doc.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, doc)}
                          onDragEnd={handleDragEnd}
                          onContextMenu={(e) => handleContextMenu(e, doc)}
                          className={`grid grid-cols-[minmax(0,1fr)_140px_120px_170px_170px_180px] items-stretch hover:bg-muted/30 transition-colors group last:border-0 cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""} ${isCut ? "opacity-50 bg-muted/20" : ""}`}
                        >
                          {/* Name + type icon + expiry badge */}
                          <div className="flex items-center gap-3 min-w-0 px-4 py-3 border-r border-border">
                            <div className={`shrink-0 rounded-lg p-2 ${bg}`}>
                              <FileTypeIcon fileType={doc.fileType} className={`h-4 w-4 ${color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {doc.fileUrl ? (
                                  <button
                                    onClick={() => setPreviewDoc(doc)}
                                    className="font-medium text-sm truncate hover:underline text-left"
                                    title={doc.name}
                                  >
                                    {doc.name}
                                  </button>
                                ) : (
                                  <span className="font-medium text-sm truncate">{doc.name}</span>
                                )}
                                {doc.fileUrl && (
                                  <a
                                    href={doc.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open in new tab"
                                    className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                {getExpiryBadge(doc.expiryDate)}
                              </div>
                              {doc.uploader && (
                                <p className="text-xs text-muted-foreground truncate">{doc.uploader.fullName}</p>
                              )}
                            </div>
                          </div>

                          {/* Category */}
                          <div className="flex items-center gap-1.5 px-4 py-3 border-r border-border">
                            <CatIcon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                            <span className={`text-xs font-medium ${color} truncate`}>{doc.category}</span>
                          </div>

                          {/* Region */}
                          <span className="flex items-center px-4 py-3 text-sm text-muted-foreground border-r border-border truncate">
                            {doc.region}
                          </span>

                          {/* Uploaded */}
                          <span className="flex items-center px-4 py-3 text-xs text-muted-foreground border-r border-border">
                            {formatDate(doc.createdAt)}
                          </span>

                          {/* Modified */}
                          <span className="flex items-center px-4 py-3 text-xs text-muted-foreground border-r border-border">
                            {formatDate(doc.updatedAt)}
                          </span>

                          {/* Actions */}
                          <div className="flex items-center justify-end gap-0.5 px-2 py-3">
                            {doc.fileUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Preview"
                                onClick={() => setPreviewDoc(doc)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {fileCanEdit && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Edit metadata"
                                  onClick={() => openEdit(doc)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                {doc.fileUrl && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Replace file"
                                    onClick={() => { setReplaceDoc(doc); setReplaceFile(null); setReplaceStatus("idle"); }}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Version history"
                                  onClick={() => setHistoryDoc(doc)}
                                >
                                  <History className="h-3.5 w-3.5" />
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
              ) : (
                /* ── Block View (cards grid) ── */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {files.map((doc) => {
                    const { color, gradient } = getCategoryMeta(doc.category);
                    const fileCanEdit = doc.canEdit !== undefined ? doc.canEdit : canEdit;
                    const isDragging = draggedItem?.id === doc.id;
                    const isCut = clipboard?.item.id === doc.id && clipboard.mode === "cut";
                    return (
                      <div
                        key={doc.id}
                        className="group relative"
                        draggable
                        onDragStart={(e) => handleDragStart(e, doc)}
                        onDragEnd={handleDragEnd}
                        onContextMenu={(e) => handleContextMenu(e, doc)}
                      >
                        <div
                          className={`rounded-xl border bg-card p-4 transition-all hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 cursor-grab active:cursor-grabbing ${
                            isDragging ? "opacity-30" : ""
                          } ${isCut ? "opacity-50 border-dashed border-primary/40" : "border-border"}`}
                        >
                          {/* Icon */}
                          <div className="flex flex-col items-center gap-2.5 text-center">
                            <div
                              className={`rounded-xl p-3 bg-gradient-to-br ${gradient} shadow-sm`}
                              onClick={() => doc.fileUrl && setPreviewDoc(doc)}
                            >
                              <FileTypeIcon fileType={doc.fileType} className="h-6 w-6 text-white" />
                            </div>
                            <div className="min-w-0 w-full">
                              {doc.fileUrl ? (
                                <button
                                  onClick={() => setPreviewDoc(doc)}
                                  className="text-sm font-semibold truncate w-full text-center hover:underline leading-tight"
                                  title={doc.name}
                                >
                                  {doc.name}
                                </button>
                              ) : (
                                <p className="text-sm font-semibold truncate leading-tight" title={doc.name}>
                                  {doc.name}
                                </p>
                              )}
                              <span className={`text-xs font-medium ${color}`}>{doc.category}</span>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(doc.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </p>
                              {getExpiryBadge(doc.expiryDate) && (
                                <div className="mt-1 flex justify-center">
                                  {getExpiryBadge(doc.expiryDate)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Hover actions */}
                        <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {doc.fileUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 bg-card/90 backdrop-blur-sm shadow-sm"
                              title="Preview"
                              onClick={() => setPreviewDoc(doc)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                          {doc.fileUrl && (
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open in new tab"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 bg-card/90 backdrop-blur-sm shadow-sm"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </a>
                          )}
                          {fileCanEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 bg-card/90 backdrop-blur-sm shadow-sm"
                                title="Edit metadata"
                                onClick={() => openEdit(doc)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 bg-card/90 backdrop-blur-sm shadow-sm text-destructive hover:text-destructive"
                                title="Delete"
                                onClick={() => setDeleteDoc(doc)}
                              >
                                <Trash2 className="h-3 w-3" />
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
          )}
        </div>
      )}

      {/* ─── Context Menu ──────────────────────────────── */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: "fixed",
            top: Math.min(contextMenu.y, window.innerHeight - 240),
            left: Math.min(contextMenu.x, window.innerWidth - 200),
            zIndex: 1000,
          }}
          className="bg-card border border-border rounded-xl shadow-2xl py-1 min-w-[188px] text-sm"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground truncate border-b border-border mb-1 max-w-[188px]">
            {contextMenu.doc.name}
          </div>
          <button
            className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2.5 transition-colors"
            onClick={() => {
              setClipboard({ item: contextMenu.doc, mode: "copy" });
              setContextMenu(null);
              toast.success(`"${contextMenu.doc.name}" copied`);
            }}
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            Copy
          </button>
          <button
            className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2.5 transition-colors"
            onClick={() => {
              setClipboard({ item: contextMenu.doc, mode: "cut" });
              setContextMenu(null);
              toast.success(`"${contextMenu.doc.name}" cut`);
            }}
          >
            <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
            Cut
          </button>
          {clipboard && (
            <button
              className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2.5 transition-colors"
              onClick={() => { handlePaste(); setContextMenu(null); }}
            >
              <ClipboardPaste className="h-3.5 w-3.5 text-muted-foreground" />
              Paste
            </button>
          )}
          <div className="border-t border-border my-1" />
          {!contextMenu.doc.isFolder && contextMenu.doc.fileUrl && (
            <button
              className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2.5 transition-colors"
              onClick={() => { setPreviewDoc(contextMenu.doc); setContextMenu(null); }}
            >
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              Preview
            </button>
          )}
          {contextMenu.doc.isFolder && (
            <button
              className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2.5 transition-colors"
              onClick={() => { navigateToFolder(contextMenu.doc.id); setContextMenu(null); }}
            >
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              Open
            </button>
          )}
          {(canEdit || contextMenu.doc.canEdit) && (
            <>
              <button
                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2.5 transition-colors"
                onClick={() => { openEdit(contextMenu.doc); setContextMenu(null); }}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                Rename / Edit
              </button>
              <button
                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2.5 text-destructive transition-colors"
                onClick={() => { setDeleteDoc(contextMenu.doc); setContextMenu(null); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </>
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
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelect(e.target.files)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.jfif,.gif,.webp,.zip"
              />
              {uploadFiles.length > 0 ? (
                <div className="w-full space-y-1.5">
                  {uploadFiles.map((f, i) => {
                    const prog = uploadProgress[i];
                    return (
                      <div key={i} className="flex items-center gap-2 text-left">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm truncate flex-1">{f.name}</span>
                        {prog?.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
                        {prog?.status === "done" && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                        {prog?.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setUploadFiles([]); setUploadProgress([]); }}
                    className="text-xs text-muted-foreground hover:text-foreground mt-1"
                  >
                    Clear selection
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click or drag & drop files</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOC, Excel, Images — up to 50 MB each · Multiple files supported</p>
                </>
              )}
            </div>

            {/* Name — only shown for single file */}
            {uploadFiles.length <= 1 && (
              <div className="space-y-1.5">
                <Label>Document Name *</Label>
                <Input
                  placeholder="e.g. ISO_9001_Certificate"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            )}

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <div className="flex gap-2 flex-wrap mb-1">
                {UPLOAD_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setUploadForm((f) => ({ ...f, category: cat }))}
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
                onChange={(e) => setUploadForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>

            {/* Expiry Date — Certifications only */}
            {uploadForm.category === "Certifications" && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5 text-amber-500" />
                  Expiry Date *
                </Label>
                <Input
                  type="date"
                  value={uploadForm.expiryDate}
                  onChange={(e) => setUploadForm((f) => ({ ...f, expiryDate: e.target.value }))}
                />
              </div>
            )}

            {/* Region */}
            <div className="space-y-1.5">
              <Label>Region</Label>
              <Input
                placeholder="Global, EU, North America…"
                value={uploadForm.region}
                onChange={(e) => setUploadForm((f) => ({ ...f, region: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setUploadOpen(false); setUploadStatus("idle"); setUploadFiles([]); setUploadProgress([]); }}
              disabled={uploadStatus === "uploading" || uploadStatus === "saving"}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={uploadStatus === "uploading" || uploadStatus === "saving" || uploadStatus === "done"}
              className="gap-2"
            >
              {(uploadStatus === "uploading" || uploadStatus === "saving") && <><Loader2 className="h-4 w-4 animate-spin" />{uploadStatus === "uploading" ? `Uploading${uploadFiles.length > 1 ? "…" : "…"}` : "Saving…"}</>}
              {uploadStatus === "done" && <><Check className="h-4 w-4" />Done</>}
              {uploadStatus === "error" && <><AlertCircle className="h-4 w-4" />Retry</>}
              {uploadStatus === "idle" && <><Upload className="h-4 w-4" />Upload {uploadFiles.length > 1 ? `(${uploadFiles.length} files)` : ""}</>}
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
                    onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value }))}
                  />
                </div>

                {editForm.category === "Certifications" && (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5 text-amber-500" />
                      Expiry Date
                    </Label>
                    <Input
                      type="date"
                      value={editForm.expiryDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    />
                  </div>
                )}
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
                : " from storage"}
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

      {/* ─── Preview Dialog ────────────────────────────── */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 min-w-0 pr-8">
              {previewDoc && <FileTypeIcon fileType={previewDoc.fileType} className="h-4 w-4 shrink-0 text-primary" />}
              <span className="truncate">{previewDoc?.name}</span>
            </DialogTitle>
            {previewDoc?.fileUrl && (
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={previewDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in new tab
                </a>
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-lg bg-muted/30 min-h-[400px] flex items-center justify-center">
            {previewDoc?.fileType === "image" && previewDoc.fileUrl && (
              <img
                src={previewDoc.fileUrl}
                alt={previewDoc.name}
                className="max-w-full max-h-[65vh] object-contain rounded"
              />
            )}
            {(previewDoc?.fileType === "pdf") && previewDoc?.fileUrl && (
              <object
                data={previewDoc.fileUrl}
                type="application/pdf"
                className="w-full h-[65vh] rounded border-0"
              >
                <div className="flex flex-col items-center gap-4 text-muted-foreground p-8">
                  <FileTypeIcon fileType="pdf" className="h-16 w-16 opacity-30" />
                  <p className="text-sm">PDF cannot be displayed inline.</p>
                  <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Open PDF in new tab
                    </Button>
                  </a>
                </div>
              </object>
            )}
            {previewDoc?.fileType === "html" && previewDoc?.fileUrl && (
              <div className="flex flex-col items-center gap-4 text-muted-foreground p-8">
                <FileTypeIcon fileType="pdf" className="h-16 w-16 opacity-30" />
                <p className="text-sm font-medium text-foreground">Report ready to view</p>
                <p className="text-xs text-center max-w-xs">PDF generation was unavailable — the full HTML report is stored and opens perfectly in a new tab.</p>
                <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open Report
                  </Button>
                </a>
              </div>
            )}
            {(previewDoc?.fileType === "doc" || previewDoc?.fileType === "sheet" || previewDoc?.fileType === "file") && previewDoc?.fileUrl && (
              <div className="flex flex-col items-center gap-4 text-muted-foreground p-8">
                <FileTypeIcon fileType={previewDoc.fileType} className="h-16 w-16 opacity-30" />
                <p className="text-sm">Preview not available for this file type.</p>
                <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download to view
                  </Button>
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Replace File Dialog ───────────────────────── */}
      <Dialog open={!!replaceDoc} onOpenChange={(o) => !o && setReplaceDoc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Replace File
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Current version of <strong>{replaceDoc?.name}</strong> will be archived and a new version created.
            </p>
            <div
              onClick={() => replaceFileRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
            >
              <input
                ref={replaceFileRef}
                type="file"
                className="hidden"
                onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.jfif,.gif,.webp,.zip"
              />
              {replaceFile ? (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium truncate max-w-[280px]">{replaceFile.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                  <p className="text-sm">Click to select replacement file</p>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceDoc(null)} disabled={replaceStatus === "uploading" || replaceStatus === "saving"}>
              Cancel
            </Button>
            <Button onClick={handleReplace} disabled={!replaceFile || replaceStatus === "uploading" || replaceStatus === "saving" || replaceStatus === "done"} className="gap-2">
              {(replaceStatus === "uploading" || replaceStatus === "saving") && <><Loader2 className="h-4 w-4 animate-spin" />{replaceStatus === "uploading" ? "Uploading…" : "Saving…"}</>}
              {replaceStatus === "done" && <><Check className="h-4 w-4" />Done</>}
              {replaceStatus === "error" && <><AlertCircle className="h-4 w-4" />Retry</>}
              {replaceStatus === "idle" && <><RefreshCw className="h-4 w-4" />Replace</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Version History Sheet ─────────────────────── */}
      <Sheet open={!!historyDoc} onOpenChange={(o) => !o && setHistoryDoc(null)}>
        <SheetContent className="w-[400px] sm:w-[480px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Version History
            </SheetTitle>
            <p className="text-xs text-muted-foreground truncate">{historyDoc?.name}</p>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {versionsLoading && (
              <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading history…
              </div>
            )}
            {!versionsLoading && versions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No previous versions — this is the original upload.</p>
            )}
            {versions.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={v.name}>{v.name}</p>
                  <p className="text-xs text-muted-foreground">v{v.versionNum} · {formatDate(v.createdAt)}{v.uploader ? ` · ${v.uploader.fullName}` : ""}</p>
                </div>
                <div className="flex gap-1">
                  <a href={v.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Open in new tab">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Restore this version"
                      onClick={() => handleRestoreVersion(v)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
