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
import { PermissionGate } from "@/components/PermissionGate";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { SelectWithOthers } from "@/components/SelectWithOthers";
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
  FileText,
  Award,
  Package,
  Tag,
  Users,
  Pencil,
  ShieldCheck,
  RefreshCw,
  Calendar,
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquareText,
  Upload,
  X,
} from "lucide-react";

interface EmailCampaign {
  id: string;
  newSupplierId: string;
  status: "active" | "completed" | "response_received";
  currentStep: number;
  introEmailSentAt: string;
  followup1SentAt?: string | null;
  followup2SentAt?: string | null;
  followup3SentAt?: string | null;
  responseReceivedAt?: string | null;
  nextFollowupDue?: string | null;
}

interface OrganicCertRow { market: string; certNumber: string; expiryDate: string; }
interface LabTestRow { testType: string; lastTestDate: string; labName: string; reportAttached: string; }

interface NewSupplier {
  id: string;
  company: string;
  productCategory?: string;
  product?: string;
  country?: string;
  accountManager?: string;
  currentStatus?: string;
  certifications?: string;
  latestQuotation?: string;
  reasonInactive?: string;
  dateMarkedInactive?: string;
  reactivationPotential?: string;
  notes?: string;
  phone?: string;
  email?: string;
  createdAt?: string;
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
  productCatalog?: string;
}

const ORGANIC_CERT_MARKETS = ["India — NPOP", "USA — USDA Organic (NOP)", "EU — EU Organic (Reg 2018/848)", "UK — UK Organic", "Australia — ACO / NASAA", "Japan — JAS Organic"];
const LAB_TEST_TYPES = ["Pesticide Residue Analysis", "Heavy Metals Test", "Microbiology Test", "Aflatoxin Test", "Moisture Analysis"];


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
        <p className="text-sm font-medium wrap-break-word">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function NewSupplierDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<NewSupplier>>({});
  const [catalogFile, setCatalogFile] = useState<File | null>(null);

  const { data: supplier, isLoading } = useQuery<NewSupplier>({
    queryKey: ["new-supplier", id],
    queryFn: () => api.get(`/new-suppliers/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<NewSupplier> }) =>
      api.put(`/new-suppliers/${id}`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-supplier", id] });
      queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["new-supplier-filters"] });
      setDialogOpen(false);
      toast.success("Supplier updated");
    },
    onError: () => toast.error("Failed to update supplier"),
  });

  const uploadCatalogMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/new-suppliers/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onError: () => toast.error("Failed to upload product catalog"),
  });

  const { data: campaign } = useQuery<EmailCampaign | null>({
    queryKey: ["new-supplier-campaign", id],
    queryFn: () =>
      api
        .get(`/new-supplier-campaigns/${id}`)
        .then((r) => r.data)
        .catch((e) => (e.response?.status === 404 ? null : Promise.reject(e))),
    enabled: !!id,
  });

  const startCampaignMutation = useMutation({
    mutationFn: () => api.post(`/new-supplier-campaigns/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaigns"] });
      toast.success("Intro email campaign started");
    },
    onError: () => toast.error("Failed to start campaign"),
  });

  const markSentMutation = useMutation({
    mutationFn: () => api.post(`/new-supplier-campaigns/${id}/mark-sent`),
    onSuccess: (res) => {
      if (res.data?.movedToOld) {
        toast.success("All emails sent — supplier moved to Old Suppliers (no response)");
        navigate("/suppliers/old");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaigns"] });
      toast.success("Follow-up marked as sent");
    },
    onError: () => toast.error("Failed to mark email as sent"),
  });

  const markResponseMutation = useMutation({
    mutationFn: () => api.post(`/new-supplier-campaigns/${id}/mark-response`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaigns"] });
      toast.success("Supplier response recorded — campaign stopped");
    },
    onError: () => toast.error("Failed to record response"),
  });

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
          onClick={() => navigate("/suppliers/new")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to New Suppliers
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
    let catalogUrl = form.productCatalog;
    if (catalogFile) {
      try {
        const uploadRes = await uploadCatalogMutation.mutateAsync(catalogFile);
        catalogUrl = uploadRes.url;
      } catch {
        return;
      }
    }
    if (supplier?.id) {
      updateMutation.mutate({ id: supplier.id, d: { ...form, productCatalog: catalogUrl } });
    }
  };

  const openEdit = () => {
    setForm(supplier || {});
    setCatalogFile(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="text-sm text-muted-foreground flex items-center gap-1">
        <Link to="/" className="hover:underline">
          CRM
        </Link>
        <span>/</span>
        <Link to="/suppliers/new" className="hover:underline">
          New Suppliers
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
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Supplier ID: #{supplier.id.slice(0, 8).toUpperCase()}
            {registeredSince && ` · Added On ${registeredSince}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PermissionGate permission="suppliers" editOnly>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </PermissionGate>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/suppliers/new")}
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
            <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" />General Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Building2} label="Company Name" value={supplier.company} />
            <InfoRow icon={Building2} label="Trade / Brand Name" value={supplier.tradeName} />
            <InfoRow icon={MapPin} label="Country" value={supplier.country} />
            <InfoRow icon={MapPin} label="City" value={supplier.city} />
            <InfoRow icon={MapPin} label="State / Province" value={supplier.state} />
            <InfoRow icon={MapPin} label="Postal Code" value={supplier.postalCode} />
            <InfoRow icon={MapPin} label="Manufacturing Address" value={supplier.manufacturingAddress} />
            <InfoRow icon={Calendar} label="Year Established" value={supplier.yearEstablished} />
            <InfoRow icon={Tag} label="Supplier Type" value={supplier.supplierType} />
          </CardContent>
        </Card>

        {/* ── Contact Details ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Users} label="Account Manager" value={supplier.accountManager} />
            <InfoRow icon={Phone} label="Phone" value={supplier.phone} />
            <InfoRow icon={Phone} label="WhatsApp" value={supplier.whatsapp} />
            <InfoRow icon={Mail} label="Email" value={supplier.email} />
            <InfoRow icon={ShieldCheck} label="Current Status" value={supplier.currentStatus} />
          </CardContent>
        </Card>

        {/* ── Product Info ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />Product Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Tag} label="Product Category" value={supplier.productCategory} />
            <InfoRow icon={Package} label="Product" value={supplier.product} />
            <InfoRow icon={FileText} label="HS Code" value={supplier.hsCode} />
            <InfoRow icon={Award} label="Organic Status" value={supplier.organicStatus} />
            <InfoRow icon={Award} label="Certifications" value={supplier.certifications} />
            <InfoRow icon={FileText} label="Shelf Life" value={supplier.shelfLife} />
            <InfoRow icon={FileText} label="Storage Conditions" value={supplier.storageConditions} />
            <InfoRow icon={Package} label="Packaging Type & Material" value={supplier.packagingType} />
            <InfoRow icon={Package} label="Net Weight Variants" value={supplier.netWeightVariants} />
            <InfoRow icon={FileText} label="Ingredient List" value={supplier.ingredientList} />
            <InfoRow icon={FileText} label="Allergen Declaration" value={supplier.allergenDeclaration} />
          </CardContent>
        </Card>

        {/* ── Samples ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />Samples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Package} label="Sample Available?" value={supplier.sampleAvailable} />
            <InfoRow icon={Clock} label="Sample Lead Time (days)" value={supplier.sampleLeadTime} />
            <InfoRow icon={FileText} label="Sample Cost" value={supplier.sampleCost} />
          </CardContent>
        </Card>

        {/* ── Production & Capacity ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Production & Volume Capacity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={FileText} label="Annual Production Volume" value={supplier.annualProductionVolume} />
            <InfoRow icon={FileText} label="Avg Monthly Volume" value={supplier.avgMonthlyVolume} />
            <InfoRow icon={FileText} label="Max Scalable Monthly Volume" value={supplier.maxScalableMonthlyVolume} />
            <InfoRow icon={FileText} label="Peak Season Months" value={supplier.peakSeasonMonths} />
            <InfoRow icon={FileText} label="Off-Season Availability?" value={supplier.offSeasonAvailability} />
            <InfoRow icon={FileText} label="Min Exportable Batch Size" value={supplier.minExportableBatch} />
            <InfoRow icon={FileText} label="MOQ" value={supplier.moq} />
            <InfoRow icon={Clock} label="Lead Time — First Order" value={supplier.leadTimeFirstOrder} />
            <InfoRow icon={Clock} label="Lead Time — Repeat Orders" value={supplier.leadTimeRepeatOrder} />
          </CardContent>
        </Card>

        {/* ── Commercial & Export Terms ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Commercial & Export Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={FileText} label="Incoterms Supported" value={supplier.incotermsSupported} />
            <InfoRow icon={MapPin} label="Ports of Export" value={supplier.portsOfExport} />
            <InfoRow icon={MapPin} label="Current Export Markets" value={supplier.latestQuotation} />
            <InfoRow icon={MapPin} label="Target Export Markets" value={supplier.targetExportMarkets} />
            <InfoRow icon={FileText} label="Currency Preferred" value={supplier.currencyPreferred} />
            <InfoRow icon={FileText} label="Payment Terms" value={supplier.paymentTerms} />
          </CardContent>
        </Card>

        {/* ── Regulatory & Legal ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Regulatory & Legal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={FileText} label="IEC Number" value={supplier.iecNumber} />
            <InfoRow icon={FileText} label="GST Number" value={supplier.gstNumber} />
            <InfoRow icon={FileText} label="FSSAI Central License" value={supplier.fssaiLicense} />
            <InfoRow icon={FileText} label="APEDA Registration" value={supplier.apedaNumber} />
            <InfoRow icon={FileText} label="FDA Registration Number" value={supplier.fdaRegistrationNumber} />
            <InfoRow icon={ShieldCheck} label="US Agent Appointed?" value={supplier.usAgentAppointed} />
            <InfoRow icon={ShieldCheck} label="TRACES NT Registration (EU)?" value={supplier.tracesNtRegistration} />
            <InfoRow icon={ShieldCheck} label="COI Capability?" value={supplier.coiCapability} />
            <InfoRow icon={ShieldCheck} label="DAFF Biosecurity (Australia)?" value={supplier.daffBiosecurity} />
            <InfoRow icon={ShieldCheck} label="JAS Label Compliance (Japan)?" value={supplier.jasLabelCompliance} />
          </CardContent>
        </Card>

        {/* ── Certifications & Food Safety ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" />Certifications & Food Safety</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={ShieldCheck} label="HACCP Plan Available?" value={supplier.haccpAvailable} />
            <InfoRow icon={FileText} label="ISO/FSSC 22000 Cert No." value={supplier.isoFsscCertNo} />
            <InfoRow icon={Calendar} label="ISO Cert Validity Date" value={supplier.isoCertValidityDate} />
            <InfoRow icon={Calendar} label="Latest Internal Audit Date" value={supplier.latestInternalAuditDate} />
            <InfoRow icon={Calendar} label="Latest Third-Party Audit Date" value={supplier.latestThirdPartyAuditDate} />
            <InfoRow icon={Building2} label="Auditing Body" value={supplier.auditingBodyName} />
          </CardContent>
        </Card>

        {/* ── Status & Activity ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4" />Status & Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={FileText} label="Reason Inactive" value={supplier.reasonInactive} />
            <InfoRow icon={Calendar} label="Date Marked Inactive" value={supplier.dateMarkedInactive} />
            <InfoRow icon={RefreshCw} label="Reactivation Potential" value={supplier.reactivationPotential} />
          </CardContent>
        </Card>

        {/* ── Branding & Private Label ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" />Branding & Private Label</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Tag} label="Export Under" value={supplier.exportBrand} />
            <InfoRow icon={FileText} label="Health/Nutrition Claims" value={supplier.healthNutritionClaims} />
            <InfoRow icon={MapPin} label="Claims Approved Markets" value={supplier.claimsApprovedMarkets} />
            <InfoRow icon={FileText} label="Packaging Compliance Regions" value={supplier.packagingComplianceRegions} />
          </CardContent>
        </Card>

        {/* ── Processing Compliance ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Processing Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={ShieldCheck} label="Organic Segregation SOP?" value={supplier.organicSegregationSop} />
            <InfoRow icon={ShieldCheck} label="Cleaning & Line Clearance SOP?" value={supplier.cleaningLinelearanceSop} />
            <InfoRow icon={ShieldCheck} label="No Prohibited Processing Aids?" value={supplier.noProhibitedAids} />
          </CardContent>
        </Card>
      </div>

      {/* ── Product Catalog ── */}
      {supplier.productCatalog && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Product Catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={supplier.productCatalog}
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

      {/* ── Organic Certs by Market ── */}
      {supplier.organicCertsByMarket && supplier.organicCertsByMarket.some(r => r.certNumber || r.expiryDate) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" />Organic Certificates by Market</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-1.5 font-medium text-slate-500 w-1/3">Market / Standard</th><th className="text-left py-1.5 font-medium text-slate-500">Certificate Number</th><th className="text-left py-1.5 font-medium text-slate-500">Expiry Date</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{supplier.organicCertsByMarket.map(r => (<tr key={r.market}><td className="py-1.5 font-medium text-slate-700">{r.market}</td><td className="py-1.5 text-slate-600">{r.certNumber || "—"}</td><td className="py-1.5 text-slate-600">{r.expiryDate || "—"}</td></tr>))}</tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Lab Testing Records ── */}
      {supplier.labTestingRecords && supplier.labTestingRecords.some(r => r.lastTestDate || r.labName) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Lab Testing Records</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-1.5 font-medium text-slate-500">Test</th><th className="text-left py-1.5 font-medium text-slate-500">Last Test Date</th><th className="text-left py-1.5 font-medium text-slate-500">Lab Name</th><th className="text-left py-1.5 font-medium text-slate-500">Report?</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{supplier.labTestingRecords.map(r => (<tr key={r.testType}><td className="py-1.5 font-medium text-slate-700">{r.testType}</td><td className="py-1.5 text-slate-600">{r.lastTestDate || "—"}</td><td className="py-1.5 text-slate-600">{r.labName || "—"}</td><td className="py-1.5 text-slate-600">{r.reportAttached || "—"}</td></tr>))}</tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Lab Declarations ── */}
      {(supplier.gmoFreeDeclaration || supplier.irradiationFreeDeclaration || supplier.foodContactCompliance || supplier.compostabilityCert || supplier.migrationTestReport) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Declarations & Compliance Certs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={ShieldCheck} label="GMO-Free Declaration?" value={supplier.gmoFreeDeclaration} />
            <InfoRow icon={ShieldCheck} label="Irradiation-Free Declaration?" value={supplier.irradiationFreeDeclaration} />
            <InfoRow icon={ShieldCheck} label="Food Contact Compliance (EU/FDA)?" value={supplier.foodContactCompliance} />
            <InfoRow icon={ShieldCheck} label="Compostability Certificate?" value={supplier.compostabilityCert} />
            <InfoRow icon={ShieldCheck} label="Migration Test Report?" value={supplier.migrationTestReport} />
          </CardContent>
        </Card>
      )}

      {/* ── Organic Certification Chain ── */}
      {(supplier.farmerOrganicCert || supplier.aggregatorOrganicCert || supplier.processingUnitOrganicCert || supplier.certifyingBodyName) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" />Organic Certification Chain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={ShieldCheck} label="Farmer Organic Cert?" value={supplier.farmerOrganicCert} />
            <InfoRow icon={ShieldCheck} label="Aggregator/FPO Organic Cert?" value={supplier.aggregatorOrganicCert} />
            <InfoRow icon={ShieldCheck} label="Processing Unit Organic Cert?" value={supplier.processingUnitOrganicCert} />
            <InfoRow icon={Building2} label="Certifying Body" value={supplier.certifyingBodyName} />
            <InfoRow icon={ShieldCheck} label="Certs Valid for Export?" value={supplier.certsValidForExport} />
          </CardContent>
        </Card>
      )}

      {/* ── Notes ── */}
      {supplier.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{supplier.notes}</p>
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
            <DialogTitle>Edit New Supplier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-2">
            {/* Basic Info */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Basic Info</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Company Name *</Label><Input value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Trade / Brand Name</Label><Input value={form.tradeName ?? ""} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Year Established</Label><Input value={form.yearEstablished ?? ""} onChange={(e) => setForm({ ...form, yearEstablished: e.target.value })} /></div>
              <div className="space-y-2"><Label>Country</Label><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              <div className="space-y-2"><Label>City</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div className="space-y-2"><Label>State / Province</Label><Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
              <div className="space-y-2"><Label>Postal Code</Label><Input value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
              <div className="space-y-2"><Label>Supplier Type</Label><MultiSelectDropdown value={form.supplierType ?? ""} onChange={(v) => setForm({ ...form, supplierType: v })} options={["Manufacturer", "Trader", "Processor", "Aggregator", "Farmer Producer Organisation (FPO)"]} placeholder="Select supplier type(s)…" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Manufacturing Address</Label><Textarea value={form.manufacturingAddress ?? ""} onChange={(e) => setForm({ ...form, manufacturingAddress: e.target.value })} rows={2} /></div>
            </div></div>
            <Separator />
            {/* Contact */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Contact Details</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Account Manager</Label><Input value={form.accountManager ?? ""} onChange={(e) => setForm({ ...form, accountManager: e.target.value })} /></div>
              <div className="space-y-2"><Label>Current Status</Label><Input value={form.currentStatus ?? ""} onChange={(e) => setForm({ ...form, currentStatus: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>WhatsApp</Label><Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div></div>
            <Separator />
            {/* Products */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Products</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Product Category</Label><Input value={form.productCategory ?? ""} onChange={(e) => setForm({ ...form, productCategory: e.target.value })} /></div>
              <div className="space-y-2"><Label>Product Name / Description</Label><Input value={form.product ?? ""} onChange={(e) => setForm({ ...form, product: e.target.value })} /></div>
              <div className="space-y-2"><Label>HS Code</Label><Input value={form.hsCode ?? ""} onChange={(e) => setForm({ ...form, hsCode: e.target.value })} /></div>
              <div className="space-y-2"><Label>Organic Status</Label><SelectWithOthers value={form.organicStatus ?? ""} onChange={(v) => setForm({ ...form, organicStatus: v })} options={["Certified Organic", "In Conversion", "Conventional"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Certifications</Label><Input value={form.certifications ?? ""} onChange={(e) => setForm({ ...form, certifications: e.target.value })} /></div>
              <div className="space-y-2"><Label>Shelf Life (months)</Label><Input value={form.shelfLife ?? ""} onChange={(e) => setForm({ ...form, shelfLife: e.target.value })} /></div>
              <div className="space-y-2"><Label>Storage Conditions</Label><Input value={form.storageConditions ?? ""} onChange={(e) => setForm({ ...form, storageConditions: e.target.value })} /></div>
              <div className="space-y-2"><Label>Packaging Type & Material</Label><Input value={form.packagingType ?? ""} onChange={(e) => setForm({ ...form, packagingType: e.target.value })} /></div>
              <div className="space-y-2"><Label>Net Weight Variants</Label><Input value={form.netWeightVariants ?? ""} onChange={(e) => setForm({ ...form, netWeightVariants: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Ingredient List</Label><Textarea value={form.ingredientList ?? ""} onChange={(e) => setForm({ ...form, ingredientList: e.target.value })} rows={2} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Allergen Declaration</Label><Textarea value={form.allergenDeclaration ?? ""} onChange={(e) => setForm({ ...form, allergenDeclaration: e.target.value })} rows={2} /></div>
            </div></div>
            <Separator />
            {/* Samples */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Samples</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Sample Available?</Label><SelectWithOthers value={form.sampleAvailable ?? ""} onChange={(v) => setForm({ ...form, sampleAvailable: v })} options={["Yes", "No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Lead Time (days)</Label><Input value={form.sampleLeadTime ?? ""} onChange={(e) => setForm({ ...form, sampleLeadTime: e.target.value })} /></div>
              <div className="space-y-2"><Label>Sample Cost</Label><Input value={form.sampleCost ?? ""} onChange={(e) => setForm({ ...form, sampleCost: e.target.value })} /></div>
            </div></div>
            <Separator />
            {/* Production */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Production & Volume Capacity</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Annual Production Volume</Label><Input value={form.annualProductionVolume ?? ""} onChange={(e) => setForm({ ...form, annualProductionVolume: e.target.value })} /></div>
              <div className="space-y-2"><Label>Avg Monthly Volume</Label><Input value={form.avgMonthlyVolume ?? ""} onChange={(e) => setForm({ ...form, avgMonthlyVolume: e.target.value })} /></div>
              <div className="space-y-2"><Label>Max Scalable Monthly Volume</Label><Input value={form.maxScalableMonthlyVolume ?? ""} onChange={(e) => setForm({ ...form, maxScalableMonthlyVolume: e.target.value })} /></div>
              <div className="space-y-2"><Label>Min Exportable Batch</Label><Input value={form.minExportableBatch ?? ""} onChange={(e) => setForm({ ...form, minExportableBatch: e.target.value })} /></div>
              <div className="space-y-2"><Label>MOQ</Label><Input value={form.moq ?? ""} onChange={(e) => setForm({ ...form, moq: e.target.value })} /></div>
              <div className="space-y-2"><Label>Off-Season Availability?</Label><SelectWithOthers value={form.offSeasonAvailability ?? ""} onChange={(v) => setForm({ ...form, offSeasonAvailability: v })} options={["Yes", "No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Lead Time — First Order (days)</Label><Input value={form.leadTimeFirstOrder ?? ""} onChange={(e) => setForm({ ...form, leadTimeFirstOrder: e.target.value })} /></div>
              <div className="space-y-2"><Label>Lead Time — Repeat Orders (days)</Label><Input value={form.leadTimeRepeatOrder ?? ""} onChange={(e) => setForm({ ...form, leadTimeRepeatOrder: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Peak Season Months</Label><MultiSelectDropdown value={form.peakSeasonMonths ?? ""} onChange={(v) => setForm({ ...form, peakSeasonMonths: v })} options={["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]} placeholder="Select months…" /></div>
            </div></div>
            <Separator />
            {/* Commercial */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Commercial & Export Terms</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Incoterms Supported</Label><MultiSelectDropdown value={form.incotermsSupported ?? ""} onChange={(v) => setForm({ ...form, incotermsSupported: v })} options={["EXW","FCA","FOB","CIF","CNF","CPT","CIP","DDP"]} placeholder="Select incoterms…" /></div>
              <div className="space-y-2"><Label>Ports of Export</Label><Input value={form.portsOfExport ?? ""} onChange={(e) => setForm({ ...form, portsOfExport: e.target.value })} /></div>
              <div className="space-y-2"><Label>Target Export Markets</Label><Input value={form.targetExportMarkets ?? ""} onChange={(e) => setForm({ ...form, targetExportMarkets: e.target.value })} /></div>
              <div className="space-y-2"><Label>Currency Preferred</Label><Input value={form.currencyPreferred ?? ""} onChange={(e) => setForm({ ...form, currencyPreferred: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Payment Terms</Label><MultiSelectDropdown value={form.paymentTerms ?? ""} onChange={(v) => setForm({ ...form, paymentTerms: v })} options={["T/T Advance (100%)","50% Advance + 50% Against BL","L/C at Sight","L/C Usance","D/P (Documents against Payment)","D/A (Documents against Acceptance)","Open Account"]} placeholder="Select payment terms…" /></div>
            </div></div>
            <Separator />
            {/* Regulatory */}
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
            {/* Certifications */}
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
            {/* Organic Chain */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Organic Certification Chain</p>
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
            <Separator />
            {/* Lab Testing */}
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
            {/* Branding */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Branding & Private Label</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Export Under</Label><SelectWithOthers value={form.exportBrand ?? ""} onChange={(v) => setForm({ ...form, exportBrand: v })} options={["Own Brand","Buyer's Private Label","Elan Brand","White Label / Unbranded"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Claims Approved Markets</Label><Input value={form.claimsApprovedMarkets ?? ""} onChange={(e) => setForm({ ...form, claimsApprovedMarkets: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Packaging Compliance Regions</Label><MultiSelectDropdown value={form.packagingComplianceRegions ?? ""} onChange={(v) => setForm({ ...form, packagingComplianceRegions: v })} options={["India (FSSAI)","EU (Reg 1169/2011)","USA (FDA 21 CFR)","UK (FSA)","GCC / GSO","Australia / NZ (FSANZ)","Japan (JAS / MHLW)","Canada (CFIA)"]} placeholder="Select regions…" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Health / Nutrition Claims</Label><Textarea value={form.healthNutritionClaims ?? ""} onChange={(e) => setForm({ ...form, healthNutritionClaims: e.target.value })} rows={2} /></div>
            </div></div>
            <Separator />
            {/* Processing Compliance */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Processing Compliance</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Organic Segregation SOP?</Label><SelectWithOthers value={form.organicSegregationSop ?? ""} onChange={(v) => setForm({ ...form, organicSegregationSop: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2"><Label>Cleaning & Line Clearance SOP?</Label><SelectWithOthers value={form.cleaningLinelearanceSop ?? ""} onChange={(v) => setForm({ ...form, cleaningLinelearanceSop: v })} options={["Yes","No"]} placeholder="Select…" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>No Prohibited Processing Aids?</Label><SelectWithOthers value={form.noProhibitedAids ?? ""} onChange={(v) => setForm({ ...form, noProhibitedAids: v })} options={["Yes","No"]} placeholder="Select…" /></div>
            </div></div>
            <Separator />
            {/* Additional */}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Additional Info</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Latest Quotation</Label><Input value={form.latestQuotation ?? ""} onChange={(e) => setForm({ ...form, latestQuotation: e.target.value })} /></div>
              <div className="space-y-2"><Label>Reason Inactive</Label><Input value={form.reasonInactive ?? ""} onChange={(e) => setForm({ ...form, reasonInactive: e.target.value })} /></div>
              <div className="space-y-2"><Label>Date Marked Inactive</Label><Input value={form.dateMarkedInactive ?? ""} onChange={(e) => setForm({ ...form, dateMarkedInactive: e.target.value })} /></div>
              <div className="space-y-2"><Label>Reactivation Potential</Label><Input value={form.reactivationPotential ?? ""} onChange={(e) => setForm({ ...form, reactivationPotential: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
            </div></div>

            <Separator />

            {/* Product Catalog */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Product Catalog</p>
              <div className="space-y-3">
                {form.productCatalog && !catalogFile && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-brand-500 shrink-0" />
                    <a
                      href={form.productCatalog}
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
                    id="catalog-upload-nsd"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setCatalogFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                    onClick={() => document.getElementById("catalog-upload-nsd")?.click()}
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

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
