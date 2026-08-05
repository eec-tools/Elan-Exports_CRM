import { Fragment, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, Plus } from "lucide-react";
import { useMentionOptions, type MentionOption } from "@/hooks/useMentionOptions";

interface MentionMatch {
  start: number;
  query: string;
}

const detectMention = (text: string, caret: number): MentionMatch | null => {
  const upToCaret = text.slice(0, caret);
  const atIndex = upToCaret.lastIndexOf("@");
  if (atIndex === -1) return null;
  if (atIndex > 0 && !/\s/.test(upToCaret[atIndex - 1])) return null;
  const query = upToCaret.slice(atIndex + 1);
  if (/\s/.test(query)) return null;
  return { start: atIndex, query };
};

interface TaskMentionInputProps {
  value: string;
  autoFocus?: boolean;
  className?: string;
  onChange: (value: string) => void;
  onSave: (value?: string) => void;
  onCancel: () => void;
}

export function TaskMentionInput({
  value,
  autoFocus,
  className,
  onChange,
  onSave,
  onCancel,
}: TaskMentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const navigate = useNavigate();

  const { data } = useMentionOptions();

  const allOptions: MentionOption[] = data ? [...data.suppliers, ...data.buyers] : [];
  const filtered = (
    query
      ? allOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
      : allOptions
  ).slice(0, 8);

  const closeDropdown = () => {
    setShowDropdown(false);
    setMentionStart(null);
    setQuery("");
  };

  const insertMention = (label: string) => {
    if (mentionStart === null || !inputRef.current) return;
    const caret = inputRef.current.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);
    const newValue = `${before}@${label} ${after}`;
    onChange(newValue);
    closeDropdown();
    requestAnimationFrame(() => {
      const pos = before.length + label.length + 2;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  const handleCreateNew = (type: "supplier" | "buyer") => {
    const name = query.trim();
    if (!name) return;
    onSave(value);
    navigate(type === "supplier" ? "/suppliers/signed-contract" : "/buyers", {
      state: { openAddDialog: true, prefillCompany: name },
    });
  };

  const handleChangeInternal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    const caret = e.target.selectionStart ?? newVal.length;
    const mention = detectMention(newVal, caret);
    if (mention) {
      setMentionStart(mention.start);
      setQuery(mention.query);
      setShowDropdown(true);
      setHighlightIndex(0);
    } else {
      closeDropdown();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown) {
      if (e.key === "ArrowDown" && filtered.length > 0) {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp" && filtered.length > 0) {
        e.preventDefault();
        setHighlightIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        insertMention(filtered[highlightIndex].label);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeDropdown();
        return;
      }
    }
    if (e.key === "Enter") {
      onSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <Fragment>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        type="text"
        className={className}
        value={value}
        onChange={handleChangeInternal}
        onBlur={() => onSave()}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && (
        <div
          className="absolute left-0 top-full mt-1 w-88 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-30"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          {filtered.length > 0 ? (
            filtered.map((opt, i) => (
              <button
                key={`${opt.type}-${opt.id}`}
                type="button"
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  i === highlightIndex ? "bg-slate-50" : ""
                }`}
                onClick={() => insertMention(opt.label)}
              >
                <span className="truncate text-slate-800 font-medium">{opt.label}</span>
                <span
                  className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                    opt.type === "supplier"
                      ? "bg-brand-50 text-brand-600 border border-brand-100"
                      : "bg-purple-50 text-purple-600 border border-purple-100"
                  }`}
                >
                  {opt.type === "supplier" ? (
                    <Building2 className="h-3 w-3" />
                  ) : (
                    <Users className="h-3 w-3" />
                  )}
                  {opt.type === "supplier" ? "Supplier" : "Buyer"}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
          )}
          {query.trim() && (
            <div className="border-t border-slate-100 p-1.5 flex flex-col gap-1">
              <button
                type="button"
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-md"
                onClick={() => handleCreateNew("supplier")}
              >
                <Plus className="h-3.5 w-3.5" /> Create "{query.trim()}" as new Supplier
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-md"
                onClick={() => handleCreateNew("buyer")}
              >
                <Plus className="h-3.5 w-3.5" /> Create "{query.trim()}" as new Buyer
              </button>
            </div>
          )}
        </div>
      )}
    </Fragment>
  );
}
