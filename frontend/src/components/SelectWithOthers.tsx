import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface SelectWithOthersProps {
  value: string;
  onChange: (val: string) => void;
  options: string[]; // base options
  placeholder?: string;
  className?: string;
}

const OTHERS_SENTINEL = "__others__";

export function SelectWithOthers({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
}: SelectWithOthersProps) {
  // If value is not in base options, treat it as a custom value
  const isCustom = value !== "" && !options.includes(value);

  const [extraOptions, setExtraOptions] = useState<string[]>(() =>
    isCustom ? [value] : []
  );
  const [showInput, setShowInput] = useState(false);
  const [inputVal, setInputVal] = useState("");

  // When value changes from outside (e.g., form pre-fill), sync extra options
  useEffect(() => {
    if (value && !options.includes(value)) {
      setExtraOptions((prev) =>
        prev.includes(value) ? prev : [...prev, value]
      );
    }
  }, [value, options]);

  const allOptions = [...options, ...extraOptions];

  const handleSelectChange = (val: string) => {
    if (val === OTHERS_SENTINEL) {
      setShowInput(true);
      setInputVal("");
    } else {
      setShowInput(false);
      onChange(val);
    }
  };

  const confirmCustom = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    if (!allOptions.includes(trimmed)) {
      setExtraOptions((prev) => [...prev, trimmed]);
    }
    onChange(trimmed);
    setShowInput(false);
    setInputVal("");
  };

  // The displayed select value: if showInput, keep showing "Others" selected
  const selectDisplayValue = showInput ? OTHERS_SENTINEL : value || "";

  return (
    <div className={`space-y-1 ${className}`}>
      <Select value={selectDisplayValue} onValueChange={handleSelectChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {showInput ? (
              <span className="text-muted-foreground italic">Others</span>
            ) : (
              value || <span className="text-muted-foreground">{placeholder}</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allOptions.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
          <SelectItem value={OTHERS_SENTINEL} className="italic text-slate-500">
            Others…
          </SelectItem>
        </SelectContent>
      </Select>

      {showInput && (
        <div className="flex items-center gap-1">
          <Input
            className="h-8 text-sm"
            placeholder="Type custom value…"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmCustom();
              }
              if (e.key === "Escape") {
                setShowInput(false);
              }
            }}
            autoFocus
          />
          <Button
            type="button"
            size="icon"
            className="h-8 w-8 shrink-0 bg-brand-500 hover:bg-brand-600"
            onClick={confirmCustom}
          >
            <Check className="h-4 w-4 text-white" />
          </Button>
        </div>
      )}
    </div>
  );
}
