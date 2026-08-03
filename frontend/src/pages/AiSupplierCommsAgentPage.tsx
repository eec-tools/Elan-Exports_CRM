import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bot,
  Sparkles,
  Send,
  RefreshCw,
  Building2,
  Mail,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  Loader2,
  User,
  Globe,
  Package,
  CheckCircle2,
  ArrowLeft,
  PhoneCall,
  Award,
  Paperclip,
  Download,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ArchiveX,
} from "lucide-react";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { stripHtml, sanitizeEmailHtml, linkifyText, formatFileSize } from "@/components/EmailContent";
import { useResizableWidth } from "@/hooks/useResizableWidth";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { label: "procurement1@eectrade.com", account: "procurement1@eectrade.com" },
  { label: "procurement2@eectrade.com", account: "procurement2@eectrade.com" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatestReply {
  id: string;
  subject?: string | null;
  body: string;
  fromEmail: string;
  fromName?: string | null;
  receivedAt: string;
  repliedAt?: string | null;
  attachmentCount?: number;
}

type EntityType = "sourcing" | "new" | "signed";

interface InboxItem {
  id: string;
  entityType: EntityType;
  label: string;
  company: string;
  contactPerson?: string | null;
  email?: string | null;
  country?: string | null;
  product?: string | null;
  assignedGmailAccount: string;
  alreadyContacted: boolean;
  certifications?: string | null;
  supplierType?: string | null;
  notes?: string | null;
  campaignStatus: string;
  latestReply: LatestReply;
  unrepliedCount: number;
}

const ENTITY_ARCHIVE_ENDPOINT: Record<EntityType, string> = {
  sourcing: "sourcing-suppliers",
  new: "new-suppliers",
  signed: "suppliers",
};

const ENTITY_BADGE_STYLE: Record<EntityType, string> = {
  sourcing: "bg-emerald-100 text-emerald-700 border-emerald-200",
  new: "bg-blue-100 text-blue-700 border-blue-200",
  signed: "bg-violet-100 text-violet-700 border-violet-200",
};

function EntityBadge({ item, className = "" }: { item: InboxItem; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${ENTITY_BADGE_STYLE[item.entityType]} ${className}`}>
      {item.label}
    </span>
  );
}

interface ThreadAttachment {
  id: string;
  filename: string;
  mimeType?: string | null;
  size?: number | null;
  url: string;
}

interface ThreadMessage {
  id: string;
  direction: "sent" | "received";
  fromEmail: string;
  fromName?: string | null;
  subject?: string | null;
  body: string;
  bodyHtml?: string | null;
  receivedAt: string;
  attachments?: ThreadAttachment[];
}

interface PendingAttachment {
  filename: string;
  mimeType?: string;
  size?: number;
  s3Key?: string;
  url: string;
}

interface DraftResult { subject: string; body: string; }
interface ClarificationResult { clarificationsNeeded: string[]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, supplierCompany }: { msg: ThreadMessage; supplierCompany: string }) {
  const isSent = msg.direction === "sent";
  const plain = stripHtml(msg.body);

  return (
    <div className={`flex ${isSent ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
        isSent ? "bg-blue-600 text-white rounded-tr-sm" : "bg-muted border border-border text-foreground rounded-tl-sm"
      }`}>
        <div className={`text-xs mb-1 font-medium ${isSent ? "text-blue-200" : "text-muted-foreground"}`}>
          {isSent ? "You (EEC)" : msg.fromName ?? supplierCompany}
          {" · "}{formatTime(msg.receivedAt)}
        </div>
        {msg.subject && (
          <div className={`text-xs font-semibold mb-1.5 ${isSent ? "text-blue-100" : "text-muted-foreground"}`}>
            {msg.subject}
          </div>
        )}
        {msg.bodyHtml ? (
          <div
            className={`rounded-lg -mx-1 p-3 overflow-x-auto text-sm leading-relaxed [&_a]:underline [&_a]:break-all [&_img]:max-w-full [&_img]:h-auto [&_table]:max-w-full ${
              isSent ? "bg-white text-slate-900" : "bg-background"
            }`}
            dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(msg.bodyHtml) }}
          />
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">{linkifyText(plain)}</p>
        )}
        {!!msg.attachments?.length && (
          <div className="mt-2.5 flex flex-col gap-1.5">
            {msg.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                download={att.filename}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  isSent
                    ? "bg-blue-700/50 hover:bg-blue-700/70 text-blue-50"
                    : "bg-background border border-border hover:border-primary/40 text-foreground"
                }`}
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate flex-1">{att.filename}</span>
                {!!att.size && <span className="opacity-60 shrink-0">{formatFileSize(att.size)}</span>}
                <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Draft Panel ─────────────────────────────────────────────────────────────

function DraftPanel({
  item,
  onClose,
  onSent,
  onArchive,
  threadWidth,
  onThreadResize,
}: {
  item: InboxItem;
  onClose: () => void;
  onSent: () => void;
  onArchive: () => void;
  threadWidth: number;
  onThreadResize: (e: React.MouseEvent) => void;
}) {
  const queryClient = useQueryClient();

  const [contacted, setContacted] = useState(item.alreadyContacted);
  const [togglingContacted, setTogglingContacted] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [clarifications, setClarifications] = useState<string[]>([]);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: thread = [], isLoading: threadLoading } = useQuery<ThreadMessage[]>({
    queryKey: ["ai-supplier-comms-thread", item.entityType, item.id],
    queryFn: async () => {
      const res = await api.get(`/ai-supplier-comms/${item.entityType}/${item.id}/thread`);
      return res.data;
    },
  });

  useEffect(() => {
    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [thread]);

  async function handleToggleContacted() {
    setTogglingContacted(true);
    try {
      await api.patch(`/ai-supplier-comms/${item.entityType}/${item.id}/contacted`, { alreadyContacted: !contacted });
      setContacted((v) => !v);
      queryClient.invalidateQueries({ queryKey: ["ai-supplier-comms-inbox"] });
      toast.success(!contacted ? "Marked as already contacted" : "Marked as pending reply");
    } catch {
      toast.error("Failed to update contacted status");
    } finally {
      setTogglingContacted(false);
    }
  }

  async function generateDraft(extraContext = "") {
    setIsGenerating(true);
    setClarifications([]);
    setHasDraft(false);
    try {
      const res = await api.post(`/ai-supplier-comms/${item.entityType}/${item.id}/draft`, {
        replyId: item.latestReply.id,
        additionalContext: extraContext,
      });
      const data = res.data as DraftResult | ClarificationResult;
      if ("clarificationsNeeded" in data) {
        setClarifications(data.clarificationsNeeded);
        const initial: Record<string, string> = {};
        data.clarificationsNeeded.forEach((q) => { initial[q] = ""; });
        setClarificationAnswers(initial);
      } else {
        setDraftSubject(data.subject);
        setDraftBody(data.body);
        setHasDraft(true);
      }
    } catch {
      toast.error("AI draft failed — please try again");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleAnswerAndDraft() {
    const context = Object.entries(clarificationAnswers)
      .filter(([, v]) => v.trim())
      .map(([q, a]) => `Q: ${q}\nA: ${a}`)
      .join("\n\n");
    await generateDraft(context);
  }

  async function handleAttachFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingAttachment(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await api.post(`/ai-supplier-comms/${item.entityType}/${item.id}/upload-attachment`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setPendingAttachments((prev) => [...prev, res.data]);
      }
    } catch {
      toast.error("Failed to upload attachment");
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = "";
    }
  }

  function removeAttachment(index: number) {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    if (!draftSubject.trim() || !draftBody.trim()) {
      toast.error("Subject and body cannot be empty");
      return;
    }
    setIsSending(true);
    try {
      await api.post(`/ai-supplier-comms/${item.entityType}/${item.id}/send`, {
        replyId: item.latestReply.id,
        subject: draftSubject.trim(),
        body: draftBody.trim(),
        attachments: pendingAttachments,
      });
      toast.success(`Reply sent to ${item.company}`);
      setPendingAttachments([]);
      queryClient.invalidateQueries({ queryKey: ["ai-supplier-comms-inbox"] });
      onSent();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Failed to send reply");
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    generateDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card flex-shrink-0">
        <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm text-foreground leading-tight">{item.company}</p>
                <EntityBadge item={item} />
              </div>
              <p className="text-xs text-muted-foreground">{item.contactPerson ?? item.email ?? "—"}</p>
            </div>
          </div>
        </div>
        {item.entityType === "sourcing" && (
          <button
            onClick={handleToggleContacted}
            disabled={togglingContacted}
            title={contacted ? "Click to mark as pending reply" : "Click if already contacted via call/other channel"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              contacted
                ? "bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200"
                : "bg-muted border-border text-muted-foreground hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
            }`}
          >
            {togglingContacted ? <Loader2 className="h-3 w-3 animate-spin" /> : <PhoneCall className="h-3 w-3" />}
            {contacted ? "Already Contacted" : "Mark Contacted"}
          </button>
        )}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          <Mail className="h-3 w-3" />
          {item.assignedGmailAccount.split("@")[0]}
        </div>
        <button
          onClick={onArchive}
          title="Add to Archive"
          className="p-1.5 rounded hover:bg-amber-50 hover:text-amber-600 text-muted-foreground transition-colors"
        >
          <ArchiveX className="h-4 w-4" />
        </button>
      </div>

      {/* Supplier context strip */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-2 bg-emerald-50 border-b border-emerald-100 text-xs text-emerald-800 flex-shrink-0">
        {item.country && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{item.country}</span>}
        {item.product && <span className="flex items-center gap-1"><Package className="h-3 w-3" />{item.product}</span>}
        {item.supplierType && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{item.supplierType}</span>}
        {item.certifications && (
          <span className="flex items-center gap-1"><Award className="h-3 w-3" />Certs: {item.certifications}</span>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Thread */}
        <div className="flex flex-col border-r border-border flex-shrink-0" style={{ width: threadWidth }}>
          <div className="px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email Thread</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {threadLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading thread…
              </div>
            ) : thread.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No emails yet</p>
            ) : (
              thread.map((msg) => <MessageBubble key={msg.id} msg={msg} supplierCompany={item.company} />)
            )}
            <div ref={threadEndRef} />
          </div>
        </div>

        <ResizeHandle onMouseDown={onThreadResize} />

        {/* Right: AI Draft */}
        <div className="flex-1 flex flex-col min-w-[320px]">
          <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Draft</p>
            </div>
            {hasDraft && !isGenerating && (
              <button
                onClick={() => generateDraft()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3 w-3" />Regenerate
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isGenerating && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-12">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full animate-pulse" />
                </div>
                <p className="text-sm font-medium">AI is reading the conversation…</p>
                <p className="text-xs text-center max-w-xs">Analyzing supplier's capabilities and crafting a personalized procurement reply</p>
              </div>
            )}

            {!isGenerating && clarifications.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">AI needs more information</p>
                    <p className="text-xs text-amber-700 mt-0.5">Answer the questions below to get an accurate draft.</p>
                  </div>
                </div>
                {clarifications.map((q, i) => (
                  <div key={i} className="space-y-1.5">
                    <Label className="text-sm font-medium text-foreground flex items-start gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                      {q}
                    </Label>
                    <Input
                      value={clarificationAnswers[q] ?? ""}
                      onChange={(e) => setClarificationAnswers((prev) => ({ ...prev, [q]: e.target.value }))}
                      placeholder="Your answer…"
                      className="text-sm"
                    />
                  </div>
                ))}
                <Button
                  onClick={handleAnswerAndDraft}
                  disabled={Object.values(clarificationAnswers).some((v) => !v.trim())}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Sparkles className="h-4 w-4" />Generate Draft with Answers
                </Button>
              </div>
            )}

            {!isGenerating && hasDraft && (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-800 font-medium">Draft ready — review, edit, then send</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">SUBJECT</Label>
                  <Input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} className="text-sm font-medium" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">BODY</Label>
                  <textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                    rows={14}
                  />
                </div>
                <div className="space-y-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleAttachFiles}
                  />
                  {pendingAttachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1">{att.filename}</span>
                      {!!att.size && <span className="text-muted-foreground shrink-0">{formatFileSize(att.size)}</span>}
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAttachment}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
                  >
                    {isUploadingAttachment ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading…</>
                    ) : (
                      <><Paperclip className="h-3.5 w-3.5" />Attach files</>
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Your default signature will be appended automatically when sent.</p>
              </div>
            )}

            {!isGenerating && !hasDraft && clarifications.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-12">
                <Bot className="h-10 w-10 opacity-30" />
                <p className="text-sm">Ready to draft a reply</p>
                <Button size="sm" onClick={() => generateDraft()} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Sparkles className="h-4 w-4" />Generate AI Draft
                </Button>
              </div>
            )}
          </div>

          {hasDraft && !isGenerating && (
            <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between gap-3 flex-shrink-0">
              <p className="text-xs text-muted-foreground">
                Sending as <span className="font-medium text-foreground">{item.assignedGmailAccount}</span>
              </p>
              <Button
                onClick={handleSend}
                disabled={isSending || !draftSubject.trim() || !draftBody.trim()}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {isSending ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <><Send className="h-4 w-4" />Send Reply</>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inbox Card ───────────────────────────────────────────────────────────────

function InboxCard({ item, onSelect, onArchive }: { item: InboxItem; onSelect: () => void; onArchive: () => void }) {
  const isReplied = !!item.latestReply.repliedAt;
  const plain = stripHtml(item.latestReply.body);
  const snippet = plain.length > 120 ? plain.slice(0, 120) + "…" : plain;

  return (
    <div
      className={`group relative rounded-xl border bg-card p-4 cursor-pointer hover:shadow-md hover:border-emerald-400/40 transition-all ${isReplied ? "opacity-60" : ""}`}
      onClick={onSelect}
    >
      {!isReplied && !item.alreadyContacted && (
        <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      )}
      <button
        type="button"
        title="Add to Archive"
        onClick={(e) => { e.stopPropagation(); onArchive(); }}
        className="absolute top-3 right-3 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-amber-600 hover:bg-amber-50 transition-all"
      >
        <ArchiveX className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
          <Building2 className="text-white" style={{ width: 18, height: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{item.company}</p>
              <EntityBadge item={item} className="flex-shrink-0" />
              {item.unrepliedCount > 1 && (
                <span className="flex-shrink-0 text-xs bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5">
                  {item.unrepliedCount} new
                </span>
              )}
            </div>
            <span className="flex-shrink-0 text-xs text-muted-foreground">{timeAgo(item.latestReply.receivedAt)}</span>
          </div>

          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {item.contactPerson && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />{item.contactPerson}
              </span>
            )}
            {item.country && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />{item.country}
              </span>
            )}
            {item.product && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                <Package className="h-3 w-3" />{item.product}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">
              {item.latestReply.subject ?? "(no subject)"}
            </p>
            {!!item.latestReply.attachmentCount && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                <Paperclip className="h-3 w-3" />{item.latestReply.attachmentCount}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{snippet}</p>

          {item.certifications && (
            <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 rounded-md px-2 py-1 w-fit">
              <Award className="h-3 w-3 flex-shrink-0" />
              <span className="truncate max-w-xs">{item.certifications}</span>
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1 group-hover:text-emerald-600 transition-colors" />
      </div>

      {item.alreadyContacted && (
        <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
          <PhoneCall className="h-3 w-3" />Already contacted via other channel
        </div>
      )}
      {isReplied && !item.alreadyContacted && (
        <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />Replied {timeAgo(item.latestReply.repliedAt!)}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AiSupplierCommsAgentPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [inboxCollapsed, setInboxCollapsed] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<InboxItem | null>(null);
  const queryClient = useQueryClient();
  const { width: inboxWidth, onMouseDown: onInboxResize } = useResizableWidth(
    "ai-supplier-comms-inbox-width", 380, 260, 640,
  );
  const { width: threadWidth, onMouseDown: onThreadResize } = useResizableWidth(
    "ai-supplier-comms-thread-width", 460, 320, 900,
  );

  const { data: inbox = [], isLoading, refetch } = useQuery<InboxItem[]>({
    queryKey: ["ai-supplier-comms-inbox", TABS[activeTab].account],
    queryFn: async () => {
      const res = await api.get("/ai-supplier-comms/inbox", {
        params: { account: TABS[activeTab].account },
      });
      return res.data;
    },
    refetchInterval: 60_000,
  });

  const archiveMutation = useMutation({
    mutationFn: (item: InboxItem) => api.patch(`/${ENTITY_ARCHIVE_ENDPOINT[item.entityType]}/${item.id}/archive`),
    onSuccess: (_res, item) => {
      queryClient.invalidateQueries({ queryKey: ["ai-supplier-comms-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers-stats"] });
      queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (selectedItem?.id === item.id) setSelectedItem(null);
      setArchiveTarget(null);
      toast.success(`${item.label} moved to archive`);
    },
    onError: () => toast.error("Failed to archive supplier"),
  });

  useEffect(() => { setSelectedItem(null); }, [activeTab]);

  const unreplied = inbox.filter((i) => !i.latestReply.repliedAt && !i.alreadyContacted);
  const alreadyContacted = inbox.filter((i) => i.alreadyContacted);
  const replied = inbox.filter((i) => !!i.latestReply.repliedAt && !i.alreadyContacted);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">AI Supplier Comms Agent</h1>
            <p className="text-xs text-muted-foreground">AI-drafted replies to supplier emails · review &amp; send manually</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-border bg-background flex-shrink-0 overflow-x-auto">
        {TABS.map((tab, i) => {
          const count = i === activeTab ? unreplied.length : 0;
          return (
            <button
              key={tab.account}
              onClick={() => setActiveTab(i)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                i === activeTab
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              {tab.label}
              {i === activeTab && count > 0 && (
                <span className="h-5 min-w-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center px-1">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Inbox list */}
        <div
          className={`flex flex-col border-r border-border ${selectedItem ? "flex-shrink-0" : "flex-1"}`}
          style={selectedItem ? { width: inboxCollapsed ? 56 : inboxWidth } : undefined}
        >
          {selectedItem && (
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 flex-shrink-0">
              {!inboxCollapsed && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Inbox</p>
              )}
              <button
                onClick={() => setInboxCollapsed((v) => !v)}
                className="p-1 rounded hover:bg-muted transition-colors ml-auto"
                title={inboxCollapsed ? "Expand inbox list" : "Collapse inbox list"}
              >
                {inboxCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {inboxCollapsed ? (
              <div className="flex flex-col items-center gap-2 py-3">
                {[...unreplied, ...alreadyContacted, ...replied].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    title={item.company}
                    className={`relative h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold transition-all ${
                      selectedItem?.id === item.id
                        ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {item.company.charAt(0).toUpperCase()}
                    {!item.latestReply.repliedAt && !item.alreadyContacted && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading inbox…
              </div>
            ) : inbox.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <MessageSquare className="h-10 w-10 opacity-25" />
                <p className="text-sm font-medium">No supplier replies for this account</p>
                <p className="text-xs text-center max-w-xs">When suppliers respond to your outreach, their replies will appear here.</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {unreplied.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Needs Reply · {unreplied.length}
                    </p>
                    {unreplied.map((item) => (
                      <InboxCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} onArchive={() => setArchiveTarget(item)} />
                    ))}
                  </div>
                )}

                {alreadyContacted.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 px-1">
                      <PhoneCall className="h-3 w-3 text-emerald-600" />
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                        Already Contacted · {alreadyContacted.length}
                      </p>
                    </div>
                    {alreadyContacted.map((item) => (
                      <InboxCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} onArchive={() => setArchiveTarget(item)} />
                    ))}
                  </div>
                )}

                {replied.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Replied · {replied.length}
                    </p>
                    {replied.map((item) => (
                      <InboxCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} onArchive={() => setArchiveTarget(item)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedItem && !inboxCollapsed && <ResizeHandle onMouseDown={onInboxResize} />}

        {/* Draft panel */}
        {selectedItem && (
          <div className="flex-1 min-w-0 flex flex-col bg-background">
            <DraftPanel
              key={selectedItem.id}
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onSent={() => setSelectedItem(null)}
              onArchive={() => setArchiveTarget(selectedItem)}
              threadWidth={threadWidth}
              onThreadResize={onThreadResize}
            />
          </div>
        )}

        {!selectedItem && inbox.length > 0 && (
          <div className="flex-1 hidden lg:flex flex-col items-center justify-center text-muted-foreground gap-3 bg-muted/10">
            <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-sm font-medium">Select a message to draft a reply</p>
            <p className="text-xs text-center max-w-xs">AI will analyze the supplier's product capabilities and craft a professional procurement response.</p>
          </div>
        )}
      </div>

      {/* Archive confirmation */}
      <Dialog
        open={!!archiveTarget}
        onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Move to Archive?</DialogTitle>
          <DialogDescription>
            Move <strong>{archiveTarget?.company}</strong> to the archive — you
            can restore it anytime from Archived Suppliers.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={archiveMutation.isPending}
              onClick={() => archiveTarget && archiveMutation.mutate(archiveTarget)}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {archiveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArchiveX className="h-4 w-4" />
              )}
              Move to Archive
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
