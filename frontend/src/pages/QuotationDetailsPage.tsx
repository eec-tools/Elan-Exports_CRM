import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { copyToClipboard } from "@/lib/utils";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  FileDown,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Search,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────
interface FieldConfig {
  sentToSupplier: boolean;
  mandatory: boolean;
}

interface BuyerSpecs {
  targetPrice?: string;
  specs?: string;
  requiredCertifications?: string;
  notes?: string;
}

interface BuyerSuggestion {
  id: string;
  company: string;
  name: string;
  country: string;
}

interface Quotation {
  id: string;
  formToken?: string;
  status: string;
  linkedSupplierId?: string;
  linkedSupplierType?: string;
  supplierName: string;
  supplierWebsite?: string;
  fieldConfig: Record<string, FieldConfig>;
  fieldSources: Record<string, "supplier" | "internal">;
  buyerId?: string;
  buyerName?: string;
  quotedPrice?: string;
  currency?: string;
  validUntil?: string;
  linkedDealId?: string;
  date?: string;
  hsCode?: string;
  product?: string;
  fclDetails?: string;
  fobSupplierPrice?: string;
  fobCommissionPercent?: string;
  fobWithCommission?: string;
  cifSupplierPrice?: string;
  cifWithCommission?: string;
  loadability?: string;
  packing?: string;
  paymentTerms?: string;
  origin?: string;
  priceValidity?: string;
  supplierCertifications?: string;
  leadTime?: string;
  supplierComments?: string;
  quantityDetails?: string;
  monthlyVolume?: string;
  yearlyVolume?: string;
  palette?: string;
  buyerSpecifications?: BuyerSpecs;
  createdAt: string;
  updatedAt: string;
}

// ─── All fields ordered ──────────────────────────────
const QUOTATION_FIELDS: { key: keyof Quotation; label: string }[] = [
  { key: "supplierName", label: "Supplier" },
  { key: "supplierWebsite", label: "Website" },
  { key: "date", label: "Date" },
  { key: "hsCode", label: "HS Code" },
  { key: "product", label: "Product" },
  { key: "fclDetails", label: "FCL Details" },
  { key: "fobSupplierPrice", label: "FOB — Supplier's Price" },
  { key: "fobCommissionPercent", label: "FOB — Commission %" },
  { key: "fobWithCommission", label: "FOB — With Commission" },
  { key: "cifSupplierPrice", label: "CIF — Supplier's Price" },
  { key: "cifWithCommission", label: "CIF — With Commission" },
  { key: "loadability", label: "Loadability" },
  { key: "packing", label: "Packing" },
  { key: "paymentTerms", label: "Payment Terms" },
  { key: "origin", label: "Origin" },
  { key: "priceValidity", label: "Price Validity" },
  { key: "supplierCertifications", label: "Supplier Certifications" },
  { key: "leadTime", label: "Lead Time" },
  { key: "supplierComments", label: "Supplier Comments on Specs" },
  { key: "quantityDetails", label: "Quantity Details" },
  { key: "monthlyVolume", label: "Monthly Volume" },
  { key: "yearlyVolume", label: "Yearly Volume" },
  { key: "palette", label: "Palette" },
];

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending:           { label: "Pending",     class: "bg-slate-100 text-slate-700" },
  form_sent:         { label: "Form Sent",   class: "bg-blue-100 text-blue-700" },
  response_received: { label: "Responded",   class: "bg-green-100 text-green-700" },
  negotiating:       { label: "Negotiating", class: "bg-amber-100 text-amber-700" },
  finalized:         { label: "Finalized",   class: "bg-purple-100 text-purple-700" },
};

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "INR", "CNY", "JPY", "SGD", "AUD", "CAD"];

function isExpired(validUntil?: string) {
  if (!validUntil) return false;
  return new Date(validUntil) < new Date();
}

function isExpiringSoon(validUntil?: string) {
  if (!validUntil) return false;
  const d = new Date(validUntil);
  const now = new Date();
  const sevenDays = new Date();
  sevenDays.setDate(now.getDate() + 7);
  return d >= now && d <= sevenDays;
}

export default function QuotationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission("suppliers") || hasEditPermission("quotations");

  const [localFields, setLocalFields] = useState<Record<string, string>>({});
  const [localBuyerSpecs, setLocalBuyerSpecs] = useState<BuyerSpecs>({});
  const [localCurrency, setLocalCurrency] = useState("");
  const [localValidUntil, setLocalValidUntil] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<Record<string, FieldConfig>>({});
  const [formLinkDialog, setFormLinkDialog] = useState(false);
  const [convertConfirmOpen, setConvertConfirmOpen] = useState(false);

  // Buyer search state for details page
  const [buyerQuery, setBuyerQuery] = useState("");
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerSuggestion | null>(null);
  const buyerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (buyerDropdownRef.current && !buyerDropdownRef.current.contains(e.target as Node)) {
        setShowBuyerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: quotation, isLoading } = useQuery<Quotation>({
    queryKey: ["quotation", id],
    queryFn: async () => {
      const res = await api.get(`/quotations/${id}`);
      return res.data as Quotation;
    },
  });

  const { data: buyerSuggestions = [] } = useQuery({
    queryKey: ["quotation-buyer-search-detail", buyerQuery],
    queryFn: async () => {
      if (!buyerQuery.trim()) return [];
      const res = await api.get(`/quotations/search-buyers?q=${encodeURIComponent(buyerQuery)}`);
      return res.data as BuyerSuggestion[];
    },
    enabled: buyerQuery.length > 0,
  });

  useEffect(() => {
    if (quotation) {
      setLocalBuyerSpecs(quotation.buyerSpecifications ?? {});
      setLocalConfig(quotation.fieldConfig ?? {});
      setLocalCurrency(quotation.currency ?? "USD");
      setLocalValidUntil(
        quotation.validUntil ? quotation.validUntil.slice(0, 10) : ""
      );
      if (quotation.buyerId) {
        setBuyerQuery(quotation.buyerName ?? "");
      }
    }
  }, [quotation?.id]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put(`/quotations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation", id] });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      setIsDirty(false);
      toast.success("Saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  const regenerateTokenMutation = useMutation({
    mutationFn: () => api.post(`/quotations/${id}/regenerate-token`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["quotation", id] });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("New form link generated");
      const newToken = res.data?.formToken;
      if (newToken) setFormLinkDialog(true);
      else setFormLinkDialog(true);
    },
    onError: () => toast.error("Failed to regenerate link"),
  });

  const convertToDealMutation = useMutation({
    mutationFn: () => api.post(`/quotations/${id}/convert-to-deal`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["quotation", id] });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      setConvertConfirmOpen(false);
      const deal = res.data?.deal;
      toast.success(`Deal created: ${deal?.title ?? "Deal"}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? "Failed to convert to deal");
    },
  });

  const handleCopyLink = async (link: string | null) => {
    if (!link) { toast.error("Link not available"); return; }
    const success = await copyToClipboard(link);
    if (success) toast.success("Link copied to clipboard");
    else toast.error("Failed to copy link. Please copy it manually.");
  };

  async function downloadPdf(mode: "supplier" | "all") {
    try {
      const res = await api.get(`/quotations/${id}/export-pdf?mode=${mode}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quotation_${quotation?.supplierName?.replace(/\s+/g, "_") ?? id}_${mode}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export PDF");
    }
  }

  function handleFieldChange(key: string, value: string) {
    setLocalFields((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }

  function handleBuyerSpecChange(key: keyof BuyerSpecs, value: string) {
    setLocalBuyerSpecs((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }

  function handleSave() {
    updateMutation.mutate({
      ...localFields,
      buyerSpecifications: localBuyerSpecs,
      currency: localCurrency,
      validUntil: localValidUntil || null,
      ...(selectedBuyer ? { buyerId: selectedBuyer.id, buyerName: selectedBuyer.company } : {}),
    });
  }

  function handleSaveConfig() {
    updateMutation.mutate({ fieldConfig: localConfig }, { onSuccess: () => setConfigOpen(false) });
  }

  function handleStageTransition(newStatus: string) {
    updateMutation.mutate({ status: newStatus });
  }

  function toggleConfigSent(key: string, value: boolean) {
    setLocalConfig((prev) => ({
      ...prev,
      [key]: { sentToSupplier: value, mandatory: value ? (prev[key]?.mandatory ?? false) : false },
    }));
  }

  function toggleConfigMandatory(key: string, value: boolean) {
    setLocalConfig((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { sentToSupplier: true }), mandatory: value },
    }));
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!quotation) {
    return <div className="p-6 text-center text-slate-500">Quotation not found.</div>;
  }

  const statusCfg = STATUS_CONFIG[quotation.status] ?? { label: quotation.status, class: "bg-slate-100 text-slate-700" };
  const formLink = quotation.formToken ? `${window.location.origin}/quotation-form/${quotation.formToken}` : null;
  const fieldConfig = quotation.fieldConfig ?? {};
  const fieldSources = quotation.fieldSources ?? {};
  const expired = isExpired(quotation.validUntil);
  const expiringSoon = !expired && isExpiringSoon(quotation.validUntil);
  const canConvert = ["response_received", "negotiating", "finalized"].includes(quotation.status);

  const getFieldValue = (key: string): string =>
    localFields[key] !== undefined
      ? localFields[key]
      : (((quotation as unknown as Record<string, unknown>)[key] as string) ?? "");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/quotations")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{quotation.supplierName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.class}`}>
                {statusCfg.label}
              </span>
              {quotation.linkedSupplierType && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${quotation.linkedSupplierType === "signed" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                  {quotation.linkedSupplierType === "signed" ? "Signed Supplier" : "New Supplier"}
                </span>
              )}
              {expired && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                  <AlertCircle className="h-3 w-3" /> Expired
                </span>
              )}
              {expiringSoon && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                  <AlertCircle className="h-3 w-3" /> Expiring soon
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && canConvert && !quotation.linkedDealId && (
            <Button
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setConvertConfirmOpen(true)}
            >
              <TrendingUp className="h-4 w-4" /> Convert to Deal
            </Button>
          )}
          {quotation.linkedDealId && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-green-700 border-green-300"
              onClick={() => navigate(`/deals`)}
            >
              <Link2 className="h-4 w-4" /> View Linked Deal
            </Button>
          )}
          {formLink && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => handleCopyLink(formLink)}>
              <Copy className="h-4 w-4" /> Copy Form Link
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <FileDown className="h-4 w-4" /> Export PDF <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadPdf("supplier")}>
                <FileDown className="h-4 w-4 mr-2" /> Supplier View (sent fields only)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadPdf("all")}>
                <FileDown className="h-4 w-4 mr-2" /> Full View (all fields)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canEdit && isDirty && (
            <Button size="sm" className="gap-2" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Quotation Fields ──────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Internal Summary Fields */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Quote Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Buyer */}
              <div className="sm:col-span-3 space-y-1" ref={buyerDropdownRef}>
                <Label className="text-xs font-medium text-slate-600">Buyer <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9 text-sm"
                    placeholder="Search buyers…"
                    disabled={!canEdit}
                    value={selectedBuyer ? selectedBuyer.company : buyerQuery}
                    onChange={(e) => {
                      setSelectedBuyer(null);
                      setBuyerQuery(e.target.value);
                      setShowBuyerDropdown(true);
                      setIsDirty(true);
                    }}
                    onFocus={() => { if (buyerQuery) setShowBuyerDropdown(true); }}
                  />
                  {showBuyerDropdown && buyerSuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {buyerSuggestions.map((b) => (
                        <button
                          key={b.id}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between"
                          onClick={() => {
                            setSelectedBuyer(b);
                            setBuyerQuery(b.company);
                            setShowBuyerDropdown(false);
                            setIsDirty(true);
                          }}
                        >
                          <span className="font-medium text-slate-800">{b.company}</span>
                          <span className="text-xs text-slate-500">{b.country}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {(quotation.buyerName && !selectedBuyer) && (
                  <p className="text-xs text-slate-500">Current: <span className="font-medium text-slate-700">{quotation.buyerName}</span></p>
                )}
              </div>

              {/* Currency */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-600">Currency <span className="text-red-500">*</span></Label>
                <select
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={localCurrency}
                  disabled={!canEdit}
                  onChange={(e) => { setLocalCurrency(e.target.value); setIsDirty(true); }}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Quoted Price */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-600">Quoted Price <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={getFieldValue("quotedPrice")}
                  onChange={(e) => handleFieldChange("quotedPrice", e.target.value)}
                  disabled={!canEdit}
                  className="text-sm"
                  placeholder="e.g. 4.50"
                />
              </div>

              {/* Valid Until */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-600">Valid Until <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={localValidUntil}
                  onChange={(e) => { setLocalValidUntil(e.target.value); setIsDirty(true); }}
                  disabled={!canEdit}
                  className={`text-sm ${expired ? "border-red-400" : ""}`}
                />
                {expired && <p className="text-xs text-red-600 font-medium">This quotation has expired.</p>}
                {expiringSoon && <p className="text-xs text-amber-600 font-medium">Expiring within 7 days.</p>}
              </div>

              {/* Linked Deal (read-only) */}
              {quotation.linkedDealId && (
                <div className="sm:col-span-3 space-y-1">
                  <Label className="text-xs font-medium text-slate-600">Linked Deal</Label>
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    <Link2 className="h-4 w-4 shrink-0" />
                    <span>Deal created from this quotation</span>
                    <button className="ml-auto text-xs underline hover:no-underline" onClick={() => navigate("/deals")}>
                      View in Deals
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quotation Fields */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Quotation Fields</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {QUOTATION_FIELDS.map(({ key, label }) => {
                const k = key as string;
                const cfg = fieldConfig[k];
                const sentToSupplier = cfg?.sentToSupplier ?? true;
                const filledBySupplier = fieldSources[k] === "supplier";

                return (
                  <div key={k} className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Label className="text-xs font-medium text-slate-600">{label}</Label>
                      {cfg?.mandatory && sentToSupplier && (
                        <span className="text-red-500 text-xs font-bold">*</span>
                      )}
                      {!sentToSupplier && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="h-2.5 w-2.5" /> Not sent to supplier
                        </span>
                      )}
                      {filledBySupplier && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle2 className="h-2.5 w-2.5" /> By supplier
                        </span>
                      )}
                    </div>
                    {key === "supplierComments" ? (
                      <Textarea rows={3} value={getFieldValue(k)} onChange={(e) => handleFieldChange(k, e.target.value)} disabled={!canEdit} className="text-sm resize-none" />
                    ) : key === "palette" ? (
                      <select
                        value={getFieldValue(k)}
                        onChange={(e) => handleFieldChange(k, e.target.value)}
                        disabled={!canEdit}
                        className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">— Select —</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    ) : (
                      <Input value={getFieldValue(k)} onChange={(e) => handleFieldChange(k, e.target.value)} disabled={!canEdit} className="text-sm" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Buyer's Specifications */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-slate-700">Buyer's Specifications</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                Internal Only — Never sent to supplier
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(["targetPrice", "requiredCertifications"] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">{k === "targetPrice" ? "Target Price" : "Required Certifications"}</Label>
                  <Input value={localBuyerSpecs[k] ?? ""} onChange={(e) => handleBuyerSpecChange(k, e.target.value)} disabled={!canEdit} className="text-sm" />
                </div>
              ))}
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-medium text-slate-600">Specifications / Requirements</Label>
                <Textarea rows={3} value={localBuyerSpecs.specs ?? ""} onChange={(e) => handleBuyerSpecChange("specs", e.target.value)} disabled={!canEdit} className="text-sm resize-none" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-medium text-slate-600">Notes</Label>
                <Textarea rows={2} value={localBuyerSpecs.notes ?? ""} onChange={(e) => handleBuyerSpecChange("notes", e.target.value)} disabled={!canEdit} className="text-sm resize-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Status + Config + Form Link ─────── */}
        <div className="space-y-4">

          {/* Stage Workflow */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <Label className="text-xs font-semibold text-slate-600 mb-3 block">Stage</Label>
            <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${statusCfg.class} mb-3`}>
              {statusCfg.label}
            </div>

            {canEdit && (
              <div className="space-y-2">
                {/* Pending → Form Sent: handled by Regenerate Token */}
                {quotation.status === "pending" && (
                  <p className="text-xs text-slate-400">Send the form link to the supplier to advance this stage.</p>
                )}
                {/* Form Sent → Responded: auto on submit; show info */}
                {quotation.status === "form_sent" && (
                  <p className="text-xs text-slate-400">Waiting for supplier to submit the form. Stage advances automatically on submission.</p>
                )}
                {/* Responded → Negotiating */}
                {quotation.status === "response_received" && (
                  <Button
                    size="sm"
                    className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={() => handleStageTransition("negotiating")}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                    Move to Negotiating
                  </Button>
                )}
                {/* Negotiating → Finalized */}
                {quotation.status === "negotiating" && (
                  <Button
                    size="sm"
                    className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => handleStageTransition("finalized")}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Finalize Quotation
                  </Button>
                )}
                {quotation.status === "finalized" && (
                  <p className="text-xs text-slate-400">This quotation is finalized.</p>
                )}
                {/* Always allow manual override via dropdown */}
                <details className="mt-1">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Override stage manually</summary>
                  <select
                    className="mt-2 w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={localFields["status"] ?? quotation.status}
                    onChange={(e) => handleFieldChange("status", e.target.value)}
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </details>
              </div>
            )}
          </div>

          {/* Form Link */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Supplier Form Link</h3>
            {formLink ? (
              <>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs font-mono text-slate-700 break-all">{formLink}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => handleCopyLink(formLink)}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(formLink, "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {canEdit && (
                  <Button size="sm" variant="ghost" className="w-full gap-2 text-slate-500" disabled={regenerateTokenMutation.isPending} onClick={() => regenerateTokenMutation.mutate()}>
                    {regenerateTokenMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Regenerate Link (re-send)
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">No form link generated.</p>
            )}
          </div>

          {/* Field Configuration summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Field Configuration</h3>
              {canEdit && (
                <Button size="sm" variant="ghost" className="gap-1.5 text-slate-500 h-7 text-xs" onClick={() => { setLocalConfig({ ...fieldConfig }); setConfigOpen(true); }}>
                  <Edit3 className="h-3 w-3" /> Edit
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              {QUOTATION_FIELDS.map(({ key, label }) => {
                const k = key as string;
                const cfg = fieldConfig[k];
                const sent = cfg?.sentToSupplier ?? true;
                return (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 truncate">{label}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {sent ? (
                        <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Sent</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Internal</span>
                      )}
                      {cfg?.mandatory && (
                        <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Req</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Details</h3>
            <div className="text-xs text-slate-500 space-y-1">
              <p><span className="font-medium text-slate-600">Created:</span> {new Date(quotation.createdAt).toLocaleString()}</p>
              <p><span className="font-medium text-slate-600">Updated:</span> {new Date(quotation.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Edit Field Config Dialog ─────────────────── */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Edit Field Configuration</DialogTitle>
          <DialogDescription>
            Update which fields appear in the supplier's web form. Regenerate the link after saving so the supplier sees the updated form.
          </DialogDescription>
          <div className="border border-slate-200 rounded-lg overflow-hidden mt-3">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Field</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-center w-36">Send to Supplier</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-center w-28">Mandatory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {QUOTATION_FIELDS.map(({ key, label }) => {
                  const k = key as string;
                  const cfg = localConfig[k] ?? { sentToSupplier: true, mandatory: false };
                  return (
                    <tr key={k} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-slate-700 font-medium">{label}</td>
                      <td className="px-3 py-2.5 text-center">
                        <Switch checked={cfg.sentToSupplier} onCheckedChange={(v: boolean) => toggleConfigSent(k, v)} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Switch checked={cfg.mandatory} disabled={!cfg.sentToSupplier} onCheckedChange={(v: boolean) => toggleConfigMandatory(k, v)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Regenerated Link Dialog ─────────────────── */}
      <Dialog open={formLinkDialog} onOpenChange={setFormLinkDialog}>
        <DialogContent className="max-w-md">
          <DialogTitle>New Form Link Generated</DialogTitle>
          <DialogDescription>
            Share this updated link with <strong>{quotation.supplierName}</strong> for the next negotiation round.
          </DialogDescription>
          <div className="space-y-4 pt-2">
            {formLink && (
              <>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs font-mono text-slate-800 break-all">{formLink}</p>
                </div>
                <Button className="w-full gap-2" onClick={() => handleCopyLink(formLink)}>
                  <Copy className="h-4 w-4" /> Copy Link
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Convert to Deal Confirm ──────────────────── */}
      <Dialog open={convertConfirmOpen} onOpenChange={setConvertConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Convert to Deal</DialogTitle>
          <DialogDescription>
            This will create a new Deal pre-filled with the supplier, buyer, product, and quoted price from this quotation. The quotation will remain linked to the deal.
          </DialogDescription>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setConvertConfirmOpen(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={convertToDealMutation.isPending}
              onClick={() => convertToDealMutation.mutate()}
            >
              {convertToDealMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Convert to Deal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
