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
  workingDays: number;
  presentDays: number;
  approvedLeaves: number;
  absentDays: number;
  grossSalary: number;
  professionalTax: number;
  netSalary: number;
  generatedAt: string;
  user: {
    fullName: string;
    designation: string | null;
    monthlySalary: number | null;
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

  const perDaySalary =
    payroll && payroll.workingDays > 0
      ? (payroll.user.monthlySalary ?? 0) / payroll.workingDays
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
              <SlipRow label="Employee Name" value={payroll.user.fullName} />
              {payroll.user.designation && (
                <SlipRow label="Designation" value={payroll.user.designation} />
              )}
              <SlipRow label="Month / Year" value={`${MONTHS[payroll.month - 1]} ${payroll.year}`} />
              <div className="border-t border-slate-100 my-2" />
              <SlipRow label="Working Days" value={String(payroll.workingDays)} />
              <SlipRow label="Present Days" value={String(payroll.presentDays)} />
              <SlipRow label="Approved Leaves" value={String(payroll.approvedLeaves)} />
              <SlipRow label="Absent Days" value={String(payroll.absentDays)} />
              <div className="border-t border-slate-100 my-2" />
              <SlipRow label="Monthly Salary" value={fmt(payroll.user.monthlySalary ?? 0)} />
              <SlipRow label="Per Day Salary" value={fmt(perDaySalary)} />
              <SlipRow label="Gross Salary" value={fmt(payroll.grossSalary)} />
              <div className="border-t border-slate-100 my-2" />
              <SlipRow
                label="Professional Tax"
                value={`- ${fmt(payroll.professionalTax)}`}
                className="text-red-600"
              />
              <div className="border-t border-slate-200 my-2" />
              <SlipRow
                label="NET SALARY"
                value={fmt(payroll.netSalary)}
                bold
              />
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
