import { useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import api from "@/api/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Payroll {
  id: string;
  month: number;
  year: number;
  daysInMonth: number;
  scheduledWorkingDays: number;
  saturdaySchedule: string;
  weekdayPresentDays: number;
  weekendWorkedDays: number;
  holidayCount: number;
  holidayPaidDays: number;
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

export default function PayrollSlipPage() {
  const [isDownloading, setIsDownloading] = useState(false);
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const { data: payroll, isLoading } = useQuery<Payroll | null>({
    queryKey: ["payroll-slip", userId, month, year],
    queryFn: () =>
      api.get(`/payroll/admin/${userId}/slip?month=${month}&year=${year}`).then((r) => r.data),
    enabled: !!userId && !!month && !!year,
  });

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading payroll slip...</p>;
  }

  if (!payroll) {
    return (
      <div className="max-w-lg mx-auto mt-8 text-center text-slate-500 text-sm">
        Payroll slip not found. Please generate payroll first.
      </div>
    );
  }

  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    const slip = document.getElementById("payroll-slip-print");
    if (!slip) {
      toast.error("Slip content not found");
      return;
    }

    const safeName = payroll.user.fullName
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase();

    setIsDownloading(true);
    try {
      const pngData = await toPng(slip, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const img = new Image();
      img.src = pngData;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to prepare image for PDF"));
      });

      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
      const renderWidth = img.width * ratio;
      const renderHeight = img.height * ratio;
      const x = (pageWidth - renderWidth) / 2;
      const y = margin;

      pdf.addImage(pngData, "PNG", x, y, renderWidth, renderHeight, undefined, "FAST");

      const fileName = `salary-slip-${safeName || "employee"}-${payroll.month}-${payroll.year}.pdf`;
      try {
        pdf.save(fileName);
      } catch {
        const blob = pdf.output("blob");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("PDF download failed:", err);
      toast.error("Failed to download PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div id="payroll-slip-print">
        <Card className="print:shadow-none border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 print:bg-white text-center py-6">
            <p className="text-xl font-bold text-slate-800 tracking-tight">
              ÉLAN EXPORTS CONSULTANCY
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Salary Slip — {MONTHS[payroll.month - 1]} {payroll.year}
            </p>
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
            <SlipRow
              label="Month / Year"
              value={`${MONTHS[payroll.month - 1]} ${payroll.year}`}
            />

            {/* Salary calculation */}
            <div className="border-t border-slate-100 my-3" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pb-1">
              Salary Calculation
            </p>
            <SlipRow label="Monthly Salary" value={fmt(payroll.user.monthlySalary ?? 0)} />
            <SlipRow
              label={`Per Day Salary (÷ ${payroll.scheduledWorkingDays} scheduled days)`}
              value={fmt(payroll.perDaySalary)}
            />

            <div className="border-t border-slate-100 my-2" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pb-1">
              Paid Days Breakdown
            </p>
            <SlipRow label="Days Present" value={String(payroll.weekdayPresentDays)} />
            <SlipRow label="Sundays (paid off)" value={String(Math.round(payroll.paidDays - payroll.weekdayPresentDays - payroll.weekendWorkedDays - payroll.approvedLeavesMonth - payroll.holidayPaidDays))} />
            {payroll.weekendWorkedDays > 0 && (
              <SlipRow label="Bonus Days (weekend work)" value={String(payroll.weekendWorkedDays)} />
            )}
            {payroll.holidayPaidDays > 0 && (
              <SlipRow
                label={`Holidays (${payroll.holidayCount} declared, ${payroll.holidayPaidDays} on working days)`}
                value={String(payroll.holidayPaidDays)}
              />
            )}
            {payroll.approvedLeavesMonth > 0 && (
              <SlipRow label="Approved Leaves" value={String(payroll.approvedLeavesMonth)} />
            )}
            <SlipRow label="Total Paid Days" value={String(payroll.paidDays)} bold />

            <div className="border-t border-slate-100 my-2" />
            <SlipRow
              label={`Gross Salary (${fmt(payroll.perDaySalary)} × ${payroll.paidDays} days)`}
              value={fmt(payroll.grossSalary)}
            />

            {/* Deductions */}
            <div className="border-t border-slate-100 my-3" />
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
              <SlipRow
                label="Excess Leave Deduction"
                value="- ₹0"
                className="text-slate-400"
              />
            )}
            <SlipRow
              label="Professional Tax"
              value={payroll.professionalTax > 0 ? `- ${fmt(payroll.professionalTax)}` : "- ₹0"}
              className="text-red-600"
            />

            {/* Net */}
            <div className="border-t border-slate-200 my-3" />
            <SlipRow label="NET SALARY" value={fmt(payroll.netSalary)} bold />

            {/* Formula note */}
            <div className="border-t border-slate-100 mt-3 pt-3">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Paid days = {payroll.weekdayPresentDays} present
                {" "}+ {Math.round(payroll.paidDays - payroll.weekdayPresentDays - payroll.weekendWorkedDays - payroll.approvedLeavesMonth - payroll.holidayPaidDays)} Sundays
                {payroll.holidayPaidDays > 0 ? ` + ${payroll.holidayPaidDays} holidays` : ""}
                {payroll.weekendWorkedDays > 0 ? ` + ${payroll.weekendWorkedDays} bonus` : ""}
                {payroll.approvedLeavesMonth > 0 ? ` + ${payroll.approvedLeavesMonth} leaves` : ""}
                {" "}= {payroll.paidDays}
                {" "}· Net = ({fmt(payroll.user.monthlySalary ?? 0)} ÷ {payroll.scheduledWorkingDays}) × {payroll.paidDays}
                {payroll.leaveSalaryDeduction > 0 ? ` − ${fmt(payroll.leaveSalaryDeduction)} (excess leaves)` : ""}
                {payroll.professionalTax > 0 ? ` − ${fmt(payroll.professionalTax)} (PT)` : ""}
                {" "}= {fmt(payroll.netSalary)}
              </p>
            </div>

            {/* Bank details */}
            {(payroll.user.bankName || payroll.user.bankAccountNumber) && (
              <div className="border-t border-slate-100 mt-3 pt-3">
                <p className="text-xs text-slate-500">
                  {[
                    payroll.user.bankName && `Bank: ${payroll.user.bankName}`,
                    payroll.user.bankAccountNumber && `A/C: ${payroll.user.bankAccountNumber}`,
                    payroll.user.bankIfsc && `IFSC: ${payroll.user.bankIfsc}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end print:hidden">
        <Button variant="outline" onClick={handleDownloadPdf} className="gap-2" disabled={isDownloading}>
          <Download className="h-4 w-4" />
          {isDownloading ? "Downloading..." : "Download PDF"}
        </Button>
      </div>

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
    <div
      className={`flex justify-between py-1.5 text-sm ${
        bold ? "font-bold text-slate-900" : "text-slate-700"
      }`}
    >
      <span className="text-slate-500">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}
