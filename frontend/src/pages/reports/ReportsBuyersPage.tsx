import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { Loader2, Users, Globe, TrendingUp, AlertTriangle, DollarSign, UserX, FileSpreadsheet, FileDown } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BuyersReportData {
  kpis: {
    totalBuyers: number;
    activeBuyers: number;
    pendingBuyers: number;
    suspendedBuyers: number;
    totalPipelineValue: number;
    countriesCount: number;
    highRiskCount: number;
    noDealCount: number;
    avgDealValue: number;
  };
  statusBreakdown: { status: string; count: number }[];
  byCountry: { country: string; count: number }[];
  topByPipelineValue: { company: string; name: string; pipelineValue: number; dealCount: number }[];
  dealStageDistribution: { stage: string; count: number }[];
  productDemand: { name: string; count: number }[];
  riskDistribution: { rating: string; count: number }[];
  acquisitionTrend: { month: string; count: number }[];
  buyerTable: {
    id: string; company: string; name: string; country: string; region: string;
    status: string; riskRating: string; productCategoryInterest: string;
    dealCount: number; pipelineValue: number; lastDealStage: string;
    linkedSupplierCount: number;
  }[];
  noDealBuyers: { id: string; company: string; name: string; country: string; status: string; riskRating: string; linkedSupplierCount: number }[];
  noSupplierLinkBuyers: { id: string; company: string; dealCount: number; pipelineValue: number }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

const STATUS_COLORS: Record<string, string> = {
  Active: "#10b981",
  Pending: "#f59e0b",
  Suspended: "#ef4444",
};

const RISK_COLORS: Record<string, string> = {
  Low: "#10b981",
  Medium: "#f59e0b",
  High: "#ef4444",
  "Not Set": "#94a3b8",
  "—": "#94a3b8",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(v: number) {
  if (!v) return "$0";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function KpiCard({ label, value, sub, icon: Icon, color = "blue" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`rounded-lg p-2 ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
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

function StatusBadge({ status }: { status: string }) {
  const color = status === "Active" ? "bg-emerald-100 text-emerald-700" :
    status === "Suspended" ? "bg-red-100 text-red-700" :
    "bg-amber-100 text-amber-700";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{status}</span>;
}

function RiskBadge({ risk }: { risk: string }) {
  const color = risk === "High" ? "bg-red-100 text-red-700" :
    risk === "Low" ? "bg-emerald-100 text-emerald-700" :
    risk === "Medium" ? "bg-amber-100 text-amber-700" :
    "bg-slate-100 text-slate-500";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{risk}</span>;
}

const STAGE_SHORT: Record<string, string> = {
  "Communication": "Communication",
  "Sampling": "Sampling",
  "Quotation": "Quotation",
  "Negotiation with EEC": "Negotiation EEC",
  "Price quotation to Buyer after EEC approval": "Price to Buyer",
  "Negotiation with buyer": "Negotiation Buyer",
  "Price approval by buyer": "Price Approved",
  "Quotation send to the supplier from buyer end": "Quotation to Supplier",
  "Orders confirmed from buyers end": "Orders Confirmed",
  "Timeline (Product shipping.. etc) should be established from suppliers end": "Timeline Est.",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportsBuyersPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "noDeal" | "noSupplier">("all");

  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;

  const { data, isLoading, error } = useQuery<BuyersReportData>({
    queryKey: ["analytics", "buyers-report", from, to],
    queryFn: () => api.get("/analytics/buyers-report", { params }).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">Failed to load buyers report.</p>
      </div>
    );
  }

  const { kpis, statusBreakdown, byCountry, topByPipelineValue, dealStageDistribution,
    productDemand, riskDistribution, acquisitionTrend, buyerTable, noDealBuyers, noSupplierLinkBuyers } = data;

  const filteredTable = (activeTab === "all" ? buyerTable :
    activeTab === "noDeal" ? noDealBuyers.map((b) => ({
      ...b, productCategoryInterest: "—", dealCount: 0, pipelineValue: 0,
      lastDealStage: "—", region: "—",
    })) :
    noSupplierLinkBuyers.map((b) => ({
      ...b, name: "—", country: "—", region: "—", status: "—", riskRating: "—",
      productCategoryInterest: "—", lastDealStage: "—", linkedSupplierCount: 0,
    }))
  ).filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.company?.toLowerCase().includes(q) ||
      (b as any).name?.toLowerCase().includes(q) ||
      (b as any).country?.toLowerCase().includes(q)
    );
  });

  const stageChartData = dealStageDistribution.map((d) => ({
    stage: STAGE_SHORT[d.stage] ?? d.stage.slice(0, 20),
    count: d.count,
  }));

  const tabLabel = activeTab === "all" ? "All Buyers" : activeTab === "noDeal" ? "No Deals" : "No Supplier Link";

  function exportCSV() {
    const headers = ["Company", "Contact Name", "Country", "Region", "Status", "Risk Rating",
      "Product Interest", "Deals", "Pipeline Value ($)", "Last Deal Stage", "Linked Suppliers"];
    const rows = filteredTable.map((b) => [
      b.company ?? "",
      (b as any).name ?? "",
      (b as any).country ?? "",
      (b as any).region ?? "",
      (b as any).status ?? "",
      (b as any).riskRating ?? "",
      (b as any).productCategoryInterest ?? "",
      b.dealCount,
      b.pipelineValue ?? 0,
      (b as any).lastDealStage ?? "",
      (b as any).linkedSupplierCount ?? "",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buyers-report-${tabLabel.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const dateRange = from || to ? `${from || "—"} to ${to || "—"}` : "All time";

    // ── Header band ──
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageW, 22, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("Élan Exports Consultancy", 12, 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("sales@elanexports.com  ·  Buyers Intelligence Report", 12, 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`Buyers Report — ${tabLabel}`, pageW / 2, 10, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Period: ${dateRange}`, pageW / 2, 16, { align: "center" });
    doc.text(`Generated: ${today}`, pageW - 12, 10, { align: "right" });
    doc.setTextColor(100, 116, 139);
    doc.text(`${filteredTable.length} record${filteredTable.length !== 1 ? "s" : ""}`, pageW - 12, 16, { align: "right" });

    // ── KPI band ──
    const kpiY = 26;
    const kpiItems = [
      { label: "Total Buyers", value: String(kpis.totalBuyers) },
      { label: "Active", value: String(kpis.activeBuyers) },
      { label: "Pipeline Value", value: fmtMoney(kpis.totalPipelineValue) },
      { label: "Avg Deal Value", value: fmtMoney(kpis.avgDealValue) },
      { label: "Countries", value: String(kpis.countriesCount) },
      { label: "High Risk", value: String(kpis.highRiskCount) },
      { label: "No Deals", value: String(kpis.noDealCount) },
    ];
    const kpiW = (pageW - 24) / kpiItems.length;
    kpiItems.forEach((k, i) => {
      const x = 12 + i * kpiW;
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(x, kpiY, kpiW - 2, 14, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(k.value, x + (kpiW - 2) / 2, kpiY + 6, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(k.label, x + (kpiW - 2) / 2, kpiY + 11, { align: "center" });
    });

    // ── Table ──
    const tableRows = filteredTable.map((b) => [
      b.company ?? "—",
      (b as any).name && (b as any).name !== "—" ? (b as any).name : "",
      (b as any).country ?? "—",
      (b as any).status ?? "—",
      (b as any).riskRating ?? "—",
      (b as any).productCategoryInterest && (b as any).productCategoryInterest !== "—"
        ? String((b as any).productCategoryInterest).slice(0, 30)
        : "—",
      String(b.dealCount),
      b.pipelineValue > 0 ? fmtMoney(b.pipelineValue) : "—",
      (b as any).lastDealStage && (b as any).lastDealStage !== "—"
        ? (STAGE_SHORT[(b as any).lastDealStage] ?? String((b as any).lastDealStage).slice(0, 22))
        : "—",
      String((b as any).linkedSupplierCount ?? "—"),
    ]);

    autoTable(doc, {
      startY: kpiY + 18,
      head: [["Company", "Contact", "Country", "Status", "Risk", "Product Interest", "Deals", "Pipeline", "Last Stage", "Suppliers"]],
      body: tableRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
        halign: "left",
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 34 },
        1: { cellWidth: 24, textColor: [100, 116, 139] },
        2: { cellWidth: 22 },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 16, halign: "center" },
        5: { cellWidth: 36 },
        6: { cellWidth: 14, halign: "center" },
        7: { cellWidth: 22, halign: "right", fontStyle: "bold", textColor: [5, 150, 105] },
        8: { cellWidth: 28 },
        9: { cellWidth: 14, halign: "center" },
      },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 3) {
          const v = hookData.cell.raw as string;
          if (v === "Active") hookData.cell.styles.textColor = [5, 150, 105];
          else if (v === "Suspended") hookData.cell.styles.textColor = [220, 38, 38];
          else hookData.cell.styles.textColor = [180, 120, 0];
        }
        if (hookData.section === "body" && hookData.column.index === 4) {
          const v = hookData.cell.raw as string;
          if (v === "High") hookData.cell.styles.textColor = [220, 38, 38];
          else if (v === "Low") hookData.cell.styles.textColor = [5, 150, 105];
          else if (v === "Medium") hookData.cell.styles.textColor = [180, 120, 0];
        }
      },
      // Footer on each page
      didDrawPage: (hookData) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Élan Exports Consultancy  ·  Buyers Report  ·  Page ${hookData.pageNumber}`,
          pageW / 2, pageH - 5, { align: "center" },
        );
      },
    });

    doc.save(`buyers-report-${tabLabel.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exported");
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Buyers Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">Portfolio health, deal pipeline and revenue intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
          {(from || to) && (
            <button
              onClick={() => { setFrom(""); setTo(""); }}
              className="text-xs text-slate-500 hover:text-rose-600 px-2 py-1 rounded"
            >
              Clear
            </button>
          )}
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-brand-200 bg-white text-brand-700 text-sm font-medium shadow-sm hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={exportPDF}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Buyers" value={kpis.totalBuyers}
          sub={`${kpis.activeBuyers} active · ${kpis.pendingBuyers} pending`}
          icon={Users} color="blue" />
        <KpiCard label="Pipeline Value" value={fmtMoney(kpis.totalPipelineValue)}
          sub={`Avg ${fmtMoney(kpis.avgDealValue)} per buyer`}
          icon={DollarSign} color="green" />
        <KpiCard label="Countries" value={kpis.countriesCount}
          sub="Geographic reach"
          icon={Globe} color="purple" />
        <KpiCard label="High Risk" value={kpis.highRiskCount}
          sub="Buyers needing attention"
          icon={AlertTriangle} color="red" />
        <KpiCard label="No Deals Yet" value={kpis.noDealCount}
          sub="Potential to nurture"
          icon={UserX} color="amber" />
        <KpiCard label="Suspended" value={kpis.suspendedBuyers}
          sub={`${kpis.activeBuyers} active of ${kpis.totalBuyers}`}
          icon={TrendingUp} color="slate" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Buyer Status Breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusBreakdown} dataKey="count" nameKey="status"
                cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                {statusBreakdown.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number | undefined) => [v, "Buyers"]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Buyers by Country (Top 15)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCountry} layout="vertical" margin={{ left: 60, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} width={55} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Buyers" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Top 10 Buyers by Pipeline Value">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topByPipelineValue.map((b) => ({
              company: b.company.length > 18 ? b.company.slice(0, 18) + "…" : b.company,
              value: b.pipelineValue,
            }))} layout="vertical" margin={{ left: 100, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtMoney(v)} />
              <YAxis type="category" dataKey="company" tick={{ fontSize: 11 }} width={95} />
              <Tooltip formatter={(v: number | undefined) => [v !== undefined ? fmtMoney(v) : "-", "Pipeline"]} />
              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} name="Pipeline Value" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Deal Stage Distribution">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stageChartData} margin={{ left: 0, right: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Deals" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Product Category Demand">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={productDemand.slice(0, 8)} layout="vertical" margin={{ left: 80, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Buyers" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Risk Rating Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={riskDistribution} dataKey="count" nameKey="rating"
                cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                {riskDistribution.map((entry, i) => (
                  <Cell key={i} fill={RISK_COLORS[entry.rating] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number | undefined) => [v, "Buyers"]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Buyer Acquisition (Last 12 Months)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={acquisitionTrend} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="New Buyers" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Buyer Data</h3>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{filteredTable.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
              {(["all", "noDeal", "noSupplier"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 transition-colors ${
                    activeTab === tab ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {tab === "all" ? `All (${buyerTable.length})` :
                    tab === "noDeal" ? `No Deals (${noDealBuyers.length})` :
                    `No Supplier Link (${noSupplierLinkBuyers.length})`}
                </button>
              ))}
            </div>
            <input
              placeholder="Search buyers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-48 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Country</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Risk</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product Interest</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Deals</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Pipeline</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Stage</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Suppliers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTable.slice(0, 50).map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{b.company}</p>
                    <p className="text-xs text-slate-400">{(b as any).name !== "—" ? (b as any).name : ""}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{(b as any).country ?? "—"}</td>
                  <td className="px-4 py-3">
                    {(b as any).status && (b as any).status !== "—" ? (
                      <StatusBadge status={(b as any).status} />
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {(b as any).riskRating && (b as any).riskRating !== "—" ? (
                      <RiskBadge risk={(b as any).riskRating} />
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">
                    {(b as any).productCategoryInterest ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{b.dealCount}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {b.pipelineValue > 0 ? fmtMoney(b.pipelineValue) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {(b as any).lastDealStage !== "—"
                      ? (STAGE_SHORT[(b as any).lastDealStage] ?? (b as any).lastDealStage)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {(b as any).linkedSupplierCount ?? "—"}
                  </td>
                </tr>
              ))}
              {filteredTable.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400 text-sm">
                    No buyers match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredTable.length > 50 && (
          <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
            Showing 50 of {filteredTable.length} buyers.
          </p>
        )}
      </div>
    </div>
  );
}
