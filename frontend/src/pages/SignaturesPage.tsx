import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Link2, X, GripVertical,
  User, Briefcase, Building2, AlignLeft, CheckCircle2,
  Loader2, PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignatureLink {
  label: string;
  url: string;
}

interface EmailSignature {
  id: string;
  name: string;
  role: string;
  company: string;
  tagline: string;
  links: SignatureLink[];
  createdAt: string;
}

const GMAIL_ACCOUNTS = [
  "procurement1@eectrade.com",
  "partners@eectrade.com",
  "procurement2@eectrade.com",
];

const LINK_PRESETS = [
  { label: "Email",    urlPrefix: "mailto:" },
  { label: "Website",  urlPrefix: "https://" },
  { label: "LinkedIn", urlPrefix: "https://linkedin.com/in/" },
  { label: "Phone",    urlPrefix: "tel:" },
];

// ─── Signature preview card ───────────────────────────────────────────────────

function SignaturePreview({ sig }: { sig: Partial<EmailSignature> }) {
  return (
    <div className="border-t border-slate-200 pt-4 mt-2 font-sans text-sm text-slate-700 leading-relaxed">
      <div className="text-slate-500 text-xs mb-2 italic">Preview</div>
      <div>
        Warm regards,<br />
        <strong className="text-slate-900">{sig.name || "Your Name"}</strong><br />
        {sig.role && <><span className="text-slate-500">{sig.role}</span><br /></>}
        {sig.company && <><span className="text-slate-500">{sig.company}</span><br /></>}
        {(sig.links ?? []).map((l, i) => (
          <span key={i} className="block">
            <a href={l.url} className="text-blue-600 underline text-xs">{l.label}</a>
          </span>
        ))}
        {sig.tagline && (
          <span className="text-slate-400 text-xs italic block mt-1">{sig.tagline}</span>
        )}
      </div>
    </div>
  );
}

// ─── Edit / Create Dialog ─────────────────────────────────────────────────────

function SignatureDialog({
  open,
  initial,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initial: Partial<EmailSignature> | null;
  onClose: () => void;
  onSave: (data: Omit<EmailSignature, "id" | "createdAt">) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [links, setLinks] = useState<SignatureLink[]>(initial?.links ?? []);

  const addLink = () => setLinks((prev) => [...prev, { label: "", url: "" }]);
  const removeLink = (i: number) => setLinks((prev) => prev.filter((_, idx) => idx !== i));
  const updateLink = (i: number, field: keyof SignatureLink, value: string) =>
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));

  const handlePreset = (i: number, preset: typeof LINK_PRESETS[0]) => {
    setLinks((prev) =>
      prev.map((l, idx) =>
        idx === i ? { label: preset.label, url: l.url.startsWith(preset.urlPrefix) ? l.url : preset.urlPrefix } : l
      )
    );
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const cleanLinks = links.filter((l) => l.label.trim() && l.url.trim());
    onSave({ name: name.trim(), role, company, tagline, links: cleanLinks });
  };

  // Reset when dialog opens with new initial
  const preview: Partial<EmailSignature> = { name, role, company, tagline, links };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden bg-white rounded-xl shadow-2xl border-none">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
          <DialogTitle className="text-base font-bold text-slate-900">
            {initial?.id ? "Edit Signature" : "New Signature"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            This signature will be appended to campaign emails sent from the linked Gmail account.
          </DialogDescription>
        </div>

        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Full Name *
            </label>
            <Input
              placeholder="e.g. Mohita Vadrevu"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm border-slate-200"
            />
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Job Title / Role
            </label>
            <Input
              placeholder="e.g. Strategic Partnerships Lead"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-9 text-sm border-slate-200"
            />
          </div>

          {/* Company */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Company Name
            </label>
            <Input
              placeholder="e.g. Elan Exports Consultancy Pte Ltd"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="h-9 text-sm border-slate-200"
            />
          </div>

          {/* Links */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Links
            </label>

            <div className="space-y-2">
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />

                  {/* Preset selector */}
                  <select
                    value={link.label}
                    onChange={(e) => {
                      const preset = LINK_PRESETS.find((p) => p.label === e.target.value);
                      if (preset) handlePreset(i, preset);
                      else updateLink(i, "label", e.target.value);
                    }}
                    className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 w-28 shrink-0"
                  >
                    <option value="">Label…</option>
                    {LINK_PRESETS.map((p) => (
                      <option key={p.label} value={p.label}>{p.label}</option>
                    ))}
                    {link.label && !LINK_PRESETS.find((p) => p.label === link.label) && (
                      <option value={link.label}>{link.label}</option>
                    )}
                  </select>

                  <Input
                    placeholder="URL or value"
                    value={link.url}
                    onChange={(e) => updateLink(i, "url", e.target.value)}
                    className="h-9 text-sm border-slate-200 flex-1"
                  />

                  <button
                    onClick={() => removeLink(i)}
                    className="p-1.5 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={addLink}
              className="w-fit gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50 h-8 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Link
            </Button>
          </div>

          {/* Tagline */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <AlignLeft className="h-3.5 w-3.5" /> Tagline
            </label>
            <Input
              placeholder="e.g. Global Trade | Textiles & Food Commodities | 15+ Countries"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="h-9 text-sm border-slate-200"
            />
          </div>

          {/* Preview */}
          <SignaturePreview sig={preview} />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
          <Button variant="outline" onClick={onClose} className="border-slate-200 text-slate-700">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 text-white gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {initial?.id ? "Save Changes" : "Create Signature"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SignaturesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailSignature | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailSignature | null>(null);

  const { data: signatures = [], isLoading } = useQuery<EmailSignature[]>({
    queryKey: ["email-signatures"],
    queryFn: async () => (await api.get("/email-signatures")).data,
  });

  // Default signatures per gmail account (map: email → signatureId | null)
  const { data: accountDefaults = {} } = useQuery<Record<string, string | null>>({
    queryKey: ["signature-defaults"],
    queryFn: async () => {
      const results = await Promise.all(
        GMAIL_ACCOUNTS.map(async (acc) => {
          const res = await api.get("/email-signatures/default", { params: { account: acc } });
          return [acc, res.data?.id ?? null] as [string, string | null];
        })
      );
      return Object.fromEntries(results);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; payload: Omit<EmailSignature, "id" | "createdAt"> }) => {
      if (data.id) {
        return api.put(`/email-signatures/${data.id}`, data.payload);
      }
      return api.post("/email-signatures", data.payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-signatures"] });
      queryClient.invalidateQueries({ queryKey: ["signature-defaults"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "Signature updated" : "Signature created");
    },
    onError: () => toast.error("Failed to save signature"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/email-signatures/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-signatures"] });
      queryClient.invalidateQueries({ queryKey: ["signature-defaults"] });
      setDeleteTarget(null);
      toast.success("Signature deleted");
    },
    onError: () => toast.error("Failed to delete signature"),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (data: { account: string; signatureId: string | null }) =>
      api.post("/email-signatures/default", { account: data.account, signatureId: data.signatureId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-defaults"] });
      toast.success("Default signature updated");
    },
    onError: () => toast.error("Failed to update default"),
  });

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (sig: EmailSignature) => { setEditing(sig); setDialogOpen(true); };

  return (
    <div className="p-6 max-w-3xl space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PenLine className="h-6 w-6 text-brand-500" />
            Email Signatures
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create signatures and assign them as defaults to each Gmail account. They'll automatically appear in campaign emails.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-brand-600 hover:bg-brand-700 text-white shadow-sm">
          <Plus className="h-4 w-4" /> New Signature
        </Button>
      </div>

      {/* ── Signature list ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Saved Signatures
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : signatures.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center">
            <PenLine className="h-8 w-8 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No signatures yet</p>
            <p className="text-slate-400 text-sm mt-1">Create your first signature to get started</p>
          </div>
        ) : (
          signatures.map((sig) => (
            <div key={sig.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start justify-between gap-4 hover:shadow-md transition-shadow">
              {/* Left: signature info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-slate-900">{sig.name}</p>
                </div>
                {sig.role && <p className="text-sm text-brand-600 font-medium">{sig.role}</p>}
                {sig.company && <p className="text-sm text-slate-600 font-semibold">{sig.company}</p>}
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {sig.links.map((l, i) => (
                    <span key={i} className="text-xs text-slate-400 flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      <span className="font-medium text-slate-600">{l.label}:</span>
                      <span className="truncate max-w-[160px]" title={l.url}>{l.url.replace(/^mailto:|^tel:/, "")}</span>
                    </span>
                  ))}
                </div>
                {sig.tagline && (
                  <p className="text-xs text-slate-400 italic mt-1.5">{sig.tagline}</p>
                )}
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(sig)}
                  className="p-2 rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(sig)}
                  className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Default per Gmail account ── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Default Signature per Account
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            The selected signature will be automatically appended to all emails sent from that Gmail account.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {GMAIL_ACCOUNTS.map((acc) => {
            const currentId = accountDefaults[acc] ?? null;
            return (
              <div key={acc} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{acc}</p>
                  {currentId ? (
                    <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {signatures.find((s) => s.id === currentId)?.name ?? "Unknown"}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">No default set</p>
                  )}
                </div>
                <select
                  value={currentId ?? ""}
                  onChange={(e) =>
                    setDefaultMutation.mutate({ account: acc, signatureId: e.target.value || null })
                  }
                  className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 min-w-[180px]"
                >
                  <option value="">No signature</option>
                  {signatures.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Create / Edit dialog ── */}
      {dialogOpen && (
        <SignatureDialog
          open={dialogOpen}
          initial={editing}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          onSave={(payload) => saveMutation.mutate({ id: editing?.id, payload })}
          saving={saveMutation.isPending}
        />
      )}

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md p-6 bg-white rounded-xl shadow-2xl border-none">
          <div className="flex items-center gap-4 mb-5">
            <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">Delete Signature</DialogTitle>
              <DialogDescription className="text-slate-500 text-sm mt-0.5">
                This will also remove it as the default for any Gmail accounts using it.
              </DialogDescription>
            </div>
          </div>
          <p className="text-sm bg-slate-50 border border-slate-100 rounded-lg p-3 font-semibold text-slate-700 mb-5">
            "{deleteTarget?.name}"
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-slate-200">Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
