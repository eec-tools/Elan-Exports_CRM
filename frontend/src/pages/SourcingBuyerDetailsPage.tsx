import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import {
  ArrowLeft,
  Loader2,
  Mail,
  CheckCircle2,
  Save,
  Circle,
  AlertCircle,
  MessageSquare,
  UserCheck,
  PhoneCall,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BuyersTabBar from "@/components/BuyersTabBar";

const BUYER_GMAIL = "partners@eectrade.com";

interface SourcingBuyer {
  id: string;
  company: string;
  country?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  product?: string;
  productCategory?: string;
  notes?: string;
  status: string;
  alreadyContacted?: boolean;
  assignedGmailAccount?: string | null;
  emailTemplateId?: string | null;
  emailCampaign?: {
    status: string;
    currentStep: number;
    introEmailSentAt?: string;
    followup1SentAt?: string | null;
    followup2SentAt?: string | null;
    followup3SentAt?: string | null;
    responseReceivedAt?: string | null;
    nextFollowupDue?: string | null;
  } | null;
}

interface EmailReply {
  id: string;
  direction: "sent" | "received";
  fromEmail: string;
  fromName?: string;
  subject?: string;
  body: string;
  receivedAt: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  isDefault: boolean;
}

function stripQuotedText(body: string): string {
  const lines = body.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    const t = line.trimStart();
    if (t.startsWith(">")) break;
    if (/^On \w{3},\s/.test(t)) break;
    if (/^[-_]{4,}/.test(t)) break;
    if (/^From:\s+\S/.test(t) && result.length > 0) break;
    result.push(line);
  }
  while (result.length > 0 && result[result.length - 1].trim() === "") result.pop();
  return result.join("\n").trim();
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending:            { label: "Pending",           class: "bg-slate-100 text-slate-700" },
  intro_sent:         { label: "Intro Sent",         class: "bg-blue-100 text-blue-700" },
  followup1_sent:     { label: "Follow-up 1 Sent",   class: "bg-amber-100 text-amber-700" },
  followup2_sent:     { label: "Follow-up 2 Sent",   class: "bg-orange-100 text-orange-700" },
  followup3_sent:     { label: "Follow-up 3 Sent",   class: "bg-red-100 text-red-700" },
  response_received:  { label: "Responded",          class: "bg-green-100 text-green-700" },
  no_response:        { label: "No Response",        class: "bg-red-100 text-red-700" },
  converted_to_buyer: { label: "Converted to Buyer", class: "bg-purple-100 text-purple-700" },
  invalid:            { label: "Invalid Email",      class: "bg-rose-100 text-rose-700" },
};

function FieldRow({ label, value, onChange, canEdit, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; canEdit: boolean; type?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-slate-500 font-medium">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        disabled={!canEdit} className="mt-1 h-8 text-sm" />
    </div>
  );
}

export default function SourcingBuyerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission("buyers");

  const [fields, setFields] = useState<Partial<SourcingBuyer>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [convertConfirmOpen, setConvertConfirmOpen] = useState(false);
  const [alreadyContacted, setAlreadyContacted] = useState(false);

  const set = (key: string) => (value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setIsDirty(true);
  };
  const v = (key: keyof SourcingBuyer) => (fields[key] as string) ?? "";

  const { data: buyer, isLoading } = useQuery({
    queryKey: ["sourcing-buyer", id],
    queryFn: async () => {
      const res = await api.get(`/sourcing-buyers/${id}`);
      return res.data as SourcingBuyer;
    },
    enabled: !!id,
  });

  const { data: emailTemplates = [] } = useQuery({
    queryKey: ["buyer-email-campaign-templates"],
    queryFn: async () => {
      const res = await api.get("/buyer-email-templates");
      return res.data as EmailTemplate[];
    },
  });

  const { data: emailReplies = [] } = useQuery<EmailReply[]>({
    queryKey: ["buyer-replies", id],
    queryFn: async () => {
      const res = await api.get(`/buyer-campaigns/${id}/replies`);
      return res.data;
    },
    enabled: !!id,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (buyer) {
      setFields(buyer);
      setIsDirty(false);
      setAlreadyContacted(buyer.alreadyContacted ?? false);
    }
  }, [buyer]);

  const contactedMutation = useMutation({
    mutationFn: (val: boolean) => api.patch(`/ai-comms/${id}/contacted`, { alreadyContacted: val }),
    onSuccess: (_data, val) => {
      setAlreadyContacted(val);
      queryClient.invalidateQueries({ queryKey: ["ai-comms-inbox"] });
      toast.success(val ? "Marked as already contacted" : "Marked as pending reply");
    },
    onError: () => toast.error("Failed to update contacted status"),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<SourcingBuyer>) => api.put(`/sourcing-buyers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyer", id] });
      setIsDirty(false);
      toast.success("Saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  const startCampaignMutation = useMutation({
    mutationFn: () => api.post(`/buyer-campaigns/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyer", id] });
      toast.success("Intro email sent via partners@eectrade.com");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Failed to start campaign");
    },
  });

  const sendFollowupMutation = useMutation({
    mutationFn: () => api.post(`/buyer-campaigns/${id}/send-followup`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyer", id] });
      toast.success("Follow-up email sent");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Failed to send follow-up");
    },
  });

  const markResponseMutation = useMutation({
    mutationFn: () => api.post(`/buyer-campaigns/${id}/mark-response`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sourcing-buyer", id] });
      toast.success("Response recorded — buyer added to Buyers Directory");
      const newId = res.data?.newBuyerId;
      if (newId) navigate(`/buyers/${newId}`);
    },
    onError: () => toast.error("Failed to record response"),
  });

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString() : "—";

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <BuyersTabBar />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!buyer) {
    return (
      <div className="p-6 space-y-6">
        <BuyersTabBar />
        <div className="text-slate-500">Buyer not found.</div>
      </div>
    );
  }

  const campaign = fields.emailCampaign ?? buyer.emailCampaign;
  const statusCfg = STATUS_CONFIG[fields.status as string ?? buyer.status] ?? {
    label: buyer.status,
    class: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="p-6 space-y-6">
      <BuyersTabBar />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/buyers/sourcing")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{buyer.company}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.class}`}>
                {statusCfg.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {buyer.country ?? "—"} · {buyer.product ?? buyer.productCategory ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {campaign?.status === "response_received" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => contactedMutation.mutate(!alreadyContacted)}
              disabled={contactedMutation.isPending}
              className={alreadyContacted
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50"}
            >
              {contactedMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                : <PhoneCall className="h-4 w-4 mr-1.5" />}
              {alreadyContacted ? "Already Contacted" : "Mark as Contacted"}
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
            <h2 className="font-semibold text-slate-800">Buyer Information</h2>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Company" value={v("company")} onChange={set("company")} canEdit={canEdit} />
              <FieldRow label="Country" value={v("country")} onChange={set("country")} canEdit={canEdit} />
              <FieldRow label="Contact Person" value={v("contactPerson")} onChange={set("contactPerson")} canEdit={canEdit} />
              <FieldRow label="Buyer Email" value={v("email")} onChange={set("email")} canEdit={canEdit} type="email" />
              <FieldRow label="Phone" value={v("phone")} onChange={set("phone")} canEdit={canEdit} />
              <FieldRow label="Product / Category" value={v("product")} onChange={set("product")} canEdit={canEdit} />
              <FieldRow label="Product Category" value={v("productCategory")} onChange={set("productCategory")} canEdit={canEdit} />

              {/* Campaign email account — fixed to partners@eectrade.com */}
              <div className="col-span-2">
                <Label className="text-xs text-slate-500 font-medium">Campaign Email Account</Label>
                <div className="mt-1 flex items-center gap-2 h-8 text-sm px-3 bg-slate-50 border border-slate-200 rounded-md">
                  <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className="text-slate-700 font-medium">{BUYER_GMAIL}</span>
                  <span className="text-xs text-slate-400 ml-auto">fixed for buyer outreach</span>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 font-medium">Notes</Label>
              <Textarea
                value={v("notes")} onChange={(e) => set("notes")(e.target.value)}
                disabled={!canEdit} rows={3} className="mt-1 text-sm"
                placeholder="Internal notes about this buyer prospect…"
              />
            </div>
          </div>
        </div>

        {/* ── Right: Campaign Status ─── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold text-slate-800 mb-3">Email Campaign</h2>

            {/* Sending account badge */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 pb-3 border-b border-slate-100">
              <Mail className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              <span className="font-medium text-slate-700">{BUYER_GMAIL}</span>
            </div>

            {/* Email template selector */}
            {emailTemplates.length > 0 && (
              <div className="mb-3 pb-3 border-b border-slate-100">
                <Label className="text-xs text-slate-500 font-medium">Email Template</Label>
                {canEdit && !buyer.emailCampaign ? (
                  <>
                    <select
                      value={(fields.emailTemplateId as string) ?? ""}
                      onChange={(e) => {
                        setFields((f) => ({ ...f, emailTemplateId: e.target.value || null }));
                        setIsDirty(true);
                      }}
                      className="mt-1 w-full border border-slate-200 rounded-md text-sm px-3 py-1.5 bg-white text-slate-700"
                    >
                      <option value="">Default buyer outreach emails</option>
                      {emailTemplates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (Default)" : ""}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Customise the intro and follow-up email content.</p>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-slate-600 flex items-center gap-1.5 h-8">
                    {(fields.emailTemplateId as string)
                      ? <><span className="font-medium">{emailTemplates.find((t) => t.id === fields.emailTemplateId)?.name ?? "Custom template"}</span>{buyer.emailCampaign && <span className="text-xs text-slate-400 ml-1">(locked)</span>}</>
                      : <span className="text-slate-400 italic">Default buyer outreach</span>}
                  </div>
                )}
              </div>
            )}

            {!campaign ? (
              <div className="space-y-3">
                {!buyer.email ? (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                    No email address set. Add one above and save before starting the campaign.
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">No campaign started yet.</p>
                )}
                {canEdit && buyer.email &&
                  buyer.status !== "converted_to_buyer" &&
                  buyer.status !== "no_response" && (
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
                  { step: 1, label: "Intro Email",  date: campaign.introEmailSentAt },
                  { step: 2, label: "Follow-up 1",  date: campaign.followup1SentAt },
                  { step: 3, label: "Follow-up 2",  date: campaign.followup2SentAt },
                  { step: 4, label: "Follow-up 3",  date: campaign.followup3SentAt },
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

                {canEdit && campaign.status === "active" && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {campaign.currentStep < 4 && (
                      <Button size="sm" variant="outline" className="w-full"
                        onClick={() => sendFollowupMutation.mutate()} disabled={sendFollowupMutation.isPending}>
                        {sendFollowupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Mail className="h-4 w-4 mr-1.5" />}
                        Send Follow-up {campaign.currentStep}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="w-full border-green-400 text-green-700 hover:bg-green-50"
                      onClick={() => markResponseMutation.mutate()} disabled={markResponseMutation.isPending}>
                      {markResponseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                      Mark as Responded
                    </Button>
                  </div>
                )}

                {/* Reply detected — ready to convert */}
                {canEdit && campaign.status === "response_received" && buyer.status !== "converted_to_buyer" && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <p className="text-xs text-emerald-700 font-medium">Buyer replied — ready to add to directory</p>
                    <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setConvertConfirmOpen(true)} disabled={markResponseMutation.isPending}>
                      {markResponseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserCheck className="h-4 w-4 mr-1.5" />}
                      Add to Buyers Directory
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Email Thread ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-800">Email Thread</h2>
          {emailReplies.length > 0 && (
            <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {emailReplies.length} messages
            </span>
          )}
          <div className="ml-auto flex gap-2" />
        </div>

        {emailReplies.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No email thread yet</p>
            <p className="text-xs mt-1">Messages will appear here once the campaign starts</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {emailReplies.map((msg) => {
              const isSent = msg.direction === "sent";
              const name = isSent ? "Élan Exports" : (msg.fromName ?? msg.fromEmail);
              const email = isSent ? BUYER_GMAIL : msg.fromEmail;
              const initial = name.charAt(0).toUpperCase();
              const cleanBody = stripQuotedText(msg.body);

              return (
                <div key={msg.id} className={`rounded-lg border text-sm ${isSent ? "border-blue-100 bg-blue-50" : "border-slate-200 bg-white"}`}>
                  <div className={`flex items-center gap-3 px-4 py-3 border-b ${isSent ? "border-blue-100" : "border-slate-100"}`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isSent ? "bg-blue-600 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{name}</p>
                      <p className="text-xs text-slate-400 truncate">{email}</p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 text-right">
                      {new Date(msg.receivedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <div className="px-4 py-3 text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {cleanBody || <span className="text-slate-400 italic">No content</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Convert Confirm Dialog ── */}
      <Dialog open={convertConfirmOpen} onOpenChange={setConvertConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Add to Buyers Directory?</DialogTitle>
          <DialogDescription>
            This will create a <strong>{buyer.company}</strong> record in the Buyers Directory and mark this outreach as converted. You will be taken to the buyer's profile.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConvertConfirmOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={markResponseMutation.isPending}
              onClick={() => { setConvertConfirmOpen(false); markResponseMutation.mutate(); }}
            >
              {markResponseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserCheck className="h-4 w-4 mr-1.5" />}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
