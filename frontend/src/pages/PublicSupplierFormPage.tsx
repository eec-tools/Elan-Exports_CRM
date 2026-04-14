import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight, Save, Upload, X, FileText, Image, Video } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

// ─── Section Definitions ─────────────────────────────────────────────────────

type Field = { key: string; label: string; type?: "text" | "email" | "textarea"; hint?: string };

const SECTION_DEFS: { key: string; label: string; fields: Field[] }[] = [
  {
    key: "identity",
    label: "Company Identity",
    fields: [
      { key: "company", label: "Company Name" },
      { key: "tradeName", label: "Trade Name" },
      { key: "yearEstablished", label: "Year Established" },
      { key: "manufacturingAddress", label: "Manufacturing Address", type: "textarea" },
      { key: "city", label: "City" },
      { key: "state", label: "State / Province" },
      { key: "postalCode", label: "Postal Code" },
      { key: "supplierType", label: "Supplier Type", hint: "e.g. Manufacturer, Trader, Farm" },
      { key: "country", label: "Country" },
    ],
  },
  {
    key: "contacts",
    label: "Contact Details",
    fields: [
      { key: "contactPerson", label: "Contact Person Name" },
      { key: "email", label: "Email Address", type: "email" },
      { key: "phone", label: "Phone Number" },
      { key: "whatsapp", label: "WhatsApp Number" },
    ],
  },
  {
    key: "products",
    label: "Products",
    fields: [
      { key: "product", label: "Primary Product" },
      { key: "productCategory", label: "Product Category" },
      { key: "hsCode", label: "HS Code" },
      { key: "organicStatus", label: "Organic Status", hint: "e.g. Certified Organic, Conventional" },
      { key: "ingredientList", label: "Ingredient List", type: "textarea" },
      { key: "allergenDeclaration", label: "Allergen Declaration", type: "textarea" },
      { key: "shelfLife", label: "Shelf Life" },
      { key: "storageConditions", label: "Storage Conditions" },
      { key: "packagingType", label: "Packaging Type" },
      { key: "netWeightVariants", label: "Net Weight Variants" },
      { key: "sampleAvailable", label: "Sample Available?", hint: "Yes / No" },
      { key: "sampleLeadTime", label: "Sample Lead Time" },
      { key: "sampleCost", label: "Sample Cost" },
    ],
  },
  {
    key: "production",
    label: "Production Capacity",
    fields: [
      { key: "annualProductionVolume", label: "Annual Production Volume" },
      { key: "avgMonthlyVolume", label: "Avg Monthly Volume" },
      { key: "maxScalableMonthlyVolume", label: "Max Scalable Monthly Volume" },
      { key: "peakSeasonMonths", label: "Peak Season Months" },
      { key: "offSeasonAvailability", label: "Off-Season Availability" },
      { key: "minExportableBatch", label: "Min Exportable Batch" },
      { key: "moq", label: "MOQ" },
      { key: "leadTimeFirstOrder", label: "Lead Time — First Order" },
      { key: "leadTimeRepeatOrder", label: "Lead Time — Repeat Order" },
    ],
  },
  {
    key: "commercial",
    label: "Commercial Terms",
    fields: [
      { key: "incotermsSupported", label: "Incoterms Supported" },
      { key: "portsOfExport", label: "Ports of Export" },
      { key: "targetExportMarkets", label: "Target Export Markets" },
      { key: "currencyPreferred", label: "Currency Preferred" },
      { key: "paymentTerms", label: "Payment Terms" },
    ],
  },
  {
    key: "regulatory",
    label: "Regulatory Compliance",
    fields: [
      { key: "iecNumber", label: "IEC Number" },
      { key: "gstNumber", label: "GST Number" },
      { key: "fssaiLicense", label: "FSSAI License" },
      { key: "apedaNumber", label: "APEDA Number" },
      { key: "fdaRegistrationNumber", label: "FDA Registration Number" },
      { key: "usAgentAppointed", label: "US Agent Appointed?" },
      { key: "tracesNtRegistration", label: "TRACES NT Registration" },
      { key: "coiCapability", label: "CoI Capability" },
      { key: "daffBiosecurity", label: "DAFF Biosecurity" },
      { key: "jasLabelCompliance", label: "JAS Label Compliance" },
    ],
  },
  {
    key: "certifications",
    label: "Certifications & Food Safety",
    fields: [
      { key: "haccpAvailable", label: "HACCP Available?" },
      { key: "isoFsscCertNo", label: "ISO / FSSC Cert No." },
      { key: "isoCertValidityDate", label: "ISO Cert Validity Date" },
      { key: "latestInternalAuditDate", label: "Latest Internal Audit Date" },
      { key: "latestThirdPartyAuditDate", label: "Latest 3rd Party Audit Date" },
      { key: "auditingBodyName", label: "Auditing Body Name" },
    ],
  },
  {
    key: "organic",
    label: "Organic Certification Chain",
    fields: [
      { key: "farmerOrganicCert", label: "Farmer Organic Cert" },
      { key: "aggregatorOrganicCert", label: "Aggregator Organic Cert" },
      { key: "processingUnitOrganicCert", label: "Processing Unit Organic Cert" },
      { key: "certifyingBodyName", label: "Certifying Body Name" },
      { key: "certsValidForExport", label: "Certs Valid for Export?" },
    ],
  },
  {
    key: "labTesting",
    label: "Lab Testing",
    fields: [
      { key: "gmoFreeDeclaration", label: "GMO-Free Declaration" },
      { key: "irradiationFreeDeclaration", label: "Irradiation-Free Declaration" },
      { key: "foodContactCompliance", label: "Food Contact Compliance" },
      { key: "compostabilityCert", label: "Compostability Cert" },
      { key: "migrationTestReport", label: "Migration Test Report" },
    ],
  },
  {
    key: "branding",
    label: "Branding",
    fields: [
      { key: "exportBrand", label: "Export Brand Name" },
      { key: "healthNutritionClaims", label: "Health & Nutrition Claims", type: "textarea" },
      { key: "claimsApprovedMarkets", label: "Claims Approved Markets" },
      { key: "packagingComplianceRegions", label: "Packaging Compliance Regions" },
    ],
  },
  {
    key: "processing",
    label: "Processing Compliance",
    fields: [
      { key: "organicSegregationSop", label: "Organic Segregation SOP" },
      { key: "cleaningLinelearanceSop", label: "Cleaning Line Clearance SOP" },
      { key: "noProhibitedAids", label: "No Prohibited Processing Aids?" },
    ],
  },
  {
    key: "media",
    label: "Media & Documents",
    fields: [], // rendered specially — see MediaSection component below
  },
];

type SectionConfig = { enabled: boolean; requiredFields: string[] };
type TemplateConfig = Record<string, SectionConfig>;

type UploadedFile = { url: string; name: string };

function getActiveSections(templateConfig: TemplateConfig) {
  return SECTION_DEFS.filter((s) => templateConfig[s.key]?.enabled !== false);
}

// ─── MediaSection ─────────────────────────────────────────────────────────────

interface MediaSectionProps {
  token: string;
  productCatalogs: UploadedFile[];
  certificates: UploadedFile[];
  warehousePhotos: UploadedFile[];
  videoLinks: string[];
  onProductCatalogsChange: (files: UploadedFile[]) => void;
  onCertificatesChange: (files: UploadedFile[]) => void;
  onWarehousePhotosChange: (files: UploadedFile[]) => void;
  onVideoLinksChange: (links: string[]) => void;
}

function MediaSection({
  token,
  productCatalogs,
  certificates,
  warehousePhotos,
  videoLinks,
  onProductCatalogsChange,
  onCertificatesChange,
  onWarehousePhotosChange,
  onVideoLinksChange,
}: MediaSectionProps) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [newVideoLink, setNewVideoLink] = useState("");

  const uploadFile = async (
    file: File,
    bucket: string,
    current: UploadedFile[],
    onChange: (files: UploadedFile[]) => void,
  ) => {
    setUploading((u) => ({ ...u, [bucket]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API_BASE}/public/supplier-form/${token}/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange([...current, { url: res.data.url, name: file.name }]);
    } catch {
      // silently fail — user can retry
    }
    setUploading((u) => ({ ...u, [bucket]: false }));
  };

  const removeFile = (arr: UploadedFile[], idx: number, onChange: (f: UploadedFile[]) => void) =>
    onChange(arr.filter((_, i) => i !== idx));

  return (
    <div className="space-y-6">
      {/* Product Catalogs */}
      <UploadBucket
        label="Product Catalogs"
        description="PDF brochures, spec sheets, price lists"
        icon={<FileText className="h-5 w-5 text-brand-500" />}
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        files={productCatalogs}
        uploading={uploading["catalogs"]}
        onUpload={(f) => uploadFile(f, "catalogs", productCatalogs, onProductCatalogsChange)}
        onRemove={(i) => removeFile(productCatalogs, i, onProductCatalogsChange)}
      />

      {/* Certificates */}
      <UploadBucket
        label="Certifications"
        description="Organic certs, food safety certs, audit reports"
        icon={<FileText className="h-5 w-5 text-green-500" />}
        accept=".pdf,.jpg,.jpeg,.png"
        files={certificates}
        uploading={uploading["certs"]}
        onUpload={(f) => uploadFile(f, "certs", certificates, onCertificatesChange)}
        onRemove={(i) => removeFile(certificates, i, onCertificatesChange)}
      />

      {/* Warehouse Photos */}
      <UploadBucket
        label="Warehouse / Facility Photos"
        description="Photos of your production facility, storage, or packaging area"
        icon={<Image className="h-5 w-5 text-amber-500" />}
        accept=".jpg,.jpeg,.png,.webp"
        files={warehousePhotos}
        uploading={uploading["photos"]}
        onUpload={(f) => uploadFile(f, "photos", warehousePhotos, onWarehousePhotosChange)}
        onRemove={(i) => removeFile(warehousePhotos, i, onWarehousePhotosChange)}
      />

      {/* Video Links */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Video className="h-5 w-5 text-purple-500" />
          <Label className="text-sm font-medium text-slate-700">Video Links</Label>
        </div>
        <p className="text-xs text-slate-400 mb-2">YouTube, Vimeo, or direct links to facility/process videos</p>
        <div className="space-y-2">
          {videoLinks.map((link, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={link} readOnly className="text-xs font-mono flex-1 h-8" />
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:bg-red-50" onClick={() => onVideoLinksChange(videoLinks.filter((_, j) => j !== i))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newVideoLink}
              onChange={(e) => setNewVideoLink(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="h-8 text-xs flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newVideoLink.trim()) {
                  onVideoLinksChange([...videoLinks, newVideoLink.trim()]);
                  setNewVideoLink("");
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={!newVideoLink.trim()}
              onClick={() => {
                onVideoLinksChange([...videoLinks, newVideoLink.trim()]);
                setNewVideoLink("");
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface UploadBucketProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  accept: string;
  files: UploadedFile[];
  uploading?: boolean;
  onUpload: (f: File) => void;
  onRemove: (i: number) => void;
}

function UploadBucket({ label, description, icon, accept, files, uploading, onUpload, onRemove }: UploadBucketProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <Label className="text-sm font-medium text-slate-700">{label}</Label>
      </div>
      <p className="text-xs text-slate-400 mb-2">{description}</p>
      <div className="space-y-1.5">
        {files.map((f, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-50 rounded px-3 py-1.5 text-xs">
            <span className="flex-1 truncate text-slate-700">{f.name}</span>
            <a href={f.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline shrink-0">View</a>
            <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-600 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <label className={`flex items-center gap-2 border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors ${uploading ? "border-brand-300 bg-brand-50" : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/40"}`}>
          {uploading
            ? <><Loader2 className="h-4 w-4 animate-spin text-brand-500" /><span className="text-sm text-brand-600">Uploading…</span></>
            : <><Upload className="h-4 w-4 text-slate-400" /><span className="text-sm text-slate-500">Click to upload</span><span className="text-xs text-slate-400">({accept})</span></>
          }
          <input
            type="file"
            className="hidden"
            accept={accept}
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); e.target.value = ""; } }}
          />
        </label>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PublicSupplierFormPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>({});
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Media upload state
  const [productCatalogs, setProductCatalogs] = useState<UploadedFile[]>([]);
  const [certificates, setCertificates] = useState<UploadedFile[]>([]);
  const [warehousePhotos, setWarehousePhotos] = useState<UploadedFile[]>([]);
  const [videoLinks, setVideoLinks] = useState<string[]>([]);

  // Load form data on mount
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_BASE}/public/supplier-form/${token}${searchParams.get("t") ? `?t=${searchParams.get("t")}` : ""}`)
      .then((res) => {
        const { company: c, templateConfig: tc, formData: fd } = res.data;
        setCompany(c ?? "");
        setTemplateConfig(tc ?? {});
        const flatData: Record<string, string> = {};
        for (const [k, v] of Object.entries(fd ?? {})) {
          if (typeof v === "string") flatData[k] = v;
        }
        setFormData(flatData);
        // Pre-populate media arrays from existing data
        const raw = fd ?? {};
        if (Array.isArray(raw.productCatalogs)) setProductCatalogs(raw.productCatalogs);
        if (Array.isArray(raw.certificates)) setCertificates(raw.certificates);
        if (Array.isArray(raw.warehousePhotos)) setWarehousePhotos(raw.warehousePhotos);
        if (Array.isArray(raw.videoLinks)) setVideoLinks(raw.videoLinks.map((v: any) => typeof v === "string" ? v : v?.url ?? "").filter(Boolean));
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.error ?? "Failed to load the form. The link may be invalid.");
        setLoading(false);
      });
  }, [token]);

  const activeSections = getActiveSections(templateConfig);
  const currentSection = activeSections[activeSectionIdx];
  const requiredFields = templateConfig[currentSection?.key]?.requiredFields ?? [];

  const field = (key: string) => formData[key] ?? "";
  const setField = (key: string, value: string) => setFormData((f) => ({ ...f, [key]: value }));

  const sectionComplete = (sectionKey: string) => {
    const required = templateConfig[sectionKey]?.requiredFields ?? [];
    return required.every((f) => (formData[f] ?? "").trim() !== "");
  };

  const totalSections = activeSections.length;
  const completedSections = activeSections.filter((s) => sectionComplete(s.key)).length;
  const progressPct = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;


  const allFields = () => ({
    ...formData,
    productCatalogs,
    certificates,
    warehousePhotos,
    videoLinks,
  });

  const saveProgress = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/public/supplier-form/${token}`, { fields: allFields() });
    } catch (_) {
      // Silent — progress saved in background
    }
    setSaving(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/public/supplier-form/${token}`, { fields: allFields() });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Submission failed. Please try again.");
    }
    setSaving(false);
  };

  // ─── Loading / Error / Success states ───────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl font-bold">!</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Link Not Found</h2>
          <p className="text-slate-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800">Thank You!</h2>
          <p className="text-slate-500 text-sm mt-2">
            Your supplier details for <strong>{company}</strong> have been received. Our team will review them and be in touch.
          </p>
        </div>
      </div>
    );
  }

  if (activeSections.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-slate-500">No form sections have been configured. Please contact the team.</p>
        </div>
      </div>
    );
  }

  // ─── Main Form UI ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-medium tracking-wide">Supplier Profile Form</p>
            <h1 className="text-lg font-bold text-slate-900">{company}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Progress</p>
            <p className="text-sm font-semibold text-slate-700">{progressPct}% complete</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-2">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Section tabs (scrollable) */}
      <div className="bg-white border-b border-slate-100 overflow-x-auto">
        <div className="max-w-2xl mx-auto flex gap-1 px-4 py-2">
          {activeSections.map((s, idx) => {
            const done = sectionComplete(s.key);
            const active = idx === activeSectionIdx;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSectionIdx(idx)}
                className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1 ${
                  active
                    ? "bg-brand-600 text-white"
                    : done
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {done && !active && <CheckCircle2 className="h-3 w-3" />}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form content */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">{currentSection.label}</h2>
          {requiredFields.length > 0 && (
            <p className="text-xs text-slate-400 mb-4">Fields marked with * are required</p>
          )}

          {currentSection.key === "media" ? (
            <MediaSection
              token={token!}
              productCatalogs={productCatalogs}
              certificates={certificates}
              warehousePhotos={warehousePhotos}
              videoLinks={videoLinks}
              onProductCatalogsChange={setProductCatalogs}
              onCertificatesChange={setCertificates}
              onWarehousePhotosChange={setWarehousePhotos}
              onVideoLinksChange={setVideoLinks}
            />
          ) : (
            <div className="space-y-4">
              {currentSection.fields.map((f) => {
                const isRequired = requiredFields.includes(f.key);
                return (
                  <div key={f.key}>
                    <Label className="text-sm font-medium text-slate-700">
                      {f.label}{isRequired ? " *" : ""}
                    </Label>
                    {f.hint && <p className="text-xs text-slate-400">{f.hint}</p>}
                    {f.type === "textarea" ? (
                      <Textarea
                        value={field(f.key)}
                        onChange={(e) => setField(f.key, e.target.value)}
                        rows={3}
                        className="mt-1"
                        placeholder={`Enter ${f.label.toLowerCase()}...`}
                      />
                    ) : (
                      <Input
                        type={f.type ?? "text"}
                        value={field(f.key)}
                        onChange={(e) => setField(f.key, e.target.value)}
                        className="mt-1"
                        placeholder={`Enter ${f.label.toLowerCase()}...`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveSectionIdx((i) => i - 1)}
            disabled={activeSectionIdx === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={saveProgress}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Progress
            </Button>

            {activeSectionIdx < totalSections - 1 ? (
              <Button
                size="sm"
                onClick={() => {
                  saveProgress();
                  setActiveSectionIdx((i) => i + 1);
                }}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Submit
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Your information is securely stored and only shared with the EEC Export team.
        </p>
      </div>
    </div>
  );
}
