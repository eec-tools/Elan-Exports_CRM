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
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Star,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { PermissionGate } from "@/components/PermissionGate";

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
  introSubject: string;
  introBody: string;
  followup1Subject: string;
  followup1Body: string;
  followup2Subject: string;
  followup2Body: string;
  followup3Subject: string;
  followup3Body: string;
}

const VARIABLES = [
  { placeholder: "{{greeting}}", description: "Dear [Contact Name], or Dear Sir/Madam," },
  { placeholder: "{{company}}", description: "Supplier company name" },
  { placeholder: "{{contactPerson}}", description: "Contact person's name" },
  { placeholder: "{{product}}", description: "Product / product category" },
  { placeholder: "{{formButton}}", description: "CTA button + form link box (recommended)" },
  { placeholder: "{{formLink}}", description: "Raw form URL (use inside text)" },
];

const STEPS = [
  { key: "intro",    label: "Intro",       subjectField: "introSubject",    bodyField: "introBody",    stepNum: 1 },
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
    introSubject:    defaults?.introSubject    ?? "",
    introBody:       defaults?.introBody       ?? "",
    followup1Subject: defaults?.followup1Subject ?? "",
    followup1Body:   defaults?.followup1Body   ?? "",
    followup2Subject: defaults?.followup2Subject ?? "",
    followup2Body:   defaults?.followup2Body   ?? "",
    followup3Subject: defaults?.followup3Subject ?? "",
    followup3Body:   defaults?.followup3Body   ?? "",
  };
}

function insertVariable(text: string, cursor: number, variable: string): [string, number] {
  const before = text.slice(0, cursor);
  const after = text.slice(cursor);
  const next = before + variable + after;
  return [next, cursor + variable.length];
}

export default function EmailTemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission("suppliers") || hasEditPermission("sourcing_suppliers");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [fields, setFields] = useState<StepFields>(emptyFields());
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [activeTab, setActiveTab] = useState("intro");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-campaign-templates"],
    queryFn: async () => {
      const res = await api.get("/email-campaign-templates");
      return res.data as EmailTemplate[];
    },
  });

  const { data: defaultContent } = useQuery<DefaultContent>({
    queryKey: ["email-campaign-templates-default"],
    queryFn: async () => {
      const res = await api.get("/email-campaign-templates/default-content");
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; isDefault: boolean } & StepFields) =>
      editingTemplate
        ? api.put(`/email-campaign-templates/${editingTemplate.id}`, data)
        : api.post("/email-campaign-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaign-templates"] });
      setEditorOpen(false);
      toast.success(editingTemplate ? "Template updated" : "Template created");
    },
    onError: () => toast.error("Failed to save template"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/email-campaign-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaign-templates"] });
      setDeleteTarget(null);
      toast.success("Template deleted");
    },
    onError: () => toast.error("Failed to delete template"),
  });

  const setDefaultMutation = useMutation({
    mutationFn: ({ id, isDefault }: { id: string; isDefault: boolean }) =>
      api.put(`/email-campaign-templates/${id}`, { isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaign-templates"] });
      toast.success("Default updated");
    },
    onError: () => toast.error("Failed to update default"),
  });

  const openCreate = () => {
    setEditingTemplate(null);
    setName("");
    setIsDefault(false);
    setFields(emptyFields(defaultContent));
    setActiveTab("intro");
    setEditorOpen(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setIsDefault(t.isDefault);
    setFields({
      introSubject: t.introSubject,
      introBody: t.introBody,
      followup1Subject: t.followup1Subject,
      followup1Body: t.followup1Body,
      followup2Subject: t.followup2Subject,
      followup2Body: t.followup2Body,
      followup3Subject: t.followup3Subject,
      followup3Body: t.followup3Body,
    });
    setActiveTab("intro");
    setEditorOpen(true);
  };

  const setField = (key: keyof StepFields) => (value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error("Template name is required"); return; }
    if (!fields.introSubject.trim()) { toast.error("Intro subject is required"); return; }
    if (!fields.introBody.trim()) { toast.error("Intro body is required"); return; }
    saveMutation.mutate({ name: name.trim(), isDefault, ...fields });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/suppliers/sourcing")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Email Templates</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Customise the intro and follow-up emails sent to sourcing suppliers
            </p>
          </div>
        </div>
        <PermissionGate permission="suppliers" editOnly>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Template
          </Button>
        </PermissionGate>
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Mail className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No email templates yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Create a template to customise intro and follow-up email content.
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
            <div
              key={t.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{t.name}</span>
                  {t.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-medium">
                      <Star className="h-3 w-3" />
                      Default
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
                <p className="mt-1.5 text-xs text-slate-400">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!t.isDefault && canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-amber-600"
                    title="Set as default"
                    onClick={() => setDefaultMutation.mutate({ id: t.id, isDefault: true })}
                    disabled={setDefaultMutation.isPending}
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-600"
                    onClick={() => setDeleteTarget(t)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Editor Dialog ── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0">
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
            <DialogTitle>{editingTemplate ? "Edit Template" : "New Email Template"}</DialogTitle>
            <DialogDescription>
              Use variables like <code className="text-xs bg-slate-100 px-1 rounded">{"{{company}}"}</code> to personalise content. Include <code className="text-xs bg-slate-100 px-1 rounded">{"{{formButton}}"}</code> to insert the supplier form CTA.
            </DialogDescription>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Name + Default */}
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label className="text-xs text-slate-500 font-medium">Template Name</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Standard Outreach, Organic Suppliers…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-2 shrink-0">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-600">Set as default</span>
              </label>
            </div>

            {/* Variable reference */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Available Variables</p>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <span
                    key={v.placeholder}
                    title={v.description}
                    className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-mono text-slate-700 cursor-default"
                  >
                    {v.placeholder}
                    <span className="text-slate-400 font-sans font-normal">— {v.description}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Step tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 w-full">
                {STEPS.map((s) => (
                  <TabsTrigger key={s.key} value={s.key} className="text-xs">
                    Step {s.stepNum} — {s.label}
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
                    <Label className="text-xs text-slate-500 font-medium">
                      Subject{s.stepNum > 1 ? " (used as intro subject — follow-ups thread automatically)" : ""}
                    </Label>
                    <Input
                      className="mt-1 font-mono text-sm"
                      placeholder={`e.g. Export Supply Partnership Inquiry – {{product}}`}
                      value={fields[s.subjectField]}
                      onChange={(e) => setField(s.subjectField)(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 font-medium">Email Body</Label>
                    <p className="text-xs text-slate-400 mt-0.5 mb-1">
                      Plain text with blank lines between paragraphs. Lists: start lines with <code className="bg-slate-100 px-1 rounded">- </code>. HTML is also accepted.
                    </p>
                    <Textarea
                      className="mt-1 font-mono text-sm leading-relaxed"
                      rows={18}
                      placeholder={`{{greeting}}\n\nYour email body here...\n\n{{formButton}}\n\nBest regards,\nHarsh Patel`}
                      value={fields[s.bodyField]}
                      onChange={(e) => setField(s.bodyField)(e.target.value)}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Template</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? Suppliers already using this template will fall back to the system default.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
