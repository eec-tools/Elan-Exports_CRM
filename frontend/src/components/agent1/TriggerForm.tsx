import { useState } from "react";
import { Bot, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const COUNTRIES = [
  "Germany", "France", "Netherlands", "Italy", "Spain",
  "UK", "UAE", "Saudi Arabia", "Japan", "Singapore",
];

const CATEGORIES = [
  "Organic Food",
  "Textiles",
  "Seafood",
  "Rice & Grains",
  "Spices & Herbs",
  "Pulses & Lentils",
];

interface Props {
  onSubmit: (country: string, category: string) => void;
  isLoading: boolean;
}

export function TriggerForm({ onSubmit, isLoading }: Props) {
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!country || !category) return;
    onSubmit(country, category);
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-blue-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">Buyers Discover Agent</h2>
              <p className="text-blue-200/80 text-xs mt-0.5">
                Powered by Firecrawl · Hunter.io · Groq AI
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Target Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Select a country…" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Product Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Select a category…" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Est. 8–12 min per run
            </p>
            <Button
              type="submit"
              disabled={!country || !category || isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4" />
                  Run Agent
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
