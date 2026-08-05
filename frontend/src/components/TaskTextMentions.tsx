import { Link } from "react-router-dom";
import { useMentionOptions, mentionDetailPath, type MentionOption } from "@/hooks/useMentionOptions";

type Segment = { text: string } | { mention: MentionOption };

// Greedy longest-match: at each "@" preceded by start-of-string/whitespace,
// try the longest known company label that starts right there and is
// followed by whitespace/end-of-string. Mentions are always inserted as
// "@Label " by TaskMentionInput, so this recovers them reliably; it can
// miss mentions whose trailing space was later stripped by manual edits.
const parseMentions = (text: string, options: MentionOption[]): Segment[] => {
  if (!text || options.length === 0) return [{ text }];
  const sorted = [...options].sort((a, b) => b.label.length - a.label.length);
  const segments: Segment[] = [];
  let i = 0;
  let plainStart = 0;

  while (i < text.length) {
    if (text[i] === "@" && (i === 0 || /\s/.test(text[i - 1]))) {
      const rest = text.slice(i + 1);
      const match = sorted.find((o) => {
        if (!rest.toLowerCase().startsWith(o.label.toLowerCase())) return false;
        const nextChar = rest[o.label.length];
        return nextChar === undefined || /\s/.test(nextChar);
      });
      if (match) {
        if (i > plainStart) segments.push({ text: text.slice(plainStart, i) });
        segments.push({ mention: match });
        i += 1 + match.label.length;
        plainStart = i;
        continue;
      }
    }
    i += 1;
  }
  if (plainStart < text.length) segments.push({ text: text.slice(plainStart) });
  return segments;
};

const mentionClass = (type: MentionOption["type"], linkable: boolean) =>
  `font-semibold ${linkable ? "cursor-pointer hover:underline" : ""} ${
    type === "supplier" ? "text-brand-600" : "text-purple-600"
  }`;

export function TaskTextMentions({ text }: { text: string }) {
  const { data } = useMentionOptions();
  const options: MentionOption[] = data ? [...data.suppliers, ...data.buyers] : [];
  const segments = parseMentions(text, options);

  return (
    <>
      {segments.map((seg, i) => {
        if ("text" in seg) return <span key={i}>{seg.text}</span>;
        const href = mentionDetailPath(seg.mention);
        if (href) {
          return (
            <Link
              key={i}
              to={href}
              onClick={(e) => e.stopPropagation()}
              className={mentionClass(seg.mention.type, true)}
            >
              @{seg.mention.label}
            </Link>
          );
        }
        return (
          <span key={i} className={mentionClass(seg.mention.type, false)}>
            @{seg.mention.label}
          </span>
        );
      })}
    </>
  );
}
