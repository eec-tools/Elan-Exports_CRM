import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface PayrollRow {
  id: string;
  userId: string;
  month: number;
  year: number;
  workingDays: number;
  presentDays: number;
  approvedLeaves: number;
  absentDays: number;
  grossSalary: number;
  professionalTax: number;
  netSalary: number;
  user: {
    id: string;
    fullName: string;
    designation: string | null;
    monthlySalary: number | null;
  };
}

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
      api.post("/payroll/admin/generate", { month, year }).then((r) => r.data),
    onSuccess: (data) => {
      const failed = data.results.filter((r: any) => r.status === "failed");
      if (failed.length > 0) {
        toast.warning(
          `Payroll generated with ${failed.length} error(s). Check employees without salary set.`,
        );
      } else {
        toast.success(`Payroll generated for ${data.results.length} employees`);
      }
      refetch();
    },
    onError: () => toast.error("Failed to generate payroll"),
  });

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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Designation</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Present</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Leaves</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Absent</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Gross</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">PT</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Net</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/50 cursor-pointer"
                      onClick={() =>
                        navigate(
                          `/admin/payroll-slip/${row.userId}?month=${month}&year=${year}`,
                        )
                      }
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {row.user.fullName}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {row.user.designation || "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.presentDays}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.approvedLeaves}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.absentDays}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(row.grossSalary)}</td>
                      <td className="px-4 py-3 text-right text-red-600">
                        -{fmt(row.professionalTax)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
