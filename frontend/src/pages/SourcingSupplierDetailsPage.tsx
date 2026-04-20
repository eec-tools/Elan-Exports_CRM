import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { copyToClipboard } from "@/lib/utils";
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
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Loader2,
  Mail,
  CheckCircle2,
  Copy,
  ArrowRight,
  LayoutTemplate,
  Save,
  Circle,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface SourcingSupplier {
  id: string;
  company: string;
  country?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  contactPerson?: string;
  product?: string;
  productCategory?: string;
  notes?: string;
  status: string;
  formToken?: string;
  tradeName?: string;
  yearEstablished?: string;
  manufacturingAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  supplierType?: string;
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
  // Media (uploaded by supplier)
  productCatalogs?: string[];
  productCatalogImages?: string[];
  certificates?: string[];
  warehousePhotos?: string[];
  videoLinks?: string[];
  quotations?: string[];
  // Internal / EEC fields
  latestQuotation?: string;
  vettingScore?: number | null;
  exclusivityArrangement?: string;
  eecMarginPercent?: string;
  factoryVisitStatus?: string;
  factoryVisitDate?: string;
  factoryVisitOutcome?: string;
  referralSource?: string;
  emailCampaign?: {
    status: string;
    currentStep: number;
    introEmailSentAt?: string;
    followup1SentAt?: string | null;
    followup2SentAt?: string | null;
    responseReceivedAt?: string | null;
    nextFollowupDue?: string | null;
  } | null;
}

interface FormTemplate {
  id: string;
  name: string;
  isDefault: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending:           { label: "Pending",            class: "bg-slate-100 text-slate-700" },
  intro_sent:        { label: "Intro Sent",          class: "bg-blue-100 text-blue-700" },
  followup1_sent:    { label: "Follow-up 1 Sent",    class: "bg-amber-100 text-amber-700" },
  followup2_sent:    { label: "Follow-up 2 Sent",    class: "bg-orange-100 text-orange-700" },
  response_received: { label: "Responded",           class: "bg-green-100 text-green-700" },
  no_response:       { label: "No Response",         class: "bg-red-100 text-red-700" },
  converted:         { label: "Converted",           class: "bg-purple-100 text-purple-700" },
};

function FieldRow({ label, value, onChange, canEdit, type = "text", hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-slate-500 font-medium">{label}</Label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!canEdit}
        className="mt-1 h-8 text-sm"
      />
    </div>
  );
}

function TextAreaRow({ label, value, onChange, canEdit }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
}) {
  return (
    <div className="col-span-2">
      <Label className="text-xs text-slate-500 font-medium">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={!canEdit} rows={2} className="mt-1 text-sm" />
    </div>
  );
}

export default function SourcingSupplierDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission("suppliers");

  const [fields, setFields] = useState<Partial<SourcingSupplier>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [formLinkOpen, setFormLinkOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const set = (key: string) => (value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setIsDirty(true);
  };
  const v = (key: keyof SourcingSupplier) => (fields[key] as string) ?? "";

  // ─── Queries ────────────────────────────────────────
  const { data: supplier, isLoading } = useQuery({
    queryKey: ["sourcing-supplier", id],
    queryFn: async () => {
      const res = await api.get(`/sourcing-suppliers/${id}`);
      return res.data as SourcingSupplier;
    },
    enabled: !!id,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["supplier-form-templates"],
    queryFn: async () => {
      const res = await api.get("/supplier-form-templates");
      return res.data as FormTemplate[];
    },
  });

  useEffect(() => {
    if (supplier) {
      setFields(supplier);
      setIsDirty(false);
    }
  }, [supplier]);

  // ─── Mutations ──────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: Partial<SourcingSupplier>) => api.put(`/sourcing-suppliers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-supplier", id] });
      setIsDirty(false);
      toast.success("Saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  const startCampaignMutation = useMutation({
    mutationFn: () => api.post(`/sourcing-campaigns/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-supplier", id] });
      toast.success("Campaign started");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? "Failed to start campaign"),
  });

  const markSentMutation = useMutation({
    mutationFn: () => api.post(`/sourcing-campaigns/${id}/mark-sent`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-supplier", id] });
      toast.success("Email marked as sent");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? "Failed"),
  });

  const markResponseMutation = useMutation({
    mutationFn: () => api.post(`/sourcing-campaigns/${id}/mark-response`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-supplier", id] });
      toast.success("Response recorded");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? "Failed"),
  });

  const convertMutation = useMutation({
    mutationFn: () => api.post(`/sourcing-suppliers/${id}/convert`),
    onSuccess: (res) => {
      setConvertOpen(false);
      toast.success("Converted to New Supplier");
      navigate(`/suppliers/new/${res.data.id}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? "Failed to convert"),
  });

  // ─── Helpers ────────────────────────────────────────
  const formLink = supplier?.formToken
    ? `${window.location.origin}/supplier-form/${supplier.formToken}`
    : null;

  const copyLink = async () => {
    if (formLink) {
      const success = await copyToClipboard(formLink);
      if (success) {
        toast.success("Form link copied");
      } else {
        toast.error("Failed to copy link. Please copy it manually.");
      }
    }
  };

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString() : "—";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!supplier) {
    return <div className="p-6 text-slate-500">Supplier not found.</div>;
  }

  const campaign = fields.emailCampaign ?? supplier.emailCampaign;
  const statusCfg = STATUS_CONFIG[fields.status as string ?? supplier.status] ?? { label: supplier.status, class: "bg-slate-100 text-slate-700" };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/suppliers/sourcing")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{supplier.company}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.class}`}>
                {statusCfg.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">{supplier.country ?? "—"} · {supplier.product ?? "—"}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {supplier.formToken && (
            <Button variant="outline" size="sm" onClick={() => setFormLinkOpen(true)}>
              <LayoutTemplate className="h-4 w-4 mr-1.5" />
              Form Link
            </Button>
          )}
          {supplier.status === "response_received" && canEdit && (
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setConvertOpen(true)}>
              <ArrowRight className="h-4 w-4 mr-1.5" />
              Convert to New Supplier
            </Button>
          )}
          {isDirty && canEdit && (
            <Button size="sm" onClick={() => saveMutation.mutate(fields)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Basic Info ─── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <h2 className="font-semibold text-slate-800">Basic Information</h2>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Company" value={v("company")} onChange={set("company")} canEdit={canEdit} />
              <FieldRow label="Country" value={v("country")} onChange={set("country")} canEdit={canEdit} />
              <FieldRow label="Contact Person" value={v("contactPerson")} onChange={set("contactPerson")} canEdit={canEdit} />
              <FieldRow label="Email" value={v("email")} onChange={set("email")} canEdit={canEdit} type="email" />
              <FieldRow label="Phone" value={v("phone")} onChange={set("phone")} canEdit={canEdit} />
              <FieldRow label="WhatsApp" value={v("whatsapp")} onChange={set("whatsapp")} canEdit={canEdit} />
              <FieldRow label="Product" value={v("product")} onChange={set("product")} canEdit={canEdit} />
              <FieldRow label="Product Category" value={v("productCategory")} onChange={set("productCategory")} canEdit={canEdit} />
            </div>
            <div>
              <Label className="text-xs text-slate-500 font-medium">Notes</Label>
              <Textarea value={v("notes")} onChange={(e) => set("notes")(e.target.value)} disabled={!canEdit} rows={2} className="mt-1 text-sm" />
            </div>
          </div>
        </div>

        {/* ── Right: Campaign Status ─── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold text-slate-800 mb-3">Email Campaign</h2>
            {!campaign ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">No campaign started yet.</p>
                {canEdit && supplier.status !== "converted" && (
                  <Button size="sm" className="w-full" onClick={() => startCampaignMutation.mutate()} disabled={startCampaignMutation.isPending}>
                    {startCampaignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Mail className="h-4 w-4 mr-1.5" />}
                    Start Campaign
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Step timeline */}
                {[
                  { step: 1, label: "Intro Email", date: campaign.introEmailSentAt },
                  { step: 2, label: "Follow-up 1", date: campaign.followup1SentAt },
                  { step: 3, label: "Follow-up 2 (Final)", date: campaign.followup2SentAt },
                ].map(({ step, label, date }) => (
                  <div key={step} className="flex items-start gap-2.5">
                    {date ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    ) : campaign.currentStep === step && campaign.status === "active" ? (
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-slate-700">{label}</div>
                      {date && <div className="text-xs text-slate-400">{fmt(date)}</div>}
                    </div>
                  </div>
                ))}

                {campaign.responseReceivedAt && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-green-100">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-green-700">Response Received</div>
                      <div className="text-xs text-slate-400">{fmt(campaign.responseReceivedAt)}</div>
                    </div>
                  </div>
                )}

                {campaign.nextFollowupDue && campaign.status === "active" && (
                  <div className="text-xs text-amber-600 font-medium pt-1">
                    Next follow-up due: {fmt(campaign.nextFollowupDue)}
                  </div>
                )}

                {/* Actions */}
                {canEdit && campaign.status === "active" && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {campaign.currentStep < 3 && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => markSentMutation.mutate()} disabled={markSentMutation.isPending}>
                        {markSentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Mail className="h-4 w-4 mr-1.5" />}
                        Mark {campaign.currentStep === 1 ? "Follow-up 1" : "Follow-up 2"} Sent
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="w-full border-green-400 text-green-700 hover:bg-green-50" onClick={() => markResponseMutation.mutate()} disabled={markResponseMutation.isPending}>
                      {markResponseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                      Mark as Responded
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form link panel */}
          {formLink && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="font-semibold text-slate-800 mb-2">Supplier Form Link</h2>
              <p className="text-xs text-slate-500 mb-2">Share this link with the supplier to fill in their details.</p>
              <div className="flex gap-2">
                <Input readOnly value={formLink} className="text-xs font-mono flex-1" />
                <Button size="sm" variant="outline" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" variant="link" className="px-0 mt-1 text-xs" onClick={() => window.open(formLink, "_blank")}>
                Preview form →
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Form Sections Tabs ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-800 mb-4">Supplier Information Form</h2>
        <Tabs defaultValue="identity">
          <TabsList className="flex-wrap h-auto gap-1 mb-4">
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="commercial">Commercial</TabsTrigger>
            <TabsTrigger value="regulatory">Regulatory</TabsTrigger>
            <TabsTrigger value="certifications">Certifications</TabsTrigger>
            <TabsTrigger value="organic">Organic</TabsTrigger>
            <TabsTrigger value="labTesting">Lab Testing</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="eec">EEC Internal</TabsTrigger>
          </TabsList>

          {/* Section 1 — Identity */}
          <TabsContent value="identity">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Trade Name" value={v("tradeName")} onChange={set("tradeName")} canEdit={canEdit} />
              <FieldRow label="Year Established" value={v("yearEstablished")} onChange={set("yearEstablished")} canEdit={canEdit} />
              <TextAreaRow label="Manufacturing Address" value={v("manufacturingAddress")} onChange={set("manufacturingAddress")} canEdit={canEdit} />
              <FieldRow label="City" value={v("city")} onChange={set("city")} canEdit={canEdit} />
              <FieldRow label="State" value={v("state")} onChange={set("state")} canEdit={canEdit} />
              <FieldRow label="Postal Code" value={v("postalCode")} onChange={set("postalCode")} canEdit={canEdit} />
              <FieldRow label="Supplier Type" value={v("supplierType")} onChange={set("supplierType")} canEdit={canEdit} />
            </div>
          </TabsContent>

          {/* Section 3 — Products */}
          <TabsContent value="products">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="HS Code" value={v("hsCode")} onChange={set("hsCode")} canEdit={canEdit} />
              <FieldRow label="Organic Status" value={v("organicStatus")} onChange={set("organicStatus")} canEdit={canEdit} />
              <TextAreaRow label="Ingredient List" value={v("ingredientList")} onChange={set("ingredientList")} canEdit={canEdit} />
              <TextAreaRow label="Allergen Declaration" value={v("allergenDeclaration")} onChange={set("allergenDeclaration")} canEdit={canEdit} />
              <FieldRow label="Shelf Life" value={v("shelfLife")} onChange={set("shelfLife")} canEdit={canEdit} />
              <FieldRow label="Storage Conditions" value={v("storageConditions")} onChange={set("storageConditions")} canEdit={canEdit} />
              <FieldRow label="Packaging Type" value={v("packagingType")} onChange={set("packagingType")} canEdit={canEdit} />
              <FieldRow label="Net Weight Variants" value={v("netWeightVariants")} onChange={set("netWeightVariants")} canEdit={canEdit} />
              <FieldRow label="Sample Available" value={v("sampleAvailable")} onChange={set("sampleAvailable")} canEdit={canEdit} />
              <FieldRow label="Sample Lead Time" value={v("sampleLeadTime")} onChange={set("sampleLeadTime")} canEdit={canEdit} />
              <FieldRow label="Sample Cost" value={v("sampleCost")} onChange={set("sampleCost")} canEdit={canEdit} />
            </div>
          </TabsContent>

          {/* Section 4 — Production */}
          <TabsContent value="production">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Annual Production Volume" value={v("annualProductionVolume")} onChange={set("annualProductionVolume")} canEdit={canEdit} />
              <FieldRow label="Avg Monthly Volume" value={v("avgMonthlyVolume")} onChange={set("avgMonthlyVolume")} canEdit={canEdit} />
              <FieldRow label="Max Scalable Monthly Volume" value={v("maxScalableMonthlyVolume")} onChange={set("maxScalableMonthlyVolume")} canEdit={canEdit} />
              <FieldRow label="Peak Season Months" value={v("peakSeasonMonths")} onChange={set("peakSeasonMonths")} canEdit={canEdit} />
              <FieldRow label="Off-Season Availability" value={v("offSeasonAvailability")} onChange={set("offSeasonAvailability")} canEdit={canEdit} />
              <FieldRow label="Min Exportable Batch" value={v("minExportableBatch")} onChange={set("minExportableBatch")} canEdit={canEdit} />
              <FieldRow label="MOQ" value={v("moq")} onChange={set("moq")} canEdit={canEdit} />
              <FieldRow label="Lead Time (First Order)" value={v("leadTimeFirstOrder")} onChange={set("leadTimeFirstOrder")} canEdit={canEdit} />
              <FieldRow label="Lead Time (Repeat Order)" value={v("leadTimeRepeatOrder")} onChange={set("leadTimeRepeatOrder")} canEdit={canEdit} />
            </div>
          </TabsContent>

          {/* Section 5 — Commercial */}
          <TabsContent value="commercial">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Incoterms Supported" value={v("incotermsSupported")} onChange={set("incotermsSupported")} canEdit={canEdit} />
              <FieldRow label="Ports of Export" value={v("portsOfExport")} onChange={set("portsOfExport")} canEdit={canEdit} />
              <FieldRow label="Target Export Markets" value={v("targetExportMarkets")} onChange={set("targetExportMarkets")} canEdit={canEdit} />
              <FieldRow label="Currency Preferred" value={v("currencyPreferred")} onChange={set("currencyPreferred")} canEdit={canEdit} />
              <FieldRow label="Payment Terms" value={v("paymentTerms")} onChange={set("paymentTerms")} canEdit={canEdit} />
            </div>
          </TabsContent>

          {/* Section 6 — Regulatory */}
          <TabsContent value="regulatory">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="IEC Number" value={v("iecNumber")} onChange={set("iecNumber")} canEdit={canEdit} />
              <FieldRow label="GST Number" value={v("gstNumber")} onChange={set("gstNumber")} canEdit={canEdit} />
              <FieldRow label="FSSAI License" value={v("fssaiLicense")} onChange={set("fssaiLicense")} canEdit={canEdit} />
              <FieldRow label="APEDA Number" value={v("apedaNumber")} onChange={set("apedaNumber")} canEdit={canEdit} />
              <FieldRow label="FDA Registration Number" value={v("fdaRegistrationNumber")} onChange={set("fdaRegistrationNumber")} canEdit={canEdit} />
              <FieldRow label="US Agent Appointed" value={v("usAgentAppointed")} onChange={set("usAgentAppointed")} canEdit={canEdit} />
              <FieldRow label="TRACES NT Registration" value={v("tracesNtRegistration")} onChange={set("tracesNtRegistration")} canEdit={canEdit} />
              <FieldRow label="CoI Capability" value={v("coiCapability")} onChange={set("coiCapability")} canEdit={canEdit} />
              <FieldRow label="DAFF Biosecurity" value={v("daffBiosecurity")} onChange={set("daffBiosecurity")} canEdit={canEdit} />
              <FieldRow label="JAS Label Compliance" value={v("jasLabelCompliance")} onChange={set("jasLabelCompliance")} canEdit={canEdit} />
            </div>
          </TabsContent>

          {/* Section 7 — Certifications */}
          <TabsContent value="certifications">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="HACCP Available" value={v("haccpAvailable")} onChange={set("haccpAvailable")} canEdit={canEdit} />
              <FieldRow label="ISO/FSSC Cert No." value={v("isoFsscCertNo")} onChange={set("isoFsscCertNo")} canEdit={canEdit} />
              <FieldRow label="ISO Cert Validity Date" value={v("isoCertValidityDate")} onChange={set("isoCertValidityDate")} canEdit={canEdit} />
              <FieldRow label="Latest Internal Audit Date" value={v("latestInternalAuditDate")} onChange={set("latestInternalAuditDate")} canEdit={canEdit} />
              <FieldRow label="Latest 3rd Party Audit Date" value={v("latestThirdPartyAuditDate")} onChange={set("latestThirdPartyAuditDate")} canEdit={canEdit} />
              <FieldRow label="Auditing Body Name" value={v("auditingBodyName")} onChange={set("auditingBodyName")} canEdit={canEdit} />
            </div>
          </TabsContent>

          {/* Section 8 — Organic */}
          <TabsContent value="organic">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Farmer Organic Cert" value={v("farmerOrganicCert")} onChange={set("farmerOrganicCert")} canEdit={canEdit} />
              <FieldRow label="Aggregator Organic Cert" value={v("aggregatorOrganicCert")} onChange={set("aggregatorOrganicCert")} canEdit={canEdit} />
              <FieldRow label="Processing Unit Organic Cert" value={v("processingUnitOrganicCert")} onChange={set("processingUnitOrganicCert")} canEdit={canEdit} />
              <FieldRow label="Certifying Body Name" value={v("certifyingBodyName")} onChange={set("certifyingBodyName")} canEdit={canEdit} />
              <FieldRow label="Certs Valid for Export" value={v("certsValidForExport")} onChange={set("certsValidForExport")} canEdit={canEdit} />
            </div>
          </TabsContent>

          {/* Section 9 — Lab Testing */}
          <TabsContent value="labTesting">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="GMO Free Declaration" value={v("gmoFreeDeclaration")} onChange={set("gmoFreeDeclaration")} canEdit={canEdit} />
              <FieldRow label="Irradiation Free Declaration" value={v("irradiationFreeDeclaration")} onChange={set("irradiationFreeDeclaration")} canEdit={canEdit} />
              <FieldRow label="Food Contact Compliance" value={v("foodContactCompliance")} onChange={set("foodContactCompliance")} canEdit={canEdit} />
              <FieldRow label="Compostability Cert" value={v("compostabilityCert")} onChange={set("compostabilityCert")} canEdit={canEdit} />
              <FieldRow label="Migration Test Report" value={v("migrationTestReport")} onChange={set("migrationTestReport")} canEdit={canEdit} />
            </div>
          </TabsContent>

          {/* Section 10 — Branding */}
          <TabsContent value="branding">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Export Brand" value={v("exportBrand")} onChange={set("exportBrand")} canEdit={canEdit} />
              <TextAreaRow label="Health & Nutrition Claims" value={v("healthNutritionClaims")} onChange={set("healthNutritionClaims")} canEdit={canEdit} />
              <FieldRow label="Claims Approved Markets" value={v("claimsApprovedMarkets")} onChange={set("claimsApprovedMarkets")} canEdit={canEdit} />
              <FieldRow label="Packaging Compliance Regions" value={v("packagingComplianceRegions")} onChange={set("packagingComplianceRegions")} canEdit={canEdit} />
            </div>
          </TabsContent>

          {/* Section 11 — Processing */}
          <TabsContent value="processing">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Organic Segregation SOP" value={v("organicSegregationSop")} onChange={set("organicSegregationSop")} canEdit={canEdit} />
              <FieldRow label="Cleaning Line Clearance SOP" value={v("cleaningLinelearanceSop")} onChange={set("cleaningLinelearanceSop")} canEdit={canEdit} />
              <FieldRow label="No Prohibited Aids" value={v("noProhibitedAids")} onChange={set("noProhibitedAids")} canEdit={canEdit} />
            </div>
          </TabsContent>

          {/* Media — uploaded by supplier */}
          <TabsContent value="media">
            <div className="space-y-6">
              {(
                [
                  { label: "Product Catalogs", key: "productCatalogs" },
                  { label: "Product Catalog Images", key: "productCatalogImages" },
                  { label: "Certificates", key: "certificates" },
                  { label: "Warehouse Photos", key: "warehousePhotos" },
                  { label: "Video Links", key: "videoLinks" },
                  { label: "Quotations", key: "quotations" },
                ] as { label: string; key: keyof SourcingSupplier }[]
              ).map(({ label, key }) => {
                // Items can be strings (URLs) or objects with a url/path property
                const rawItems = (supplier[key] as unknown[] | undefined) ?? [];
                const items: string[] = rawItems
                  .map((item) => {
                    if (typeof item === "string") return item;
                    if (item && typeof item === "object") {
                      const obj = item as Record<string, unknown>;
                      return (obj.url ?? obj.path ?? obj.secure_url ?? "") as string;
                    }
                    return "";
                  })
                  .filter(Boolean);
                return (
                  <div key={key}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{label}</p>
                    {items.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No files uploaded yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {items.map((url, i) => {
                          const isVideo = url.includes("youtube") || url.includes("vimeo") || !url.match(/\.(pdf|jpg|jpeg|png|webp|doc|docx|xls|xlsx|csv|zip)/i);
                          const fileName = url.split("/").pop()?.split("?")[0] ?? `File ${i + 1}`;
                          return (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate max-w-sm"
                              >
                                {isVideo ? url : fileName}
                              </a>
                              <span className="text-xs text-slate-400 shrink-0">
                                {isVideo ? "video" : fileName.match(/\.(\w+)$/)?.[1]?.toUpperCase() ?? "file"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* EEC Internal — admin only, never sent to supplier */}
          <TabsContent value="eec">
            <div className="space-y-6">
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                These fields are for internal use only and are never shared with or editable by the supplier.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Latest Quotation */}
                <FieldRow label="Latest Quotation" value={v("latestQuotation")} onChange={set("latestQuotation")} canEdit={canEdit} />
                {/* Referral Source */}
                <FieldRow label="Referral Source" value={v("referralSource")} onChange={set("referralSource")} canEdit={canEdit} />
                {/* EEC Margin */}
                <FieldRow label="EEC Internal Margin %" value={v("eecMarginPercent")} onChange={set("eecMarginPercent")} canEdit={canEdit} />
                {/* Exclusivity Arrangement */}
                <div>
                  <Label className="text-xs text-slate-500 font-medium">Exclusivity Arrangement</Label>
                  <select
                    value={v("exclusivityArrangement")}
                    onChange={(e) => set("exclusivityArrangement")(e.target.value)}
                    disabled={!canEdit}
                    className="mt-1 w-full h-8 border border-slate-200 rounded-md text-sm px-2 disabled:opacity-60 disabled:bg-slate-50"
                  >
                    <option value="">— Select —</option>
                    <option value="exclusive">Exclusive</option>
                    <option value="non_exclusive">Non-Exclusive</option>
                    <option value="region_exclusive">Region Exclusive</option>
                  </select>
                </div>
                {/* Vetting Score */}
                <div>
                  <Label className="text-xs text-slate-500 font-medium">Vetting / Reliability Score</Label>
                  <select
                    value={fields.vettingScore != null ? String(fields.vettingScore) : ""}
                    onChange={(e) => {
                      setFields((f) => ({ ...f, vettingScore: e.target.value ? Number(e.target.value) : null }));
                      setIsDirty(true);
                    }}
                    disabled={!canEdit}
                    className="mt-1 w-full h-8 border border-slate-200 rounded-md text-sm px-2 disabled:opacity-60 disabled:bg-slate-50"
                  >
                    <option value="">— Not rated —</option>
                    {[1,2,3,4,5].map((n) => (
                      <option key={n} value={n}>{n} — {["Poor","Below Average","Average","Good","Excellent"][n-1]}</option>
                    ))}
                  </select>
                </div>
                {/* Factory Visit Status */}
                <div>
                  <Label className="text-xs text-slate-500 font-medium">Factory Visit Status</Label>
                  <select
                    value={v("factoryVisitStatus")}
                    onChange={(e) => set("factoryVisitStatus")(e.target.value)}
                    disabled={!canEdit}
                    className="mt-1 w-full h-8 border border-slate-200 rounded-md text-sm px-2 disabled:opacity-60 disabled:bg-slate-50"
                  >
                    <option value="">— Select —</option>
                    <option value="not_planned">Not Planned</option>
                    <option value="planned">Planned</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                {/* Factory Visit Date */}
                <FieldRow label="Factory Visit Date" value={v("factoryVisitDate")} onChange={set("factoryVisitDate")} canEdit={canEdit} type="date" />
                {/* Factory Visit Outcome */}
                <div className="col-span-2">
                  <Label className="text-xs text-slate-500 font-medium">Factory Visit Outcome</Label>
                  <Textarea
                    value={v("factoryVisitOutcome")}
                    onChange={(e) => set("factoryVisitOutcome")(e.target.value)}
                    disabled={!canEdit}
                    rows={2}
                    className="mt-1 text-sm"
                    placeholder="Brief summary of visit findings…"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {isDirty && canEdit && (
          <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
            <Button onClick={() => saveMutation.mutate(fields)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save All Changes
            </Button>
          </div>
        )}
      </div>

      {/* ── Form Link Dialog ── */}
      <Dialog open={formLinkOpen} onOpenChange={setFormLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Supplier Form Link</DialogTitle>
          <DialogDescription>
            Share this link with <strong>{supplier.company}</strong> to let them fill in their supplier details.
          </DialogDescription>
          {templates.length > 0 && (
            <div className="mt-3">
              <Label className="text-xs text-slate-500">Form Template (optional)</Label>
              <select
                className="mt-1 w-full border border-slate-200 rounded-md text-sm px-3 py-2"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="">All sections (default)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (Default)" : ""}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">The form will show only the sections enabled in the selected template.</p>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Input readOnly value={formLink ?? ""} className="text-xs font-mono" />
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setFormLinkOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Convert Dialog ── */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Convert to New Supplier?</DialogTitle>
          <DialogDescription>
            <strong>{supplier.company}</strong> will be moved to the New Suppliers list with all data carried over. The sourcing record will be marked as "Converted".
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              disabled={convertMutation.isPending}
              onClick={() => convertMutation.mutate()}
            >
              {convertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Convert
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
