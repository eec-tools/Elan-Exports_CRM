import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { Loader2, Activity, Clock, UserRound, ArrowRight, Filter } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Log {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  createdAt: string;
  user?: { fullName: string; email: string };
}

export default function ActivityPage() {
  const [daysFilter, setDaysFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["activity", daysFilter],
    queryFn: () => api.get("/activity", { params: { days: daysFilter === "all" ? undefined : daysFilter } }).then((r) => r.data),
  });

  const getActionStyles = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("create") || act.includes("activate")) {
       return "bg-brand-50 text-brand-700 border-brand-200";
    }
    if (act.includes("update")) {
       return "bg-blue-50 text-blue-700 border-blue-200";
    }
    if (act.includes("delete") || act.includes("deactivate")) {
       return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (act.includes("login")) {
       return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  const formatEntityType = (type: string) => {
    if (!type) return "System Event";
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* ── Dashboard Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-100 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-brand-500" />
            System Activity Logs
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time audit trail of actions taken across the CRM.
          </p>
        </div>
        <div className="flex items-center gap-3">
           <Filter className="h-4 w-4 text-slate-400" />
           <Select value={daysFilter} onValueChange={setDaysFilter}>
              <SelectTrigger className="w-[180px] bg-white border-slate-200">
                 <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="all">Last 1 Year (Default)</SelectItem>
                 <SelectItem value="30">Last 30 Days</SelectItem>
                 <SelectItem value="7">Last 7 Days</SelectItem>
                 <SelectItem value="2">Last 2 Days</SelectItem>
                 <SelectItem value="1">Last 24 Hours</SelectItem>
              </SelectContent>
           </Select>
        </div>
      </div>

      {/* ── Main Data Table ── */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-4">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left border-collapse min-w-max">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Acting User</th>
                <th className="px-5 py-3.5 font-semibold">Action Performed</th>
                <th className="px-5 py-3.5 font-semibold">Target Entity</th>
                <th className="px-5 py-3.5 font-semibold max-w-[400px]">Technical Details</th>
                <th className="px-5 py-3.5 font-semibold w-[180px]">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                   <td colSpan={5} className="h-32 text-center">
                     <div className="flex justify-center">
                       <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                     </div>
                   </td>
                </tr>
              ) : logs.length === 0 ? (
                 <tr>
                    <td colSpan={5} className="px-5 py-16 text-center shadow-[inset_0_1px_0_#f1f5f9]">
                       <div className="flex flex-col items-center justify-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                             <Activity className="h-6 w-6 text-slate-300" />
                          </div>
                          <p className="text-slate-600 font-medium">No system activity recorded yet</p>
                       </div>
                    </td>
                 </tr>
              ) : (
                logs.map((log: Log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group align-middle">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                             <UserRound className="h-4 w-4 text-slate-400" />
                          </div>
                          <div className="flex flex-col">
                             {log.user ? (
                                <>
                                  <span className="font-bold text-slate-900 text-[13px]">{log.user.fullName}</span>
                                  <span className="text-[12px] text-slate-500 leading-none mt-0.5">{log.user.email}</span>
                                </>
                             ) : (
                                <span className="font-bold text-slate-500 text-[13px] italic">System Automation</span>
                             )}
                          </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                       <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getActionStyles(log.action)}`}>
                          {log.action.replace(/_/g, " ")}
                       </span>
                    </td>
                    <td className="px-5 py-3">
                       <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                              {formatEntityType(log.entityType)}
                          </span>
                       </div>
                    </td>
                    <td className="px-5 py-3 max-w-[400px]">
                      {log.details ? (
                         <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {Object.entries(log.details as Record<string, unknown>).map(([k, v]) => (
                               <div key={k} className="flex items-center text-[12px] max-w-full">
                                  <span className="text-slate-400 font-medium">{k}</span>
                                  <ArrowRight className="h-3 w-3 text-slate-300 mx-1 shrink-0" />
                                  <span className="text-slate-700 font-mono truncate max-w-[200px]" title={String(v)}>{String(v)}</span>
                               </div>
                            ))}
                         </div>
                      ) : (
                         <span className="text-slate-400 italic text-[13px]">No additional constraints</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                       <div className="flex items-center gap-1.5 object-right">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <div className="flex flex-col text-[12px]">
                             <span className="font-bold text-slate-700">{format(new Date(log.createdAt), "dd MMM yyyy")}</span>
                             <span className="text-slate-500 leading-none">{format(new Date(log.createdAt), "HH:mm:ss a")}</span>
                          </div>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
