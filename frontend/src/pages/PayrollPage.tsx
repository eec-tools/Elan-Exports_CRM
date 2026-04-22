import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface Payroll {
  id: string;
  month: number;
  year: number;
  daysInMonth: number;
  scheduledWorkingDays: number;
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
    fullName: string;
    designation: string | null;
    monthlySalary: number | null;
    employeeStatus: string;
    bankAccountNumber: string | null;
    bankName: string | null;
    bankIfsc: string | null;
  };
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

const statusLabel: Record<string, string> = {
  intern: "Intern",
  probation: "Probation",
  confirmed: "Confirmed",
};

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: payroll, isLoading } = useQuery<Payroll | null>({
    queryKey: ["my-payroll", month, year],
    queryFn: () =>
      api.get(`/payroll/me?month=${month}&year=${year}`).then((r) => r.data),
  });

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  const paidLeaves = payroll
    ? payroll.approvedLeavesMonth - payroll.excessLeaveDays
    : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">My Payroll</h1>

      {/* Month/Year selector */}
      <div className="flex items-center gap-3">
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
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading...</p>}

      {!isLoading && !payroll && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            No payroll generated for {MONTHS[month - 1]} {year}.
          </CardContent>
        </Card>
      )}

      {payroll && (
        <div id="payroll-slip-print">
          <Card className="border-slate-200 print:shadow-none">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 print:bg-white">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">ÉLAN EXPORTS CONSULTANCY</p>
                <p className="text-sm text-slate-500 mt-1">
                  Salary Slip — {MONTHS[payroll.month - 1]} {payroll.year}
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-0">
              {/* Employee info */}
              <SlipRow label="Employee Name" value={payroll.user.fullName} />
              {payroll.user.designation && (
                <SlipRow label="Designation" value={payroll.user.designation} />
              )}
              <SlipRow
                label="Employee Status"
                value={statusLabel[payroll.user.employeeStatus] ?? payroll.user.employeeStatus}
              />
              <SlipRow label="Month / Year" value={`${MONTHS[payroll.month - 1]} ${payroll.year}`} />

              {/* Attendance breakdown */}
              <div className="border-t border-slate-100 my-2" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pb-1">
                Attendance Breakdown
              </p>
              <SlipRow label="Days in Month" value={String(payroll.daysInMonth)} />
              <SlipRow label="Weekday Present Days" value={String(payroll.weekdayPresentDays)} />
              <SlipRow label="Weekend Days Worked" value={String(payroll.weekendWorkedDays)} />
              <SlipRow label="Approved Leave Days" value={String(payroll.approvedLeavesMonth)} />
              {payroll.excessLeaveDays > 0 && (
                <SlipRow
                  label="Excess Leaves (Unpaid)"
                  value={String(payroll.excessLeaveDays)}
                  className="text-red-600"
                />
              )}
              <SlipRow label="Paid Leave Days" value={String(paidLeaves)} />
              <SlipRow label="Total Paid Days" value={String(payroll.paidDays)} bold />

              {/* Salary calculation */}
              <div className="border-t border-slate-100 my-2" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pb-1">
                Salary Calculation
              </p>
              <SlipRow label="Monthly Salary" value={fmt(payroll.user.monthlySalary ?? 0)} />
              <SlipRow
                label={`Per Day Salary (÷ ${payroll.scheduledWorkingDays} scheduled days)`}
                value={fmt(payroll.perDaySalary)}
              />
              <SlipRow
                label={`Gross Salary (× ${payroll.paidDays} paid days)`}
                value={fmt(payroll.grossSalary)}
              />

              {/* Deductions */}
              <div className="border-t border-slate-100 my-2" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pb-1">
                Deductions
              </p>
              {payroll.leaveSalaryDeduction > 0 ? (
                <SlipRow
                  label={`Excess Leave Deduction (${payroll.excessLeaveDays} days × ${fmt(payroll.perDaySalary)})`}
                  value={`- ${fmt(payroll.leaveSalaryDeduction)}`}
                  className="text-red-600"
                />
              ) : (
                <SlipRow label="Excess Leave Deduction" value="- ₹0" className="text-slate-400" />
              )}
              <SlipRow
                label="Professional Tax"
                value={payroll.professionalTax > 0 ? `- ${fmt(payroll.professionalTax)}` : "- ₹0"}
                className="text-red-600"
              />

              {/* Net */}
              <div className="border-t border-slate-200 my-2" />
              <SlipRow label="NET SALARY" value={fmt(payroll.netSalary)} bold />

              {/* Formula */}
              <div className="border-t border-slate-100 mt-3 pt-2">
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Net = ({fmt(payroll.user.monthlySalary ?? 0)} ÷ {payroll.scheduledWorkingDays}) × {payroll.paidDays} days
                  {payroll.leaveSalaryDeduction > 0
                    ? ` − ${fmt(payroll.leaveSalaryDeduction)} (excess leaves)`
                    : ""}
                  {payroll.professionalTax > 0 ? ` − ${fmt(payroll.professionalTax)} (PT)` : ""}
                  {" "}= {fmt(payroll.netSalary)}
                </p>
              </div>

              {/* Bank details */}
              {(payroll.user.bankName || payroll.user.bankAccountNumber) && (
                <>
                  <div className="border-t border-slate-100 my-2" />
                  <p className="text-xs text-slate-500 py-1">
                    {[
                      payroll.user.bankName && `Bank: ${payroll.user.bankName}`,
                      payroll.user.bankAccountNumber && `A/C: ${payroll.user.bankAccountNumber}`,
                      payroll.user.bankIfsc && `IFSC: ${payroll.user.bankIfsc}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end mt-4 print:hidden">
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" />
              Print Slip
            </Button>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #payroll-slip-print, #payroll-slip-print * { visibility: visible; }
          #payroll-slip-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

function SlipRow({
  label,
  value,
  bold,
  className = "",
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${bold ? "font-bold text-slate-900" : "text-slate-700"}`}>
      <span className="text-slate-500">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}
