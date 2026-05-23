import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Factory,
  TrendingUp,
  Mail,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  entityName: string;
  entityLink: string | null;
  createdBy: string | null;
  createdAt: string;
  isRead: boolean;
}

function notificationIcon(type: string) {
  if (type === "deal_stage_change")
    return <TrendingUp className="h-5 w-5 text-blue-500 shrink-0" />;
  if (type.startsWith("campaign"))
    return <Mail className="h-5 w-5 text-amber-500 shrink-0" />;
  if (type === "stage_change")
    return <Factory className="h-5 w-5 text-emerald-500 shrink-0" />;
  if (type === "status_change")
    return <Factory className="h-5 w-5 text-violet-500 shrink-0" />;
  return <AlertCircle className="h-5 w-5 text-slate-400 shrink-0" />;
}

function typeBadge(type: string) {
  const map: Record<string, { label: string; className: string }> = {
    deal_stage_change: { label: "Deal", className: "bg-blue-50 text-blue-700" },
    stage_change: { label: "Stage", className: "bg-emerald-50 text-emerald-700" },
    status_change: { label: "Status", className: "bg-violet-50 text-violet-700" },
    campaign_responded: { label: "Campaign", className: "bg-amber-50 text-amber-700" },
    campaign_completed: { label: "Campaign", className: "bg-amber-50 text-amber-700" },
    campaign_followup_due: { label: "Follow-up", className: "bg-orange-50 text-orange-700" },
  };
  const entry = map[type] ?? { label: type, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${entry.className}`}>
      {entry.label}
    </span>
  );
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/notifications?limit=100`, {
        headers: authHeader(),
      });
      if (!res.ok) return [];
      return res.json() as Promise<Notification[]>;
    },
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: "POST",
        headers: authHeader(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: "POST",
        headers: authHeader(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const filtered =
    filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Bell className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-slate-600 border-slate-200 hover:bg-slate-50 gap-1.5"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(["all", "unread"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
              filter === tab
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "unread" ? `Unread (${unreadCount})` : "All"}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-12 text-slate-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <CheckCircle2 className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                n.isRead
                  ? "bg-white border-slate-100 hover:border-slate-200"
                  : "bg-amber-50/60 border-amber-100 hover:bg-amber-50"
              } ${n.entityLink ? "cursor-pointer" : ""}`}
              onClick={() => {
                if (n.entityLink) {
                  if (!n.isRead) markReadMutation.mutate(n.id);
                  navigate(n.entityLink);
                }
              }}
            >
              <div className="mt-0.5">{notificationIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${n.isRead ? "text-slate-700" : "text-slate-900"}`}>
                    {n.title}
                  </span>
                  {typeBadge(n.type)}
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1.5">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>
              {!n.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 text-xs text-slate-400 hover:text-slate-700 hover:bg-white px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    markReadMutation.mutate(n.id);
                  }}
                >
                  Mark read
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
