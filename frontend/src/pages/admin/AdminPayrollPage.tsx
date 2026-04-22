import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PayrollRow {
  id: string;
  userId: string;
  month: number;
  year: number;
  daysInMonth: number;
  scheduledWorkingDays: number;
  saturdaySchedule: string;
  weekdayPresentDays: number;
  weekendWorkedDays: number;
  approvedLeavesMonth: number;
  excessLeaveDays: number;
  paidDays: number;
  perDaySalary: number;
  grossSalary: number;
  leaveSalaryDeduction: number;
  professionalTax: number;
  netSalary: number;
  user: {
    id: string;
    fullName: string;
    designation: string | null;
    monthlySalary: number | null;
  };
}

interface GeneratePayrollResult {
  userId: string;
  fullName: string;
  status: "generated" | "failed";
  error?: string;
}

interface GeneratePayrollResponse {
  month: number;
  year: number;
  results: GeneratePayrollResult[];
}

const saturdayLabel: Record<string, string> = {
  off: "Sat Off",
  full: "Sat Full",
  half: "Sat Half",
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtPrecise = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);

function ColHeader({ label, tip }: { label: string; tip: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-default">
            {label}
            <Info className="h-3 w-3 text-slate-400" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function AdminPayrollPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  const { data: rows = [], isLoading, refetch } = useQuery<PayrollRow[]>({
    queryKey: ["admin-payroll", month, year],
    queryFn: () =>
      api.get(`/payroll/admin?month=${month}&year=${year}`).then((r) => r.data),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post<GeneratePayrollResponse>("/payroll/admin/generate", { month, year }).then((r) => r.data),
    onSuccess: (data) => {
      const failed = data.results.filter((r) => r.status === "failed");
      if (failed.length > 0) {
        const details = failed
          .slice(0, 3)
          .map((r) => `${r.fullName}${r.error ? ` (${r.error})` : ""}`)
          .join("; ");
        const suffix = failed.length > 3 ? `; +${failed.length - 3} more` : "";
        toast.warning(`Payroll generated with ${failed.length} error(s): ${details}${suffix}`);
      } else {
        toast.success(`Payroll generated for ${data.results.length} employees`);
      }
      refetch();
    },
    onError: () => toast.error("Failed to generate payroll"),
  });

  const totalNet = rows.reduce((s, r) => s + r.netSalary, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Payroll</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2"
          >
            {generateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate Payroll
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-slate-500 px-6 py-4">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500 px-6 py-4">
              No payroll for {MONTHS[month - 1]} {year}. Click "Generate Payroll" to create it.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-600">
                      <th className="text-left px-4 py-3 font-medium">Employee</th>
                      <th className="text-right px-3 py-3 font-medium whitespace-nowrap">
                        <ColHeader label="Work Days" tip="Scheduled paid days in the month, including Sundays and employee's Saturday schedule. Used as per-day salary denominator." />
                      </th>
                      <th className="text-right px-3 py-3 font-medium whitespace-nowrap">
                        <ColHeader label="Per Day" tip="Monthly Salary ÷ Scheduled Working Days" />
                      </th>
                      <th className="text-right px-3 py-3 font-medium whitespace-nowrap">
                        <ColHeader label="Present" tip="Regular present days on scheduled workdays (Mon–Fri + Sat for full/half). HalfDay = 0.5." />
                      </th>
                      <th className="text-right px-3 py-3 font-medium whitespace-nowrap">
                        <ColHeader label="Bonus Days" tip="Extra days worked on off days (typically Saturday for off-schedule employees). Sundays are already counted as official paid days." />
                      </th>
                      <th className="text-right px-3 py-3 font-medium whitespace-nowrap">
                        <ColHeader label="Leaves" tip="Approved leave days falling this month" />
                      </th>
                      <th className="text-right px-3 py-3 font-medium whitespace-nowrap">
                        <ColHeader label="Excess" tip="Leave days beyond the 14-day annual quota (unpaid)" />
                      </th>
                      <th className="text-right px-3 py-3 font-medium whitespace-nowrap">
                        <ColHeader label="Paid Days" tip="Regular present + official paid Sundays + bonus days + approved leaves" />
                      </th>
                      <th className="text-right px-3 py-3 font-medium whitespace-nowrap">
                        <ColHeader label="Gross" tip="Per Day Salary × Paid Days" />
                      </th>
                      <th className="text-right px-3 py-3 font-medium whitespace-nowrap">
                        <ColHeader label="Leave Ded." tip="Per Day Salary × Excess Leave Days (deducted once)" />
                      </th>
                      <th className="text-right px-3 py-3 font-medium whitespace-nowrap">
                        <ColHeader label="PT" tip="Professional Tax (Maharashtra slab)" />
                      </th>
                      <th className="text-right px-4 py-3 font-medium whitespace-nowrap">
                        Net Salary
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/50 cursor-pointer"
                        onClick={() =>
                          navigate(`/admin/payroll-slip/${row.userId}?month=${month}&year=${year}`)
                        }
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{row.user.fullName}</p>
                          <p className="text-xs text-slate-400">
                            {row.user.designation && `${row.user.designation} · `}
                            {saturdayLabel[row.saturdaySchedule] ?? row.saturdaySchedule}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600">{row.scheduledWorkingDays}</td>
                        <td className="px-3 py-3 text-right text-slate-600">{fmtPrecise(row.perDaySalary)}</td>
                        <td className="px-3 py-3 text-right text-slate-600">{row.weekdayPresentDays}</td>
                        <td className="px-3 py-3 text-right text-slate-600">{row.weekendWorkedDays}</td>
                        <td className="px-3 py-3 text-right text-slate-600">{row.approvedLeavesMonth}</td>
                        <td className="px-3 py-3 text-right">
                          {row.excessLeaveDays > 0 ? (
                            <span className="text-red-600 font-medium">{row.excessLeaveDays}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-slate-700">{row.paidDays}</td>
                        <td className="px-3 py-3 text-right text-slate-600">{fmt(row.grossSalary)}</td>
                        <td className="px-3 py-3 text-right">
                          {row.leaveSalaryDeduction > 0 ? (
                            <span className="text-red-600">-{fmt(row.leaveSalaryDeduction)}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {row.professionalTax > 0 ? (
                            <span className="text-red-600">-{fmt(row.professionalTax)}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {fmt(row.netSalary)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(
                                `/admin/payroll-slip/${row.userId}?month=${month}&year=${year}`,
                              );
                            }}
                          >
                            Slip
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary footer */}
              <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between text-sm">
                <p className="text-slate-500 text-xs">
                  Formula: Net = (Salary ÷ Scheduled Work Days) × Paid Days − Excess Leave Deduction − Professional Tax
                </p>
                <p className="font-semibold text-slate-800">
                  Total Payout: {fmt(totalNet)}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
