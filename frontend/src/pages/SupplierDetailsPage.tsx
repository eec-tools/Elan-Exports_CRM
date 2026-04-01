import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { EntityLinkSelect } from "@/components/EntityLinkSelect";
import { SelectWithOthers } from "@/components/SelectWithOthers";
import {
  useSensitiveDataUnlock,
  SensitiveValue,
} from "@/components/SensitiveDataGuard";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  MapPin,
  User,
  Building2,
  DollarSign,
  FileText,
  ShieldCheck,
  Factory,
  Award,
  Globe,
  Package,
  Tag,
  Users,
  Pencil,
  Upload,
  X,
  Trash2,
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquareText,
  Plus,
} from "lucide-react";

interface OrganicCertRow { market: string; certNumber: string; expiryDate: string; }
interface LabTestRow { testType: string; lastTestDate: string; labName: string; reportAttached: string; }

interface SupplierProduct {
  id: string;
  product: string;
  productCategory: string;
  hsCode: string;
  organicStatus: string;
  certifications: string;
  shelfLife: string;
  storageConditions: string;
  packagingType: string;
  netWeightVariants: string;
  ingredientList: string;
  allergenDeclaration: string;
}

interface ProductCatalogEntry {
  name: string;
  url: string;
}

const EMPTY_SUPPLIER_PRODUCT = (): SupplierProduct => ({
  id: String(Date.now() + Math.random()),
  product: "", productCategory: "", hsCode: "", organicStatus: "",
  certifications: "", shelfLife: "", storageConditions: "",
  packagingType: "", netWeightVariants: "", ingredientList: "",
  allergenDeclaration: "",
});
interface Supplier {
  id: string;
  company: string;
  lidlFactoryId?: string;
  commissionPercent?: string;
  contractBuyer?: string;
  buyerIds?: string[];
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
  createdAt?: string;
  documents?: { name: string; url: string }[];
  contractDocument?: { name: string; url: string } | null;
  // New fields from Supplier Information Sheet
  tradeName?: string;
  yearEstablished?: string;
  manufacturingAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  supplierType?: string;
  whatsapp?: string;
  hsCode?: string;
  organicStatus?: string;
  ingredientList?: string;
  allergenDeclaration?: string;
  shelfLife?: string;
  storageConditions?: string;
  packagingType?: string;
  netWeightVariants?: string;
  sampleAvailable?: string;
  sampleLeadTime?: string;
  sampleCost?: string;
  annualProductionVolume?: string;
  avgMonthlyVolume?: string;
  maxScalableMonthlyVolume?: string;
  peakSeasonMonths?: string;
  offSeasonAvailability?: string;
  minExportableBatch?: string;
  moq?: string;
  leadTimeFirstOrder?: string;
  leadTimeRepeatOrder?: string;
  incotermsSupported?: string;
  portsOfExport?: string;
  targetExportMarkets?: string;
  currencyPreferred?: string;
  paymentTerms?: string;
  bankName?: string;
  bankBranch?: string;
  bankAddress?: string;
  accountNumber?: string;
  swiftBicCode?: string;
  iban?: string;
  lcAdvisingBankName?: string;
  lcBeneficiaryName?: string;
  lcBankAddress?: string;
  lcSwiftCode?: string;
  iecNumber?: string;
  gstNumber?: string;
  fssaiLicense?: string;
  apedaNumber?: string;
  fdaRegistrationNumber?: string;
  usAgentAppointed?: string;
  tracesNtRegistration?: string;
  coiCapability?: string;
  daffBiosecurity?: string;
  jasLabelCompliance?: string;
  haccpAvailable?: string;
  isoFsscCertNo?: string;
  isoCertValidityDate?: string;
  latestInternalAuditDate?: string;
  latestThirdPartyAuditDate?: string;
  auditingBodyName?: string;
  farmerOrganicCert?: string;
  aggregatorOrganicCert?: string;
  processingUnitOrganicCert?: string;
  certifyingBodyName?: string;
  certsValidForExport?: string;
  organicCertsByMarket?: OrganicCertRow[];
  labTestingRecords?: LabTestRow[];
  gmoFreeDeclaration?: string;
  irradiationFreeDeclaration?: string;
  foodContactCompliance?: string;
  compostabilityCert?: string;
  migrationTestReport?: string;
  exportBrand?: string;
  healthNutritionClaims?: string;
  claimsApprovedMarkets?: string;
  packagingComplianceRegions?: string;
  organicSegregationSop?: string;
  cleaningLinelearanceSop?: string;
  noProhibitedAids?: string;
  supplierProducts?: SupplierProduct[];
  productCatalogs?: ProductCatalogEntry[];
}

const ORGANIC_CERT_MARKETS = ["India — NPOP", "USA — USDA Organic (NOP)", "EU — EU Organic (Reg 2018/848)", "UK — UK Organic", "Australia — ACO / NASAA", "Japan — JAS Organic"];
const LAB_TEST_TYPES = ["Pesticide Residue Analysis", "Heavy Metals Test", "Microbiology Test", "Aflatoxin Test", "Moisture Analysis"];

interface EmailCampaign {
  id: string;
  supplierId: string;
  status: "active" | "completed" | "response_received";
  currentStep: number;
  introEmailSentAt: string;
  followup1SentAt?: string | null;
  followup2SentAt?: string | null;
  followup3SentAt?: string | null;
  responseReceivedAt?: string | null;
  nextFollowupDue?: string | null;
}

function getCatalogViewUrl(url?: string) {
  if (!url) return url;

  // Ensure we don't accidentally pass fl_inline which Cloudinary rejects on raw resources
  let fixed = url.replace("/fl_inline", "");
  // Standardise to raw/upload for PDFs if they happen to end up as image type erroneously
  if (fixed.includes("/image/upload/") && fixed.toLowerCase().endsWith(".pdf")) {
    fixed = fixed.replace("/image/upload/", "/raw/upload/");
  }
  return fixed;
}

function statusColor(status?: string) {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-brand-500/15 text-brand-700 border-brand-500/25";
    case "inactive":
      return "bg-red-500/15 text-red-700 border-red-500/25";
    case "under review":
    case "pending":
      return "bg-amber-500/15 text-amber-700 border-amber-500/25";
    default:
      return "bg-slate-500/15 text-slate-700 border-slate-500/25";
  }
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function SupplierDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>({});
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [catalogFiles, setCatalogFiles] = useState<File[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);

  const { isUnlocked, unlockButton, passkeyDialog } =
    useSensitiveDataUnlock("supplier-details");

  const { data: supplier, isLoading } = useQuery<Supplier>({
    queryKey: ["supplier", id],
    queryFn: () => api.get(`/suppliers/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: campaign } = useQuery<EmailCampaign | null>({
    queryKey: ["intro-campaign", id],
    queryFn: () =>
      api
        .get(`/intro-campaigns/${id}`)
        .then((r) => r.data)
        .catch((e) => (e.response?.status === 404 ? null : Promise.reject(e))),
    enabled: !!id,
  });

  const { data: buyersListData, isLoading: buyersListLoading } = useQuery<{ id: string; company: string; name: string }[]>({
    queryKey: ["buyers-list"],
    queryFn: () => api.get("/buyers/list").then((r) => r.data),
    staleTime: 60_000,
    enabled: !!(supplier?.buyerIds?.length || dialogOpen),
  });

  const startCampaignMutation = useMutation({
    mutationFn: () => api.post(`/intro-campaigns/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intro-campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["intro-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["intro-campaigns-due"] });
      toast.success("Intro email campaign started");
    },
    onError: () => toast.error("Failed to start campaign"),
  });

  const markSentMutation = useMutation({
    mutationFn: () => api.post(`/intro-campaigns/${id}/mark-sent`),
    onSuccess: (res) => {
      if (res.data?.movedToOld) {
        toast.success("All emails sent — supplier moved to Old Suppliers (no response)");
        navigate("/suppliers/old");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["intro-campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["intro-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["intro-campaigns-due"] });
      toast.success("Follow-up marked as sent");
    },
    onError: () => toast.error("Failed to mark email as sent"),
  });

  const markResponseMutation = useMutation({
    mutationFn: () => api.post(`/intro-campaigns/${id}/mark-response`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intro-campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["intro-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["intro-campaigns-due"] });
      toast.success("Supplier response recorded — campaign stopped");
    },
    onError: () => toast.error("Failed to record response"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<Supplier> }) =>
      api.put(`/suppliers/${id}`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier", id] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-filters"] });
      queryClient.invalidateQueries({ queryKey: ["buyer"] });
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      setDialogOpen(false);
      toast.success("Supplier updated");
    },
    onError: () => toast.error("Failed to update supplier"),
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
    onError: () => toast.error("Failed to upload catalog file"),
  });

  const uploadDocuments = async (files: FileList) => {
    if (!files || files.length === 0) return;
    setUploadingDocs(true);
    try {
      const finalDocuments = [...(supplier?.documents || [])];
      for (const file of Array.from(files)) {
        const uploadRes = await uploadCatalogMutation.mutateAsync(file);
        finalDocuments.push({ name: file.name, url: uploadRes.url });
      }
      
      // Save it immediately
      if (supplier?.id) {
        updateMutation.mutate({ id: supplier.id, d: { documents: finalDocuments } });
      }
    } catch {
      toast.error("Failed to upload some documents");
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleDeleteDocument = (index: number) => {
    if (!supplier?.documents || !supplier?.id) return;
    const finalDocuments = [...supplier.documents];
    finalDocuments.splice(index, 1);
    updateMutation.mutate({ id: supplier.id, d: { documents: finalDocuments } });
  };

  const uploadContractDocument = async (file: File) => {
    if (!file) return;
    setUploadingContract(true);
    try {
      const uploadRes = await uploadCatalogMutation.mutateAsync(file);
      const newContract = { name: file.name, url: uploadRes.url };
      if (supplier?.id) {
        updateMutation.mutate({ id: supplier.id, d: { contractDocument: newContract } });
      }
    } catch {
      toast.error("Failed to upload contract document");
    } finally {
      setUploadingContract(false);
    }
  };

  const handleDeleteContract = () => {
    if (!supplier?.id) return;
    updateMutation.mutate({ id: supplier.id, d: { contractDocument: null } });
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Supplier not found</p>
        <Button
          variant="outline"
          onClick={() => navigate("/suppliers/signed-contract")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Suppliers
        </Button>
      </div>
    );
  }

  const registeredSince = supplier.createdAt
    ? new Date(supplier.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company) return;

    let catalogUrl = form.productCatalogShared;

    if (catalogFile) {
      try {
        const uploadRes = await uploadCatalogMutation.mutateAsync(catalogFile);
        catalogUrl = uploadRes.url;
      } catch {
        return; // error already handled by onError in mutation
      }
    }

    const finalDocuments = [...(form.documents || [])];

    if (documentFiles.length > 0) {
      for (const file of documentFiles) {
        try {
          const uploadRes = await uploadCatalogMutation.mutateAsync(file);
          finalDocuments.push({ name: file.name, url: uploadRes.url });
        } catch {
          return;
        }
      }
    }

    // Upload new catalog files for multi-catalog
    const finalCatalogs = [...(form.productCatalogs || [])];
    if (catalogFiles.length > 0) {
      for (const file of catalogFiles) {
        try {
          const uploadRes = await uploadCatalogMutation.mutateAsync(file);
          finalCatalogs.push({ name: file.name, url: uploadRes.url });
        } catch {
          return;
        }
      }
    }

    const payload = { ...form, productCatalogShared: catalogUrl, documents: finalDocuments, productCatalogs: finalCatalogs };

    if (supplier?.id) {
      updateMutation.mutate({ id: supplier.id, d: payload });
    }
  };

  const addProduct = () => {
    setForm((f) => ({ ...f, supplierProducts: [...(f.supplierProducts || []), EMPTY_SUPPLIER_PRODUCT()] }));
  };
  const removeProduct = (idx: number) => {
    setForm((f) => ({ ...f, supplierProducts: (f.supplierProducts || []).filter((_, i) => i !== idx) }));
  };
  const updateProduct = (idx: number, field: keyof SupplierProduct, value: string) => {
    setForm((f) => {
      const next = [...(f.supplierProducts || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...f, supplierProducts: next };
    });
  };

  const openEdit = () => {
    setForm({ ...(supplier || {}), supplierProducts: supplier?.supplierProducts || [], productCatalogs: supplier?.productCatalogs || [] });
    setCatalogFile(null);
    setDocumentFiles([]);
    setCatalogFiles([]);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {passkeyDialog}

      {/* ── Breadcrumb ── */}
      <div className="text-sm text-muted-foreground flex items-center gap-1">
        <Link to="/" className="hover:underline">
          CRM
        </Link>
        <span>/</span>
        <Link to="/suppliers/signed-contract" className="hover:underline">
          Suppliers
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {supplier.company}
        </span>
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {supplier.company}
            </h1>
            <Badge
              variant="outline"
              className={statusColor(supplier.currentStatus)}
            >
              {supplier.currentStatus || "Active"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Supplier ID: #{supplier.id.slice(0, 8).toUpperCase()}
            {registeredSince && ` · Added On ${registeredSince}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {unlockButton}
          <PermissionGate permission="suppliers" editOnly>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </PermissionGate>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/suppliers/signed-contract")}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <Separator />

      {/* ── Content Grid ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* ── General Info ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              General Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={User}
              label="Contact Person"
              value={supplier.contactPerson}
            />
            <InfoRow icon={Mail} label="Email Address" value={supplier.email} />
            <InfoRow icon={Phone} label="Phone" value={supplier.phone} />
            <InfoRow icon={MapPin} label="Country" value={supplier.country} />
            <InfoRow
              icon={Building2}
              label="Company Address"
              value={supplier.companyAddress}
            />
            <InfoRow icon={Globe} label="Website" value={supplier.website} />
            <InfoRow
              icon={Factory}
              label="Production Capacity"
              value={supplier.productionCapacity}
            />
            <InfoRow
              icon={Award}
              label="Certifications"
              value={supplier.certifications}
            />
          </CardContent>
        </Card>

        {/* ── Contract & Commission (Sensitive) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Contract & Commission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {(supplier.buyerIds ?? []).length > 0 && (
              <div className="flex items-start gap-3 py-2">
                <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Contract Buyers</p>
                  {!isUnlocked ? (
                    <div className="mt-1">
                      <span className="font-mono tracking-widest text-muted-foreground opacity-60">
                        ••••••••••••••••
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(supplier.buyerIds ?? []).map((buyerId) => {
                        const buyer = buyersListData?.find((b) => b.id === buyerId);
                        return (
                          <Link
                            key={buyerId}
                            to={`/buyers/${buyerId}`}
                            className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors"
                          >
                            {buyer ? `${buyer.company}${buyer.name ? ` (${buyer.name})` : ""}` : buyerId.slice(0, 8)}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            <InfoRow
              icon={Building2}
              label="Contract Buyer"
              value={
                <SensitiveValue
                  value={supplier.contractBuyer}
                  isUnlocked={isUnlocked}
                />
              }
            />
            <InfoRow
              icon={DollarSign}
              label="Commission %"
              value={
                <SensitiveValue
                  value={supplier.commissionPercent}
                  isUnlocked={isUnlocked}
                />
              }
            />
            <InfoRow
              icon={DollarSign}
              label="Approved Confirm %"
              value={
                <SensitiveValue
                  value={supplier.approvedConfirmPercent}
                  isUnlocked={isUnlocked}
                />
              }
            />
            <InfoRow
              icon={Tag}
              label="Lidl Factory ID"
              value={supplier.lidlFactoryId}
            />

            <Separator className="my-3" />
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                <FileText className="h-3.5 w-3.5" />
                Contract Document
              </p>
              {!isUnlocked ? (
                <p className="text-sm font-medium text-slate-800">•••••••••••••••••••••</p>
              ) : supplier.contractDocument ? (
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <a
                      href={getCatalogViewUrl(supplier.contractDocument.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline line-clamp-1"
                    >
                      {supplier.contractDocument.name}
                    </a>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full shrink-0 ml-2"
                    onClick={handleDeleteContract}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="file"
                    className="h-9 text-sm text-slate-500 max-w-[250px]
                    file:mr-4 file:py-1 file:px-3
                    file:rounded-md file:border-0
                    file:text-xs file:font-semibold
                    file:bg-brand-50 file:text-brand-700
                    hover:file:bg-brand-100 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        uploadContractDocument(e.target.files[0]);
                      }
                    }}
                    disabled={uploadingContract}
                  />
                  {uploadingContract && <Loader2 className="h-4 w-4 animate-spin text-brand-500" />}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Products & Reach ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products & Reach
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(supplier.supplierProducts ?? []).length > 0 ? (
              (supplier.supplierProducts ?? []).map((prod, i) => (
                <div key={prod.id || i} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-1">
                  <p className="text-sm font-semibold text-slate-700">Product #{i + 1}: {prod.product || "Unnamed"}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Category:</span> {prod.productCategory || "—"}</div>
                    <div><span className="text-muted-foreground">HS Code:</span> {prod.hsCode || "—"}</div>
                    <div><span className="text-muted-foreground">Organic:</span> {prod.organicStatus || "—"}</div>
                    <div><span className="text-muted-foreground">Certs:</span> {prod.certifications || "—"}</div>
                    <div><span className="text-muted-foreground">Shelf Life:</span> {prod.shelfLife || "—"}</div>
                    <div><span className="text-muted-foreground">Storage:</span> {prod.storageConditions || "—"}</div>
                  </div>
                </div>
              ))
            ) : (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Products</p>
                <p className="text-sm whitespace-pre-wrap">{supplier.products || "—"}</p>
              </div>
            )}
            <Separator />
            <InfoRow
              icon={Globe}
              label="Exporting Countries"
              value={supplier.exportingCountries}
            />
            <InfoRow
              icon={FileText}
              label="Sample Policy"
              value={supplier.samplePolicy}
            />
          </CardContent>
        </Card>

        {/* ── Engagement ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={ShieldCheck}
              label="Current Status"
              value={
                <Badge
                  variant="outline"
                  className={statusColor(supplier.currentStatus)}
                >
                  {supplier.currentStatus || "Active"}
                </Badge>
              }
            />
            <InfoRow
              icon={Users}
              label="Working With Our Brands"
              value={supplier.workingWithOurBrands}
            />
            <InfoRow
              icon={Building2}
              label="Other Brands"
              value={supplier.otherBrands}
            />
            <InfoRow
              icon={FileText}
              label="Product Catalog Shared"
              value={
                supplier.productCatalogShared ? (
                  <a
                    href={getCatalogViewUrl(supplier.productCatalogShared)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    View Catalog
                  </a>
                ) : (
                  "—"
                )
              }
            />
            {(supplier.productCatalogs ?? []).length > 0 && (
              <div className="py-2">
                <p className="text-xs text-muted-foreground mb-2">Product Catalogs</p>
                <div className="space-y-1.5">
                  {(supplier.productCatalogs ?? []).map((cat, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                      <FileText className="h-4 w-4 text-brand-500 shrink-0" />
                      <a href={cat.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline truncate">
                        {cat.name}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <InfoRow
              icon={Factory}
              label="Factory Videos Shared"
              value={supplier.factoryVideosShared}
            />
            <InfoRow
              icon={Factory}
              label="Warehouse Videos Shared"
              value={supplier.warehouseVideosShared}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Supplier Info Sheet Sections ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info extras */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Business Details</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Tag} label="Trade / Brand Name" value={supplier.tradeName} />
            <InfoRow icon={Building2} label="Year Established" value={supplier.yearEstablished} />
            <InfoRow icon={MapPin} label="City" value={supplier.city} />
            <InfoRow icon={MapPin} label="State / Province" value={supplier.state} />
            <InfoRow icon={MapPin} label="Postal Code" value={supplier.postalCode} />
            <InfoRow icon={Factory} label="Supplier Type" value={supplier.supplierType} />
            <InfoRow icon={MapPin} label="Manufacturing Address" value={supplier.manufacturingAddress} />
            <InfoRow icon={Phone} label="WhatsApp" value={supplier.whatsapp} />
          </CardContent>
        </Card>

        {/* Product Details */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />Product Details</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Tag} label="HS Code" value={supplier.hsCode} />
            <InfoRow icon={ShieldCheck} label="Organic Status" value={supplier.organicStatus} />
            <InfoRow icon={Package} label="Shelf Life" value={supplier.shelfLife} />
            <InfoRow icon={Package} label="Storage Conditions" value={supplier.storageConditions} />
            <InfoRow icon={Package} label="Packaging Type & Material" value={supplier.packagingType} />
            <InfoRow icon={Package} label="Net Weight Variants" value={supplier.netWeightVariants} />
            {supplier.ingredientList && (<div className="py-2"><p className="text-xs text-muted-foreground">Ingredient List</p><p className="text-sm font-medium whitespace-pre-wrap">{supplier.ingredientList}</p></div>)}
            {supplier.allergenDeclaration && (<div className="py-2"><p className="text-xs text-muted-foreground">Allergen Declaration</p><p className="text-sm font-medium whitespace-pre-wrap">{supplier.allergenDeclaration}</p></div>)}
          </CardContent>
        </Card>

        {/* Samples */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />Samples</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Package} label="Sample Available?" value={supplier.sampleAvailable} />
            <InfoRow icon={Package} label="Sample Lead Time (days)" value={supplier.sampleLeadTime} />
            <InfoRow icon={DollarSign} label="Sample Cost" value={supplier.sampleCost} />
            <InfoRow icon={FileText} label="Sample Policy" value={supplier.samplePolicy} />
          </CardContent>
        </Card>

        {/* Production & Volume */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Factory className="h-4 w-4" />Production & Volume Capacity</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Factory} label="Annual Production Volume" value={supplier.annualProductionVolume} />
            <InfoRow icon={Factory} label="Avg Monthly Volume" value={supplier.avgMonthlyVolume} />
            <InfoRow icon={Factory} label="Max Scalable Monthly Volume" value={supplier.maxScalableMonthlyVolume} />
            <InfoRow icon={Factory} label="Peak Season Months" value={supplier.peakSeasonMonths} />
            <InfoRow icon={Factory} label="Off-Season Availability?" value={supplier.offSeasonAvailability} />
            <InfoRow icon={Package} label="Min Exportable Batch" value={supplier.minExportableBatch} />
            <InfoRow icon={Package} label="MOQ" value={supplier.moq} />
            <InfoRow icon={Clock} label="Lead Time — First Order" value={supplier.leadTimeFirstOrder} />
            <InfoRow icon={Clock} label="Lead Time — Repeat Orders" value={supplier.leadTimeRepeatOrder} />
          </CardContent>
        </Card>

        {/* Commercial & Export */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Commercial & Export Terms</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Globe} label="Incoterms Supported" value={supplier.incotermsSupported} />
            <InfoRow icon={MapPin} label="Ports of Export" value={supplier.portsOfExport} />
            <InfoRow icon={Globe} label="Target Export Markets" value={supplier.targetExportMarkets} />
            <InfoRow icon={DollarSign} label="Currency Preferred" value={supplier.currencyPreferred} />
            <InfoRow icon={DollarSign} label="Payment Terms Accepted" value={supplier.paymentTerms} />
          </CardContent>
        </Card>

        {/* Banking Details (Sensitive) */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" />Banking Details</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Wire Transfer</p>
            <InfoRow icon={Building2} label="Bank Name" value={<SensitiveValue value={supplier.bankName} isUnlocked={isUnlocked} />} />
            <InfoRow icon={Building2} label="Bank Branch" value={<SensitiveValue value={supplier.bankBranch} isUnlocked={isUnlocked} />} />
            <InfoRow icon={MapPin} label="Bank Address" value={<SensitiveValue value={supplier.bankAddress} isUnlocked={isUnlocked} />} />
            <InfoRow icon={Tag} label="Account Number" value={<SensitiveValue value={supplier.accountNumber} isUnlocked={isUnlocked} />} />
            <InfoRow icon={Tag} label="SWIFT / BIC Code" value={<SensitiveValue value={supplier.swiftBicCode} isUnlocked={isUnlocked} />} />
            <InfoRow icon={Tag} label="IBAN" value={<SensitiveValue value={supplier.iban} isUnlocked={isUnlocked} />} />
            <Separator className="my-2" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Letter of Credit (L/C)</p>
            <InfoRow icon={Building2} label="L/C Advising Bank" value={<SensitiveValue value={supplier.lcAdvisingBankName} isUnlocked={isUnlocked} />} />
            <InfoRow icon={User} label="L/C Beneficiary Name" value={<SensitiveValue value={supplier.lcBeneficiaryName} isUnlocked={isUnlocked} />} />
            <InfoRow icon={MapPin} label="L/C Bank Address" value={<SensitiveValue value={supplier.lcBankAddress} isUnlocked={isUnlocked} />} />
            <InfoRow icon={Tag} label="L/C SWIFT Code" value={<SensitiveValue value={supplier.lcSwiftCode} isUnlocked={isUnlocked} />} />
          </CardContent>
        </Card>

        {/* Regulatory & Legal */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Regulatory & Legal</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Tag} label="IEC Number" value={supplier.iecNumber} />
            <InfoRow icon={Tag} label="GST Number" value={supplier.gstNumber} />
            <InfoRow icon={Tag} label="FSSAI Central License" value={supplier.fssaiLicense} />
            <InfoRow icon={Tag} label="APEDA Registration" value={supplier.apedaNumber} />
            <InfoRow icon={Tag} label="FDA Registration Number" value={supplier.fdaRegistrationNumber} />
            <InfoRow icon={User} label="US Agent Appointed?" value={supplier.usAgentAppointed} />
            <InfoRow icon={ShieldCheck} label="TRACES NT Registration (EU)?" value={supplier.tracesNtRegistration} />
            <InfoRow icon={ShieldCheck} label="COI Capability?" value={supplier.coiCapability} />
            <InfoRow icon={ShieldCheck} label="DAFF Biosecurity (Australia)?" value={supplier.daffBiosecurity} />
            <InfoRow icon={ShieldCheck} label="JAS Label Compliance (Japan)?" value={supplier.jasLabelCompliance} />
          </CardContent>
        </Card>

        {/* Certifications & Food Safety */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" />Certifications & Food Safety</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={ShieldCheck} label="HACCP Plan Available?" value={supplier.haccpAvailable} />
            <InfoRow icon={Tag} label="ISO/FSSC 22000 Cert No." value={supplier.isoFsscCertNo} />
            <InfoRow icon={Tag} label="ISO Cert Validity Date" value={supplier.isoCertValidityDate} />
            <InfoRow icon={Building2} label="Auditing Body" value={supplier.auditingBodyName} />
            <InfoRow icon={Tag} label="Latest Internal Audit Date" value={supplier.latestInternalAuditDate} />
            <InfoRow icon={Tag} label="Latest Third-Party Audit Date" value={supplier.latestThirdPartyAuditDate} />
          </CardContent>
        </Card>
      </div>

      {/* Organic Certification Chain (only when organic) */}
      {(() => { const hasOrganic = (supplier.supplierProducts ?? []).some(p => p.organicStatus === "Certified Organic" || p.organicStatus === "In Conversion") || supplier.organicStatus === "Certified Organic" || supplier.organicStatus === "In Conversion"; return hasOrganic ? (
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" />Organic Certification Chain</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-1 md:grid-cols-2 mb-4">
            <InfoRow icon={ShieldCheck} label="Farmer Organic Cert?" value={supplier.farmerOrganicCert} />
            <InfoRow icon={ShieldCheck} label="Aggregator/FPO Organic Cert?" value={supplier.aggregatorOrganicCert} />
            <InfoRow icon={ShieldCheck} label="Processing Unit Organic Cert?" value={supplier.processingUnitOrganicCert} />
            <InfoRow icon={Building2} label="Certifying Body" value={supplier.certifyingBodyName} />
            <InfoRow icon={ShieldCheck} label="Certs Valid for Export?" value={supplier.certsValidForExport} />
          </div>
          {supplier.organicCertsByMarket && supplier.organicCertsByMarket.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Organic Certificates by Market</p>
              <div className="rounded-md border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left font-medium text-slate-500 w-1/3">Market / Standard</th><th className="px-3 py-2 text-left font-medium text-slate-500">Certificate Number</th><th className="px-3 py-2 text-left font-medium text-slate-500">Expiry Date</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {supplier.organicCertsByMarket.map((row) => (
                      <tr key={row.market}><td className="px-3 py-2 text-slate-600 font-medium">{row.market}</td><td className="px-3 py-2">{row.certNumber || "—"}</td><td className="px-3 py-2">{row.expiryDate || "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      ) : null; })()}

      {/* Lab Testing Records */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Lab Testing Records & Declarations</CardTitle></CardHeader>
        <CardContent>
          {supplier.labTestingRecords && supplier.labTestingRecords.length > 0 && (
            <div className="mb-4">
              <div className="rounded-md border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left font-medium text-slate-500">Test</th><th className="px-3 py-2 text-left font-medium text-slate-500">Last Test Date</th><th className="px-3 py-2 text-left font-medium text-slate-500">Lab Name</th><th className="px-3 py-2 text-left font-medium text-slate-500">Report?</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {supplier.labTestingRecords.map((row) => (
                      <tr key={row.testType}><td className="px-3 py-2 text-slate-600 font-medium">{row.testType}</td><td className="px-3 py-2">{row.lastTestDate || "—"}</td><td className="px-3 py-2">{row.labName || "—"}</td><td className="px-3 py-2">{row.reportAttached || "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="grid gap-1 md:grid-cols-2">
            <InfoRow icon={ShieldCheck} label="GMO-Free Declaration?" value={supplier.gmoFreeDeclaration} />
            <InfoRow icon={ShieldCheck} label="Irradiation-Free Declaration?" value={supplier.irradiationFreeDeclaration} />
            <InfoRow icon={ShieldCheck} label="Food Contact Compliance?" value={supplier.foodContactCompliance} />
            <InfoRow icon={ShieldCheck} label="Compostability Certificate?" value={supplier.compostabilityCert} />
            <InfoRow icon={ShieldCheck} label="Migration Test Report?" value={supplier.migrationTestReport} />
          </div>
        </CardContent>
      </Card>

      {/* Branding & Processing */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" />Branding & Private Label</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Tag} label="Export Under" value={supplier.exportBrand} />
            <InfoRow icon={Globe} label="Claims Approved Markets" value={supplier.claimsApprovedMarkets} />
            <InfoRow icon={Globe} label="Packaging Compliance Regions" value={supplier.packagingComplianceRegions} />
            {supplier.healthNutritionClaims && (<div className="py-2"><p className="text-xs text-muted-foreground">Health / Nutrition Claims</p><p className="text-sm font-medium whitespace-pre-wrap">{supplier.healthNutritionClaims}</p></div>)}
          </CardContent>
        </Card>
        {/* Processing Compliance (only when organic) */}
        {(() => { const hasOrganic = (supplier.supplierProducts ?? []).some(p => p.organicStatus === "Certified Organic" || p.organicStatus === "In Conversion") || supplier.organicStatus === "Certified Organic" || supplier.organicStatus === "In Conversion"; return hasOrganic ? (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Processing Compliance</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={ShieldCheck} label="Organic Segregation SOP?" value={supplier.organicSegregationSop} />
            <InfoRow icon={ShieldCheck} label="Cleaning & Line Clearance SOP?" value={supplier.cleaningLinelearanceSop} />
            <InfoRow icon={ShieldCheck} label="No Prohibited Processing Aids?" value={supplier.noProhibitedAids} />
          </CardContent>
        </Card>
        ) : null; })()}
      </div>

      {/* ── Certifications & Documents ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Certifications & Documents
          </CardTitle>
          <PermissionGate permission="suppliers" editOnly>
            <div>
              <input
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                id="cert-upload"
                onChange={(e) => {
                   if (e.target.files) uploadDocuments(e.target.files);
                   e.target.value = "";
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                onClick={() => document.getElementById("cert-upload")?.click()}
                disabled={uploadingDocs}
              >
                {uploadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload New
              </Button>
            </div>
          </PermissionGate>
        </CardHeader>
        <CardContent>
           {(!supplier.documents || supplier.documents.length === 0) && !uploadingDocs ? (
             <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
           ) : (
             <div className="flex flex-col gap-2">
               {supplier.documents?.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg group">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-white flex items-center justify-center border border-slate-200 shadow-sm shrink-0">
                        <FileText className="h-4 w-4 text-rose-500" />
                      </div>
                      <a href={getCatalogViewUrl(doc.url)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-700 hover:text-brand-600 hover:underline line-clamp-1">
                        {doc.name}
                      </a>
                    </div>
                    <PermissionGate permission="suppliers" editOnly>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => handleDeleteDocument(idx)}
                        disabled={updateMutation.isPending}
                        title="Delete Document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                  </div>
               ))}
               {uploadingDocs && (
                  <div className="flex items-center gap-2 p-3 text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading documents...
                  </div>
               )}
             </div>
           )}
        </CardContent>
      </Card>

      {/* ── Remarks ── */}
      {supplier.remarks && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Remarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{supplier.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Intro Email Campaign ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Intro Email Campaign
            </CardTitle>
            {campaign?.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                className="text-purple-600 border-purple-200 hover:bg-purple-50 h-8 gap-1.5"
                onClick={() => markResponseMutation.mutate()}
                disabled={markResponseMutation.isPending}
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Supplier Responded
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!campaign ? (
            <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
              <div className="rounded-full bg-slate-100 p-3">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">No campaign started yet</p>
                <p className="text-xs text-slate-500 mt-0.5">Start a campaign after sending the intro email to this supplier</p>
              </div>
              <PermissionGate permission="suppliers" editOnly>
                <Button
                  size="sm"
                  className="bg-brand-600 hover:bg-brand-700 text-white gap-1.5"
                  onClick={() => startCampaignMutation.mutate()}
                  disabled={startCampaignMutation.isPending}
                >
                  {startCampaignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  Start Intro Email Campaign
                </Button>
              </PermissionGate>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status banner */}
              {campaign.status === "response_received" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium">
                  <MessageSquareText className="h-4 w-4 shrink-0" />
                  Supplier responded on {new Date(campaign.responseReceivedAt!).toLocaleDateString()} — campaign stopped
                </div>
              )}
              {campaign.status === "completed" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  All follow-ups completed
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-3">
                {[
                  { label: "Intro Email", sentAt: campaign.introEmailSentAt, step: 0 },
                  { label: "Follow-up 1", sentAt: campaign.followup1SentAt, step: 1 },
                  { label: "Follow-up 2", sentAt: campaign.followup2SentAt, step: 2 },
                ].map((item, idx) => {
                  const isSent = !!item.sentAt;
                  const isDue =
                    campaign.status === "active" &&
                    campaign.currentStep === item.step &&
                    item.step > 0 &&
                    campaign.nextFollowupDue &&
                    new Date(campaign.nextFollowupDue) <= new Date();
                  const isNext =
                    campaign.status === "active" &&
                    campaign.currentStep === item.step &&
                    item.step > 0 &&
                    !isDue;

                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {isSent ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : isDue ? (
                          <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${isSent ? "text-slate-800" : "text-slate-400"}`}>
                            {item.label}
                          </span>
                          {isSent && (
                            <span className="text-xs text-slate-500">{new Date(item.sentAt!).toLocaleDateString()}</span>
                          )}
                          {isDue && (
                            <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Due today
                            </span>
                          )}
                          {isNext && campaign.nextFollowupDue && (
                            <span className="text-xs text-slate-400">
                              Due {new Date(campaign.nextFollowupDue).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {(isDue || isNext) && (
                          <PermissionGate permission="suppliers" editOnly>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-1.5 h-7 text-xs text-brand-600 border-brand-200 hover:bg-brand-50 gap-1"
                              onClick={() => markSentMutation.mutate()}
                              disabled={markSentMutation.isPending}
                            >
                              {markSentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                              Mark as Sent
                            </Button>
                          </PermissionGate>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-2">

            {/* ── Basic Info ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Basic Info</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Company *</Label><Input value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Trade / Brand Name</Label><Input value={form.tradeName ?? ""} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Year Established</Label><Input value={form.yearEstablished ?? ""} onChange={(e) => setForm({ ...form, yearEstablished: e.target.value })} /></div>
              <div className="space-y-2"><Label>Country</Label><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              <div className="space-y-2"><Label>City</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div className="space-y-2"><Label>State / Province</Label><Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
              <div className="space-y-2"><Label>Postal Code</Label><Input value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
              <div className="space-y-2"><Label>Supplier Type</Label><MultiSelectDropdown value={form.supplierType ?? ""} onChange={(v) => setForm({ ...form, supplierType: v })} options={["Manufacturer","Trader","Processor","Aggregator","Farmer Producer Organisation (FPO)"]} placeholder="Select supplier type(s)…" /></div>
              <div className="space-y-2"><Label>Website</Label><Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
              <div className="space-y-2"><Label>Lidl Factory ID</Label><Input value={form.lidlFactoryId ?? ""} onChange={(e) => setForm({ ...form, lidlFactoryId: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Company Address</Label><Textarea value={form.companyAddress ?? ""} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} rows={2} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Manufacturing / Processing Facility Address</Label><Textarea value={form.manufacturingAddress ?? ""} onChange={(e) => setForm({ ...form, manufacturingAddress: e.target.value })} rows={2} /></div>
            </div></div>

            <Separator />

            {/* ── Contact Details ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Contact Details</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contactPerson ?? ""} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>WhatsApp</Label><Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="With country code" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="text" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Current Status</Label>
                <Select value={form.currentStatus ?? "Active"} onValueChange={(v) => setForm({ ...form, currentStatus: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Signed">Signed</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div></div>

            <Separator />

            {/* ── Products (Multi-Product) ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Products</p>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={addProduct}>
                  <Plus className="h-3.5 w-3.5" /> Add Product
                </Button>
              </div>
              {(form.supplierProducts || []).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">No products added yet.</p>
              )}
              {(form.supplierProducts || []).map((prod, i) => (
                <div key={prod.id} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700">Product #{i + 1}</p>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => removeProduct(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label className="text-xs">Product Name</Label><Input className="h-8 text-sm" value={prod.product} onChange={(e) => updateProduct(i, "product", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Product Category</Label><Input className="h-8 text-sm" value={prod.productCategory} onChange={(e) => updateProduct(i, "productCategory", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">HS Code</Label><Input className="h-8 text-sm" value={prod.hsCode} onChange={(e) => updateProduct(i, "hsCode", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Organic Status</Label><SelectWithOthers value={prod.organicStatus} onChange={(v) => updateProduct(i, "organicStatus", v)} options={["Certified Organic","In Conversion","Conventional"]} placeholder="Select…" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Certifications</Label><Input className="h-8 text-sm" value={prod.certifications} onChange={(e) => updateProduct(i, "certifications", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Shelf Life</Label><Input className="h-8 text-sm" value={prod.shelfLife} onChange={(e) => updateProduct(i, "shelfLife", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Storage Conditions</Label><Input className="h-8 text-sm" value={prod.storageConditions} onChange={(e) => updateProduct(i, "storageConditions", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Packaging Type</Label><Input className="h-8 text-sm" value={prod.packagingType} onChange={(e) => updateProduct(i, "packagingType", e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Net Weight Variants</Label><Input className="h-8 text-sm" value={prod.netWeightVariants} onChange={(e) => updateProduct(i, "netWeightVariants", e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Ingredient List</Label><Textarea className="text-sm" value={prod.ingredientList} onChange={(e) => updateProduct(i, "ingredientList", e.target.value)} rows={2} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Allergen Declaration</Label><Textarea className="text-sm" value={prod.allergenDeclaration} onChange={(e) => updateProduct(i, "allergenDeclaration", e.target.value)} rows={2} /></div>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* ── Samples ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Samples</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Sample Available?</Label><SelectWithOthers value={form.sampleAvailable ?? ""} onChange={(v) => setForm({ ...form, sampleAvailable: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Sample Lead Time (days)</Label><Input value={form.sampleLeadTime ?? ""} onChange={(e) => setForm({ ...form, sampleLeadTime: e.target.value })} /></div>
              <div className="space-y-2"><Label>Sample Cost</Label><Input value={form.sampleCost ?? ""} onChange={(e) => setForm({ ...form, sampleCost: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-3"><Label>Sample Policy (additional notes)</Label><Input value={form.samplePolicy ?? ""} onChange={(e) => setForm({ ...form, samplePolicy: e.target.value })} /></div>
            </div></div>

            <Separator />

            {/* ── Production ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Production & Volume Capacity</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Annual Production Volume</Label><Input value={form.annualProductionVolume ?? ""} onChange={(e) => setForm({ ...form, annualProductionVolume: e.target.value })} placeholder="e.g. 500 MT" /></div>
              <div className="space-y-2"><Label>Avg Monthly Volume</Label><Input value={form.avgMonthlyVolume ?? ""} onChange={(e) => setForm({ ...form, avgMonthlyVolume: e.target.value })} /></div>
              <div className="space-y-2"><Label>Max Scalable Monthly Volume</Label><Input value={form.maxScalableMonthlyVolume ?? ""} onChange={(e) => setForm({ ...form, maxScalableMonthlyVolume: e.target.value })} /></div>
              <div className="space-y-2"><Label>Production Capacity (general)</Label><Input value={form.productionCapacity ?? ""} onChange={(e) => setForm({ ...form, productionCapacity: e.target.value })} /></div>
              <div className="space-y-2"><Label>Min Exportable Batch</Label><Input value={form.minExportableBatch ?? ""} onChange={(e) => setForm({ ...form, minExportableBatch: e.target.value })} /></div>
              <div className="space-y-2"><Label>MOQ</Label><Input value={form.moq ?? ""} onChange={(e) => setForm({ ...form, moq: e.target.value })} /></div>
              <div className="space-y-2"><Label>Off-Season Availability?</Label><SelectWithOthers value={form.offSeasonAvailability ?? ""} onChange={(v) => setForm({ ...form, offSeasonAvailability: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Lead Time — First Order (days)</Label><Input value={form.leadTimeFirstOrder ?? ""} onChange={(e) => setForm({ ...form, leadTimeFirstOrder: e.target.value })} /></div>
              <div className="space-y-2"><Label>Lead Time — Repeat Orders (days)</Label><Input value={form.leadTimeRepeatOrder ?? ""} onChange={(e) => setForm({ ...form, leadTimeRepeatOrder: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Peak Season Months</Label><MultiSelectDropdown value={form.peakSeasonMonths ?? ""} onChange={(v) => setForm({ ...form, peakSeasonMonths: v })} options={["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]} placeholder="Select months…" /></div>
            </div></div>

            <Separator />

            {/* ── Commercial & Export ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Commercial & Export Terms</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Contract Buyer(s)</Label>
                <EntityLinkSelect
                  selectedIds={form.buyerIds ?? []}
                  onChange={(ids) => setForm({ ...form, buyerIds: ids })}
                  options={(buyersListData ?? []).map((b) => ({
                    id: b.id,
                    label: `${b.company}${b.name ? ` (${b.name})` : ""}`,
                  }))}
                  isLoading={buyersListLoading}
                  placeholder="Select contract buyer(s)…"
                />
              </div>
              <div className="space-y-2"><Label>Contract Buyer (legacy)</Label><Input value={form.contractBuyer ?? ""} onChange={(e) => setForm({ ...form, contractBuyer: e.target.value })} /></div>
              <div className="space-y-2"><Label>Commission %</Label><Input value={form.commissionPercent ?? ""} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} /></div>
              <div className="space-y-2"><Label>Approved Confirm %</Label><Input value={form.approvedConfirmPercent ?? ""} onChange={(e) => setForm({ ...form, approvedConfirmPercent: e.target.value })} /></div>
              <div className="space-y-2"><Label>Currency Preferred</Label><Input value={form.currencyPreferred ?? ""} onChange={(e) => setForm({ ...form, currencyPreferred: e.target.value })} placeholder="e.g. USD, EUR" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Incoterms Supported</Label><MultiSelectDropdown value={form.incotermsSupported ?? ""} onChange={(v) => setForm({ ...form, incotermsSupported: v })} options={["EXW","FCA","FOB","CIF","CNF","CPT","CIP","DDP"]} placeholder="Select incoterms…" /></div>
              <div className="space-y-2"><Label>Ports of Export</Label><Input value={form.portsOfExport ?? ""} onChange={(e) => setForm({ ...form, portsOfExport: e.target.value })} /></div>
              <div className="space-y-2"><Label>Exporting Countries</Label><Textarea value={form.exportingCountries ?? ""} onChange={(e) => setForm({ ...form, exportingCountries: e.target.value })} rows={2} /></div>
              <div className="space-y-2"><Label>Target Export Markets</Label><Input value={form.targetExportMarkets ?? ""} onChange={(e) => setForm({ ...form, targetExportMarkets: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Payment Terms Accepted</Label><MultiSelectDropdown value={form.paymentTerms ?? ""} onChange={(v) => setForm({ ...form, paymentTerms: v })} options={["T/T Advance (100%)","50% Advance + 50% Against BL","L/C at Sight","L/C Usance","D/P (Documents against Payment)","D/A (Documents against Acceptance)","Open Account"]} placeholder="Select payment terms…" /></div>
            </div></div>

            <Separator />

            {/* ── Banking Details ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Banking Details — Wire Transfer</p>
            <p className="text-xs text-slate-400 mb-3">Sensitive — only visible to authorised users</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Bank Name</Label><Input value={form.bankName ?? ""} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Bank Branch</Label><Input value={form.bankBranch ?? ""} onChange={(e) => setForm({ ...form, bankBranch: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Bank Address</Label><Input value={form.bankAddress ?? ""} onChange={(e) => setForm({ ...form, bankAddress: e.target.value })} /></div>
              <div className="space-y-2"><Label>Account Number</Label><Input value={form.accountNumber ?? ""} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></div>
              <div className="space-y-2"><Label>SWIFT / BIC Code</Label><Input value={form.swiftBicCode ?? ""} onChange={(e) => setForm({ ...form, swiftBicCode: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>IBAN (if applicable)</Label><Input value={form.iban ?? ""} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-4 mb-3">Banking Details — Letter of Credit (L/C)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>L/C Advising Bank Name</Label><Input value={form.lcAdvisingBankName ?? ""} onChange={(e) => setForm({ ...form, lcAdvisingBankName: e.target.value })} /></div>
              <div className="space-y-2"><Label>L/C Beneficiary Name</Label><Input value={form.lcBeneficiaryName ?? ""} onChange={(e) => setForm({ ...form, lcBeneficiaryName: e.target.value })} /></div>
              <div className="space-y-2"><Label>L/C SWIFT Code</Label><Input value={form.lcSwiftCode ?? ""} onChange={(e) => setForm({ ...form, lcSwiftCode: e.target.value })} /></div>
              <div className="space-y-2"><Label>L/C Bank Address</Label><Input value={form.lcBankAddress ?? ""} onChange={(e) => setForm({ ...form, lcBankAddress: e.target.value })} /></div>
            </div></div>

            <Separator />

            {/* ── Regulatory ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Regulatory & Legal</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>IEC Number</Label><Input value={form.iecNumber ?? ""} onChange={(e) => setForm({ ...form, iecNumber: e.target.value })} /></div>
              <div className="space-y-2"><Label>GST Number</Label><Input value={form.gstNumber ?? ""} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} /></div>
              <div className="space-y-2"><Label>FSSAI Central License</Label><Input value={form.fssaiLicense ?? ""} onChange={(e) => setForm({ ...form, fssaiLicense: e.target.value })} /></div>
              <div className="space-y-2"><Label>APEDA Registration</Label><Input value={form.apedaNumber ?? ""} onChange={(e) => setForm({ ...form, apedaNumber: e.target.value })} /></div>
              <div className="space-y-2"><Label>FDA Registration Number</Label><Input value={form.fdaRegistrationNumber ?? ""} onChange={(e) => setForm({ ...form, fdaRegistrationNumber: e.target.value })} /></div>
              <div className="space-y-2"><Label>US Agent Appointed?</Label><SelectWithOthers value={form.usAgentAppointed ?? ""} onChange={(v) => setForm({ ...form, usAgentAppointed: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>TRACES NT Registration (EU)?</Label><SelectWithOthers value={form.tracesNtRegistration ?? ""} onChange={(v) => setForm({ ...form, tracesNtRegistration: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>COI Capability?</Label><SelectWithOthers value={form.coiCapability ?? ""} onChange={(v) => setForm({ ...form, coiCapability: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>DAFF Biosecurity (Australia)?</Label><SelectWithOthers value={form.daffBiosecurity ?? ""} onChange={(v) => setForm({ ...form, daffBiosecurity: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>JAS Label Compliance (Japan)?</Label><SelectWithOthers value={form.jasLabelCompliance ?? ""} onChange={(v) => setForm({ ...form, jasLabelCompliance: v })} options={["Yes","No"]} placeholder="Select…" /></div>
            </div></div>

            <Separator />

            {/* ── Certifications & Food Safety ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Certifications & Food Safety</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>HACCP Plan Available?</Label><SelectWithOthers value={form.haccpAvailable ?? ""} onChange={(v) => setForm({ ...form, haccpAvailable: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>ISO/FSSC 22000 Cert No.</Label><Input value={form.isoFsscCertNo ?? ""} onChange={(e) => setForm({ ...form, isoFsscCertNo: e.target.value })} /></div>
              <div className="space-y-2"><Label>ISO Cert Validity Date</Label><Input value={form.isoCertValidityDate ?? ""} onChange={(e) => setForm({ ...form, isoCertValidityDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Auditing Body</Label><Input value={form.auditingBodyName ?? ""} onChange={(e) => setForm({ ...form, auditingBodyName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Latest Internal Audit Date</Label><Input value={form.latestInternalAuditDate ?? ""} onChange={(e) => setForm({ ...form, latestInternalAuditDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Latest Third-Party Audit Date</Label><Input value={form.latestThirdPartyAuditDate ?? ""} onChange={(e) => setForm({ ...form, latestThirdPartyAuditDate: e.target.value })} /></div>
            </div></div>

            <Separator />

            {/* ── Organic Chain (only when organic) ── */}
            {(() => { const hasOrganic = (form.supplierProducts || []).some(p => p.organicStatus === "Certified Organic" || p.organicStatus === "In Conversion") || form.organicStatus === "Certified Organic" || form.organicStatus === "In Conversion"; return hasOrganic ? (
            <><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Organic Certification Chain</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Farmer Organic Cert?</Label><SelectWithOthers value={form.farmerOrganicCert ?? ""} onChange={(v) => setForm({ ...form, farmerOrganicCert: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Aggregator/FPO Organic Cert?</Label><SelectWithOthers value={form.aggregatorOrganicCert ?? ""} onChange={(v) => setForm({ ...form, aggregatorOrganicCert: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Processing Unit Organic Cert?</Label><SelectWithOthers value={form.processingUnitOrganicCert ?? ""} onChange={(v) => setForm({ ...form, processingUnitOrganicCert: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Certifying Body</Label><Input value={form.certifyingBodyName ?? ""} onChange={(e) => setForm({ ...form, certifyingBodyName: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Certs Valid for Export?</Label><SelectWithOthers value={form.certsValidForExport ?? ""} onChange={(v) => setForm({ ...form, certsValidForExport: v })} options={["Yes","No"]} placeholder="Select…" /></div>
            </div>
            <div className="mt-4"><Label className="mb-2 block text-sm">Organic Certificates by Market</Label>
            <div className="rounded-md border border-slate-200 overflow-hidden"><table className="w-full text-xs"><thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left font-medium text-slate-500 w-1/3">Market / Standard</th><th className="px-3 py-2 text-left font-medium text-slate-500">Certificate Number</th><th className="px-3 py-2 text-left font-medium text-slate-500">Expiry Date</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{(form.organicCertsByMarket ?? ORGANIC_CERT_MARKETS.map(m => ({ market: m, certNumber: "", expiryDate: "" }))).map((row, i) => (
              <tr key={row.market}><td className="px-3 py-1.5 text-slate-600 font-medium">{row.market}</td>
              <td className="px-3 py-1.5"><Input className="h-7 text-xs border-slate-200" value={row.certNumber} onChange={(e) => { const next = [...(form.organicCertsByMarket ?? ORGANIC_CERT_MARKETS.map(m => ({ market: m, certNumber: "", expiryDate: "" })))]; next[i] = { ...next[i], certNumber: e.target.value }; setForm({ ...form, organicCertsByMarket: next }); }} /></td>
              <td className="px-3 py-1.5"><Input className="h-7 text-xs border-slate-200" value={row.expiryDate} onChange={(e) => { const next = [...(form.organicCertsByMarket ?? ORGANIC_CERT_MARKETS.map(m => ({ market: m, certNumber: "", expiryDate: "" })))]; next[i] = { ...next[i], expiryDate: e.target.value }; setForm({ ...form, organicCertsByMarket: next }); }} /></td>
              </tr>))}
            </tbody></table></div></div></div>
            </>
            ) : null; })()}

            <Separator />

            {/* ── Lab Testing ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Lab Testing Records</p>
            <div className="rounded-md border border-slate-200 overflow-hidden mb-4"><table className="w-full text-xs"><thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left font-medium text-slate-500">Test</th><th className="px-3 py-2 text-left font-medium text-slate-500">Last Test Date</th><th className="px-3 py-2 text-left font-medium text-slate-500">Lab Name</th><th className="px-3 py-2 text-left font-medium text-slate-500">Report?</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{(form.labTestingRecords ?? LAB_TEST_TYPES.map(t => ({ testType: t, lastTestDate: "", labName: "", reportAttached: "" }))).map((row, i) => (
              <tr key={row.testType}><td className="px-3 py-1.5 text-slate-600 font-medium">{row.testType}</td>
              <td className="px-3 py-1.5"><Input className="h-7 text-xs border-slate-200" value={row.lastTestDate} onChange={(e) => { const next = [...(form.labTestingRecords ?? LAB_TEST_TYPES.map(t => ({ testType: t, lastTestDate: "", labName: "", reportAttached: "" })))]; next[i] = { ...next[i], lastTestDate: e.target.value }; setForm({ ...form, labTestingRecords: next }); }} /></td>
              <td className="px-3 py-1.5"><Input className="h-7 text-xs border-slate-200" value={row.labName} onChange={(e) => { const next = [...(form.labTestingRecords ?? LAB_TEST_TYPES.map(t => ({ testType: t, lastTestDate: "", labName: "", reportAttached: "" })))]; next[i] = { ...next[i], labName: e.target.value }; setForm({ ...form, labTestingRecords: next }); }} /></td>
              <td className="px-3 py-1.5"><SelectWithOthers value={row.reportAttached} onChange={(v) => { const next = [...(form.labTestingRecords ?? LAB_TEST_TYPES.map(t => ({ testType: t, lastTestDate: "", labName: "", reportAttached: "" })))]; next[i] = { ...next[i], reportAttached: v }; setForm({ ...form, labTestingRecords: next }); }} options={["Yes","No"]} placeholder="Y/N" /></td>
              </tr>))}
            </tbody></table></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>GMO-Free Declaration?</Label><SelectWithOthers value={form.gmoFreeDeclaration ?? ""} onChange={(v) => setForm({ ...form, gmoFreeDeclaration: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Irradiation-Free Declaration?</Label><SelectWithOthers value={form.irradiationFreeDeclaration ?? ""} onChange={(v) => setForm({ ...form, irradiationFreeDeclaration: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Food Contact Compliance?</Label><SelectWithOthers value={form.foodContactCompliance ?? ""} onChange={(v) => setForm({ ...form, foodContactCompliance: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Compostability Certificate?</Label><SelectWithOthers value={form.compostabilityCert ?? ""} onChange={(v) => setForm({ ...form, compostabilityCert: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Migration Test Report?</Label><SelectWithOthers value={form.migrationTestReport ?? ""} onChange={(v) => setForm({ ...form, migrationTestReport: v })} options={["Yes","No"]} placeholder="Select…" /></div>
            </div></div>

            <Separator />

            {/* ── Branding ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Branding & Private Label</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Export Under</Label><SelectWithOthers value={form.exportBrand ?? ""} onChange={(v) => setForm({ ...form, exportBrand: v })} options={["Own Brand","Buyer's Private Label","Elan Brand","White Label / Unbranded"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Claims Approved Markets</Label><Input value={form.claimsApprovedMarkets ?? ""} onChange={(e) => setForm({ ...form, claimsApprovedMarkets: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Packaging Compliance Regions</Label><MultiSelectDropdown value={form.packagingComplianceRegions ?? ""} onChange={(v) => setForm({ ...form, packagingComplianceRegions: v })} options={["India (FSSAI)","EU (Reg 1169/2011)","USA (FDA 21 CFR)","UK (FSA)","GCC / GSO","Australia / NZ (FSANZ)","Japan (JAS / MHLW)","Canada (CFIA)"]} placeholder="Select regions…" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Health / Nutrition Claims</Label><Textarea value={form.healthNutritionClaims ?? ""} onChange={(e) => setForm({ ...form, healthNutritionClaims: e.target.value })} rows={2} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Working With Our Brands</Label><Textarea value={form.workingWithOurBrands ?? ""} onChange={(e) => setForm({ ...form, workingWithOurBrands: e.target.value })} rows={2} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Other Brands</Label><Textarea value={form.otherBrands ?? ""} onChange={(e) => setForm({ ...form, otherBrands: e.target.value })} rows={2} /></div>
            </div></div>

            <Separator />

            {/* ── Processing Compliance (only when organic) ── */}
            {(() => { const hasOrganic = (form.supplierProducts || []).some(p => p.organicStatus === "Certified Organic" || p.organicStatus === "In Conversion") || form.organicStatus === "Certified Organic" || form.organicStatus === "In Conversion"; return hasOrganic ? (
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Processing Compliance</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Organic Segregation SOP?</Label><SelectWithOthers value={form.organicSegregationSop ?? ""} onChange={(v) => setForm({ ...form, organicSegregationSop: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Cleaning & Line Clearance SOP?</Label><SelectWithOthers value={form.cleaningLinelearanceSop ?? ""} onChange={(v) => setForm({ ...form, cleaningLinelearanceSop: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>No Prohibited Processing Aids?</Label><SelectWithOthers value={form.noProhibitedAids ?? ""} onChange={(v) => setForm({ ...form, noProhibitedAids: v })} options={["Yes","No"]} placeholder="Select…" /></div>
            </div></div>
            ) : null; })()}

            <Separator />

            {/* ── Documents & Remarks ── */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Documents & Remarks</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Product Catalogs</Label>
                <div className="flex flex-col gap-2">
                  <input type="file" accept="application/pdf,.doc,.docx" multiple className="hidden" id="multi-catalog-upload-detail" onChange={(e) => { if (e.target.files) setCatalogFiles((prev) => [...prev, ...Array.from(e.target.files || [])]); }} />
                  <Button type="button" variant="outline" onClick={() => document.getElementById("multi-catalog-upload-detail")?.click()} className="w-full justify-start truncate"><Upload className="mr-2 h-4 w-4 shrink-0" /><span>Upload Product Catalogs</span></Button>
                  {(form.productCatalogs || []).length > 0 && (<div className="flex flex-col gap-1 mt-2">{(form.productCatalogs || []).map((cat, idx) => (<div key={`cat-${idx}`} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 text-sm"><a href={cat.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-600 hover:underline flex-1 mr-2 text-xs">{cat.name}</a><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => { const updated = [...(form.productCatalogs || [])]; updated.splice(idx, 1); setForm({ ...form, productCatalogs: updated }); }}><X className="h-4 w-4" /></button></div>))}</div>)}
                  {catalogFiles.length > 0 && (<div className="flex flex-col gap-1 mt-1">{catalogFiles.map((f, idx) => (<div key={`pend-cat-${idx}`} className="flex items-center justify-between bg-amber-50 p-2 rounded border border-amber-100 text-sm"><span className="truncate text-slate-700 text-xs flex-1 mr-2">{f.name} (Pending)</span><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => setCatalogFiles((prev) => prev.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></button></div>))}</div>)}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Upload Documents</Label>
                <div className="flex flex-col gap-2">
                  <input type="file" accept="application/pdf" multiple className="hidden" id="documents-upload-edit" onChange={(e) => { if (e.target.files) setDocumentFiles((prev) => [...prev, ...Array.from(e.target.files || [])]); }} />
                  <Button type="button" variant="outline" onClick={() => document.getElementById("documents-upload-edit")?.click()} className="w-full justify-start truncate"><Upload className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">Add Document PDFs</span></Button>
                  {form.documents && form.documents.length > 0 && (<div className="flex flex-col gap-1 mt-2">{form.documents.map((doc, idx) => (<div key={`stored-${idx}`} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 text-sm"><a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-600 hover:underline flex-1 mr-2 text-xs">{doc.name}</a><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => { const updated = [...form.documents!]; updated.splice(idx, 1); setForm({ ...form, documents: updated }); }}><X className="h-4 w-4" /></button></div>))}</div>)}
                  {documentFiles.length > 0 && (<div className="flex flex-col gap-1 mt-1">{documentFiles.map((f, idx) => (<div key={`pending-${idx}`} className="flex items-center justify-between bg-amber-50 p-2 rounded border border-amber-100 text-sm"><span className="truncate text-slate-700 text-xs flex-1 mr-2">{f.name} (Pending)</span><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => setDocumentFiles((prev) => prev.filter((_, i) => i !== idx))}><X className="h-4 w-4" /></button></div>))}</div>)}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2"><Label>Factory Videos Shared</Label><Input value={form.factoryVideosShared ?? ""} onChange={(e) => setForm({ ...form, factoryVideosShared: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Warehouse Videos Shared</Label><Input value={form.warehouseVideosShared ?? ""} onChange={(e) => setForm({ ...form, warehouseVideosShared: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks ?? ""} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={3} /></div>
            </div></div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending || uploadCatalogMutation.isPending}>
                {(updateMutation.isPending || uploadCatalogMutation.isPending) && (<Loader2 className="mr-2 h-4 w-4 animate-spin" />)}
                Update
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
