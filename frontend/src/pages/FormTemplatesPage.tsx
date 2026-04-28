import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Star,
  LayoutTemplate,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { PermissionGate } from "@/components/PermissionGate";

const SECTIONS = [
  {
    key: "identity",
    label: "Section 1 — Identity",
    fields: [
      "company",
      "tradeName",
      "yearEstablished",
      "manufacturingAddress",
      "city",
      "state",
      "postalCode",
      "supplierType",
    ],
  },
  {
    key: "contacts",
    label: "Section 2 — Contacts",
    fields: ["email", "phone", "whatsapp", "contactPerson"],
  },
  {
    key: "products",
    label: "Section 3 — Products",
    fields: [
      "hsCode",
      "organicStatus",
      "ingredientList",
      "allergenDeclaration",
      "shelfLife",
      "storageConditions",
      "packagingType",
      "netWeightVariants",
      "sampleAvailable",
      "sampleLeadTime",
      "sampleCost",
    ],
  },
  {
    key: "production",
    label: "Section 4 — Production",
    fields: [
      "annualProductionVolume",
      "avgMonthlyVolume",
      "maxScalableMonthlyVolume",
      "peakSeasonMonths",
      "offSeasonAvailability",
      "minExportableBatch",
      "moq",
      "leadTimeFirstOrder",
      "leadTimeRepeatOrder",
    ],
  },
  {
    key: "commercial",
    label: "Section 5 — Commercial",
    fields: [
      "incotermsSupported",
      "portsOfExport",
      "targetExportMarkets",
      "currencyPreferred",
      "paymentTerms",
    ],
  },
  {
    key: "regulatory",
    label: "Section 6 — Regulatory",
    fields: [
      "iecNumber",
      "gstNumber",
      "fssaiLicense",
      "apedaNumber",
      "fdaRegistrationNumber",
      "usAgentAppointed",
      "tracesNtRegistration",
      "coiCapability",
      "daffBiosecurity",
      "jasLabelCompliance",
    ],
  },
  {
    key: "certifications",
    label: "Section 7 — Certifications",
    fields: [
      "haccpAvailable",
      "isoFsscCertNo",
      "isoCertValidityDate",
      "latestInternalAuditDate",
      "latestThirdPartyAuditDate",
      "auditingBodyName",
    ],
  },
  {
    key: "organic",
    label: "Section 8 — Organic Certification",
    fields: [
      "farmerOrganicCert",
      "aggregatorOrganicCert",
      "processingUnitOrganicCert",
      "certifyingBodyName",
      "certsValidForExport",
    ],
  },
  {
    key: "labTesting",
    label: "Section 9 — Lab Testing",
    fields: [
      "gmoFreeDeclaration",
      "irradiationFreeDeclaration",
      "foodContactCompliance",
      "compostabilityCert",
      "migrationTestReport",
    ],
  },
  {
    key: "branding",
    label: "Section 10 — Branding",
    fields: [
      "exportBrand",
      "healthNutritionClaims",
      "claimsApprovedMarkets",
      "packagingComplianceRegions",
    ],
  },
  {
    key: "processing",
    label: "Section 11 — Processing",
    fields: [
      "organicSegregationSop",
      "cleaningLinelearanceSop",
      "noProhibitedAids",
    ],
  },
  {
    key: "media",
    label: "Section 12 — Media & Documents",
    fields: [
      "productCatalogs",
      "certificates",
      "warehousePhotos",
      "videoLinks",
    ],
  },
];

type SectionConfig = { enabled: boolean; requiredFields: string[] };
type TemplateConfig = Record<string, SectionConfig>;

function emptyConfig(): TemplateConfig {
  const cfg: TemplateConfig = {};
  for (const s of SECTIONS) {
    cfg[s.key] = { enabled: false, requiredFields: [] };
  }
  // Default: identity + contacts + products enabled
  cfg["identity"].enabled = true;
  cfg["contacts"].enabled = true;
  cfg["products"].enabled = true;
  return cfg;
}

interface FormTemplate {
  id: string;
  name: string;
  config: TemplateConfig;
  isDefault: boolean;
  createdAt: string;
}

export default function FormTemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasEditPermission } = useAuth();
  const canEdit =
    hasEditPermission("suppliers") || hasEditPermission("new_suppliers");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(
    null,
  );
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [config, setConfig] = useState<TemplateConfig>(emptyConfig());
  const [deleteTarget, setDeleteTarget] = useState<FormTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["supplier-form-templates"],
    queryFn: async () => {
      const res = await api.get("/supplier-form-templates");
      return res.data as FormTemplate[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: {
      name: string;
      config: TemplateConfig;
      isDefault: boolean;
    }) =>
      editingTemplate
        ? api.put(`/supplier-form-templates/${editingTemplate.id}`, data)
        : api.post("/supplier-form-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-form-templates"] });
      setEditorOpen(false);
      toast.success(editingTemplate ? "Template updated" : "Template created");
    },
    onError: () => toast.error("Failed to save template"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/supplier-form-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-form-templates"] });
      setDeleteTarget(null);
      toast.success("Template deleted");
    },
    onError: () => toast.error("Failed to delete template"),
  });

  const openCreate = () => {
    setEditingTemplate(null);
    setName("");
    setIsDefault(false);
    setConfig(emptyConfig());
    setEditorOpen(true);
  };

  const openEdit = (t: FormTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setIsDefault(t.isDefault);
    setConfig({ ...emptyConfig(), ...t.config });
    setEditorOpen(true);
  };

  const toggleSection = (key: string) => {
    setConfig((c) => ({
      ...c,
      [key]: { ...c[key], enabled: !c[key].enabled },
    }));
  };

  const toggleRequired = (sectionKey: string, field: string) => {
    setConfig((c) => {
      const section = c[sectionKey];
      const already = section.requiredFields.includes(field);
      return {
        ...c,
        [sectionKey]: {
          ...section,
          requiredFields: already
            ? section.requiredFields.filter((f) => f !== field)
            : [...section.requiredFields, field],
        },
      };
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Form Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure which sections appear in the public supplier form.
            Templates control what the supplier sees.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/suppliers/sourcing")}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <PermissionGate permission="new_suppliers" editOnly>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Template
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <LayoutTemplate className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">No templates yet</p>
          <p className="text-sm mt-1">
            Create your first template to control what the public form shows
          </p>
          {canEdit && (
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => {
            const enabledSections = SECTIONS.filter(
              (s) => t.config[s.key]?.enabled,
            );
            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="h-4 w-4 text-brand-600" />
                    <h3 className="font-semibold text-slate-800">{t.name}</h3>
                    {t.isDefault && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                        <Star className="h-3 w-3" />
                        Default
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium">
                    Enabled sections ({enabledSections.length}):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {enabledSections.map((s) => (
                      <span
                        key={s.key}
                        className="text-xs bg-brand-50 text-brand-700 rounded px-1.5 py-0.5"
                      >
                        {s.label.split("—")[1]?.trim() ?? s.label}
                      </span>
                    ))}
                    {enabledSections.length === 0 && (
                      <span className="text-xs text-slate-400">
                        No sections enabled
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Template Editor Dialog ── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogTitle>
            {editingTemplate ? "Edit Template" : "Create Template"}
          </DialogTitle>
          <DialogDescription>
            Choose which sections appear in the public supplier form. You can
            also mark individual fields as required.
          </DialogDescription>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Template Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Basic Intro Form"
                  className="mt-1"
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="isDefault" className="cursor-pointer">
                  Set as default template
                </Label>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">
                Form Sections
              </p>
              {SECTIONS.map((section) => {
                const sectionCfg = config[section.key] ?? {
                  enabled: false,
                  requiredFields: [],
                };
                return (
                  <div
                    key={section.key}
                    className={`border rounded-lg p-3 transition-colors ${sectionCfg.enabled ? "border-brand-200 bg-brand-50/30" : "border-slate-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`section-${section.key}`}
                        checked={sectionCfg.enabled}
                        onChange={() => toggleSection(section.key)}
                        className="h-4 w-4"
                      />
                      <Label
                        htmlFor={`section-${section.key}`}
                        className="cursor-pointer font-medium text-sm"
                      >
                        {section.label}
                      </Label>
                    </div>

                    {sectionCfg.enabled && (
                      <div className="mt-2 pl-7">
                        <p className="text-xs text-slate-500 mb-1.5">
                          Mark as required:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {section.fields.map((field) => {
                            const required =
                              sectionCfg.requiredFields.includes(field);
                            return (
                              <button
                                key={field}
                                onClick={() =>
                                  toggleRequired(section.key, field)
                                }
                                className={`text-xs rounded px-2 py-0.5 border transition-colors ${
                                  required
                                    ? "border-brand-400 bg-brand-100 text-brand-700 font-medium"
                                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                                }`}
                              >
                                {field}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!name || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ name, config, isDefault })}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              {editingTemplate ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Template?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{deleteTarget?.name}</strong>.
            Existing form links won't be affected.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
