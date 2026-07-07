import { useState } from "react";
import { ExternalLink, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyDrawer } from "./CompanyDrawer";

export interface AgentContact {
  id: string;
  name?: string | null;
  title?: string | null;
  email: string;
  emailStatus: string;
  emailConfidence?: number | null;
  linkedinUrl?: string | null;
  isPrimary: boolean;
}

export interface DiscoveredCompany {
  id: string;
  name: string;
  website?: string | null;
  country: string;
  industry?: string | null;
  employeeRange?: string | null;
  description?: string | null;
  productsImported?: string | null;
  asiaConnection: boolean;
  indiaConnection: boolean;
  fitScore?: number | null;
  scoreDim1?: number | null;
  scoreDim2?: number | null;
  scoreDim3?: number | null;
  scoreDim4?: number | null;
  scoreDim5?: number | null;
  priorityTier?: "High" | "Medium" | "Low" | null;
  rationale?: string | null;
  contacts: AgentContact[];
}

interface RunSummary {
  country: string;
  productCategory: string;
  totalFound: number;
  totalScored: number;
  totalHighPrio: number;
  totalMedPrio: number;
}

interface Props {
  companies: DiscoveredCompany[];
  run: RunSummary;
}

const TIER_STYLES: Record<string, string> = {
  High:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low:    "bg-slate-100 text-slate-600 border-slate-200",
};

function exportCSV(companies: DiscoveredCompany[]) {
  const headers = ["Rank", "Company", "Country", "Contact", "Title", "Email", "Email Status", "Score", "Tier", "Website", "Rationale"];
  const rows = companies.map((c, i) => {
    const primary = c.contacts[0];
    return [
      i + 1,
      c.name,
      c.country,
      primary?.name ?? "",
      primary?.title ?? "",
      primary?.email ?? "",
      primary?.emailStatus ?? "",
      c.fitScore ?? "",
      c.priorityTier ?? "",
      c.website ?? "",
      (c.rationale ?? "").replace(/"/g, '""'),
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${v}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agent1-results-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsTable({ companies, run }: Props) {
  const [selectedCompany, setSelectedCompany] = useState<DiscoveredCompany | null>(null);

  const discarded = run.totalFound - run.totalScored;

  return (
    <>
      <div className="space-y-4">
        {/* Summary bar */}
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="font-semibold text-slate-700">
            {run.country} · {run.productCategory}
          </span>
          <span className="text-slate-500">{run.totalFound} discovered</span>
          <span className="text-slate-500">{run.totalScored} scored</span>
          <Badge className={`${TIER_STYLES.High} border text-xs font-medium`}>
            {run.totalHighPrio} High
          </Badge>
          <Badge className={`${TIER_STYLES.Medium} border text-xs font-medium`}>
            {run.totalMedPrio} Medium
          </Badge>
          {discarded > 0 && (
            <span className="text-slate-400 text-xs">
              ({discarded} discarded — domain invalid, no email found, or score &lt; 30)
            </span>
          )}
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => exportCSV(companies)}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-10">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Country</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Best Email</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Score</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((company, index) => {
                  const primary = company.contacts[0];
                  return (
                    <tr
                      key={company.id}
                      onClick={() => setSelectedCompany(company)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">{index + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{company.name}</span>
                          {company.website && (
                            <a
                              href={company.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-400 hover:text-blue-500 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        {company.productsImported && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-50">
                            {company.productsImported}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{company.country}</td>
                      <td className="px-4 py-3.5">
                        {primary ? (
                          <div>
                            {primary.name ? (
                              <p className="text-slate-700 font-medium">{primary.name}</p>
                            ) : (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border text-violet-600 bg-violet-50 border-violet-100">
                                dept.
                              </span>
                            )}
                            {primary.title && (
                              <p className="text-xs text-slate-400 mt-0.5">{primary.title}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {primary ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-700 font-mono text-xs">
                              {primary.email.length > 26
                                ? primary.email.slice(0, 26) + "…"
                                : primary.email}
                            </span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                              primary.emailStatus === "valid" || primary.emailStatus === "deliverable"
                                ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                                : "text-slate-500 bg-slate-50 border-slate-200"
                            }`}>
                              {primary.emailStatus === "valid" || primary.emailStatus === "deliverable"
                                ? primary.emailStatus
                                : "found"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-slate-800">{company.fitScore ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {company.priorityTier ? (
                          <Badge
                            className={`${TIER_STYLES[company.priorityTier]} border text-xs font-semibold`}
                          >
                            {company.priorityTier.toUpperCase()}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {companies.length === 0 && (
              <div className="py-16 text-center text-slate-400">
                <p className="text-sm font-medium">No results — no reachable procurement contact found.</p>
                <p className="text-xs mt-1 text-slate-300 max-w-sm mx-auto">
                  We search Snov.io, Hunter, and the company website for a named person
                  (e.g. john@company.com) or a procurement dept. email (procurement@, buying@).
                  Generic mailboxes like info@ or contact@ are excluded.
                </p>
              </div>
            )}
          </div>
        </div>

        {companies.length > 0 && (
          <p className="text-xs text-slate-400 text-center">
            All rows have a reachable procurement email (named person or buying dept.) · Click any row →
          </p>
        )}
      </div>

      <CompanyDrawer
        company={selectedCompany}
        onClose={() => setSelectedCompany(null)}
      />
    </>
  );
}
