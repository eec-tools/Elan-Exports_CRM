import { useState } from "react";
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
  Plus, Trash2, Pencil, Loader2, Star, Mail,
  Settings, PenLine, User, Briefcase, Building2, AlignLeft,
  Link2, GripVertical, X, CheckCircle2, Paperclip, Upload, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionGate } from "@/components/PermissionGate";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  introSubject: string;
  introBody: string;
  followup1Subject: string;
  followup1Body: string;
  followup2Subject: string;
  followup2Body: string;
  followup3Subject: string;
  followup3Body: string;
  createdAt: string;
}

interface DefaultContent {
  introSubject: string; introBody: string;
  followup1Subject: string; followup1Body: string;
  followup2Subject: string; followup2Body: string;
  followup3Subject: string; followup3Body: string;
}

interface SigLink { label: string; url: string; }

interface EmailSignature {
  id: string;
  name: string;
  role: string;
  company: string;
  tagline: string;
  links: SigLink[];
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUYER_GMAIL_ACCOUNT = "partners@eectrade.com";

const LINK_PRESETS = [
  { label: "Email",    urlPrefix: "mailto:" },
  { label: "Website",  urlPrefix: "https://" },
  { label: "LinkedIn", urlPrefix: "https://" },
  { label: "Phone",    urlPrefix: "tel:" },
];

const VARIABLES = [
  { placeholder: "{{greeting}}",       description: "Dear [Contact Name], or Dear Sir/Madam," },
  { placeholder: "{{company}}",        description: "Buyer company name" },
  { placeholder: "{{contactPerson}}", description: "Contact person's name" },
  { placeholder: "{{product}}",        description: "Product / product category" },
];

const STEPS = [
  { key: "intro",     label: "Intro",       subjectField: "introSubject",     bodyField: "introBody",     stepNum: 1 },
  { key: "followup1", label: "Follow-up 1", subjectField: "followup1Subject", bodyField: "followup1Body", stepNum: 2 },
  { key: "followup2", label: "Follow-up 2", subjectField: "followup2Subject", bodyField: "followup2Body", stepNum: 3 },
  { key: "followup3", label: "Follow-up 3", subjectField: "followup3Subject", bodyField: "followup3Body", stepNum: 4 },
] as const;

type StepFields = {
  introSubject: string; introBody: string;
  followup1Subject: string; followup1Body: string;
  followup2Subject: string; followup2Body: string;
  followup3Subject: string; followup3Body: string;
};

function emptyFields(defaults?: DefaultContent): StepFields {
  return {
    introSubject:     defaults?.introSubject     ?? "",
    introBody:        defaults?.introBody        ?? "",
    followup1Subject: defaults?.followup1Subject ?? "",
    followup1Body:    defaults?.followup1Body    ?? "",
    followup2Subject: defaults?.followup2Subject ?? "",
    followup2Body:    defaults?.followup2Body    ?? "",
    followup3Subject: defaults?.followup3Subject ?? "",
    followup3Body:    defaults?.followup3Body    ?? "",
  };
}

// ─── Signature preview ────────────────────────────────────────────────────────

function SigPreview({ sig }: { sig: Partial<EmailSignature> }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-sm font-sans text-slate-700 leading-relaxed">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Preview</p>
      <div>
        Warm regards,<br />
        <strong className="text-slate-900">{sig.name || "Your Name"}</strong><br />
        {sig.role    && <><span className="text-brand-600 text-xs">{sig.role}</span><br /></>}
        {sig.company && <><span className="text-slate-600 font-semibold text-xs">{sig.company}</span><br /></>}
        <div className="mt-1 space-y-0.5">
          {(sig.links ?? []).map((l, i) => (
            <div key={i} className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{l.label}:</span>{" "}
              <span className="text-blue-600">{l.url.replace(/^mailto:|^tel:/, "")}</span>
            </div>
          ))}
        </div>
        {sig.tagline && <p className="text-[11px] text-slate-400 italic mt-1.5">{sig.tagline}</p>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BuyerEmailTemplatesPage() {
  const queryClient = useQueryClient();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission("buyers");

  // ── Template state ──
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [fields, setFields] = useState<StepFields>(emptyFields());
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [activeTab, setActiveTab] = useState("intro");

  // ── Attachment state ──
  const [attachmentUploading, setAttachmentUploading] = useState(false);

  // ── Signature dialog state ──
  const [sigOpen, setSigOpen] = useState(false);
  const [sigView, setSigView] = useState<"list" | "form">("list");
  const [sigEditing, setSigEditing] = useState<EmailSignature | null>(null);
  const [sigDeleteTarget, setSigDeleteTarget] = useState<EmailSignature | null>(null);
  const [sigName, setSigName]       = useState("");
  const [sigRole, setSigRole]       = useState("");
  const [sigCompany, setSigCompany] = useState("");
  const [sigTagline, setSigTagline] = useState("");
  const [sigLinks, setSigLinks]     = useState<SigLink[]>([]);

  // ── Queries ──
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["buyer-email-campaign-templates"],
    queryFn: async () => (await api.get("/buyer-email-templates")).data as EmailTemplate[],
  });

  const { data: defaultContent } = useQuery<DefaultContent>({
    queryKey: ["buyer-email-campaign-templates-default"],
    queryFn: async () => (await api.get("/buyer-email-templates/default-content")).data,
  });

  const { data: signatures = [] } = useQuery<EmailSignature[]>({
    queryKey: ["email-signatures"],
    queryFn: async () => (await api.get("/email-signatures")).data,
    enabled: sigOpen,
  });

  const { data: accountDefault = null } = useQuery<string | null>({
    queryKey: ["signature-defaults", BUYER_GMAIL_ACCOUNT],
    queryFn: async () => {
      const res = await api.get("/email-signatures/default", { params: { account: BUYER_GMAIL_ACCOUNT } });
      return res.data?.id ?? null;
    },
    enabled: sigOpen,
  });

  // ── Attachment queries ──
  const { data: attachmentData, refetch: refetchAttachment } = useQuery<{ attachment: { url: string; filename: string } | null }>({
    queryKey: ["email-campaign-attachment"],
    queryFn: async () => (await api.get("/email-settings/attachment")).data,
  });
  const currentAttachment = attachmentData?.attachment ?? null;

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post("/email-settings/attachment", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onMutate: () => setAttachmentUploading(true),
    onSettled: () => setAttachmentUploading(false),
    onSuccess: () => { refetchAttachment(); toast.success("Attachment uploaded"); },
    onError: () => toast.error("Failed to upload attachment"),
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: () => api.delete("/email-settings/attachment"),
    onSuccess: () => { refetchAttachment(); toast.success("Attachment removed"); },
    onError: () => toast.error("Failed to remove attachment"),
  });

  // ── Template mutations ──
  const saveMutation = useMutation({
    mutationFn: (data: { name: string; isDefault: boolean } & StepFields) =>
      editingTemplate
        ? api.put(`/buyer-email-templates/${editingTemplate.id}`, data)
        : api.post("/buyer-email-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyer-email-campaign-templates"] });
      setEditorOpen(false);
      toast.success(editingTemplate ? "Template updated" : "Template created");
    },
    onError: () => toast.error("Failed to save template"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/buyer-email-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyer-email-campaign-templates"] });
      setDeleteTarget(null);
      toast.success("Template deleted");
    },
    onError: () => toast.error("Failed to delete template"),
  });

  const setDefaultMutation = useMutation({
    mutationFn: ({ id, isDefault }: { id: string; isDefault: boolean }) =>
      api.put(`/buyer-email-templates/${id}`, { isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyer-email-campaign-templates"] });
      toast.success("Default updated");
    },
    onError: () => toast.error("Failed to update default"),
  });

  // ── Signature mutations ──
  const saveSigMutation = useMutation({
    mutationFn: (data: Omit<EmailSignature, "id" | "createdAt">) =>
      sigEditing
        ? api.put(`/email-signatures/${sigEditing.id}`, data)
        : api.post("/email-signatures", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-signatures"] });
      setSigView("list");
      setSigEditing(null);
      toast.success(sigEditing ? "Signature updated" : "Signature created");
    },
    onError: () => toast.error("Failed to save signature"),
  });

  const deleteSigMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/email-signatures/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-signatures"] });
      queryClient.invalidateQueries({ queryKey: ["signature-defaults", BUYER_GMAIL_ACCOUNT] });
      setSigDeleteTarget(null);
      toast.success("Signature deleted");
    },
    onError: () => toast.error("Failed to delete signature"),
  });

  const setDefaultSigMutation = useMutation({
    mutationFn: (signatureId: string | null) =>
      api.post("/email-signatures/default", { account: BUYER_GMAIL_ACCOUNT, signatureId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-defaults", BUYER_GMAIL_ACCOUNT] });
      toast.success("Default signature updated");
    },
    onError: () => toast.error("Failed to update default"),
  });

  // ── Template handlers ──
  const openCreate = () => {
    setEditingTemplate(null);
    setName(""); setIsDefault(false);
    setFields(emptyFields(defaultContent));
    setActiveTab("intro");
    setEditorOpen(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setName(t.name); setIsDefault(t.isDefault);
    setFields({
      introSubject: t.introSubject, introBody: t.introBody,
      followup1Subject: t.followup1Subject, followup1Body: t.followup1Body,
      followup2Subject: t.followup2Subject, followup2Body: t.followup2Body,
      followup3Subject: t.followup3Subject, followup3Body: t.followup3Body,
    });
    setActiveTab("intro");
    setEditorOpen(true);
  };

  const setField = (key: keyof StepFields) => (value: string) =>
    setFields((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    if (!name.trim()) { toast.error("Template name is required"); return; }
    if (!fields.introSubject.trim()) { toast.error("Intro subject is required"); return; }
    if (!fields.introBody.trim()) { toast.error("Intro body is required"); return; }
    saveMutation.mutate({ name: name.trim(), isDefault, ...fields });
  };

  // ── Signature handlers ──
  const openSigCreate = () => {
    setSigEditing(null);
    setSigName(""); setSigRole(""); setSigCompany(""); setSigTagline(""); setSigLinks([]);
    setSigView("form");
  };

  const openSigEdit = (sig: EmailSignature) => {
    setSigEditing(sig);
    setSigName(sig.name); setSigRole(sig.role); setSigCompany(sig.company);
    setSigTagline(sig.tagline); setSigLinks(sig.links ?? []);
    setSigView("form");
  };

  const addSigLink    = () => setSigLinks((p) => [...p, { label: "", url: "" }]);
  const removeSigLink = (i: number) => setSigLinks((p) => p.filter((_, idx) => idx !== i));
  const updateSigLink = (i: number, field: keyof SigLink, val: string) =>
    setSigLinks((p) => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  const applyPreset = (i: number, preset: typeof LINK_PRESETS[0]) =>
    setSigLinks((p) => p.map((l, idx) =>
      idx === i ? { label: preset.label, url: l.url.startsWith(preset.urlPrefix) ? l.url : preset.urlPrefix } : l
    ));

  const handleSaveSig = () => {
    if (!sigName.trim()) { toast.error("Name is required"); return; }
    const cleanLinks = sigLinks.filter((l) => l.label.trim() && l.url.trim());
    saveSigMutation.mutate({ name: sigName.trim(), role: sigRole, company: sigCompany, tagline: sigTagline, links: cleanLinks });
  };

  const sigPreview: Partial<EmailSignature> = { name: sigName, role: sigRole, company: sigCompany, tagline: sigTagline, links: sigLinks };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Buyer Email Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Customise the intro and follow-up emails sent to sourcing buyers via{" "}
            <span className="font-medium text-slate-700">{BUYER_GMAIL_ACCOUNT}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => { setSigView("list"); setSigOpen(true); }}
            className="gap-1.5 border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50"
            title="Manage email signatures"
          >
            <Settings className="h-4 w-4" />
            Signatures
          </Button>
          <PermissionGate permission="buyers" editOnly>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Template
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* ── Template list ── */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Mail className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No buyer email templates yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Create a template to customise intro and follow-up email content for buyers.
            <br />If no template is assigned, the system default emails are used.
          </p>
          {canEdit && (
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create First Template
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{t.name}</span>
                  {t.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-medium">
                      <Star className="h-3 w-3" /> Default
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Intro subject</span>
                    <p className="text-sm text-slate-600 truncate">{t.introSubject}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Follow-up 1 subject</span>
                    <p className="text-sm text-slate-600 truncate">{t.followup1Subject}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">Created {new Date(t.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!t.isDefault && canEdit && (
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-amber-600" title="Set as default"
                    onClick={() => setDefaultMutation.mutate({ id: t.id, isDefault: true })}
                    disabled={setDefaultMutation.isPending}>
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canEdit && (
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600"
                    onClick={() => setDeleteTarget(t)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Email Attachment ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
              <Paperclip className="h-4 w-4 text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Campaign Attachment</p>
              <p className="text-xs text-slate-500 mt-0.5">
                A single file attached to every buyer intro &amp; follow-up email (e.g. company profile, brochure).
              </p>
            </div>
          </div>
          {canEdit && (
            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors shrink-0
              ${attachmentUploading
                ? "border-slate-200 bg-slate-50 text-slate-400 pointer-events-none"
                : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"}`}>
              {attachmentUploading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Upload className="h-3.5 w-3.5" />}
              {currentAttachment ? "Replace" : "Upload"}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                disabled={attachmentUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAttachmentMutation.mutate(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        <div className="mt-4">
          {currentAttachment ? (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
              <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-sm text-slate-700 font-medium flex-1 truncate">{currentAttachment.filename}</span>
              <a
                href={currentAttachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View
              </a>
              {canEdit && (
                <button
                  onClick={() => removeAttachmentMutation.mutate()}
                  disabled={removeAttachmentMutation.isPending}
                  className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                  title="Remove attachment"
                >
                  {removeAttachmentMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <X className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-4 py-3">
              <Paperclip className="h-3.5 w-3.5" />
              No attachment set — buyer emails will be sent without one.
            </div>
          )}
        </div>
      </div>

      {/* ── Template Editor Dialog ── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0">
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
            <DialogTitle>{editingTemplate ? "Edit Buyer Template" : "New Buyer Email Template"}</DialogTitle>
            <DialogDescription>
              Use variables like <code className="text-xs bg-slate-100 px-1 rounded">{"{{company}}"}</code> to personalise buyer outreach emails.
              No form links — these emails focus purely on introducing Élan Exports sourcing services.
            </DialogDescription>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label className="text-xs text-slate-500 font-medium">Template Name</Label>
                <Input className="mt-1" placeholder="e.g. Standard Buyer Outreach, Food Buyers…"
                  value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-2 shrink-0">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300" />
                <span className="text-sm text-slate-600">Set as default</span>
              </label>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Available Variables</p>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <span key={v.placeholder} title={v.description}
                    className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-mono text-slate-700 cursor-default">
                    {v.placeholder}
                    <span className="text-slate-400 font-sans font-normal">— {v.description}</span>
                  </span>
                ))}
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 w-full h-auto! p-1">
                {STEPS.map((s) => (
                  <TabsTrigger key={s.key} value={s.key} className="flex flex-col items-center gap-0.5 py-2 px-1 text-center">
                    <span className="text-[10px] font-normal text-slate-400 leading-none">Step {s.stepNum}</span>
                    <span className="text-xs font-medium leading-tight">{s.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {STEPS.map((s) => (
                <TabsContent key={s.key} value={s.key} className="mt-4 space-y-4">
                  {s.stepNum > 1 && (
                    <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded px-3 py-2">
                      Follow-up emails are sent as replies in the same Gmail thread. The subject will automatically be prefixed with <strong>Re:</strong> using the intro subject.
                    </p>
                  )}
                  <div>
                    <Label className="text-xs text-slate-500 font-medium">Subject</Label>
                    <Input className="mt-1 font-mono text-sm" placeholder="e.g. Sourcing Partnership Inquiry — {{product}} | Élan Exports"
                      value={fields[s.subjectField]} onChange={(e) => setField(s.subjectField)(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 font-medium">Email Body</Label>
                    <p className="text-xs text-slate-400 mt-0.5 mb-1">
                      Plain text with blank lines between paragraphs. Lists: start lines with <code className="bg-slate-100 px-1 rounded">- </code>. HTML is also accepted.
                    </p>
                    <Textarea className="mt-1 font-mono text-sm leading-relaxed" rows={18}
                      placeholder={`{{greeting}}\n\nYour email body here...\n\nBest regards,\nÉlan Exports`}
                      value={fields[s.bodyField]} onChange={(e) => setField(s.bodyField)(e.target.value)} />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Template Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Template</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? Buyers already using this template will fall back to the system default.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════
          SIGNATURE SETTINGS DIALOG
      ══════════════════════════════════════════════════════════ */}
      <Dialog open={sigOpen} onOpenChange={(o) => { setSigOpen(o); if (!o) setSigView("list"); }}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden bg-white rounded-xl shadow-2xl border-none">

          {/* ── List view ── */}
          {sigView === "list" && (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-brand-500" /> Email Signatures
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 mt-0.5">
                    Assign a signature for <strong>{BUYER_GMAIL_ACCOUNT}</strong> — appended automatically to all buyer campaign emails.
                  </DialogDescription>
                </div>
                <Button size="sm" onClick={openSigCreate}
                  className="gap-1.5 bg-brand-600 hover:bg-brand-700 text-white shrink-0">
                  <Plus className="h-3.5 w-3.5" /> New
                </Button>
              </div>

              <div className="overflow-y-auto max-h-[72vh] p-5 space-y-6">
                {/* Saved signatures */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Saved Signatures</p>
                  {signatures.length === 0 ? (
                    <div className="text-center py-8 rounded-xl border border-dashed border-slate-200">
                      <PenLine className="h-7 w-7 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No signatures yet — create one above</p>
                    </div>
                  ) : (
                    signatures.map((sig) => (
                      <div key={sig.id} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-sm">{sig.name}</p>
                          {sig.role    && <p className="text-xs text-brand-600 font-medium">{sig.role}</p>}
                          {sig.company && <p className="text-xs text-slate-500">{sig.company}</p>}
                          {sig.links.length > 0 && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              {sig.links.map((l, i) => (
                                <span key={i} className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <Link2 className="h-2.5 w-2.5" />
                                  <span className="font-medium text-slate-600">{l.label}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {sig.tagline && <p className="text-[11px] text-slate-400 italic mt-1">{sig.tagline}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openSigEdit(sig)}
                            className="p-1.5 rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setSigDeleteTarget(sig)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Default for partners@eectrade.com */}
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Default for {BUYER_GMAIL_ACCOUNT}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">This signature is auto-appended to all buyer outreach emails.</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{BUYER_GMAIL_ACCOUNT}</p>
                      {(() => {
                        const currentSig = signatures.find((s) => s.id === accountDefault);
                        return currentSig ? (
                          <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="h-3 w-3" /> {currentSig.name}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-0.5">No default set</p>
                        );
                      })()}
                    </div>
                    <select
                      value={accountDefault ?? ""}
                      onChange={(e) => setDefaultSigMutation.mutate(e.target.value || null)}
                      className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 min-w-[140px] shrink-0"
                    >
                      <option value="">No signature</option>
                      {signatures.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Create / Edit form view ── */}
          {sigView === "form" && (
            <>
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                <button onClick={() => { setSigView("list"); setSigEditing(null); }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
                  <Mail className="h-4 w-4" />
                </button>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    {sigEditing ? "Edit Signature" : "New Signature"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 mt-0.5">
                    Appended at the bottom of buyer campaign emails.
                  </DialogDescription>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[72vh] p-5 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Full Name *
                  </label>
                  <Input placeholder="e.g. Mohita Vadrevu" value={sigName}
                    onChange={(e) => setSigName(e.target.value)} className="h-9 text-sm border-slate-200" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Job Title / Role
                  </label>
                  <Input placeholder="e.g. Strategic Partnerships Lead" value={sigRole}
                    onChange={(e) => setSigRole(e.target.value)} className="h-9 text-sm border-slate-200" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Company Name
                  </label>
                  <Input placeholder="e.g. Elan Exports Consultancy Pte Ltd" value={sigCompany}
                    onChange={(e) => setSigCompany(e.target.value)} className="h-9 text-sm border-slate-200" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" /> Links
                  </label>
                  <div className="space-y-2">
                    {sigLinks.map((link, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
                        <select
                          value={link.label}
                          onChange={(e) => {
                            const preset = LINK_PRESETS.find((p) => p.label === e.target.value);
                            if (preset) applyPreset(i, preset);
                            else updateSigLink(i, "label", e.target.value);
                          }}
                          className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 w-28 shrink-0"
                        >
                          <option value="">Label…</option>
                          {LINK_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                          {link.label && !LINK_PRESETS.find((p) => p.label === link.label) && (
                            <option value={link.label}>{link.label}</option>
                          )}
                        </select>
                        <Input placeholder="URL or value" value={link.url}
                          onChange={(e) => updateSigLink(i, "url", e.target.value)}
                          className="h-9 text-sm border-slate-200 flex-1" />
                        <button onClick={() => removeSigLink(i)}
                          className="p-1.5 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={addSigLink}
                    className="w-fit gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50 h-8 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add Link
                  </Button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <AlignLeft className="h-3.5 w-3.5" /> Tagline
                  </label>
                  <Input placeholder="e.g. Global Trade | Textiles & Food Commodities | 15+ Countries"
                    value={sigTagline} onChange={(e) => setSigTagline(e.target.value)}
                    className="h-9 text-sm border-slate-200" />
                </div>

                <SigPreview sig={sigPreview} />
              </div>

              <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                <Button variant="outline" onClick={() => { setSigView("list"); setSigEditing(null); }}
                  className="border-slate-200 text-slate-700">Cancel</Button>
                <Button onClick={handleSaveSig} disabled={saveSigMutation.isPending}
                  className="bg-brand-600 hover:bg-brand-700 text-white gap-2">
                  {saveSigMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <CheckCircle2 className="h-4 w-4" />}
                  {sigEditing ? "Save Changes" : "Create Signature"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Signature Confirm ── */}
      <Dialog open={!!sigDeleteTarget} onOpenChange={(o) => { if (!o) setSigDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm p-6 bg-white rounded-xl shadow-2xl border-none">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">Delete Signature</DialogTitle>
              <DialogDescription className="text-slate-500 text-sm mt-0.5">
                This will also unset it as default for {BUYER_GMAIL_ACCOUNT}.
              </DialogDescription>
            </div>
          </div>
          <p className="text-sm bg-slate-50 border border-slate-100 rounded-lg p-3 font-semibold text-slate-700 mb-4">
            "{sigDeleteTarget?.name}"
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSigDeleteTarget(null)} className="border-slate-200">Cancel</Button>
            <Button variant="destructive" disabled={deleteSigMutation.isPending}
              onClick={() => sigDeleteTarget && deleteSigMutation.mutate(sigDeleteTarget.id)}
              className="bg-rose-600 hover:bg-rose-700 text-white">
              {deleteSigMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
