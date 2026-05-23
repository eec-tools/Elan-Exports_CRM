import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Leave {
  id: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  user: { id: string; fullName: string; email: string; designation: string | null };
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function AdminLeavesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("pending");

  const { data: leaves = [], isLoading } = useQuery<Leave[]>({
    queryKey: ["admin-leaves", filter],
    queryFn: () =>
      api.get(`/leaves/admin${filter !== "all" ? `?status=${filter}` : ""}`).then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/leaves/admin/${id}/approve`).then((r) => r.data),
    onSuccess: () => {
      toast.success("Leave approved");
      qc.invalidateQueries({ queryKey: ["admin-leaves"] });
    },
    onError: () => toast.error("Failed to approve leave"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/leaves/admin/${id}/reject`).then((r) => r.data),
    onSuccess: () => {
      toast.success("Leave rejected");
      qc.invalidateQueries({ queryKey: ["admin-leaves"] });
    },
    onError: () => toast.error("Failed to reject leave"),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Leave Requests</h1>
        <div className="flex gap-2">
          {["pending", "approved", "rejected", "all"].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-slate-500 px-6 py-4">Loading...</p>
          ) : leaves.length === 0 ? (
            <p className="text-sm text-slate-500 px-6 py-4">No {filter} leave requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Dates</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Days</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Reason</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{leave.user.fullName}</p>
                        {leave.user.designation && (
                          <p className="text-xs text-slate-400">{leave.user.designation}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(leave.startDate)} — {formatDate(leave.endDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{leave.numberOfDays}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {leave.reason || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${statusColors[leave.status]}`}>
                          {leave.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {leave.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-green-600 hover:bg-green-700"
                              onClick={() => approveMutation.mutate(leave.id)}
                              disabled={approveMutation.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => rejectMutation.mutate(leave.id)}
                              disabled={rejectMutation.isPending}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
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
