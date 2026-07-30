import DOMPurify from "dompurify";
import { Paperclip, Download } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType?: string | null;
  size?: number | null;
  url: string;
}

// ─── Sanitization ─────────────────────────────────────────────────────────────

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input", "link", "meta"],
    FORBID_ATTR: ["srcset"],
  });
}

// ─── Plain-text helpers ───────────────────────────────────────────────────────

/** Converts an HTML email body to plain text (for snippets/previews). */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n").trim();
}

/** Strips trailing quoted reply chains from a plain-text email body. */
export function stripQuotedText(body: string): string {
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

export function linkifyText(text: string): React.ReactNode[] {
  const urlPattern = /(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = urlPattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    let url = match[0];
    let trailing = "";
    const trailingMatch = url.match(/[.,;:!?]+$/);
    if (trailingMatch) {
      trailing = trailingMatch[0];
      url = url.slice(0, -trailing.length);
    }

    nodes.push(
      <a
        key={key++}
        href={url.startsWith("http") ? url : `https://${url}`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 break-all hover:opacity-80"
      >
        {url}
      </a>
    );
    if (trailing) nodes.push(trailing);
    lastIndex = urlPattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Body renderer ────────────────────────────────────────────────────────────

/**
 * Renders an email body as sanitized HTML when available, falling back to
 * quote-stripped, linkified plain text for older messages stored before
 * HTML bodies were captured.
 */
export function EmailBody({
  bodyHtml,
  bodyText,
  className = "",
}: {
  bodyHtml?: string | null;
  bodyText: string;
  className?: string;
}) {
  if (bodyHtml) {
    return (
      <div
        className={`overflow-x-auto text-sm leading-relaxed [&_a]:underline [&_a]:break-all [&_img]:max-w-full [&_img]:h-auto [&_table]:max-w-full ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(bodyHtml) }}
      />
    );
  }

  const clean = stripQuotedText(bodyText);
  return (
    <p className={`whitespace-pre-wrap leading-relaxed text-sm ${className}`}>
      {clean ? linkifyText(clean) : <span className="italic opacity-60">No content</span>}
    </p>
  );
}

// ─── Attachment list ──────────────────────────────────────────────────────────

export function EmailAttachmentList({ attachments }: { attachments?: EmailAttachment[] | null }) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-2.5 flex flex-col gap-1.5">
      {attachments.map((att) => (
        <a
          key={att.id}
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          download={att.filename}
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 hover:border-primary/40 px-2.5 py-1.5 text-xs text-foreground transition-colors"
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate flex-1">{att.filename}</span>
          {!!att.size && <span className="opacity-60 shrink-0">{formatFileSize(att.size)}</span>}
          <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </a>
      ))}
    </div>
  );
}
