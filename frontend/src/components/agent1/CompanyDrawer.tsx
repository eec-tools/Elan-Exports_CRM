import { X, ExternalLink, Globe, Mail, Linkedin, CheckCircle2, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DiscoveredCompany } from "./ResultsTable";

interface Props {
  company: DiscoveredCompany | null;
  onClose: () => void;
}

const TIER_STYLES: Record<string, string> = {
  High:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low:    "bg-slate-100 text-slate-600 border-slate-200",
};

const TIER_SCORE_COLOR: Record<string, string> = {
  High:   "text-emerald-600",
  Medium: "text-amber-600",
  Low:    "text-slate-500",
};

const DIM_LABELS = [
  { key: "scoreDim1", label: "Product Match" },
  { key: "scoreDim2", label: "Asia/India Signal" },
  { key: "scoreDim3", label: "Company Size" },
  { key: "scoreDim4", label: "Reachability" },
  { key: "scoreDim5", label: "Geography" },
] as const;

function ScoreBar({ label, score }: { label: string; score: number | null | undefined }) {
  const value = score ?? 0;
  const pct = (value / 20) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            value >= 16 ? "bg-emerald-500" : value >= 10 ? "bg-amber-400" : "bg-slate-300"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-6 text-right">{value}</span>
    </div>
  );
}

export function CompanyDrawer({ company, onClose }: Props) {
  if (!company) return null;

  const primary = company.contacts[0];
  const tier = company.priorityTier;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 text-base truncate">{company.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
                >
                  <Globe className="h-3 w-3" />
                  {company.website.replace("https://", "").replace("http://", "")}
                </a>
              )}
              <span className="text-xs text-slate-400">· {company.country}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Score */}
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-baseline gap-1">
                <span className={`text-4xl font-black ${tier ? TIER_SCORE_COLOR[tier] : "text-slate-700"}`}>
                  {company.fitScore ?? "—"}
                </span>
                <span className="text-slate-400 text-sm font-medium">/ 100</span>
              </div>
              {tier && (
                <Badge className={`${TIER_STYLES[tier]} border text-sm font-bold px-3 py-1`}>
                  {tier.toUpperCase()} PRIORITY
                </Badge>
              )}
            </div>

            <div className="space-y-2.5">
              {DIM_LABELS.map(({ key, label }) => (
                <ScoreBar key={key} label={label} score={company[key]} />
              ))}
            </div>
          </div>

          {/* Rationale */}
          {company.rationale && (
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Why This Score
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{company.rationale}</p>
            </div>
          )}

          {/* Signals */}
          {(company.asiaConnection || company.indiaConnection || company.employeeRange || company.productsImported) && (
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Signals
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {company.indiaConnection && (
                  <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                    India connection
                  </span>
                )}
                {company.asiaConnection && (
                  <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                    Asia sourcing
                  </span>
                )}
                {company.employeeRange && (
                  <span className="text-xs bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                    {company.employeeRange}
                  </span>
                )}
                {company.productsImported && (
                  <span className="text-xs bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                    {company.productsImported}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Contact */}
          {primary && (
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Contact
              </h3>
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                {primary.name && (
                  <p className="font-semibold text-slate-800 text-sm">{primary.name}</p>
                )}
                {primary.title && (
                  <p className="text-xs text-slate-500">{primary.title}</p>
                )}
                <div className="flex items-center gap-2 pt-0.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700 font-mono break-all">{primary.email}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 ml-auto" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                    {primary.emailStatus}
                  </span>
                  {primary.emailConfidence != null && (
                    <span className="text-[10px] text-slate-400">
                      {primary.emailConfidence}% confidence
                    </span>
                  )}
                </div>
                {primary.linkedinUrl && (
                  <a
                    href={primary.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-500 hover:underline"
                  >
                    <Linkedin className="h-3.5 w-3.5" />
                    LinkedIn profile
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* All contacts */}
          {company.contacts.length > 1 && (
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                All Contacts ({company.contacts.length})
              </h3>
              <div className="space-y-2">
                {company.contacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="text-slate-700 font-mono truncate block">{c.email}</span>
                      {c.title && <span className="text-slate-400">{c.title}</span>}
                    </div>
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                      c.emailStatus === "valid" || c.emailStatus === "deliverable"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : "bg-slate-50 text-slate-500 border-slate-200"
                    }`}>
                      {c.emailStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 shrink-0 bg-white">
          <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" disabled>
            Add to Buyers CRM
          </Button>
          <Button size="sm" className="flex-1 text-xs gap-1.5" disabled>
            Send to Agent 2
          </Button>
        </div>
      </div>
    </>
  );
}
