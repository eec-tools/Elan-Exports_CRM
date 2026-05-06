import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { Loader2, Factory, Globe, Star, Percent, CheckCircle, TrendingUp, Archive } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewSuppliersData {
  kpis: { total: number; withEmailCampaign: number; responded: number; convertedFromSourcing: number; avgDaysToRespond: number; countries: number };
  onboardingFunnel: { step: string; count: number }[];
  byCountry: { country: string; count: number }[];
  productCoverage: { name: string; count: number }[];
  timeInPipeline: { label: string; count: number }[];
  monthlyTrend: { month: string; count: number }[];
  table: { id: string; company: string; country: string; contactPerson: string; product: string; emailStage: string; responded: boolean; convertedFromSourcing: boolean; daysInPipeline: number; createdAt: string }[];
}

interface SignedSuppliersData {
  kpis: { total: number; withActiveDeals: number; avgVettingScore: number; avgMarginPercent: number; countries: number; haccpCount: number };
  dealStageDistribution: { stage: string; count: number }[];
  topByDealValue: { company: string; pipelineValue: number; dealCount: number; country: string }[];
  vettingScoreDistribution: { label: string; count: number }[];
  byCountry: { country: string; count: number }[];
  paymentTermsBreakdown: { terms: string; count: number }[];
  certificationCoverage: { cert: string; count: number; percentage: number }[];
  table: { id: string; company: string; country: string; contactPerson: string; products: string; dealStage: string; vettingScore: number | null; marginPercent: number | null; avgMonthlyVolume: string; paymentTerms: string; dealCount: number; pipelineValue: number; buyerCount: number; hasHaccp: boolean; hasIso: boolean; hasFssai: boolean; hasApeda: boolean; hasFda: boolean; hasOrganic: boolean }[];
}

interface OldSuppliersData {
  kpis: { total: number; countries: number; productCategories: number; highReactivation: number };
  byCountry: { country: string; count: number }[];
  productCategories: { name: string; count: number }[];
  reactivationBreakdown: { potential: string; count: number }[];
  table: { id: string; company: string; country: string; product: string; reasonInactive: string; reactivationPotential: string; currentStatus: string; certifications: string; dateMarkedInactive: string }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#14b8a6", "#f97316"];

const STAGE_SHORT: Record<string, string> = {
  "Communication": "Communication",
  "Sampling": "Sampling",
  "Quotation": "Quotation",
  "Negotiation with EEC": "Neg. EEC",
  "Price quotation to Buyer after EEC approval": "Price to Buyer",
  "Negotiation with buyer": "Neg. Buyer",
  "Price approval by buyer": "Price Approved",
  "Quotation send to the supplier from buyer end": "Quote to Supplier",
  "Orders confirmed from buyers end": "Orders Confirmed",
  "Timeline (Product shipping.. etc) should be established from suppliers end": "Timeline Est.",
};

function fmtMoney(v: number) {
  if (!v) return "$0";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function KpiCard({ label, value, sub, icon: Icon, color = "blue" }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600", slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`rounded-lg p-2 ${colorMap[color]}`}><Icon className="h-4 w-4" /></div>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function EmailStageBadge({ stage }: { stage: string }) {
  const color = stage === "Responded" ? "bg-emerald-100 text-emerald-700" :
    stage === "Not Started" ? "bg-slate-100 text-slate-500" :
    "bg-amber-100 text-amber-700";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{stage}</span>;
}

function BoolBadge({ val }: { val: boolean }) {
  return val
    ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600"><CheckCircle className="h-3 w-3" /></span>
    : <span className="text-slate-300 text-xs">—</span>;
}

// ─── Tab: New Suppliers ───────────────────────────────────────────────────────

function NewSuppliersTab({ from, to }: { from: string; to: string }) {
  const [search, setSearch] = useState("");
  const params: Record<string, string> = { tab: "new" };
  if (from) params.from = from;
  if (to) params.to = to;

  const { data, isLoading } = useQuery<NewSuppliersData>({
    queryKey: ["analytics", "suppliers-report", "new", from, to],
    queryFn: () => api.get("/analytics/suppliers-report", { params }).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (!data) return null;

  const { kpis, onboardingFunnel, byCountry, productCoverage, timeInPipeline, monthlyTrend, table } = data;
  const filtered = table.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.company.toLowerCase().includes(q) || s.country.toLowerCase().includes(q) || s.product.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total New" value={kpis.total} sub="In onboarding pipeline" icon={Factory} color="blue" />
        <KpiCard label="Intro Sent" value={kpis.withEmailCampaign} sub="Email campaign started" icon={TrendingUp} color="purple" />
        <KpiCard label="Responded" value={kpis.responded} sub={`${kpis.total > 0 ? Math.round((kpis.responded / kpis.total) * 100) : 0}% response rate`} icon={CheckCircle} color="green" />
        <KpiCard label="From Sourcing" value={kpis.convertedFromSourcing} sub="Converted from pipeline" icon={TrendingUp} color="amber" />
        <KpiCard label="Avg Days to Reply" value={kpis.avgDaysToRespond || "—"} sub="From intro to response" icon={Star} color="slate" />
        <KpiCard label="Countries" value={kpis.countries} sub="Geographic coverage" icon={Globe} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Onboarding Funnel">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={onboardingFunnel} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="step" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={45} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Suppliers" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="New Suppliers by Country">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCountry.slice(0, 10)} layout="vertical" margin={{ left: 70, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} width={65} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Suppliers" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Product Coverage">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={productCoverage.slice(0, 8)} layout="vertical" margin={{ left: 70, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={65} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Time in Pipeline">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timeInPipeline} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Suppliers" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Additions Trend">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyTrend} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Added" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700">New Suppliers</h3>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-44 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Country</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email Stage</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">From Sourcing</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Days in Pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.slice(0, 50).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.company}</td>
                  <td className="px-4 py-3 text-slate-600">{s.country}</td>
                  <td className="px-4 py-3 text-slate-500">{s.contactPerson}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate">{s.product}</td>
                  <td className="px-4 py-3"><EmailStageBadge stage={s.emailStage} /></td>
                  <td className="px-4 py-3"><BoolBadge val={s.convertedFromSourcing} /></td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      s.daysInPipeline > 60 ? "bg-red-100 text-red-700" :
                      s.daysInPipeline > 30 ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>{s.daysInPipeline}d</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">No suppliers match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Signed Suppliers ────────────────────────────────────────────────────

function SignedSuppliersTab({ from, to }: { from: string; to: string }) {
  const [search, setSearch] = useState("");
  const params: Record<string, string> = { tab: "signed" };
  if (from) params.from = from;
  if (to) params.to = to;

  const { data, isLoading } = useQuery<SignedSuppliersData>({
    queryKey: ["analytics", "suppliers-report", "signed", from, to],
    queryFn: () => api.get("/analytics/suppliers-report", { params }).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (!data) return null;

  const { kpis, dealStageDistribution, topByDealValue, vettingScoreDistribution,
    byCountry, paymentTermsBreakdown, certificationCoverage, table } = data;

  const filtered = table.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.company.toLowerCase().includes(q) || (s.country ?? "").toLowerCase().includes(q);
  });

  const stageData = dealStageDistribution.map((d) => ({
    stage: STAGE_SHORT[d.stage] ?? d.stage.slice(0, 18),
    count: d.count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Signed" value={kpis.total} sub="Active contracts" icon={Factory} color="green" />
        <KpiCard label="With Deals" value={kpis.withActiveDeals} sub={`${kpis.total > 0 ? Math.round((kpis.withActiveDeals / kpis.total) * 100) : 0}% in pipeline`} icon={TrendingUp} color="blue" />
        <KpiCard label="Avg Vetting Score" value={kpis.avgVettingScore || "—"} sub="Out of 100" icon={Star} color="amber" />
        <KpiCard label="Avg Margin %" value={kpis.avgMarginPercent ? `${kpis.avgMarginPercent}%` : "—"} sub="EEC commission" icon={Percent} color="purple" />
        <KpiCard label="Countries" value={kpis.countries} sub="Supply base coverage" icon={Globe} color="slate" />
        <KpiCard label="HACCP Certified" value={kpis.haccpCount} sub={`${kpis.total > 0 ? Math.round((kpis.haccpCount / kpis.total) * 100) : 0}% of suppliers`} icon={CheckCircle} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Deal Stage Distribution">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={stageData} margin={{ left: 0, right: 10, bottom: 45 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Deals" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Suppliers by Deal Value">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={topByDealValue.map((s) => ({
              company: s.company.length > 18 ? s.company.slice(0, 18) + "…" : s.company,
              value: s.pipelineValue,
            }))} layout="vertical" margin={{ left: 100, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtMoney(v)} />
              <YAxis type="category" dataKey="company" tick={{ fontSize: 11 }} width={95} />
              <Tooltip formatter={(v: number) => [fmtMoney(v), "Pipeline"]} />
              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} name="Pipeline Value" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Certification Coverage">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={certificationCoverage} cx="50%" cy="50%" outerRadius={80}>
              <PolarGrid />
              <PolarAngleAxis dataKey="cert" tick={{ fontSize: 11 }} />
              <Radar name="Suppliers" dataKey="count" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vetting Score Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={vettingScoreDistribution} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Suppliers">
                {vettingScoreDistribution.map((_, i) => (
                  <Cell key={i} fill={["#ef4444", "#f59e0b", "#3b82f6", "#10b981"][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Payment Terms Breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={paymentTermsBreakdown} dataKey="count" nameKey="terms"
                cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
                {paymentTermsBreakdown.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [v, "Suppliers"]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Suppliers by Country">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byCountry.slice(0, 12)} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="country" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={45} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Suppliers" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Signed Suppliers</h3>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-44 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Country</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Products</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Deal Stage</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Vetting</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Margin%</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Deals</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Pipeline</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Certs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.slice(0, 50).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.company}</td>
                  <td className="px-4 py-3 text-slate-600">{s.country}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{s.products}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{STAGE_SHORT[s.dealStage] ?? s.dealStage}</td>
                  <td className="px-4 py-3 text-right">
                    {s.vettingScore != null ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        s.vettingScore >= 76 ? "bg-emerald-100 text-emerald-700" :
                        s.vettingScore >= 51 ? "bg-blue-100 text-blue-700" :
                        s.vettingScore >= 26 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>{s.vettingScore}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{s.marginPercent != null ? `${s.marginPercent}%` : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{s.dealCount}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{s.pipelineValue > 0 ? fmtMoney(s.pipelineValue) : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {s.hasHaccp && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">HACCP</span>}
                      {s.hasIso && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">ISO</span>}
                      {s.hasOrganic && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Org</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">No suppliers match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Old Suppliers ───────────────────────────────────────────────────────

function OldSuppliersTab({ from, to }: { from: string; to: string }) {
  const [search, setSearch] = useState("");
  const params: Record<string, string> = { tab: "old" };
  if (from) params.from = from;
  if (to) params.to = to;

  const { data, isLoading } = useQuery<OldSuppliersData>({
    queryKey: ["analytics", "suppliers-report", "old", from, to],
    queryFn: () => api.get("/analytics/suppliers-report", { params }).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (!data) return null;

  const { kpis, byCountry, productCategories, reactivationBreakdown, table } = data;
  const filtered = table.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.company.toLowerCase().includes(q) || s.country.toLowerCase().includes(q);
  });

  const REACT_COLORS: Record<string, string> = { High: "#10b981", Medium: "#f59e0b", Low: "#ef4444", Unknown: "#94a3b8" };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Archived" value={kpis.total} sub="Old / inactive suppliers" icon={Archive} color="slate" />
        <KpiCard label="Countries" value={kpis.countries} sub="Geographic history" icon={Globe} color="blue" />
        <KpiCard label="Product Lines" value={kpis.productCategories} sub="Categories covered" icon={Factory} color="purple" />
        <KpiCard label="High Reactivation" value={kpis.highReactivation} sub="Potential re-engagement" icon={TrendingUp} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Old Suppliers by Country">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCountry.slice(0, 10)} layout="vertical" margin={{ left: 70, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} width={65} />
              <Tooltip />
              <Bar dataKey="count" fill="#94a3b8" radius={[0, 4, 4, 0]} name="Suppliers" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Product Categories">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={productCategories.slice(0, 8)} layout="vertical" margin={{ left: 70, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={65} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Reactivation Potential">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={reactivationBreakdown} dataKey="count" nameKey="potential"
                cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                {reactivationBreakdown.map((entry, i) => (
                  <Cell key={i} fill={REACT_COLORS[entry.potential] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [v, "Suppliers"]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Old Suppliers Archive</h3>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-44 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Country</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason Inactive</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reactivation</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date Inactive</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Certifications</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.slice(0, 50).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.company}</td>
                  <td className="px-4 py-3 text-slate-600">{s.country}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{s.product}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[140px] truncate">{s.reasonInactive}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      s.reactivationPotential === "High" ? "bg-emerald-100 text-emerald-700" :
                      s.reactivationPotential === "Medium" ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>{s.reactivationPotential}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.dateMarkedInactive}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[100px] truncate">{s.certifications}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">No suppliers match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "new" | "signed" | "old";

export default function ReportsSuppliersPage() {
  const [activeTab, setActiveTab] = useState<Tab>("new");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "new", label: "New Suppliers", icon: Factory },
    { id: "signed", label: "Signed Suppliers", icon: CheckCircle },
    { id: "old", label: "Old Suppliers", icon: Archive },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Suppliers Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">Pipeline health across new, signed, and archived suppliers</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }} className="text-xs text-slate-500 hover:text-rose-600 px-2 py-1 rounded">Clear</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "new" && <NewSuppliersTab from={from} to={to} />}
      {activeTab === "signed" && <SignedSuppliersTab from={from} to={to} />}
      {activeTab === "old" && <OldSuppliersTab from={from} to={to} />}
    </div>
  );
}
