import { useState, createContext, useContext, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { toast } from "sonner";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionGate } from "@/components/PermissionGate";
import { useAuth } from "@/contexts/AuthContext";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { SelectWithOthers } from "@/components/SelectWithOthers";
import { EntityLinkSelect } from "@/components/EntityLinkSelect";
import type { EntityOption } from "@/components/EntityLinkSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  MapPin,
  User,
  Building2,
  Globe,
  Package,
  CreditCard,
  Ship,
  MessageCircle,
  ClipboardList,
  ShoppingCart,
  Pencil,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  PauseCircle,
  Clock,
  Upload,
  FileText,
  Download,
  FolderOpen,
  AlertTriangle,
} from "lucide-react";

const DOCUMENT_TYPES = [
  "NDA",
  "Contract",
  "Compliance Doc",
  "Certificate",
  "Invoice",
  "Quotation",
  "Specification Sheet",
  "Other",
] as const;

interface BuyerDocument {
  id: string;
  name: string;
  url: string;
  documentType: string;
  uploadedAt: string;
  uploadedBy: string;
}

interface SourcingRequirement {
  id: string;
  product: string;
  productVariant: string;
  countryOfOriginPreferred: string;
  organicConventional: string;
  quantityRequired: string;
  frequency: string;
  targetPrice: string;
  currency: string;
  packagingRequirements: string;
  labellingRequirements: string;
  deliveryPort: string;
  incotermPreferred: string;
  sampleRequired: string;
  sampleQuantity: string;
  deadlineToReceiveSamples: string;
  expectedFirstDeliveryDate: string;
  qualityParameters: string;
  requiredCertifications: string;
}

interface AdditionalContact {
  name: string;
  role: string;
  phone: string;
  whatsapp: string;
  email: string;
  isPrimary: boolean;
}

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
  relationshipTier?: string;
  createdAt?: string;
  tradeName?: string;
  buyerType?: string;
  city?: string;
  whatsapp?: string;
  contactRole?: string;
  additionalContacts?: AdditionalContact[];
  productCategories?: string;
  marketsServed?: string;
  annualImportVolume?: string;
  annualPurchaseValue?: string;
  currentSuppliersOrigins?: string;
  sourcingRequirements?: SourcingRequirement[];
  preferredCurrency?: string;
  shippingMode?: string;
  portsOfDischarge?: string;
  countryOfFinalDelivery?: string;
  freightForwarder?: string;
  packingRequirements?: string;
  socialEthicalCompliance?: string;
  howHeardAboutUs?: string;
  tradeFairName?: string;
  productCatalog?: string;
  supplierLinks?: { id: string; type: "new" | "signed" }[];
  initialOrderValue?: string;
  potentialAnnualValue?: string;
  reorderLikelihood?: string;
  buyerStatedIntent?: string;
  documents?: BuyerDocument[];
}

function InfoRow({
  icon: Icon,
  label,
  value,
  onAdd,
}: {
  icon: React.ElementType;
  label: string;
  value?: React.ReactNode;
  onAdd?: () => void;
}) {
  const contextOnAdd = useContext(OnAddContext);
  const effectiveOnAdd = onAdd ?? contextOnAdd;
  const isEmpty = value === undefined || value === null || value === "";
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {isEmpty && effectiveOnAdd ? (
          <button
            type="button"
            onClick={effectiveOnAdd}
            className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/40 hover:text-brand-600 transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>Add</span>
          </button>
        ) : (
          <p className="text-sm font-medium break-words">{value || "—"}</p>
        )}
      </div>
    </div>
  );
}

const EMPTY_SOURCING_REQ = (): SourcingRequirement => ({
  id: String(Date.now() + Math.random()),
  product: "",
  productVariant: "",
  countryOfOriginPreferred: "",
  organicConventional: "",
  quantityRequired: "",
  frequency: "",
  targetPrice: "",
  currency: "",
  packagingRequirements: "",
  labellingRequirements: "",
  deliveryPort: "",
  incotermPreferred: "",
  sampleRequired: "",
  sampleQuantity: "",
  deadlineToReceiveSamples: "",
  expectedFirstDeliveryDate: "",
  qualityParameters: "",
  requiredCertifications: "",
});

const EMPTY_CONTACT = (): AdditionalContact => ({
  name: "",
  role: "",
  phone: "",
  whatsapp: "",
  email: "",
  isPrimary: false,
});

const tierStyles = (tier?: string) => {
  switch (tier) {
    case "Strategic":   return "text-violet-700 bg-violet-50 border-violet-200";
    case "Active":      return "text-brand-700 bg-brand-50 border-brand-200";
    case "Transactional": return "text-slate-600 bg-slate-100 border-slate-200";
    default:            return "text-slate-500 bg-slate-50 border-slate-200";
  }
};

const statusStyles = (status?: string) => {
  switch (status?.toLowerCase()) {
    case "active":
      return "text-brand-700 bg-brand-100 border-brand-200";
    case "pending":
      return "text-amber-700 bg-amber-100 border-amber-200";
    case "suspended":
      return "text-rose-700 bg-rose-100 border-rose-200";
    default:
      return "text-slate-600 bg-slate-100 border-slate-200";
  }
};

const StatusIcon = ({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) => {
  switch (status?.toLowerCase()) {
    case "active":
      return <CheckCircle2 className={className} />;
    case "pending":
      return <Clock className={className} />;
    case "suspended":
      return <PauseCircle className={className} />;
    default:
      return null;
  }
};

const BUYER_STRING_FIELDS: (keyof Buyer)[] = [
  "company", "name", "email", "phone", "country", "address", "city", "region", "website",
  "tradeName", "buyerType", "contactRole", "whatsapp",
  "productCategories", "productCategoryInterest", "marketsServed",
  "annualImportVolume", "annualPurchaseValue", "currentSuppliersOrigins",
  "preferredCurrency", "pricingRange", "moqRequirements", "paymentTerms", "incoterms",
  "shippingMode", "portsOfDischarge", "countryOfFinalDelivery", "freightForwarder",
  "packingRequirements", "certificationRequirements", "socialEthicalCompliance",
  "riskRating", "strategicValue", "leadSource", "lastContactDate",
  "dealHistory", "notes", "status", "relationshipTier",
  "howHeardAboutUs", "tradeFairName", "productCatalog",
  "initialOrderValue", "potentialAnnualValue", "reorderLikelihood", "buyerStatedIntent",
];

const BUYER_ARRAY_FIELDS: (keyof Buyer)[] = [
  "additionalContacts", "sourcingRequirements", "supplierLinks",
];

function computeBuyerCompleteness(b: Partial<Buyer>): number {
  const rec = b as Record<string, unknown>;
  const total = BUYER_STRING_FIELDS.length + BUYER_ARRAY_FIELDS.length;
  const filledStrings = BUYER_STRING_FIELDS.filter((f) => {
    const v = rec[f];
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;
  const filledArrays = BUYER_ARRAY_FIELDS.filter((f) => {
    const v = rec[f];
    return Array.isArray(v) && v.length > 0;
  }).length;
  return Math.round(((filledStrings + filledArrays) / total) * 100);
}

const OnAddContext = createContext<(() => void) | undefined>(undefined);

function getCatalogViewUrl(url?: string) {
  if (!url) return url;
  let fixed = url.replace("/fl_inline", "");
  if (fixed.includes("/image/upload/") && fixed.toLowerCase().endsWith(".pdf")) {
    fixed = fixed.replace("/image/upload/", "/raw/upload/");
  }
  return fixed;
}

export default function BuyerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backFrom = (location.state as { from?: { path: string; label: string } } | null)?.from;
  const queryClient = useQueryClient();
  const { hasEditPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<"overview" | "documents">("overview");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<Buyer>>({});
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [quotationFiles, setQuotationFiles] = useState<File[]>([]);

  // Documents tab state
  const [docUploadOpen, setDocUploadOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("NDA");
  const docFileRef = useRef<HTMLInputElement>(null);

  // Edit form pending documents state
  const [pendingDocFiles, setPendingDocFiles] = useState<{ file: File; docType: string }[]>([]);
  const [formDocAddType, setFormDocAddType] = useState<string>("NDA");
  const formDocFileRef = useRef<HTMLInputElement>(null);

  const { data: buyer, isLoading } = useQuery<Buyer>({
    queryKey: ["buyer", id],
    queryFn: () => api.get(`/buyers/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<Buyer> }) =>
      api.put(`/buyers/${id}`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyer", id] });
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-stats"] });
      queryClient.invalidateQueries({ queryKey: ["new-supplier"] });
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
      queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDialogOpen(false);
      toast.success("Buyer updated");
    },
    onError: () => toast.error("Failed to update buyer"),
  });

  const { data: newSuppliersListData, isLoading: newSuppLoading } = useQuery<{ id: string; company: string; type: "new" }[]>({
    queryKey: ["new-suppliers-list"],
    queryFn: () => api.get("/new-suppliers/list").then((r) => r.data),
    staleTime: 60_000,
    enabled: !!(buyer?.supplierLinks?.length || dialogOpen),
  });

  const { data: signedSuppliersListData, isLoading: signedSuppLoading } = useQuery<{ id: string; company: string; type: "signed" }[]>({
    queryKey: ["suppliers-list"],
    queryFn: () => api.get("/suppliers/list").then((r) => r.data),
    staleTime: 60_000,
    enabled: !!(buyer?.supplierLinks?.length || dialogOpen),
  });

  const suppliersListLoading = newSuppLoading || signedSuppLoading;

  const allSupplierOptions: EntityOption[] = [
    ...(newSuppliersListData ?? []).map((s) => ({ id: s.id, label: `${s.company} (New)`, type: "new" as const })),
    ...(signedSuppliersListData ?? []).map((s) => ({ id: s.id, label: `${s.company} (Signed)`, type: "signed" as const })),
  ];

  const uploadCatalogMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/buyers/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onError: () => toast.error("Failed to upload product catalog"),
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("documentType", documentType);
      const res = await api.post(`/buyers/${id}/documents`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyer", id] });
      setDocUploadOpen(false);
      setDocFile(null);
      setDocType("NDA");
      toast.success("Document uploaded");
    },
    onError: () => toast.error("Failed to upload document"),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/buyers/${id}/documents/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyer", id] });
      toast.success("Document removed");
    },
    onError: () => toast.error("Failed to remove document"),
  });

  const confirmDeleteDoc = (doc: BuyerDocument) => {
    toast.warning(`Delete "${doc.name}"?`, {
      action: { label: "Delete", onClick: () => deleteDocMutation.mutate(doc.id) },
      cancel: { label: "Cancel", onClick: () => {} },
      duration: 8000,
    });
  };

  const handleDocUpload = () => {
    if (!docFile) return;
    uploadDocMutation.mutate({ file: docFile, documentType: docType });
  };

  // Sourcing requirements helpers
  const addSourcingReq = () => {
    setForm((f) => ({
      ...f,
      sourcingRequirements: [
        ...(f.sourcingRequirements || []),
        EMPTY_SOURCING_REQ(),
      ],
    }));
  };
  const removeSourcingReq = (idx: number) => {
    setForm((f) => ({
      ...f,
      sourcingRequirements: (f.sourcingRequirements || []).filter(
        (_, i) => i !== idx,
      ),
    }));
  };
  const updateSourcingReq = (
    idx: number,
    field: keyof SourcingRequirement,
    value: string,
  ) => {
    setForm((f) => {
      const next = [...(f.sourcingRequirements || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...f, sourcingRequirements: next };
    });
  };

  // Additional contacts helpers
  const addContact = () => {
    setForm((f) => ({
      ...f,
      additionalContacts: [...(f.additionalContacts || []), EMPTY_CONTACT()],
    }));
  };
  const removeContact = (idx: number) => {
    setForm((f) => ({
      ...f,
      additionalContacts: (f.additionalContacts || []).filter(
        (_, i) => i !== idx,
      ),
    }));
  };
  const updateContact = (
    idx: number,
    field: keyof AdditionalContact,
    value: string | boolean,
  ) => {
    setForm((f) => {
      const next = [...(f.additionalContacts || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...f, additionalContacts: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company) return;
    let catalogUrl = form.productCatalog;
    if (catalogFile) {
      try {
        const uploadRes = await uploadCatalogMutation.mutateAsync(catalogFile);
        catalogUrl = uploadRes.url;
      } catch {
        return;
      }
    }
    const finalQuotations = [...((form as any).quotations || [])];
    if (quotationFiles.length > 0) {
      for (const file of quotationFiles) {
        try {
          const uploadRes = await uploadCatalogMutation.mutateAsync(file);
          finalQuotations.push({ name: file.name, url: uploadRes.url });
        } catch (error) { console.error('Upload failed', error); }
      }
    }

    if (buyer?.id) {
      try {
        await updateMutation.mutateAsync({ id: buyer.id, d: { ...form, productCatalog: catalogUrl, quotations: finalQuotations } as any });
        if (pendingDocFiles.length > 0) {
          for (const { file, docType: dt } of pendingDocFiles) {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("documentType", dt);
            await api.post(`/buyers/${buyer.id}/documents`, fd, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          }
          queryClient.invalidateQueries({ queryKey: ["buyer", id] });
          setPendingDocFiles([]);
        }
      } catch {
        // errors handled by mutations
      }
    }
  };

  const openEdit = () => {
    setForm({
      ...buyer,
      additionalContacts: buyer?.additionalContacts || [],
      sourcingRequirements: buyer?.sourcingRequirements || [],
    });
    setCatalogFile(null);
    setQuotationFiles([]);
    setPendingDocFiles([]);
    setFormDocAddType("NDA");
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!buyer) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Buyer not found</p>
        <Button variant="outline" onClick={() => navigate("/buyers")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Buyers
        </Button>
      </div>
    );
  }

  const registeredSince = buyer.createdAt
    ? new Date(buyer.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

  const additionalContacts: AdditionalContact[] =
    buyer.additionalContacts || [];
  const sourcingRequirements: SourcingRequirement[] =
    buyer.sourcingRequirements || [];

  const canEdit = hasEditPermission("buyers");

  return (
    <OnAddContext.Provider value={canEdit ? openEdit : undefined}>
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="text-sm text-muted-foreground flex items-center gap-1">
        <Link to="/" className="hover:underline">
          CRM
        </Link>
        <span>/</span>
        <Link to="/buyers" className="hover:underline">
          Buyers
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {buyer.company}
        </span>
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">
              {buyer.company}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyles(buyer.status)}`}
            >
              <StatusIcon status={buyer.status} className="h-3 w-3" />
              {buyer.status || "Pending"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Buyer ID: #{buyer.id.slice(0, 8).toUpperCase()}
            {registeredSince && ` · Added ${registeredSince}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PermissionGate permission="buyers" editOnly>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
          </PermissionGate>
          <Button
            variant="outline"
            size="sm"
            onClick={() => backFrom ? navigate(backFrom.path) : navigate("/buyers")}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {backFrom ? `Back to ${backFrom.label}` : "Back"}
          </Button>
        </div>
      </div>

      <Separator />

      {/* ── Profile Completeness Bar ── */}
      {(() => {
        const pct = computeBuyerCompleteness(buyer);
        const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-brand-500" : "bg-amber-500";
        const label = pct >= 80 ? "Complete" : pct >= 60 ? "Mostly complete" : "Incomplete";
        const labelColor = pct >= 80 ? "text-emerald-700" : pct >= 60 ? "text-brand-700" : "text-amber-700";
        return (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs font-semibold whitespace-nowrap ${labelColor}`}>
              {pct}% — {label}
            </span>
          </div>
        );
      })()}

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-slate-200">
        {(["overview", "documents"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "documents" ? (
              <span className="flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                Documents
                {(buyer.documents?.length ?? 0) > 0 && (
                  <span className="ml-1 rounded-full bg-brand-100 text-brand-700 text-xs px-1.5 py-0.5 font-semibold">
                    {buyer.documents!.length}
                  </span>
                )}
              </span>
            ) : "Overview"}
          </button>
        ))}
      </div>

      {/* ── Documents Tab ── */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Upload NDAs, contracts, compliance docs and other files for this buyer.
            </p>
            <PermissionGate permission="buyers" editOnly>
              <Button size="sm" onClick={() => setDocUploadOpen(true)}>
                <Upload className="mr-1.5 h-4 w-4" /> Upload Document
              </Button>
            </PermissionGate>
          </div>

          {(!buyer.documents || buyer.documents.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-200 rounded-lg text-center">
              <FolderOpen className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No documents yet</p>
              <p className="text-xs text-slate-400 mt-1">Upload NDAs, contracts, or compliance documents</p>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">File Name</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Document Type</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Upload Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Uploaded By</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {buyer.documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-brand-500 shrink-0" />
                          <span className="font-medium truncate max-w-[240px]">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {doc.documentType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(doc.uploadedAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{doc.uploadedBy}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </a>
                          <PermissionGate permission="buyers" editOnly>
                            <button
                              onClick={() => confirmDeleteDoc(doc)}
                              disabled={deleteDocMutation.isPending}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Upload Document Dialog */}
          <Dialog open={docUploadOpen} onOpenChange={setDocUploadOpen}>
            <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-2xl border-none">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-900">Upload Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>File</Label>
                  <input
                    ref={docFileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                  />
                  {docFile ? (
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-brand-500 shrink-0" />
                        <span className="text-sm truncate">{docFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDocFile(null)}
                        className="text-slate-400 hover:text-rose-500 shrink-0 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => docFileRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-200 rounded-md text-slate-400 hover:border-brand-300 hover:text-brand-600 transition-colors"
                    >
                      <Upload className="h-6 w-6" />
                      <span className="text-sm">Click to select file</span>
                      <span className="text-xs">PDF, DOC, DOCX, XLS, PNG, JPG</span>
                    </button>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => { setDocUploadOpen(false); setDocFile(null); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDocUpload}
                    disabled={!docFile || uploadDocMutation.isPending}
                    className="bg-brand-600 hover:bg-brand-700 text-white"
                  >
                    {uploadDocMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Upload
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeTab === "overview" && <>

      {/* ── Row 1: Company Profile + Primary Contact ── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Company Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={Building2}
              label="Legal Company Name"
              value={buyer.company}
            />
            <InfoRow
              icon={Building2}
              label="Trade / Brand Name"
              value={buyer.tradeName}
            />
            <InfoRow icon={User} label="Buyer Type" value={buyer.buyerType} />
            <InfoRow icon={MapPin} label="Country" value={buyer.country} />
            <InfoRow icon={MapPin} label="City" value={buyer.city} />
            <InfoRow icon={MapPin} label="Region" value={buyer.region} />
            <InfoRow icon={MapPin} label="Address" value={buyer.address} />
            <InfoRow
              icon={Globe}
              label="Website"
              value={
                buyer.website ? (
                  <a
                    href={buyer.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    {buyer.website}
                  </a>
                ) : undefined
              }
            />
          </CardContent>
        </Card>

        <Card className={(!buyer.phone || !buyer.whatsapp) ? "border-amber-200" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Primary Contact
              {(!buyer.phone || !buyer.whatsapp) && (
                <span className="ml-auto flex items-center gap-1 text-xs font-medium text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {!buyer.phone && !buyer.whatsapp ? "Phone & WhatsApp missing" : !buyer.phone ? "Phone missing" : "WhatsApp missing"}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={User} label="Contact Name" value={buyer.name} />
            <InfoRow
              icon={User}
              label="Role / Designation"
              value={buyer.contactRole}
            />
            <InfoRow
              icon={Mail}
              label="Email"
              value={
                buyer.email ? (
                  <a
                    href={`mailto:${buyer.email}`}
                    className="text-brand-600 hover:underline"
                  >
                    {buyer.email}
                  </a>
                ) : undefined
              }
            />
            <InfoRow
              icon={Phone}
              label="Phone"
              value={
                buyer.phone ? buyer.phone : (
                  <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                    <AlertTriangle className="h-3 w-3" /> Missing — please update
                  </span>
                )
              }
            />
            <InfoRow
              icon={MessageCircle}
              label="WhatsApp"
              value={
                buyer.whatsapp ? buyer.whatsapp : (
                  <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                    <AlertTriangle className="h-3 w-3" /> Missing — please update
                  </span>
                )
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Additional Contacts (full-width, conditional) ── */}
      {additionalContacts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Additional Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 w-8"></th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                      Name
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                      Role
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                      Phone
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                      WhatsApp
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                      Email
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                      Primary?
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {additionalContacts.map((c, i) => (
                    <tr key={i} className={(!c.phone || !c.whatsapp) ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-slate-50"}>
                      <td className="px-4 py-2.5 text-center">
                        {(!c.phone || !c.whatsapp) && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mx-auto" aria-label="Phone or WhatsApp missing" />
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {c.name || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {c.role || "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.phone ? (
                          <span className="text-slate-600">{c.phone}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                            <AlertTriangle className="h-3 w-3" /> Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.whatsapp ? (
                          <span className="text-slate-600">{c.whatsapp}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                            <AlertTriangle className="h-3 w-3" /> Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="text-brand-600 hover:underline"
                          >
                            {c.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.isPrimary ? (
                          <span className="text-brand-600 font-semibold">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Row 2: Product Portfolio + Commercial ── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" /> Current Product Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={Package}
              label="Product Categories"
              value={buyer.productCategories}
            />
            <InfoRow
              icon={MapPin}
              label="Markets Served"
              value={buyer.marketsServed}
            />
            <InfoRow
              icon={Package}
              label="Annual Import Volume"
              value={buyer.annualImportVolume}
            />
            <InfoRow
              icon={CreditCard}
              label="Annual Purchase Value"
              value={buyer.annualPurchaseValue}
            />
            <InfoRow
              icon={Package}
              label="Current Suppliers / Origins"
              value={buyer.currentSuppliersOrigins}
            />
            <InfoRow
              icon={Package}
              label="Product Category Interest"
              value={buyer.productCategoryInterest}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Commercial & Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={CreditCard}
              label="Preferred Currency"
              value={buyer.preferredCurrency}
            />
            <InfoRow
              icon={CreditCard}
              label="Pricing Range"
              value={buyer.pricingRange}
            />
            <InfoRow
              icon={CreditCard}
              label="MOQ Requirements"
              value={buyer.moqRequirements}
            />
            <InfoRow
              icon={CreditCard}
              label="Payment Terms"
              value={buyer.paymentTerms}
            />
            <InfoRow icon={Ship} label="Incoterms" value={buyer.incoterms} />
          </CardContent>
        </Card>
      </div>

      {/* ── Active Sourcing Requirements (full-width, conditional) ── */}
      {sourcingRequirements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Active Sourcing Requirements
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {sourcingRequirements.length} enquir
                {sourcingRequirements.length === 1 ? "y" : "ies"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {sourcingRequirements.map((req, i) => (
              <div
                key={req.id || i}
                className="border border-slate-200 rounded-lg p-4 bg-slate-50/50"
              >
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  Product Enquiry #{i + 1}
                  {req.product ? ` — ${req.product}` : ""}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                  <InfoRow
                    icon={Package}
                    label="Product / Commodity"
                    value={req.product}
                  />
                  <InfoRow
                    icon={Package}
                    label="Product Variant / Spec"
                    value={req.productVariant}
                  />
                  <InfoRow
                    icon={MapPin}
                    label="Country of Origin Preferred"
                    value={req.countryOfOriginPreferred}
                  />
                  <InfoRow
                    icon={Package}
                    label="Organic / Conventional"
                    value={req.organicConventional}
                  />
                  <InfoRow
                    icon={Package}
                    label="Quantity Required"
                    value={req.quantityRequired}
                  />
                  <InfoRow
                    icon={Clock}
                    label="Frequency"
                    value={req.frequency}
                  />
                  <InfoRow
                    icon={CreditCard}
                    label="Target Price (per unit)"
                    value={req.targetPrice}
                  />
                  <InfoRow
                    icon={CreditCard}
                    label="Currency"
                    value={req.currency}
                  />
                  <InfoRow
                    icon={Ship}
                    label="Delivery Port & Country"
                    value={req.deliveryPort}
                  />
                  <InfoRow
                    icon={Ship}
                    label="Incoterm Preferred"
                    value={req.incotermPreferred}
                  />
                  <InfoRow
                    icon={Package}
                    label="Sample Required?"
                    value={req.sampleRequired}
                  />
                  <InfoRow
                    icon={Package}
                    label="Sample Quantity"
                    value={req.sampleQuantity}
                  />
                  <InfoRow
                    icon={Clock}
                    label="Deadline to Receive Samples"
                    value={req.deadlineToReceiveSamples}
                  />
                  <InfoRow
                    icon={Clock}
                    label="Expected First Delivery Date"
                    value={req.expectedFirstDeliveryDate}
                  />
                  {req.packagingRequirements && (
                    <div className="sm:col-span-2">
                      <InfoRow
                        icon={Package}
                        label="Packaging Requirements"
                        value={req.packagingRequirements}
                      />
                    </div>
                  )}
                  {req.labellingRequirements && (
                    <div className="sm:col-span-2">
                      <InfoRow
                        icon={ClipboardList}
                        label="Labelling Requirements"
                        value={req.labellingRequirements}
                      />
                    </div>
                  )}
                  {req.qualityParameters && (
                    <div className="sm:col-span-2">
                      <InfoRow
                        icon={ClipboardList}
                        label="Quality Parameters"
                        value={req.qualityParameters}
                      />
                    </div>
                  )}
                  {req.requiredCertifications && (
                    <div className="sm:col-span-2">
                      <InfoRow
                        icon={ClipboardList}
                        label="Required Certifications"
                        value={req.requiredCertifications}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Row 3: Shipping & Compliance + CRM Notes ── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Ship className="h-4 w-4" /> Shipping & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={Ship}
              label="Preferred Shipping Mode"
              value={buyer.shippingMode}
            />
            <InfoRow
              icon={MapPin}
              label="Preferred Ports of Discharge"
              value={buyer.portsOfDischarge}
            />
            <InfoRow
              icon={MapPin}
              label="Country of Final Delivery"
              value={buyer.countryOfFinalDelivery}
            />
            <InfoRow
              icon={Building2}
              label="Freight Forwarder / Logistics"
              value={buyer.freightForwarder}
            />
            <InfoRow
              icon={Package}
              label="Packing / Marking Requirements"
              value={buyer.packingRequirements}
            />
            <InfoRow
              icon={ClipboardList}
              label="Certification Requirements"
              value={buyer.certificationRequirements}
            />
            <InfoRow
              icon={ClipboardList}
              label="Social / Ethical Compliance"
              value={buyer.socialEthicalCompliance}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4" /> How Did They Hear About Us
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow
                icon={MessageCircle}
                label="Source"
                value={buyer.howHeardAboutUs}
              />
              <InfoRow
                icon={Building2}
                label="Trade Fair Name"
                value={buyer.tradeFairName}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Internal CRM Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow
                icon={ClipboardList}
                label="Relationship Tier"
                value={
                  buyer.relationshipTier ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${tierStyles(buyer.relationshipTier)}`}>
                      {buyer.relationshipTier}
                    </span>
                  ) : undefined
                }
              />
              <InfoRow
                icon={ClipboardList}
                label="Risk Rating"
                value={buyer.riskRating}
              />
              <InfoRow
                icon={ClipboardList}
                label="Strategic Value"
                value={buyer.strategicValue}
              />
              <InfoRow
                icon={ClipboardList}
                label="Lead Source"
                value={buyer.leadSource}
              />
              <InfoRow
                icon={Clock}
                label="Last Contact Date"
                value={
                  buyer.lastContactDate
                    ? new Date(buyer.lastContactDate).toLocaleDateString(
                        "en-IN",
                        { day: "2-digit", month: "2-digit", year: "numeric" },
                      )
                    : undefined
                }
              />
              <InfoRow
                icon={ClipboardList}
                label="Deal History"
                value={buyer.dealHistory}
              />
              <InfoRow icon={ClipboardList} label="Notes" value={buyer.notes} />
              <InfoRow
                icon={CreditCard}
                label="Initial Order Value"
                value={buyer.initialOrderValue}
              />
              <InfoRow
                icon={CreditCard}
                label="Potential Annual Value"
                value={buyer.potentialAnnualValue}
              />
              <InfoRow
                icon={ClipboardList}
                label="Reorder Likelihood"
                value={buyer.reorderLikelihood}
              />
              <InfoRow
                icon={MessageCircle}
                label="Buyer's Stated Intent"
                value={buyer.buyerStatedIntent}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Product Catalog ── */}
      {buyer.productCatalog && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Product Catalog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={getCatalogViewUrl(buyer.productCatalog)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-brand-600 hover:underline text-sm font-medium"
            >
              <FileText className="h-4 w-4" />
              Open Product Catalog (PDF)
            </a>
          </CardContent>
        </Card>
      )}

      {/* ── Suppliers in Talks With ── */}
      {(() => {
        const validLinks = (buyer.supplierLinks ?? []).filter((link) => {
          if (suppliersListLoading) return true;
          return allSupplierOptions.some((s) => s.id === link.id);
        });
        if (validLinks.length === 0) return null;

        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Suppliers in Talks With
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {validLinks.map((link) => {
                  const found = allSupplierOptions.find((s) => s.id === link.id);
                  const path =
                    link.type === "new"
                      ? `/suppliers/new/${link.id}`
                      : `/suppliers/signed-contract/${link.id}`;
                  const label = found
                    ? found.label
                    : `${link.id.slice(0, 8)} (${link.type === "new" ? "New" : "Signed"})`;
                  return (
                    <Link
                      key={`${link.id}-${link.type}`}
                      to={path}
                      state={{ from: { path: `/buyers/${buyer.id}`, label: buyer.company } }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6 bg-white rounded-xl shadow-2xl border-none">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-2">
              <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0 border border-brand-200">
                <Building2 className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                  Edit Buyer Profile
                </DialogTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Update buyer information and sourcing requirements.
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {/* ── Section 1: Company Profile ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Company Profile
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Company Legal Name *</Label>
                  <Input
                    value={form.company ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, company: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trade / Brand Name</Label>
                  <Input
                    value={form.tradeName ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, tradeName: e.target.value })
                    }
                    placeholder="If different from the legal name e.g. Nike, ZARA"
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buyer Type</Label>
                  <SelectWithOthers
                    value={form.buyerType ?? ""}
                    onChange={(v) => setForm({ ...form, buyerType: v })}
                    options={[
                      "Wholesaler",
                      "Retailer",
                      "Importer / Distributor",
                      "E-Commerce",
                      "Supermarket Chain",
                      "Private Label Brand",
                      "Trader",
                      "Food Service / HoReCa",
                    ]}
                    placeholder="Select buyer type…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country of Registration *</Label>
                  <Input
                    value={form.country ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, country: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={form.city ?? ""}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <SelectWithOthers
                    value={form.region ?? ""}
                    onChange={(v) => setForm({ ...form, region: v })}
                    options={[
                      "EU",
                      "UK",
                      "US",
                      "Middle East",
                      "Asia",
                      "Africa",
                      "Latin America",
                      "Australia / NZ",
                    ]}
                    placeholder="Select region…"
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
                <div className="space-y-2 sm:col-span-2">
                  <Label>Registered / Business Address</Label>
                  <Textarea
                    value={form.address ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Section 2: Key Contacts ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Key Contacts
              </p>
              <p className="text-xs text-slate-400 mb-3">Primary contact</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Contact Name *</Label>
                  <Input
                    value={form.name ?? ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role / Designation</Label>
                  <Input
                    value={form.contactRole ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, contactRole: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <Input
                    type="text"
                    value={form.email ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone (with country code) *</Label>
                  <Input
                    value={form.phone ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    value={form.whatsapp ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, whatsapp: e.target.value })
                    }
                    placeholder="With country code"
                  />
                </div>
              </div>

              {/* Additional Contacts */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500 font-medium">
                    Additional Contacts
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={addContact}
                  >
                    <Plus className="h-3 w-3" /> Add Contact
                  </Button>
                </div>
                {(form.additionalContacts || []).length > 0 && (
                  <div className="rounded-md border border-slate-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-2 w-6"></th>
                          <th className="px-2 py-2 text-left font-medium text-slate-500">
                            Name
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-slate-500">
                            Role
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-slate-500">
                            Phone
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-slate-500">
                            WhatsApp
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-slate-500">
                            Email
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-slate-500">
                            Primary?
                          </th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(form.additionalContacts || []).map((c, i) => (
                          <tr key={i} className={(!c.phone || !c.whatsapp) ? "bg-amber-50/40" : ""}>
                            <td className="px-2 py-1.5 text-center">
                              {(!c.phone || !c.whatsapp) && (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="Phone or WhatsApp missing" />
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                className="h-7 text-xs border-slate-200"
                                value={c.name}
                                onChange={(e) =>
                                  updateContact(i, "name", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                className="h-7 text-xs border-slate-200"
                                value={c.role}
                                onChange={(e) =>
                                  updateContact(i, "role", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                className={`h-7 text-xs border-slate-200 ${!c.phone ? "border-amber-300 bg-amber-50" : ""}`}
                                value={c.phone}
                                onChange={(e) =>
                                  updateContact(i, "phone", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                className={`h-7 text-xs border-slate-200 ${!c.whatsapp ? "border-amber-300 bg-amber-50" : ""}`}
                                value={c.whatsapp}
                                onChange={(e) =>
                                  updateContact(i, "whatsapp", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                className="h-7 text-xs border-slate-200"
                                value={c.email}
                                onChange={(e) =>
                                  updateContact(i, "email", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={c.isPrimary}
                                onChange={(e) =>
                                  updateContact(
                                    i,
                                    "isPrimary",
                                    e.target.checked,
                                  )
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => removeContact(i)}
                                className="text-slate-400 hover:text-rose-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* ── Section 3: Current Product Portfolio ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Current Product Portfolio
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Product Categories You Currently Deal In</Label>
                  <MultiSelectDropdown
                    value={form.productCategories ?? ""}
                    onChange={(v) => setForm({ ...form, productCategories: v })}
                    options={[
                      "Rice",
                      "Millet / Grains",
                      "Honey",
                      "Spices",
                      "Pulses / Lentils",
                      "Oils / Ghee",
                      "Textiles",
                      "Handicrafts",
                      "Personal Care / Ayurveda",
                      "Organic Foods",
                      "Snacks / Ready-to-Eat",
                    ]}
                    placeholder="Select categories…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Annual Import Volume (approx.)</Label>
                  <Input
                    value={form.annualImportVolume ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, annualImportVolume: e.target.value })
                    }
                    placeholder="e.g. 500 MT"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Annual Purchase Value (approx.)</Label>
                  <Input
                    value={form.annualPurchaseValue ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, annualPurchaseValue: e.target.value })
                    }
                    placeholder="e.g. USD 1.2M"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Countries / Markets You Currently Serve</Label>
                  <Textarea
                    value={form.marketsServed ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, marketsServed: e.target.value })
                    }
                    rows={2}
                    placeholder="List all import markets"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Current Suppliers / Origins</Label>
                  <Textarea
                    value={form.currentSuppliersOrigins ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        currentSuppliersOrigins: e.target.value,
                      })
                    }
                    rows={2}
                    placeholder="Known supplier names or countries of origin"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Product Category Interest (additional notes)</Label>
                  <Input
                    value={form.productCategoryInterest ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        productCategoryInterest: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Section 4: Active Sourcing Requirements ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Active Sourcing Requirements
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Add one block per product you wish to source
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1 shrink-0"
                  onClick={addSourcingReq}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Product Enquiry
                </Button>
              </div>
              {(form.sourcingRequirements || []).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
                  No sourcing requirements added yet. Click "Add Product
                  Enquiry" to add one.
                </p>
              )}
              {(form.sourcingRequirements || []).map((req, i) => (
                <div
                  key={req.id}
                  className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700">
                      Product Enquiry #{i + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      onClick={() => removeSourcingReq(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Product / Commodity</Label>
                      <Input
                        className="h-8 text-sm"
                        value={req.product}
                        onChange={(e) =>
                          updateSourcingReq(i, "product", e.target.value)
                        }
                        placeholder="e.g. Organic Basmati Rice"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Product Variant / Specification
                      </Label>
                      <Input
                        className="h-8 text-sm"
                        value={req.productVariant}
                        onChange={(e) =>
                          updateSourcingReq(i, "productVariant", e.target.value)
                        }
                        placeholder="e.g. 1121 Long Grain, 5% broken"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Country of Origin Preferred
                      </Label>
                      <Input
                        className="h-8 text-sm"
                        value={req.countryOfOriginPreferred}
                        onChange={(e) =>
                          updateSourcingReq(
                            i,
                            "countryOfOriginPreferred",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Organic / Conventional</Label>
                      <SelectWithOthers
                        value={req.organicConventional}
                        onChange={(v) =>
                          updateSourcingReq(i, "organicConventional", v)
                        }
                        options={["Organic", "Conventional"]}
                        placeholder="Select…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quantity Required</Label>
                      <Input
                        className="h-8 text-sm"
                        value={req.quantityRequired}
                        onChange={(e) =>
                          updateSourcingReq(
                            i,
                            "quantityRequired",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. 25 MT"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Frequency</Label>
                      <Input
                        className="h-8 text-sm"
                        value={req.frequency}
                        onChange={(e) =>
                          updateSourcingReq(i, "frequency", e.target.value)
                        }
                        placeholder="e.g. Per month / Per shipment"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Target Price (per unit)</Label>
                      <Input
                        className="h-8 text-sm"
                        value={req.targetPrice}
                        onChange={(e) =>
                          updateSourcingReq(i, "targetPrice", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Currency</Label>
                      <Input
                        className="h-8 text-sm"
                        value={req.currency}
                        onChange={(e) =>
                          updateSourcingReq(i, "currency", e.target.value)
                        }
                        placeholder="e.g. USD, EUR"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Delivery Port & Country</Label>
                      <Input
                        className="h-8 text-sm"
                        value={req.deliveryPort}
                        onChange={(e) =>
                          updateSourcingReq(i, "deliveryPort", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Incoterm Preferred</Label>
                      <SelectWithOthers
                        value={req.incotermPreferred}
                        onChange={(v) =>
                          updateSourcingReq(i, "incotermPreferred", v)
                        }
                        options={[
                          "CIF",
                          "FOB",
                          "DDP",
                          "EXW",
                          "CPT",
                          "CNF",
                          "FCA",
                        ]}
                        placeholder="Select…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Sample Required Before Order?
                      </Label>
                      <SelectWithOthers
                        value={req.sampleRequired}
                        onChange={(v) =>
                          updateSourcingReq(i, "sampleRequired", v)
                        }
                        options={["Yes", "No"]}
                        placeholder="Select…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sample Quantity</Label>
                      <Input
                        className="h-8 text-sm"
                        value={req.sampleQuantity}
                        onChange={(e) =>
                          updateSourcingReq(i, "sampleQuantity", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Deadline to Receive Samples
                      </Label>
                      <Input
                        className="h-8 text-sm"
                        value={req.deadlineToReceiveSamples}
                        onChange={(e) =>
                          updateSourcingReq(
                            i,
                            "deadlineToReceiveSamples",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Expected First Delivery Date
                      </Label>
                      <Input
                        className="h-8 text-sm"
                        value={req.expectedFirstDeliveryDate}
                        onChange={(e) =>
                          updateSourcingReq(
                            i,
                            "expectedFirstDeliveryDate",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Packaging Requirements</Label>
                      <Textarea
                        className="text-sm"
                        value={req.packagingRequirements}
                        onChange={(e) =>
                          updateSourcingReq(
                            i,
                            "packagingRequirements",
                            e.target.value,
                          )
                        }
                        rows={2}
                        placeholder="e.g. 1kg retail packs in master cartons, private label"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Labelling Requirements</Label>
                      <Textarea
                        className="text-sm"
                        value={req.labellingRequirements}
                        onChange={(e) =>
                          updateSourcingReq(
                            i,
                            "labellingRequirements",
                            e.target.value,
                          )
                        }
                        rows={2}
                        placeholder="e.g. EU Reg 1169/2011, bilingual English/Arabic"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">
                        Specifications / Quality Parameters
                      </Label>
                      <Textarea
                        className="text-sm"
                        value={req.qualityParameters}
                        onChange={(e) =>
                          updateSourcingReq(
                            i,
                            "qualityParameters",
                            e.target.value,
                          )
                        }
                        rows={2}
                        placeholder="Moisture %, broken %, purity, colour, aroma, etc."
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">
                        Required Certifications / Test Reports
                      </Label>
                      <Textarea
                        className="text-sm"
                        value={req.requiredCertifications}
                        onChange={(e) =>
                          updateSourcingReq(
                            i,
                            "requiredCertifications",
                            e.target.value,
                          )
                        }
                        rows={2}
                        placeholder="e.g. USDA Organic, Halal, Pesticide Residue Report, COI"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* ── Section 5: Commercial & Payment ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Commercial & Payment Preferences
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Preferred Currency</Label>
                  <Input
                    value={form.preferredCurrency ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, preferredCurrency: e.target.value })
                    }
                    placeholder="e.g. USD, EUR, GBP"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pricing Range</Label>
                  <Input
                    value={form.pricingRange ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, pricingRange: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>MOQ Requirements</Label>
                  <Input
                    value={form.moqRequirements ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, moqRequirements: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Payment Terms Preferred</Label>
                  <MultiSelectDropdown
                    value={form.paymentTerms ?? ""}
                    onChange={(v) => setForm({ ...form, paymentTerms: v })}
                    options={[
                      "T/T Advance (100%)",
                      "50% Advance + 50% Against BL",
                      "Letter of Credit (L/C at Sight)",
                      "L/C Usance (30/60/90 days)",
                      "D/P",
                      "D/A",
                      "Open Account",
                    ]}
                    placeholder="Select payment terms…"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Incoterms Preferred</Label>
                  <MultiSelectDropdown
                    value={form.incoterms ?? ""}
                    onChange={(v) => setForm({ ...form, incoterms: v })}
                    options={["EXW", "FOB", "CIF", "CNF", "CPT", "DDP"]}
                    placeholder="Select incoterms…"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Section 6: Shipping & Compliance ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Shipping & Compliance Requirements
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Preferred Shipping Mode</Label>
                  <MultiSelectDropdown
                    value={form.shippingMode ?? ""}
                    onChange={(v) => setForm({ ...form, shippingMode: v })}
                    options={[
                      "Sea — FCL (Full Container)",
                      "Sea — LCL (Less than Container)",
                      "Air Freight",
                      "Courier / Express",
                      "Multimodal",
                    ]}
                    placeholder="Select shipping modes…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preferred Ports of Discharge</Label>
                  <Input
                    value={form.portsOfDischarge ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, portsOfDischarge: e.target.value })
                    }
                    placeholder="List ports / cities"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country of Final Delivery</Label>
                  <Input
                    value={form.countryOfFinalDelivery ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        countryOfFinalDelivery: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preferred Freight Forwarder / Logistics Partner</Label>
                  <Input
                    value={form.freightForwarder ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, freightForwarder: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>
                    Special Packing / Marking / Palletisation Requirements
                  </Label>
                  <Textarea
                    value={form.packingRequirements ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, packingRequirements: e.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Certifications Required from Supplier</Label>
                  <MultiSelectDropdown
                    value={form.certificationRequirements ?? ""}
                    onChange={(v) =>
                      setForm({ ...form, certificationRequirements: v })
                    }
                    options={[
                      "HACCP",
                      "ISO 22000 / FSSC 22000",
                      "BRC / IFS / SQF",
                      "USDA Organic (NOP)",
                      "EU Organic",
                      "JAS Organic",
                      "Halal",
                      "Kosher",
                      "Fair Trade",
                      "FDA Registration",
                      "FSSAI",
                      "TRACES NT (EU)",
                      "Phytosanitary Certificate",
                      "Health Certificate",
                    ]}
                    placeholder="Select certifications…"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Social / Ethical Compliance Requirements</Label>
                  <Input
                    value={form.socialEthicalCompliance ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        socialEthicalCompliance: e.target.value,
                      })
                    }
                    placeholder="e.g. SEDEX, SA8000, Rainforest Alliance"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Section 7: You Hear About Us ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                How Did They Hear About Us?
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <SelectWithOthers
                    value={form.howHeardAboutUs ?? ""}
                    onChange={(v) => setForm({ ...form, howHeardAboutUs: v })}
                    options={[
                      "Trade Fair / Exhibition",
                      "Referral",
                      "LinkedIn",
                      "Website / Google Search",
                      "Cold Outreach from Elan",
                      "Existing Network",
                    ]}
                    placeholder="Select source…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trade Fair Name (if applicable)</Label>
                  <Input
                    value={form.tradeFairName ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, tradeFairName: e.target.value })
                    }
                    placeholder="e.g. Anuga 2025, Gulfood 2025"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Section 8: Internal CRM Notes ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Internal CRM Notes
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Relationship Tier</Label>
                  <Select
                    value={form.relationshipTier ?? ""}
                    onValueChange={(v) => setForm({ ...form, relationshipTier: v === "_clear" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_clear"><span className="text-muted-foreground">— None —</span></SelectItem>
                      <SelectItem value="Transactional">Transactional</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Strategic">Strategic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Risk Rating</Label>
                  <SelectWithOthers
                    value={form.riskRating ?? ""}
                    onChange={(v) => setForm({ ...form, riskRating: v })}
                    options={["Low", "Medium", "High"]}
                    placeholder="Select risk…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Strategic Value</Label>
                  <SelectWithOthers
                    value={form.strategicValue ?? ""}
                    onChange={(v) => setForm({ ...form, strategicValue: v })}
                    options={["Low", "Medium", "High"]}
                    placeholder="Select value…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lead Source</Label>
                  <Input
                    value={form.leadSource ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, leadSource: e.target.value })
                    }
                    placeholder="e.g. Trade Show, Referral"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Contact Date</Label>
                  <Input
                    type="date"
                    value={
                      form.lastContactDate
                        ? form.lastContactDate.split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setForm({ ...form, lastContactDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Deal History</Label>
                  <Textarea
                    value={form.dealHistory ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, dealHistory: e.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={form.notes ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    rows={3}
                    placeholder="Special requirements, observations, past history…"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Section 8b: Commercial Intelligence ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Commercial Intelligence
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Initial Order Value</Label>
                  <Input
                    value={form.initialOrderValue ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, initialOrderValue: e.target.value })
                    }
                    placeholder="e.g. USD 25,000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Potential Annual Value</Label>
                  <Input
                    value={form.potentialAnnualValue ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, potentialAnnualValue: e.target.value })
                    }
                    placeholder="e.g. USD 200,000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reorder Likelihood</Label>
                  <Select
                    value={form.reorderLikelihood ?? ""}
                    onValueChange={(v) =>
                      setForm({ ...form, reorderLikelihood: v === "_clear" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select likelihood…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_clear"><span className="text-muted-foreground">— None —</span></SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Buyer's Stated Intent</Label>
                  <Input
                    value={form.buyerStatedIntent ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, buyerStatedIntent: e.target.value })
                    }
                    placeholder="e.g. Plans to place monthly orders of 20 MT if first shipment is approved"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Section 9: Product Catalog ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Product Catalog
              </p>
              <div className="space-y-3">
                {form.productCatalog && !catalogFile && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-brand-500 shrink-0" />
                    <a
                      href={getCatalogViewUrl(form.productCatalog)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline truncate"
                    >
                      View current catalog
                    </a>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, productCatalog: "" })}
                      className="ml-auto text-slate-400 hover:text-rose-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input
                    id="catalog-upload-buyer"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setCatalogFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                    onClick={() => document.getElementById("catalog-upload-buyer")?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {catalogFile ? "Change File" : form.productCatalog ? "Replace Catalog" : "Upload Catalog (PDF)"}
                  </button>
                  {catalogFile && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <FileText className="h-4 w-4 text-brand-500 shrink-0" />
                      <span className="truncate max-w-[200px]">{catalogFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setCatalogFile(null)}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Quotation ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Quotation</p>
              <div className="flex flex-col gap-2">
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.jfif" multiple className="hidden" id="multi-quotation-upload-buyer" onChange={(e) => { if (e.target.files) setQuotationFiles((prev) => [...prev, ...Array.from(e.target.files || [])]); }} />
                <Button type="button" variant="outline" size="sm" className="gap-2 text-slate-600 border-slate-200 w-fit" onClick={() => document.getElementById("multi-quotation-upload-buyer")?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Upload Quotation Files
                </Button>
                {((form as any).quotations || []).length > 0 && (<div className="flex flex-col gap-1 mt-2">{((form as any).quotations || []).map((doc: any, idx: number) => (<div key={`quot-${idx}`} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 text-sm"><a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-600 hover:underline flex-1 mr-2 text-xs">{doc.name}</a><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => { const updated = [...((form as any).quotations || [])]; updated.splice(idx, 1); setForm({ ...form, quotations: updated } as any); }}><X className="h-3.5 w-3.5" /></button></div>))}</div>)}
                {quotationFiles.length > 0 && (<div className="flex flex-col gap-1 mt-1">{quotationFiles.map((f, idx) => (<div key={`pend-quot-${idx}`} className="flex items-center justify-between bg-amber-50 p-2 rounded border border-amber-100 text-sm"><span className="truncate text-slate-700 text-xs flex-1 mr-2">{f.name} (Pending)</span><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => setQuotationFiles((prev) => prev.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></button></div>))}</div>)}
              </div>
            </div>

            <Separator />

            {/* ── Documents ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Documents</p>
              <div className="space-y-2">
                {/* Existing uploaded docs */}
                {((form as any).documents as BuyerDocument[] | undefined)?.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-md border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                      <span className="text-xs truncate text-slate-700 font-medium">{doc.name}</span>
                      <span className="text-xs text-slate-400 shrink-0">({doc.documentType})</span>
                    </div>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-rose-600 shrink-0 ml-2"
                      onClick={() => confirmDeleteDoc(doc)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {/* Pending new docs */}
                {pendingDocFiles.map((pd, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-amber-50 p-2 rounded-md border border-amber-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs truncate text-slate-700">{pd.file.name}</span>
                      <span className="text-xs text-slate-400 shrink-0">({pd.docType}) · Pending upload</span>
                    </div>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-rose-600 shrink-0 ml-2"
                      onClick={() => setPendingDocFiles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {/* Add doc row */}
                <div className="flex items-center gap-2 pt-1">
                  <Select value={formDocAddType} onValueChange={setFormDocAddType}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    ref={formDocFileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setPendingDocFiles((prev) => [...prev, { file: f, docType: formDocAddType }]);
                        e.target.value = "";
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => formDocFileRef.current?.click()}
                  >
                    <Upload className="h-3 w-3" /> Add Document
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Suppliers in Talks With ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Suppliers in Talks With</p>
              <div className="space-y-2">
                <Label>Supplier(s) in talks with</Label>
                <EntityLinkSelect
                  selectedIds={(form.supplierLinks ?? []).map((l) => l.id)}
                  onChange={(ids) => {
                    const links = ids.map((id) => {
                      const found = allSupplierOptions.find((s) => s.id === id);
                      return { id, type: (found?.type ?? "new") as "new" | "signed" };
                    });
                    setForm({ ...form, supplierLinks: links });
                  }}
                  options={allSupplierOptions}
                  isLoading={suppliersListLoading}
                  placeholder="Select suppliers in talks with this buyer…"
                />
              </div>
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
                disabled={updateMutation.isPending || uploadCatalogMutation.isPending}
              >
                {(updateMutation.isPending || uploadCatalogMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </> }

    </div>
    </OnAddContext.Provider>
  );
}
