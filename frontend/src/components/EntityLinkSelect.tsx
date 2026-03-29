import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Check } from "lucide-react";

export interface EntityOption {
  id: string;
  label: string;
  type?: "new" | "signed";
}

interface EntityLinkSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  options: EntityOption[];
  placeholder?: string;
  isLoading?: boolean;
  className?: string;
}

export function EntityLinkSelect({
  selectedIds,
  onChange,
  options,
  placeholder = "Select…",
  isLoading = false,
  className = "",
}: EntityLinkSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const remove = (id: string) => {
    onChange(selectedIds.filter((sid) => sid !== id));
  };

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedOptions = options.filter((opt) => selectedIds.includes(opt.id));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex flex-wrap gap-1 flex-1 text-left">
          {selectedOptions.length === 0 ? (
            <span className="text-muted-foreground">
              {isLoading ? "Loading…" : placeholder}
            </span>
          ) : (
            selectedOptions.map((opt) => (
              <span
                key={opt.id}
                className="inline-flex items-center gap-0.5 rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700"
              >
                {opt.label}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-brand-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(opt.id);
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
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {isLoading ? (
              <div className="px-2 py-3 text-center text-xs text-slate-400">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-slate-400">No options found</div>
            ) : (
              filtered.map((opt) => {
                const selected = selectedIds.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggle(opt.id)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        selected
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-slate-300"
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 text-left">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
