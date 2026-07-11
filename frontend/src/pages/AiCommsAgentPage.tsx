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
  Clock,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  Loader2,
  X,
  User,
  Globe,
  Package,
  CheckCircle2,
  ArrowLeft,
  Plus,
} from "lucide-react";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

const TABS = [
  { label: "partners@eectrade.com",      account: "partners@eectrade.com" },
  { label: "procurement1@eectrade.com",  account: "procurement1@eectrade.com" },
  { label: "procurement2@eectrade.com",  account: "procurement2@eectrade.com" },
];

interface VaultContact {
  keyPainPoints?: string | null;
  personalizationQuality?: string | null;
  website?: string | null;
  linkedin?: string | null;
  country?: string | null;
  product?: string | null;
}

interface LatestReply {
  id: string;
  subject?: string | null;
  body: string;
  fromEmail: string;
  fromName?: string | null;
  receivedAt: string;
  repliedAt?: string | null;
}

interface InboxItem {
  id: string;
  company: string;
  contactPerson?: string | null;
  email?: string | null;
  country?: string | null;
  product?: string | null;
  assignedGmailAccount: string;
  campaignStatus: string;
  latestReply: LatestReply;
  unrepliedCount: number;
  vaultContact?: VaultContact | null;
}

interface ThreadMessage {
  id: string;
  direction: "sent" | "received";
  fromEmail: string;
  fromName?: string | null;
  subject?: string | null;
  body: string;
  receivedAt: string;
}

interface DraftResult {
  subject: string;
  body: string;
}

interface ClarificationResult {
  clarificationsNeeded: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n").trim();
}

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

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, buyerCompany }: { msg: ThreadMessage; buyerCompany: string }) {
  const isSent = msg.direction === "sent";
  const plain = stripHtml(msg.body);
  const preview = plain.length > 300 ? plain.slice(0, 300) + "…" : plain;

  return (
    <div className={`flex ${isSent ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
        isSent
          ? "bg-blue-600 text-white rounded-tr-sm"
          : "bg-muted border border-border text-foreground rounded-tl-sm"
      }`}>
        <div className={`text-xs mb-1 font-medium ${isSent ? "text-blue-200" : "text-muted-foreground"}`}>
          {isSent ? "You (EEC)" : msg.fromName ?? buyerCompany}
          {" · "}{formatTime(msg.receivedAt)}
        </div>
        {msg.subject && (
          <div className={`text-xs font-semibold mb-1.5 ${isSent ? "text-blue-100" : "text-muted-foreground"}`}>
            {msg.subject}
          </div>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{preview}</p>
      </div>
    </div>
  );
}

// ─── Draft Panel ─────────────────────────────────────────────────────────────

function DraftPanel({
  item,
  onClose,
  onSent,
}: {
  item: InboxItem;
  onClose: () => void;
  onSent: () => void;
}) {
  const queryClient = useQueryClient();

  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [clarifications, setClarifications] = useState<string[]>([]);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Fetch full thread
  const { data: thread = [], isLoading: threadLoading } = useQuery<ThreadMessage[]>({
    queryKey: ["ai-comms-thread", item.id],
    queryFn: async () => {
      const res = await api.get(`/ai-comms/${item.id}/thread`);
      return res.data;
    },
  });

  useEffect(() => {
    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [thread]);

  async function generateDraft(extraContext = "") {
    setIsGenerating(true);
    setClarifications([]);
    setHasDraft(false);
    try {
      const res = await api.post(`/ai-comms/${item.id}/draft`, {
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

  async function handleSend() {
    if (!draftSubject.trim() || !draftBody.trim()) {
      toast.error("Subject and body cannot be empty");
      return;
    }
    setIsSending(true);
    try {
      await api.post(`/ai-comms/${item.id}/send`, {
        replyId: item.latestReply.id,
        subject: draftSubject.trim(),
        body: draftBody.trim(),
      });
      toast.success(`Reply sent to ${item.company}`);
      queryClient.invalidateQueries({ queryKey: ["ai-comms-inbox"] });
      onSent();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Failed to send reply");
    } finally {
      setIsSending(false);
    }
  }

  // Auto-generate on mount
  useEffect(() => {
    generateDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestReceived = item.latestReply;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card flex-shrink-0">
        <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground leading-tight">{item.company}</p>
              <p className="text-xs text-muted-foreground">{item.contactPerson ?? item.email ?? "—"}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          <Mail className="h-3 w-3" />
          {item.assignedGmailAccount.split("@")[0]}
        </div>
      </div>

      {/* Buyer context strip */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-800 flex-shrink-0">
        {item.country && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{item.country}</span>}
        {item.product && <span className="flex items-center gap-1"><Package className="h-3 w-3" />{item.product}</span>}
        {item.vaultContact?.keyPainPoints && (
          <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" />Pain: {item.vaultContact.keyPainPoints}</span>
        )}
        {item.vaultContact?.personalizationQuality && (
          <span className="text-blue-600">Quality: {item.vaultContact.personalizationQuality}</span>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Thread */}
        <div className="w-[45%] flex flex-col border-r border-border">
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
              thread.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} buyerCompany={item.company} />
              ))
            )}
            <div ref={threadEndRef} />
          </div>
        </div>

        {/* Right: AI Draft */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
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
            {/* Generating state */}
            {isGenerating && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-12">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-indigo-500 rounded-full animate-pulse" />
                </div>
                <p className="text-sm font-medium">AI is reading the conversation…</p>
                <p className="text-xs text-center max-w-xs">Analyzing buyer's tone, pain points, and crafting a personalized reply</p>
              </div>
            )}

            {/* Clarification form */}
            {!isGenerating && clarifications.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">AI needs more information</p>
                    <p className="text-xs text-amber-700 mt-0.5">Answer the questions below so the AI can draft an accurate reply.</p>
                  </div>
                </div>
                {clarifications.map((q, i) => (
                  <div key={i} className="space-y-1.5">
                    <Label className="text-sm font-medium text-foreground flex items-start gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
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
                  className="w-full gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Draft with Answers
                </Button>
              </div>
            )}

            {/* Draft form */}
            {!isGenerating && hasDraft && (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-800 font-medium">Draft ready — review, edit, then send</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">SUBJECT</Label>
                  <Input
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                    className="text-sm font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">BODY</Label>
                  <textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    rows={14}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Your default signature will be appended automatically when sent.
                </p>
              </div>
            )}

            {/* Empty state — no generation yet but also not generating */}
            {!isGenerating && !hasDraft && clarifications.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-12">
                <Bot className="h-10 w-10 opacity-30" />
                <p className="text-sm">Ready to draft a reply</p>
                <Button size="sm" onClick={() => generateDraft()} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate AI Draft
                </Button>
              </div>
            )}
          </div>

          {/* Send bar */}
          {hasDraft && !isGenerating && (
            <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between gap-3 flex-shrink-0">
              <p className="text-xs text-muted-foreground">
                Sending as <span className="font-medium text-foreground">{item.assignedGmailAccount}</span>
              </p>
              <Button
                onClick={handleSend}
                disabled={isSending || !draftSubject.trim() || !draftBody.trim()}
                className="gap-2"
              >
                {isSending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                ) : (
                  <><Send className="h-4 w-4" />Send Reply</>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inbox Card ───────────────────────────────────────────────────────────────

function InboxCard({ item, onSelect }: { item: InboxItem; onSelect: () => void }) {
  const isReplied = !!item.latestReply.repliedAt;
  const plain = stripHtml(item.latestReply.body);
  const snippet = plain.length > 120 ? plain.slice(0, 120) + "…" : plain;

  return (
    <div
      className={`group relative rounded-xl border bg-card p-4 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all ${
        isReplied ? "opacity-60" : ""
      }`}
      onClick={onSelect}
    >
      {!isReplied && (
        <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
      )}
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{item.company}</p>
              {item.unrepliedCount > 1 && (
                <span className="flex-shrink-0 text-xs bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5">
                  {item.unrepliedCount} new
                </span>
              )}
            </div>
            <span className="flex-shrink-0 text-xs text-muted-foreground">{timeAgo(item.latestReply.receivedAt)}</span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
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

          <p className="mt-1.5 text-xs text-muted-foreground font-medium truncate">
            {item.latestReply.subject ?? "(no subject)"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{snippet}</p>

          {item.vaultContact?.keyPainPoints && (
            <div className="mt-2 flex items-center gap-1 text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 w-fit">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span className="truncate max-w-xs">{item.vaultContact.keyPainPoints}</span>
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1 group-hover:text-primary transition-colors" />
      </div>

      {isReplied && (
        <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />Replied {timeAgo(item.latestReply.repliedAt!)}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AiCommsAgentPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);

  const { data: inbox = [], isLoading, refetch } = useQuery<InboxItem[]>({
    queryKey: ["ai-comms-inbox", TABS[activeTab].account],
    queryFn: async () => {
      const res = await api.get("/ai-comms/inbox", {
        params: { account: TABS[activeTab].account },
      });
      return res.data;
    },
    refetchInterval: 60_000,
  });

  // Reset selected item when switching tabs
  useEffect(() => {
    setSelectedItem(null);
  }, [activeTab]);

  const unreplied = inbox.filter((i) => !i.latestReply.repliedAt);
  const replied = inbox.filter((i) => !!i.latestReply.repliedAt);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">AI Communication Agent</h1>
            <p className="text-xs text-muted-foreground">AI-drafted replies · review &amp; send manually</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-border bg-background flex-shrink-0 overflow-x-auto">
        {TABS.map((tab, i) => {
          const tabInbox = i === activeTab ? inbox : [];
          const count = i === activeTab ? unreplied.length : 0;
          return (
            <button
              key={tab.account}
              onClick={() => setActiveTab(i)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                i === activeTab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              {tab.label}
              {i === activeTab && count > 0 && (
                <span className="h-5 min-w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center px-1">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Inbox list — always visible */}
        <div className={`flex flex-col border-r border-border transition-all ${selectedItem ? "w-[380px] flex-shrink-0" : "flex-1"}`}>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading inbox…
              </div>
            ) : inbox.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <MessageSquare className="h-10 w-10 opacity-25" />
                <p className="text-sm font-medium">No replies for this account</p>
                <p className="text-xs text-center max-w-xs">When buyers respond to your outreach, their replies will appear here for AI-assisted replies.</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Unreplied */}
                {unreplied.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Needs Reply · {unreplied.length}
                    </p>
                    {unreplied.map((item) => (
                      <InboxCard
                        key={item.id}
                        item={item}
                        onSelect={() => setSelectedItem(item)}
                      />
                    ))}
                  </div>
                )}

                {/* Already replied */}
                {replied.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Replied · {replied.length}
                    </p>
                    {replied.map((item) => (
                      <InboxCard
                        key={item.id}
                        item={item}
                        onSelect={() => setSelectedItem(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Draft panel */}
        {selectedItem && (
          <div className="flex-1 min-w-0 flex flex-col bg-background">
            <DraftPanel
              key={selectedItem.id}
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onSent={() => setSelectedItem(null)}
            />
          </div>
        )}

        {/* Empty right state when no item selected and list is non-empty */}
        {!selectedItem && inbox.length > 0 && (
          <div className="flex-1 hidden lg:flex flex-col items-center justify-center text-muted-foreground gap-3 bg-muted/10">
            <div className="h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-indigo-400" />
            </div>
            <p className="text-sm font-medium">Select a message to draft a reply</p>
            <p className="text-xs text-center max-w-xs">AI will analyze the buyer's tone, pain points, and conversation history to craft a personalized response.</p>
          </div>
        )}
      </div>
    </div>
  );
}
