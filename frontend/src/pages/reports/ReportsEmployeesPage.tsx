import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import {
  Loader2, Users, TrendingUp, Target, Award, UserCheck,
  Mail, CheckCircle, Globe,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeStats {
  userId: string;
  fullName: string;
  designation: string;
  totalSourced: number;
  thisMonth: number;
  convertedToNew: number;
  conversionRate: number;
  responseRate: number;
  countries: string[];
  statusBreakdown: { status: string; count: number }[];
  monthlyTrend: { month: string; count: number }[];
}

interface LeaderboardRow {
  rank: number;
  userId: string;
  fullName: string;
  designation: string;
  totalSourced: number;
  thisMonth: number;
  convertedToNew: number;
  conversionRate: number;
  responseRate: number;
  countriesCount: number;
}

interface AttributionRow {
  sourcingId: string;
  company: string;
  country: string;
  product: string;
  status: string;
  emailStage: string;
  introSentAt: string | null;
  responseReceivedAt: string | null;
  convertedToNew: boolean;
  daysInPipeline: number;
  createdAt: string;
  employeeId: string;
  employeeName: string;
  employeeDesignation: string;
}

interface EmployeesReportData {
  kpis: {
    activeEmployees: number;
    totalSourcing: number;
    totalConverted: number;
    endToEndRate: number;
    topSourcerName: string;
    topSourcerCount: number;
  };
  leaderboard: LeaderboardRow[];
  perEmployee: EmployeeStats[];
  attributionTable: AttributionRow[];
  volumeChart: { name: string; totalSourced: number; thisMonth: number }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8",
  intro_sent: "#3b82f6",
  followup1_sent: "#8b5cf6",
  followup2_sent: "#f59e0b",
  followup3_sent: "#f97316",
  response_received: "#10b981",
  no_response: "#ef4444",
  converted_to_new: "#06b6d4",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  intro_sent: "Intro Sent",
  followup1_sent: "Followup 1",
  followup2_sent: "Followup 2",
  followup3_sent: "Followup 3",
  response_received: "Responded",
  no_response: "No Response",
  converted_to_new: "Converted",
};


// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
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

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const colorClass =
    status === "response_received" ? "bg-emerald-100 text-emerald-700" :
    status === "no_response" ? "bg-red-100 text-red-700" :
    status === "converted_to_new" ? "bg-cyan-100 text-cyan-700" :
    status === "pending" ? "bg-slate-100 text-slate-500" :
    "bg-blue-100 text-blue-700";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>{label}</span>;
}

// ─── Employee Card ────────────────────────────────────────────────────────────

function EmployeeCard({ emp, onClick, isSelected }: {
  emp: EmployeeStats; onClick: () => void; isSelected: boolean;
}) {
  const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];
  const colorIdx = emp.fullName.charCodeAt(0) % avatarColors.length;

  return (
    <button
      onClick={onClick}
      className={`text-left w-full rounded-xl border p-4 shadow-sm transition-all ${
        isSelected
          ? "border-brand-400 bg-brand-50 shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow"
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-10 w-10 rounded-full ${avatarColors[colorIdx]} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
          {initials(emp.fullName)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{emp.fullName}</p>
          <p className="text-xs text-slate-400 truncate">{emp.designation || "Team Member"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-lg font-bold text-slate-800">{emp.totalSourced}</p>
          <p className="text-[10px] text-slate-400 font-medium">Total Sourced</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-lg font-bold text-slate-800">{emp.thisMonth}</p>
          <p className="text-[10px] text-slate-400 font-medium">This Month</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Converted to New</span>
          <span className="font-semibold text-cyan-700">{emp.convertedToNew}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Conversion Rate</span>
          <span className={`font-bold ${emp.conversionRate >= 50 ? "text-emerald-700" : emp.conversionRate >= 25 ? "text-amber-700" : "text-red-600"}`}>
            {emp.conversionRate}%
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Response Rate</span>
          <span className="font-semibold text-blue-700">{emp.responseRate}%</span>
        </div>
        {emp.countries.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
            <Globe className="h-3 w-3" />
            <span className="truncate">{emp.countries.slice(0, 3).join(", ")}</span>
          </div>
        )}
      </div>

      {/* Mini status bar */}
      {emp.totalSourced > 0 && (
        <div className="mt-3">
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
            {emp.statusBreakdown.map((s, i) => (
              <div
                key={i}
                style={{
                  width: `${(s.count / emp.totalSourced) * 100}%`,
                  background: STATUS_COLORS[s.status] ?? "#94a3b8",
                }}
                title={`${STATUS_LABEL[s.status] ?? s.status}: ${s.count}`}
              />
            ))}
          </div>
        </div>
      )}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsEmployeesPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;

  const { data, isLoading, error } = useQuery<EmployeesReportData>({
    queryKey: ["analytics", "employees-report", from, to],
    queryFn: () => api.get("/analytics/employees-report", { params }).then((r) => r.data),
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
        <p className="text-sm text-red-500">Failed to load employees report.</p>
      </div>
    );
  }

  const { kpis, leaderboard, perEmployee, attributionTable, volumeChart } = data;

  // Attribution table filtered by selected employee + search
  const filteredAttribution = attributionTable.filter((row) => {
    if (selectedEmployee && row.employeeId !== selectedEmployee) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        row.company.toLowerCase().includes(q) ||
        row.country.toLowerCase().includes(q) ||
        row.employeeName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedEmpStats = selectedEmployee
    ? perEmployee.find((e) => e.userId === selectedEmployee)
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Employees Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">Sourcing performance and supplier attribution per team member</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Active Employees" value={kpis.activeEmployees} sub="In the system" icon={Users} color="blue" />
        <KpiCard label="Total Sourced" value={kpis.totalSourcing} sub="All sourcing suppliers" icon={Target} color="purple" />
        <KpiCard label="Converted to New" value={kpis.totalConverted} sub="Sourcing → New pipeline" icon={TrendingUp} color="green" />
        <KpiCard label="Conversion Rate" value={`${kpis.endToEndRate}%`} sub="End-to-end" icon={CheckCircle} color="amber" />
        <KpiCard label="Top Sourcer" value={kpis.topSourcerName.split(" ")[0]} sub={`${kpis.topSourcerCount} suppliers total`} icon={Award} color="amber" />
        <KpiCard label="This Month" value={perEmployee.reduce((s, e) => s + e.thisMonth, 0)} sub="New sourcing leads" icon={UserCheck} color="slate" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Suppliers Sourced per Employee">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={volumeChart} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalSourced" name="All Time" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="thisMonth" name="This Month" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {selectedEmpStats ? (
          <ChartCard title={`${selectedEmpStats.fullName} — Monthly Sourcing Trend`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={selectedEmpStats.monthlyTrend} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Sourced" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : (
          <ChartCard title="Conversion Rate by Employee">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leaderboard.slice(0, 8).map((e) => ({
                name: e.fullName.split(" ")[0],
                convRate: e.conversionRate,
                respRate: e.responseRate,
              }))} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v) => [`${v ?? 0}%`]} />
                <Legend />
                <Bar dataKey="convRate" name="Conversion %" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="respRate" name="Response %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Employee Cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Team Performance
          {selectedEmployee && (
            <button onClick={() => setSelectedEmployee(null)} className="ml-3 text-xs text-brand-600 hover:underline">
              Clear filter
            </button>
          )}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {perEmployee.map((emp) => (
            <EmployeeCard
              key={emp.userId}
              emp={emp}
              isSelected={selectedEmployee === emp.userId}
              onClick={() => setSelectedEmployee(selectedEmployee === emp.userId ? null : emp.userId)}
            />
          ))}
          {perEmployee.length === 0 && (
            <p className="col-span-4 text-sm text-slate-400 text-center py-8">No sourcing data found for any employee.</p>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-700">Sourcing Leaderboard</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-10">Rank</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Designation</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Total Sourced</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">This Month</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Converted</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Conv. Rate</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Resp. Rate</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Countries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leaderboard.map((row) => (
                <tr
                  key={row.userId}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedEmployee === row.userId ? "bg-brand-50" : ""}`}
                  onClick={() => setSelectedEmployee(selectedEmployee === row.userId ? null : row.userId)}
                >
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      row.rank === 1 ? "bg-amber-100 text-amber-700" :
                      row.rank === 2 ? "bg-slate-200 text-slate-600" :
                      row.rank === 3 ? "bg-orange-100 text-orange-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>{row.rank}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.fullName}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{row.designation || "—"}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{row.totalSourced}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{row.thisMonth}</td>
                  <td className="px-4 py-3 text-right text-cyan-700 font-medium">{row.convertedToNew}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-bold ${row.conversionRate >= 50 ? "text-emerald-700" : row.conversionRate >= 25 ? "text-amber-700" : "text-red-600"}`}>
                      {row.conversionRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-blue-700 font-medium">{row.responseRate}%</td>
                  <td className="px-4 py-3 text-right text-slate-600">{row.countriesCount}</td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">No data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attribution Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">
              Supplier Attribution
              {selectedEmployee && selectedEmpStats && (
                <span className="ml-2 text-brand-600">— {selectedEmpStats.fullName}</span>
              )}
            </h3>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{filteredAttribution.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedEmployee && (
              <button onClick={() => setSelectedEmployee(null)} className="text-xs text-slate-500 hover:text-brand-600 px-2 py-1 border border-slate-200 rounded-lg">
                Show All
              </button>
            )}
            <input
              placeholder="Search supplier, country, employee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Country</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sourced By</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email Stage</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Converted</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Days in Pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAttribution.slice(0, 100).map((row) => (
                <tr key={row.sourcingId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{row.company}</td>
                  <td className="px-4 py-3 text-slate-600">{row.country}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{row.product}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-slate-800 font-medium text-xs">{row.employeeName}</p>
                      <p className="text-slate-400 text-[10px]">{row.employeeDesignation}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3"><EmailStageBadge stage={row.emailStage} /></td>
                  <td className="px-4 py-3">
                    {row.convertedToNew
                      ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded-full"><CheckCircle className="h-3 w-3" />Yes</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      row.daysInPipeline > 60 ? "bg-red-100 text-red-700" :
                      row.daysInPipeline > 30 ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>{row.daysInPipeline}d</span>
                  </td>
                </tr>
              ))}
              {filteredAttribution.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                    {selectedEmployee ? "No sourcing suppliers for this employee." : "No data found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredAttribution.length > 100 && (
          <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
            Showing 100 of {filteredAttribution.length} rows.
          </p>
        )}
      </div>

      {/* Status Legend */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Status Legend</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(STATUS_LABEL).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[key] }} />
              <span className="text-xs text-slate-600">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

