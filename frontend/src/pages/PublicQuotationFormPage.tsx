import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────
interface FieldConfig {
  sentToSupplier: boolean;
  mandatory: boolean;
}

interface QuotationFormData {
  supplierName: string;
  fieldConfig: Record<string, FieldConfig>;
  fields: Record<string, string | null>;
}

// ─── All field definitions ───────────────────────────
const ALL_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "supplierName",           label: "Supplier Name" },
  { key: "supplierWebsite",        label: "Website" },
  { key: "date",                   label: "Date" },
  { key: "hsCode",                 label: "HS Code" },
  { key: "product",                label: "Product" },
  { key: "fclDetails",             label: "FCL Details" },
  { key: "fobSupplierPrice",       label: "FOB — Supplier's Price" },
  { key: "fobCommissionPercent",   label: "FOB — Commission %" },
  { key: "fobWithCommission",      label: "FOB — Price With Commission" },
  { key: "cifSupplierPrice",       label: "CIF — Supplier's Price" },
  { key: "cifWithCommission",      label: "CIF — Price With Commission" },
  { key: "loadability",            label: "Loadability" },
  { key: "packing",                label: "Packing" },
  { key: "paymentTerms",           label: "Payment Terms" },
  { key: "origin",                 label: "Origin" },
  { key: "priceValidity",          label: "Price Validity" },
  { key: "supplierCertifications", label: "Supplier Certifications" },
  { key: "leadTime",               label: "Lead Time" },
  { key: "supplierComments",       label: "Supplier Comments on Specifications", multiline: true },
];

// Public axios instance — same base URL as authenticated client, just no auth header
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
});

export default function PublicQuotationFormPage() {
  const { token } = useParams<{ token: string }>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const {
    data: formData,
    isLoading,
    isError,
    status,
  } = useQuery<QuotationFormData>({
    queryKey: ["public-quotation-form", token],
    queryFn: async () => {
      const res = await publicApi.get(`/public/quotation-form/${token}`);
      return res.data as QuotationFormData;
    },
    enabled: !!token,
    retry: false,
  });

  // Pre-fill existing server values once data arrives (replaces removed onSuccess)
  useEffect(() => {
    if (formData && !prefilled) {
      const initial: Record<string, string> = {};
      for (const [k, v] of Object.entries(formData.fields)) {
        if (v !== null && v !== undefined) initial[k] = String(v);
      }
      setValues(initial);
      setPrefilled(true);
    }
  }, [formData, prefilled]);

  const submitMutation = useMutation({
    mutationFn: () => publicApi.post(`/public/quotation-form/${token}`, values),
    onSuccess: () => setSubmitted(true),
    onError: () => toast.error("Failed to submit. Please try again."),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formData) return;

    const missing: string[] = [];
    for (const field of ALL_FIELDS) {
      const cfg = formData.fieldConfig[field.key];
      if (cfg?.sentToSupplier && cfg?.mandatory && !values[field.key]?.trim()) {
        missing.push(field.label);
      }
    }
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    submitMutation.mutate();
  }

  // ── Loading
  if (isLoading || status === "pending") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // ── Error or no data
  if (isError || !formData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 text-slate-300" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Form Not Found</h2>
          <p className="text-sm text-slate-500">
            This link is invalid or has expired. Please contact the person who shared it with you.
          </p>
        </div>
      </div>
    );
  }

  // ── Success
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="h-14 w-14 mx-auto mb-4 text-green-500" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Quotation Submitted</h2>
          <p className="text-sm text-slate-500">
            Thank you — your quotation details have been received. We'll be in touch shortly.
          </p>
        </div>
      </div>
    );
  }

  // formData is guaranteed defined from here on
  const visibleFields = ALL_FIELDS.filter(
    (f) => formData.fieldConfig[f.key]?.sentToSupplier
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Quotation Request</h1>
          <p className="text-sm text-slate-500 mt-1">
            Please fill in your pricing details for <strong>{formData.supplierName}</strong>.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
        >
          {visibleFields.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No fields have been configured for this form yet.
            </p>
          ) : (
            visibleFields.map((field) => {
              const cfg = formData.fieldConfig[field.key];
              const mandatory = cfg?.mandatory ?? false;
              return (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">
                    {field.label}
                    {mandatory && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  {field.multiline ? (
                    <Textarea
                      rows={3}
                      value={values[field.key] ?? ""}
                      onChange={(e) =>
                        setValues((p) => ({ ...p, [field.key]: e.target.value }))
                      }
                      placeholder={`Enter ${field.label.toLowerCase()}…`}
                      className="resize-none text-sm"
                    />
                  ) : (
                    <Input
                      value={values[field.key] ?? ""}
                      onChange={(e) =>
                        setValues((p) => ({ ...p, [field.key]: e.target.value }))
                      }
                      placeholder={`Enter ${field.label.toLowerCase()}…`}
                      className="text-sm"
                    />
                  )}
                </div>
              );
            })
          )}

          <p className="text-xs text-slate-400 pt-1">
            Fields marked with <span className="text-red-500">*</span> are required.
          </p>

          <Button
            type="submit"
            className="w-full"
            disabled={submitMutation.isPending || visibleFields.length === 0}
          >
            {submitMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Submit Quotation
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by Elan Exports CRM
        </p>
      </div>
    </div>
  );
}
