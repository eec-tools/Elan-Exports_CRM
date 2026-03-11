import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Clock,
  UserRound,
  Mail,
  ShieldQuestion,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AccessRequest {
  id: string;
  userId: string;
  permission: string;
  reason: string;
  status: string;
  createdAt: string;
  reviewedAt?: string;
  user?: { fullName: string; email: string };
  reviewer?: { fullName: string; email: string };
}

export default function AccessRequestsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permission, setPermission] = useState("buyers");
  const [reason, setReason] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["access-requests"],
    queryFn: () => api.get("/access-requests").then((r) => r.data),
  });

  const pendingCount = requests.filter((r: AccessRequest) => r.status === "pending").length;
  const approvedCount = requests.filter((r: AccessRequest) => r.status === "approved").length;
  const rejectedCount = requests.filter((r: AccessRequest) => r.status === "rejected").length;

  const createMutation = useMutation({
    mutationFn: (d: { permission: string; reason: string }) =>
      api.post("/access-requests", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      setDialogOpen(false);
      toast.success("Request submitted successfully");
    },
    onError: () => toast.error("Failed to submit request"),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/access-requests/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      toast.success("Request reviewed");
    },
    onError: () => toast.error("Failed to review request"),
  });

  const getStatusStyles = (s: string) => {
    switch (s.toLowerCase()) {
      case "approved":
        return "bg-brand-50 text-brand-700 border-brand-200";
      case "rejected":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  const StatusIcon = ({ status, className }: { status: string; className?: string }) => {
     switch(status.toLowerCase()) {
        case "approved": return <ShieldCheck className={className} />;
        case "rejected": return <ShieldAlert className={className} />;
        default: return <Clock className={className} />;
     }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* ── Dashboard Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-100 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-brand-500" />
            Access Controls
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? "Review and manage permission requests from team members."
              : "Request additional organizational access for your account."}
          </p>
        </div>
        {!isAdmin && (
          <Button
            onClick={() => {
              setPermission("buyers");
              setReason("");
              setDialogOpen(true);
            }}
            className="gap-2 bg-brand-600 hover:bg-brand-700 text-white shadow-sm h-9"
          >
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        )}
      </div>

      {/* ── Summary Hub ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
         <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-y-0 left-0 w-1 bg-amber-400 group-hover:w-1.5 transition-all"></div>
            <div className="rounded-lg p-3 bg-amber-50 border border-amber-100 text-amber-600 ml-1"><Clock className="h-5 w-5" /></div>
            <div>
               <p className="text-xs text-slate-500 font-medium">Pending Review</p>
               <p className="text-xl font-bold text-slate-800">{pendingCount}</p>
            </div>
         </div>
         <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-y-0 left-0 w-1 bg-brand-500 group-hover:w-1.5 transition-all"></div>
            <div className="rounded-lg p-3 bg-brand-50 border border-brand-100 text-brand-600 ml-1"><ShieldCheck className="h-5 w-5" /></div>
            <div>
               <p className="text-xs text-slate-500 font-medium">Approved Requests</p>
               <p className="text-xl font-bold text-slate-800">{approvedCount}</p>
            </div>
         </div>
         <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-y-0 left-0 w-1 bg-rose-500 group-hover:w-1.5 transition-all"></div>
            <div className="rounded-lg p-3 bg-rose-50 border border-rose-100 text-rose-600 ml-1"><ShieldAlert className="h-5 w-5" /></div>
            <div>
               <p className="text-xs text-slate-500 font-medium">Rejected Requests</p>
               <p className="text-xl font-bold text-slate-800">{rejectedCount}</p>
            </div>
         </div>
      </div>

      {/* ── Main Data Table ── */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-4">
         <div className="overflow-auto flex-1 relative">
            <table className="w-full text-sm text-left border-collapse min-w-max">
               <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                     <th className="px-5 py-3.5 font-semibold">User Details</th>
                     <th className="px-5 py-3.5 font-semibold">Requested Access Level</th>
                     <th className="px-5 py-3.5 font-semibold max-w-[300px]">Justification</th>
                     <th className="px-5 py-3.5 font-semibold">Approval Status</th>
                     <th className="px-5 py-3.5 font-semibold text-right">Timestamp</th>
                     {isAdmin && (
                        <th className="px-5 py-3.5 font-semibold w-[120px] text-right">Actions</th>
                     )}
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-slate-700">
                  {isLoading ? (
                     <tr>
                        <td colSpan={isAdmin ? 6 : 5} className="h-32 text-center">
                           <div className="flex justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                           </div>
                        </td>
                     </tr>
                  ) : requests.length === 0 ? (
                     <tr>
                        <td colSpan={isAdmin ? 6 : 5} className="px-5 py-16 text-center shadow-[inset_0_1px_0_#f1f5f9]">
                           <div className="flex flex-col items-center justify-center gap-3">
                              <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                 <ShieldQuestion className="h-6 w-6 text-slate-300" />
                              </div>
                              <p className="text-slate-600 font-medium">No permission requests logged</p>
                           </div>
                        </td>
                     </tr>
                  ) : (
                     requests.map((r: AccessRequest) => (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group align-middle">
                           <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                    <UserRound className="h-4 w-4 text-slate-400" />
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="font-bold text-slate-900 leading-tight">{r.user?.fullName || "Unknown Admin"}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[13px] text-slate-500">
                                       <Mail className="h-3.5 w-3.5 opacity-70" />
                                       {r.user?.email || "N/A"}
                                    </div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-5 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 capitalize tracking-tight">
                                 <KeyRound className="h-3 w-3 mr-1.5 text-slate-400" />
                                 {r.permission.replace('_', ' ')}
                              </span>
                           </td>
                           <td className="px-5 py-4 max-w-[300px]">
                              <div className="flex items-start gap-2 text-[13px] text-slate-600 mt-1">
                                 <Info className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                                 <p className="line-clamp-2 leading-relaxed">{r.reason}</p>
                              </div>
                           </td>
                           <td className="px-5 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border capitalize tracking-wide ${getStatusStyles(r.status)}`}>
                                 <StatusIcon status={r.status} className="h-3.5 w-3.5 mr-1.5" />
                                 {r.status}
                              </span>
                           </td>
                           <td className="px-5 py-4 text-right">
                              <div className="flex flex-col text-[12px]">
                                 <span className="font-bold text-slate-700">{format(new Date(r.createdAt), "dd MMM yyyy")}</span>
                                 <span className="text-slate-500 leading-none mt-1">{format(new Date(r.createdAt), "HH:mm a")}</span>
                              </div>
                           </td>
                           {isAdmin && (
                              <td className="px-5 py-4 text-right">
                                 <div className={`flex items-center justify-end gap-1 transition-opacity ${r.status !== 'pending' ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                                    {r.status === "pending" && (
                                       <>
                                          <Button
                                             variant="ghost"
                                             size="icon"
                                             className="h-8 w-8 text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                                             onClick={() => reviewMutation.mutate({ id: r.id, status: "approved" })}
                                             title="Approve access"
                                          >
                                             <CheckCircle className="h-5 w-5" />
                                          </Button>
                                          <Button
                                             variant="ghost"
                                             size="icon"
                                             className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                             onClick={() => reviewMutation.mutate({ id: r.id, status: "rejected" })}
                                             title="Deny access"
                                          >
                                             <XCircle className="h-5 w-5" />
                                          </Button>
                                       </>
                                    )}
                                 </div>
                              </td>
                           )}
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* ── Request Access Modal ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setPermission("buyers");
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md p-0 bg-white rounded-xl shadow-2xl border-none custom-scrollbar-light">
           <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-10">
               <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200">
                   <KeyRound className="h-5 w-5 text-indigo-600" />
               </div>
               <div>
                   <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                     Request Access
                   </DialogTitle>
                   <DialogDescription className="text-slate-500 mt-1">
                     Submit an authorization request to administrators.
                   </DialogDescription>
               </div>
           </div>
           
           <div className="p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate({ permission, reason });
                }}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-semibold">Target Permission/Area</Label>
                  <Select value={permission} onValueChange={setPermission}>
                    <SelectTrigger className="bg-white border-slate-200 focus:ring-brand-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buyers">Buyers Directory</SelectItem>
                      <SelectItem value="suppliers">Suppliers Database</SelectItem>
                      <SelectItem value="analytics">Analytics Module</SelectItem>
                      <SelectItem value="reports">Operations Reports</SelectItem>
                      <SelectItem value="vault">The Vault (Secure Storage)</SelectItem>
                      <SelectItem value="task_tracker">Unified Task Tracker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-semibold">Business Justification *</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    rows={4}
                    className="bg-white border-slate-200 focus:ring-brand-500/20 resize-y min-h-[100px]"
                    placeholder="Briefly explain why you require clearance for this toolset..."
                  />
                </div>
                
                <div className="pt-2 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                     type="submit" 
                     disabled={createMutation.isPending}
                     className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm min-w-[120px]"
                  >
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Submit Request
                  </Button>
                </div>
              </form>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
