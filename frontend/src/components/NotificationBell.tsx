import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  ArrowRight,
  Factory,
  TrendingUp,
  Mail,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

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
  if (type === "deal_stage_change") return <TrendingUp className="h-4 w-4 text-blue-500 shrink-0" />;
  if (type.startsWith("campaign")) return <Mail className="h-4 w-4 text-amber-500 shrink-0" />;
  if (type === "stage_change") return <Factory className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (type === "status_change") return <Factory className="h-4 w-4 text-violet-500 shrink-0" />;
  return <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: authHeader(),
      });
      if (!res.ok) return { count: 0 };
      return res.json() as Promise<{ count: number }>;
    },
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const sse = new EventSource(`${API_BASE}/notifications/stream?token=${token}`);
    
    // Play 'ting' sound via a very short base64 wav
    const playTing = () => {
      const audio = new Audio("data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACApby7pIBbRERbf6S6uqSAXEZGXH+jubmjf11HR11/ore3on9dSElef6G2tqGAXkpKXoCgtbSgf19LS19/oLOzn39gTE1ggJ+ysp9/YU5OYX+esbGef2FPT2J/na+vnX9iUFBigJyurpx/Y1FRY4Ccra2cf2RSU2R/m6ysm39kVFRkgJqrq5p/ZVVVZYCaqqqagGZWVmaAmampmX9mV1dmf5ioqJiAZ1hYZ4CYp6eYgGdZWWh/l6aml4BoWlpogJelpZZ/aVtbaYCWpKSWgGlcXGmAlqOjlYBqXFxqgJWiopWAal1daoCUoaGUf2teXmt/lKCglH9rX19rgJOgoJOAbGBgbICTn5+TgGxhYWyAkp6ekn9tYWFtgJKdnZKAbWJibYCSnZ2RgG5jY26AkZyckYBuY2RugJGbm5F/b2Rkb3+Qm5qQf29lZW9/kJqakH9vZWZwgI+ZmY+AcGZmcH+PmZiPf3BnZ3B/j5iYj39xZ2dxf46Xl46AcWhocYCOl5eOgHFpaXGAjpaWjX9yaWlygI2Wlo1/cmpqcn+NlZWNf3JqanKAjZWUjIBza2tzf4yUlIx/c2trc4CMlJOMf3NsbHN/jJOTi4B0bGx0gIuTkot/dG1tdICLkpKLgHRtbXR/i5KSi4B0bm51gIqRkYp/dW5udYCKkZGKgHVub3V/ipCQin91b291gIqQkIp/dW9vdn+Jj4+Jf3ZwcHaAiY+PiX92cHB2gImPj4l/dnBxdoCJjo6JgHZxcXd/iI6OiIB3cXF3gIiOjoiAd3Jyd3+IjY2IgHdycneAiI2NiH93cnJ3f4iNjYiAd3NzeICHjIyHf3hzc3iAh4yMh4B4c3N4f4eMjId/eHR0eICHi4uHf3h0dHh/h4uLh394dHR4gIaLi4Z/eXR0eYCGioqGf3l1dXl/hoqKhoB5dXV5f4aKioaAeXV1eYCGioqGgHl1dXl/homJhoB5dnZ5gIaJiYV/enZ2en+FiYmFgHp2dnp/hYmJhX96dnZ6gIWIiIWAend3en+FiIiFf3p3d3qAhYiIhX96d3d6gIWIiIV/end3eg==");
      audio.play().catch(e => console.error("Audio playback blocked:", e));
    };

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          console.log("[NotificationBell] SSE Connected");
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    sse.addEventListener("notification", () => {
      playTing();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });

    sse.onerror = (err) => {
      console.error("SSE Error:", err);
      sse.close();
    };

    return () => sse.close();
  }, [queryClient]);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", "dropdown"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/notifications?limit=10`, {
        headers: authHeader(),
      });
      if (!res.ok) return [];
      return res.json() as Promise<Notification[]>;
    },
    enabled: open,
    refetchOnWindowFocus: false,
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

  const unreadCount = countData?.count ?? 0;
  const recentUnreadNotifications = notifications.filter((n) => !n.isRead).slice(0, 3);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 text-slate-800 hover:bg-slate-100 hover:text-slate-900 rounded-lg"
          title="Notifications"
        >
          <Bell className="h-6 w-6" strokeWidth={2.5} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 shadow-xl border border-slate-200 rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-600" />
            <span className="font-semibold text-sm text-slate-800">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-slate-500 hover:text-slate-800 px-2"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto bg-white divide-y divide-slate-50">
          {recentUnreadNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
              <CheckCheck className="h-8 w-8 opacity-40" />
              <span className="text-sm">You have no unread notifications</span>
            </div>
          ) : (
            recentUnreadNotifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer group ${
                  n.isRead ? "bg-white hover:bg-slate-50" : "bg-amber-50/60 hover:bg-amber-50"
                }`}
                onClick={() => {
                  if (n.entityLink) {
                    if (!n.isRead) markReadMutation.mutate(n.id);
                    setOpen(false);
                    navigate(n.entityLink);
                  }
                }}
              >
                <div className="mt-0.5">{notificationIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-semibold truncate ${n.isRead ? "text-slate-700" : "text-slate-900"}`}>
                      {n.title}
                    </p>
                    {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!n.isRead && (
                  <button
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-emerald-600 mt-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      markReadMutation.mutate(n.id);
                    }}
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <button
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors w-full justify-center"
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
          >
            View all notifications
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
