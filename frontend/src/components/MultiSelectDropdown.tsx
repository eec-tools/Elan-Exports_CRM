import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Plus, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MultiSelectDropdownProps {
  value: string; // comma-separated stored value
  onChange: (val: string) => void;
  options: string[]; // base options list
  placeholder?: string;
  className?: string;
}

export function MultiSelectDropdown({
  value,
  onChange,
  options,
  placeholder = "Select options…",
  className = "",
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [othersChecked, setOthersChecked] = useState(false);
  const [othersInput, setOthersInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value into selected set
  const selected = new Set(
    value
      ? value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : []
  );

  // Build full options list: base + any custom values from stored string
  const [extraOptions, setExtraOptions] = useState<string[]>(() => {
    const stored = value
      ? value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
    return stored.filter((v) => !options.includes(v));
  });

  // Sync extra options when value prop changes (e.g., form reset or edit open)
  useEffect(() => {
    const stored = value
      ? value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
    const extras = stored.filter((v) => !options.includes(v));
    setExtraOptions((prev) => {
      const combined = [...new Set([...prev, ...extras])];
      return combined;
    });
  }, [value, options]);

  const allOptions = [...options, ...extraOptions];

  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) {
      next.delete(opt);
    } else {
      next.add(opt);
    }
    onChange([...next].join(", "));
  };

  const addCustom = () => {
    const trimmed = othersInput.trim();
    if (!trimmed) return;
    if (!allOptions.includes(trimmed)) {
      setExtraOptions((prev) => [...prev, trimmed]);
    }
    const next = new Set(selected);
    next.add(trimmed);
    onChange([...next].join(", "));
    setOthersInput("");
    setOthersChecked(false);
  };

  const removeSelected = (opt: string) => {
    const next = new Set(selected);
    next.delete(opt);
    onChange([...next].join(", "));
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedArr = [...selected];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex flex-wrap gap-1 flex-1 text-left">
          {selectedArr.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selectedArr.map((opt) => (
              <span
                key={opt}
                className="inline-flex items-center gap-0.5 rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700"
              >
                {opt}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-brand-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSelected(opt);
                  }}
                />
              </span>
            ))
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground ml-1" />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-white shadow-lg">
          <div className="max-h-60 overflow-y-auto p-1">
            {allOptions.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    selected.has(opt)
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-slate-300"
                  }`}
                  onClick={() => toggle(opt)}
                >
                  {selected.has(opt) && <Check className="h-3 w-3" />}
                </span>
                <span onClick={() => toggle(opt)} className="flex-1">
                  {opt}
                </span>
              </label>
            ))}

            {/* Others row */}
            <div className="border-t border-slate-100 mt-1 pt-1">
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    othersChecked
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-slate-300"
                  }`}
                  onClick={() => setOthersChecked((c) => !c)}
                >
                  {othersChecked && <Check className="h-3 w-3" />}
                </span>
                <span
                  className="flex-1 text-slate-500 italic"
                  onClick={() => setOthersChecked((c) => !c)}
                >
                  Others
                </span>
              </label>
              {othersChecked && (
                <div className="flex items-center gap-1 px-2 pb-2 pt-1">
                  <Input
                    className="h-7 text-xs"
                    placeholder="Type custom option…"
                    value={othersInput}
                    onChange={(e) => setOthersInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustom();
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="h-7 w-7 shrink-0 bg-brand-500 hover:bg-brand-600"
                    onClick={addCustom}
                  >
                    <Plus className="h-3 w-3 text-white" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
