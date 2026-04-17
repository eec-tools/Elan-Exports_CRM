import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, AlertCircle, AlertTriangle } from "lucide-react";

interface Leave {
  id: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface LeaveBalance {
  quota: number;
  used: number;
  remaining: number;
  year: number;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function LeavePage() {
  const qc = useQueryClient();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: balance } = useQuery<LeaveBalance>({
    queryKey: ["leave-balance"],
    queryFn: () => api.get("/leaves/balance").then((r) => r.data),
  });

  const { data: leaves = [] } = useQuery<Leave[]>({
    queryKey: ["my-leaves"],
    queryFn: () => api.get("/leaves").then((r) => r.data),
  });

  const { data: empData } = useQuery({
    queryKey: ["my-employee-profile"],
    queryFn: () => api.get("/admin/employees/me").then((r) => r.data),
  });

  const isConfirmed = empData?.employeeStatus === "confirmed";

  // Preview: how many days in the selected range would exceed the quota
  const previewDays =
    startDate && endDate
      ? Math.max(
          0,
          Math.round(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1,
        )
      : 0;
  const previewExcess = balance
    ? Math.max(0, balance.used + previewDays - balance.quota)
    : 0;

  const applyMutation = useMutation({
    mutationFn: (data: { startDate: string; endDate: string; reason: string }) =>
      api.post("/leaves", data).then((r) => r.data),
    onSuccess: (data) => {
      if (data.warning) {
        toast.warning(data.warning);
      } else {
        toast.success("Leave application submitted");
      }
      qc.invalidateQueries({ queryKey: ["my-leaves"] });
      qc.invalidateQueries({ queryKey: ["leave-balance"] });
      setStartDate("");
      setEndDate("");
      setReason("");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? "Failed to apply for leave");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Please select start and end dates");
      return;
    }
    applyMutation.mutate({ startDate, endDate, reason });
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Leave Management</h1>

      {/* Balance widget */}
      {balance && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-slate-800">{balance.quota}</p>
              <p className="text-sm text-slate-500 mt-1">Annual Quota (Paid)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className={`text-3xl font-bold ${balance.used > balance.quota ? "text-red-600" : "text-orange-600"}`}>
                {balance.used}
              </p>
              <p className="text-sm text-slate-500 mt-1">Used This Year</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className={`text-3xl font-bold ${balance.remaining < 0 ? "text-red-600" : "text-green-600"}`}>
                {balance.remaining < 0 ? 0 : balance.remaining}
              </p>
              <p className="text-sm text-slate-500 mt-1">Paid Days Left</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quota exceeded notice */}
      {balance && balance.used > balance.quota && (
        <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            You have used <strong>{balance.used - balance.quota}</strong> day(s) beyond your annual
            quota. Those extra days will be deducted from your salary at payroll.
          </span>
        </div>
      )}

      {/* Apply form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Apply for Leave
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isConfirmed ? (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Only confirmed employees can apply for paid leave. Your current status is{" "}
              <strong>{empData?.employeeStatus ?? "unknown"}</strong>.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
              </div>

              {/* Unpaid leave preview warning */}
              {previewDays > 0 && previewExcess > 0 && (
                <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{previewExcess}</strong> of these {previewDays} day(s) will be{" "}
                    <strong>unpaid</strong> (annual quota of {balance?.quota} days exceeded). You
                    can still apply — the excess will be deducted from your salary.
                  </span>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Reason for leave..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
              <Button type="submit" disabled={applyMutation.isPending}>
                {applyMutation.isPending ? "Submitting..." : "Submit Application"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Leave history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {leaves.length === 0 ? (
            <p className="text-sm text-slate-500 px-6 py-4">No leave applications yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {leaves.map((leave) => (
                <div key={leave.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDate(leave.startDate)} — {formatDate(leave.endDate)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {leave.numberOfDays} day{leave.numberOfDays !== 1 ? "s" : ""}
                      {leave.reason ? ` · ${leave.reason}` : ""}
                    </p>
                  </div>
                  <Badge className={`text-xs ${statusColors[leave.status]}`}>
                    {leave.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
