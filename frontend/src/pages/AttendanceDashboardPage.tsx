import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  Activity,
  Calendar,
  Clock,
  Eye,
  Loader2,
  LogIn,
  LogOut,
  Monitor,
  Mouse,
  Square,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Types ────────────────────────────────────────── */

type AttendanceStatus = "Present" | "Absent";

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  totalTimeMinutes: number;
  idleTimeMinutes: number;
  realTimeMinutes: number;
  status: AttendanceStatus;
  lateLogin: boolean;
  earlyLogout: boolean;
  autoEnded: boolean;
  minHoursPresent: number;
  workStartTime: string;
  workEndTime: string;
  totalTimeLabel: string;
  idleTimeLabel: string;
  realTimeLabel: string;
}

interface TodayAttendanceResponse {
  date: string;
  workStartTime: string;
  workEndTime: string;
  minHoursPresent: number;
  attendance: AttendanceRecord | null;
  isWorking: boolean;
}

interface AdminAttendanceRow {
  userId: string;
  fullName: string;
  email: string;
  workStartTime: string;
  workEndTime: string;
  minHoursPresent: number;
  startTime: string | null;
  endTime: string | null;
  totalTimeMinutes: number;
  idleTimeMinutes: number;
  realTimeMinutes: number;
  status: AttendanceStatus;
  lateLogin: boolean;
  earlyLogout: boolean;
  autoEnded: boolean;
  isWorking: boolean;
  totalTimeLabel: string;
  idleTimeLabel: string;
  realTimeLabel: string;
}

interface AdminTodayResponse {
  date: string;
  rows: AdminAttendanceRow[];
}

interface HistorySummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  autoEndedDays: number;
  lateLoginDays: number;
  earlyLogoutDays: number;
}

interface HistoryRecord extends AttendanceRecord {
  fullName?: string;
  email?: string;
}

interface HistoryResponse {
  from: string;
  to: string;
  summary: HistorySummary;
  records: HistoryRecord[];
}

interface AdminHistoryResponse {
  from: string;
  to: string;
  userSummaries: Array<{
    userId: string;
    fullName: string;
    email: string;
    totalDays: number;
    presentDays: number;
    absentDays: number;
    autoEndedDays: number;
    lateLoginDays: number;
    earlyLogoutDays: number;
    totalRealMinutes: number;
  }>;
  records: HistoryRecord[];
}

interface ActivitySummary {
  totalActiveSeconds: number;
  totalIdleSeconds: number;
  totalClicks: number;
  totalKeys: number;
  totalEvents: number;
  totalActiveLabel: string;
  totalIdleLabel: string;
}

interface ActivityPage {
  page: string;
  totalActiveSeconds: number;
  totalIdleSeconds: number;
  totalClicks: number;
  totalKeys: number;
  visitCount: number;
}

interface DailyActivity {
  date: string;
  activeSeconds: number;
  idleSeconds: number;
  clicks: number;
  keys: number;
  events: number;
}

interface MyActivityResponse {
  from: string;
  to: string;
  summary: ActivitySummary;
  pages: ActivityPage[];
  dailyBreakdown: DailyActivity[];
}

interface AdminActivityUser {
  userId: string;
  fullName: string;
  email: string;
  totalActiveSeconds: number;
  totalIdleSeconds: number;
  totalClicks: number;
  totalKeys: number;
  totalEvents: number;
  totalActiveLabel: string;
  totalIdleLabel: string;
  topPages: Array<{ page: string; visits: number }>;
}

interface AdminActivityResponse {
  from: string;
  to: string;
  userSummaries: AdminActivityUser[];
}

interface ApiErrorResponse {
  error?: string;
}

/* ─── Helpers ──────────────────────────────────────── */

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(Math.max(0, minutes) / 60);
  const m = Math.max(0, minutes) % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as AxiosError<ApiErrorResponse>).response?.data?.error || fallback;
}

function getDateRangeParams(range: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  let fromDate: Date;

  switch (range) {
    case "7d":
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { from: fromDate.toISOString().split("T")[0], to };
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/buyers": "Buyers",
  "/suppliers/signed-contract": "Signed Contracts",
  "/suppliers/new": "New Suppliers",
  "/suppliers/old": "Old Suppliers",
  "/deals": "Deals",
  "/reports": "Reports",
  "/vault": "Vault",
  "/members": "Members",
  "/activity": "Activity",
  "/email-tasks": "Email Tracker",
  "/daily-tasks": "Daily Tasks",
  "/notifications": "Notifications",
  "/attendance": "Attendance",
};

function getPageLabel(path: string): string {
  return PAGE_LABELS[path] || path;
}

/* ─── Session & Activity Tracker ───────────────────── */

function generateSessionId(): string {
  // crypto.randomUUID() is only available in secure contexts (HTTPS).
  // Fall back to a manual implementation for HTTP deployments.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: generate a UUID-v4-like string
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function useActivityTracker() {
  const sessionIdRef = useRef(
    typeof window !== "undefined"
      ? sessionStorage.getItem("activity_session_id") ||
        (() => {
          const id = generateSessionId();
          sessionStorage.setItem("activity_session_id", id);
          return id;
        })()
      : ""
  );

  const statsRef = useRef({
    clicks: 0,
    keys: 0,
    scrollDepth: 0,
    activeMs: 0,
    idleMs: 0,
    lastActivity: Date.now(),
    page: window.location.pathname,
  });

  const flushRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(async () => {
    const s = statsRef.current;
    const now = Date.now();
    const gap = now - s.lastActivity;
    if (gap > 120_000) {
      s.idleMs += gap;
    } else {
      s.activeMs += gap;
    }
    s.lastActivity = now;

    if (s.activeMs === 0 && s.clicks === 0 && s.keys === 0) return;

    try {
      await api.post("/activity-tracking/track", {
        sessionId: sessionIdRef.current,
        eventType: "heartbeat",
        page: s.page,
        activeSeconds: Math.round(s.activeMs / 1000),
        idleSeconds: Math.round(s.idleMs / 1000),
        clickCount: s.clicks,
        keyCount: s.keys,
        scrollDepth: s.scrollDepth,
      });
    } catch {
      // Best-effort
    }

    s.clicks = 0;
    s.keys = 0;
    s.scrollDepth = 0;
    s.activeMs = 0;
    s.idleMs = 0;
  }, []);

  useEffect(() => {
    const onActivity = () => {
      const s = statsRef.current;
      const now = Date.now();
      const gap = now - s.lastActivity;
      if (gap > 120_000) {
        s.idleMs += gap;
      } else {
        s.activeMs += gap;
      }
      s.lastActivity = now;
    };

    const onClick = () => {
      statsRef.current.clicks++;
      onActivity();
    };
    const onKey = () => {
      statsRef.current.keys++;
      onActivity();
    };
    const onScroll = () => {
      const depth = Math.round(
        ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
      );
      statsRef.current.scrollDepth = Math.max(statsRef.current.scrollDepth, depth);
      onActivity();
    };
    const onMouseMove = () => onActivity();

    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll);
    window.addEventListener("mousemove", onMouseMove);

    // Flush every 30 seconds
    flushRef.current = setInterval(flush, 30_000);

    // Flush on page unload
    const onBeforeUnload = () => flush();
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (flushRef.current) clearInterval(flushRef.current);
      flush();
    };
  }, [flush]);

  // Update page on route change
  useEffect(() => {
    statsRef.current.page = window.location.pathname;
  });
}

/* ─── Status Pill ──────────────────────────────────── */

function StatusPill({ status, autoEnded }: { status: AttendanceStatus; autoEnded?: boolean }) {
  if (autoEnded) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
        <Zap className="h-3 w-3" />
        Auto-Absent
      </span>
    );
  }
  const classes =
    status === "Present"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-rose-50 text-rose-700 border-rose-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>
      {status}
    </span>
  );
}

/* ─── Live Timer ───────────────────────────────────── */

function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  return (
    <span className="font-mono text-3xl font-extrabold tracking-wider tabular-nums bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

/* ─── Progress Ring ────────────────────────────────── */

function ProgressRing({ value, max, size = 80, strokeWidth = 6 }: { value: number; max: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, value / max));
  const offset = circumference * (1 - pct);
  const color = pct >= 1 ? "#10b981" : pct >= 0.5 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

/* ─── Tab Button ───────────────────────────────────── */

function TabButton({ active, onClick, children, icon: Icon }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
        active
          ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* ─── Date Range Picker ────────────────────────────── */

function DateRangePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const options = [
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
    { value: "90d", label: "Last 90 Days" },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
            value === opt.value
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Stat Card ────────────────────────────────────── */

function StatCard({ label, value, sublabel, icon: Icon, color = "slate" }: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ElementType;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        {Icon && (
          <div className={`rounded-lg p-2 border ${colorMap[color] || colorMap.slate}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-slate-500">{sublabel}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function AttendanceDashboardPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"my" | "history" | "activity" | "admin" | "admin-history" | "admin-activity">("my");
  const [historyRange, setHistoryRange] = useState("30d");
  const [activityRange, setActivityRange] = useState("7d");
  const [adminHistoryRange, setAdminHistoryRange] = useState("30d");
  const [adminActivityRange, setAdminActivityRange] = useState("7d");

  // Activity tracking
  useActivityTracker();

  /* ─── Queries ────────────────────────────────────── */

  const todayQuery = useQuery<TodayAttendanceResponse>({
    queryKey: ["attendance-today"],
    queryFn: () => api.get("/attendance/today").then((r) => r.data),
    refetchInterval: 30000,
  });

  const adminTodayQuery = useQuery<AdminTodayResponse>({
    queryKey: ["attendance-admin-today"],
    queryFn: () => api.get("/attendance/admin/today").then((r) => r.data),
    enabled: isAdmin && activeTab === "admin",
    refetchInterval: 30000,
  });

  const historyParams = getDateRangeParams(historyRange);
  const historyQuery = useQuery<HistoryResponse>({
    queryKey: ["attendance-history", historyRange],
    queryFn: () => api.get("/attendance/history", { params: historyParams }).then((r) => r.data),
    enabled: activeTab === "history",
  });

  const activityParams = getDateRangeParams(activityRange);
  const myActivityQuery = useQuery<MyActivityResponse>({
    queryKey: ["my-activity", activityRange],
    queryFn: () => api.get("/activity-tracking/my", { params: activityParams }).then((r) => r.data),
    enabled: activeTab === "activity",
  });

  const adminHistoryParams = getDateRangeParams(adminHistoryRange);
  const adminHistoryQuery = useQuery<AdminHistoryResponse>({
    queryKey: ["admin-attendance-history", adminHistoryRange],
    queryFn: () => api.get("/attendance/admin/history", { params: adminHistoryParams }).then((r) => r.data),
    enabled: isAdmin && activeTab === "admin-history",
  });

  const adminActivityParams = getDateRangeParams(adminActivityRange);
  const adminActivityQuery = useQuery<AdminActivityResponse>({
    queryKey: ["admin-activity", adminActivityRange],
    queryFn: () => api.get("/activity-tracking/admin", { params: adminActivityParams }).then((r) => r.data),
    enabled: isAdmin && activeTab === "admin-activity",
  });

  /* ─── Mutations ──────────────────────────────────── */

  const startMutation = useMutation({
    mutationFn: () => api.post("/attendance/start"),
    onSuccess: () => {
      toast.success("✅ Checked in successfully!");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-admin-today"] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Could not check in")),
  });

  const endMutation = useMutation({
    mutationFn: () => api.post("/attendance/end"),
    onSuccess: () => {
      toast.success("✅ Checked out successfully!");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-admin-today"] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Could not check out")),
  });

  const heartbeatMutation = useMutation({
    mutationFn: () => api.post("/attendance/heartbeat"),
  });

  // Heartbeat while working
  useEffect(() => {
    if (!todayQuery.data?.isWorking) return;
    const interval = setInterval(() => heartbeatMutation.mutate(), 60000);
    return () => clearInterval(interval);
  }, [todayQuery.data?.isWorking]);

  /* ─── Derived ────────────────────────────────────── */

  const attendance = todayQuery.data?.attendance;
  const isWorking = Boolean(todayQuery.data?.isWorking);
  const isDone = Boolean(attendance?.endTime);
  const minPresent = todayQuery.data?.minHoursPresent ?? 420;

  const checkInStage = !attendance?.startTime ? "not-started" : isWorking ? "working" : "completed";

  /* ─── Render ─────────────────────────────────────── */

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance & Activity (Work Is In Progress...)</h1>
          <p className="mt-1 text-sm text-slate-500">Track your work sessions, history, and activity.</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 border border-slate-200 p-2">
        <TabButton active={activeTab === "my"} onClick={() => setActiveTab("my")} icon={Clock}>
          My Attendance
        </TabButton>
        <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")} icon={Calendar}>
          My History
        </TabButton>
        <TabButton active={activeTab === "activity"} onClick={() => setActiveTab("activity")} icon={Activity}>
          My Activity
        </TabButton>
        {isAdmin && (
          <>
            <div className="w-px bg-slate-200 mx-1 self-stretch" />
            <TabButton active={activeTab === "admin"} onClick={() => setActiveTab("admin")} icon={Users}>
              Team Today
            </TabButton>
            <TabButton active={activeTab === "admin-history"} onClick={() => setActiveTab("admin-history")} icon={Calendar}>
              Team History
            </TabButton>
            <TabButton active={activeTab === "admin-activity"} onClick={() => setActiveTab("admin-activity")} icon={Monitor}>
              Team Activity
            </TabButton>
          </>
        )}
      </div>

      {/* ═══ My Attendance Tab ═══ */}
      {activeTab === "my" && (
        <div className="space-y-6">
          {/* Hero Check-In/Check-Out Card */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-sm">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-emerald-50 to-transparent rounded-bl-full opacity-60" />

            <div className="relative flex flex-col items-center gap-6 md:flex-row md:justify-between">
              {/* Status + Timer */}
              <div className="flex flex-col items-center md:items-start gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${isWorking ? "bg-emerald-500 animate-pulse" : isDone ? "bg-slate-300" : "bg-amber-400"}`} />
                  <span className="text-lg font-bold text-slate-800">
                    {checkInStage === "not-started" && "Ready to Check In"}
                    {checkInStage === "working" && "Currently Working"}
                    {checkInStage === "completed" && "Day Completed ✓"}
                  </span>
                </div>

                {isWorking && attendance?.startTime && (
                  <LiveTimer startTime={attendance.startTime} />
                )}

                {isDone && (
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <ProgressRing
                        value={attendance?.realTimeMinutes ?? 0}
                        max={minPresent}
                        size={64}
                        strokeWidth={5}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-slate-600">
                          {Math.round(((attendance?.realTimeMinutes ?? 0) / minPresent) * 100)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Real work time</p>
                      <p className="text-lg font-bold text-slate-800">{formatMinutes(attendance?.realTimeMinutes ?? 0)}</p>
                    </div>
                  </div>
                )}

                {!attendance && (
                  <p className="text-sm text-slate-400">
                    Work window: {todayQuery.data?.workStartTime ?? "09:00"} – {todayQuery.data?.workEndTime ?? "18:00"}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col items-center gap-3">
                {checkInStage === "not-started" && (
                  <Button
                    onClick={() => startMutation.mutate()}
                    disabled={startMutation.isPending || todayQuery.isLoading}
                    className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 px-8 py-6 text-base rounded-xl transition-all hover:scale-105"
                  >
                    {startMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                    Check In
                  </Button>
                )}

                {checkInStage === "working" && (
                  <Button
                    onClick={() => endMutation.mutate()}
                    disabled={endMutation.isPending}
                    className="gap-2 bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20 px-8 py-6 text-base rounded-xl transition-all hover:scale-105"
                  >
                    {endMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                    Check Out
                  </Button>
                )}

                {checkInStage === "completed" && (
                  <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-3 text-sm font-semibold text-slate-500">
                    <Square className="h-4 w-4" />
                    Attendance Complete
                  </div>
                )}

                {attendance?.autoEnded && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs font-semibold text-amber-700">
                    <Zap className="h-3.5 w-3.5" />
                    Auto-ended — You forgot to check out
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Today's Stats */}
          {attendance && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="Check In" value={formatDateTime(attendance.startTime)} icon={LogIn} color="emerald" />
              <StatCard label="Check Out" value={isDone ? formatDateTime(attendance.endTime) : "In Progress"} icon={LogOut} color={isDone ? "blue" : "amber"} />
              <StatCard
                label="Status"
                value={attendance.autoEnded ? "Auto-Absent" : attendance.status}
                icon={Eye}
                color={attendance.status === "Present" ? "emerald" : "rose"}
                sublabel={attendance.lateLogin ? "Late login" : undefined}
              />
              <StatCard
                label="Work Time"
                value={formatMinutes(attendance.realTimeMinutes)}
                icon={Timer}
                color="violet"
                sublabel={`Required: ${formatMinutes(minPresent)}`}
              />
            </div>
          )}

          {/* Schedule Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Today's Schedule</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-slate-400">Start:</span>{" "}
                <span className="font-semibold text-slate-700">{todayQuery.data?.workStartTime ?? "09:00"}</span>
              </div>
              <div>
                <span className="text-slate-400">End:</span>{" "}
                <span className="font-semibold text-slate-700">{todayQuery.data?.workEndTime ?? "18:00"}</span>
              </div>
              <div>
                <span className="text-slate-400">Min. Present:</span>{" "}
                <span className="font-semibold text-slate-700">{formatMinutes(minPresent)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ My History Tab ═══ */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Attendance History</h2>
            <DateRangePicker value={historyRange} onChange={setHistoryRange} />
          </div>

          {historyQuery.isLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : historyQuery.data ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Total Days" value={historyQuery.data.summary.totalDays} icon={Calendar} color="slate" />
                <StatCard label="Present" value={historyQuery.data.summary.presentDays} icon={Eye} color="emerald" />
                <StatCard label="Absent" value={historyQuery.data.summary.absentDays} icon={Eye} color="rose" />
                <StatCard label="Auto-Absent" value={historyQuery.data.summary.autoEndedDays} icon={Zap} color="amber" />
                <StatCard label="Late Logins" value={historyQuery.data.summary.lateLoginDays} icon={Clock} color="amber" />
                <StatCard label="Early Exits" value={historyQuery.data.summary.earlyLogoutDays} icon={LogOut} color="blue" />
              </div>

              {/* History Table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Check In</th>
                        <th className="px-4 py-3">Check Out</th>
                        <th className="px-4 py-3">Work Time</th>
                        <th className="px-4 py-3">Idle</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(historyQuery.data.records ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                            No attendance records found for this period.
                          </td>
                        </tr>
                      ) : (
                        historyQuery.data.records.map((r) => (
                          <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800">{formatDateShort(r.date)}</td>
                            <td className="px-4 py-3 text-slate-600">{formatDateTime(r.startTime)}</td>
                            <td className="px-4 py-3 text-slate-600">{formatDateTime(r.endTime)}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{r.realTimeLabel}</td>
                            <td className="px-4 py-3 text-slate-500">{r.idleTimeLabel}</td>
                            <td className="px-4 py-3"><StatusPill status={r.status} autoEnded={r.autoEnded} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ═══ My Activity Tab ═══ */}
      {activeTab === "activity" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">My Website Activity</h2>
            <DateRangePicker value={activityRange} onChange={setActivityRange} />
          </div>

          {myActivityQuery.isLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : myActivityQuery.data ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard label="Active Time" value={myActivityQuery.data.summary.totalActiveLabel} icon={Timer} color="emerald" />
                <StatCard label="Idle Time" value={myActivityQuery.data.summary.totalIdleLabel} icon={Clock} color="amber" />
                <StatCard label="Total Clicks" value={myActivityQuery.data.summary.totalClicks} icon={Mouse} color="blue" />
                <StatCard label="Keystrokes" value={myActivityQuery.data.summary.totalKeys} icon={Activity} color="violet" />
              </div>

              {/* Pages Breakdown */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Pages Visited</h3>
                <div className="space-y-3">
                  {myActivityQuery.data.pages.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">No activity data recorded yet.</p>
                  ) : (
                    myActivityQuery.data.pages.map((p) => {
                      const maxTime = myActivityQuery.data!.pages[0]?.totalActiveSeconds || 1;
                      const pct = Math.round((p.totalActiveSeconds / maxTime) * 100);
                      return (
                        <div key={p.page} className="group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">{getPageLabel(p.page)}</span>
                            <span className="text-xs text-slate-500">
                              {formatSeconds(p.totalActiveSeconds)} · {p.visitCount} visits · {p.totalClicks} clicks
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Daily Breakdown */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">Daily Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Active Time</th>
                        <th className="px-4 py-3">Idle Time</th>
                        <th className="px-4 py-3">Clicks</th>
                        <th className="px-4 py-3">Keystrokes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myActivityQuery.data.dailyBreakdown.map((d) => (
                        <tr key={d.date} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-medium text-slate-800">{formatDateShort(d.date)}</td>
                          <td className="px-4 py-3 text-emerald-600 font-semibold">{formatSeconds(d.activeSeconds)}</td>
                          <td className="px-4 py-3 text-amber-600">{formatSeconds(d.idleSeconds)}</td>
                          <td className="px-4 py-3 text-slate-600">{d.clicks}</td>
                          <td className="px-4 py-3 text-slate-600">{d.keys}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ═══ Admin: Team Today ═══ */}
      {activeTab === "admin" && isAdmin && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Team Attendance — Today</h2>
          </div>

          {adminTodayQuery.isLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Quick Stats */}
              {adminTodayQuery.data && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <StatCard label="Total Team" value={adminTodayQuery.data.rows.length} icon={Users} color="slate" />
                  <StatCard
                    label="Checked In"
                    value={adminTodayQuery.data.rows.filter((r) => r.startTime).length}
                    icon={LogIn}
                    color="emerald"
                  />
                  <StatCard
                    label="Working Now"
                    value={adminTodayQuery.data.rows.filter((r) => r.isWorking).length}
                    icon={Timer}
                    color="blue"
                  />
                  <StatCard
                    label="Absent"
                    value={adminTodayQuery.data.rows.filter((r) => !r.startTime).length}
                    icon={Eye}
                    color="rose"
                  />
                </div>
              )}

              {/* Team Table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3">Check In</th>
                        <th className="px-4 py-3">Check Out</th>
                        <th className="px-4 py-3">Work Time</th>
                        <th className="px-4 py-3">Idle</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(adminTodayQuery.data?.rows ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                            No team members found.
                          </td>
                        </tr>
                      ) : (
                        (adminTodayQuery.data?.rows ?? []).map((row) => (
                          <tr key={row.userId} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-800">{row.fullName}</p>
                              <p className="text-xs text-slate-400">{row.email}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{formatDateTime(row.startTime)}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.isWorking ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Working
                                </span>
                              ) : (
                                formatDateTime(row.endTime)
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{row.realTimeLabel}</td>
                            <td className="px-4 py-3 text-slate-500">{row.idleTimeLabel}</td>
                            <td className="px-4 py-3"><StatusPill status={row.status} autoEnded={row.autoEnded} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ Admin: Team History ═══ */}
      {activeTab === "admin-history" && isAdmin && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900">Team Attendance History</h2>
            </div>
            <DateRangePicker value={adminHistoryRange} onChange={setAdminHistoryRange} />
          </div>

          {adminHistoryQuery.isLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : adminHistoryQuery.data ? (
            <>
              {/* Per-User Summary Table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">Summary by Member</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3">Days</th>
                        <th className="px-4 py-3">Present</th>
                        <th className="px-4 py-3">Absent</th>
                        <th className="px-4 py-3">Auto-Absent</th>
                        <th className="px-4 py-3">Late</th>
                        <th className="px-4 py-3">Total Work</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminHistoryQuery.data.userSummaries.map((u) => (
                        <tr key={u.userId} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{u.fullName}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{u.totalDays}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-emerald-600">{u.presentDays}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-rose-600">{u.absentDays}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-amber-600">{u.autoEndedDays}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-amber-600">{u.lateLoginDays}</span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">{formatMinutes(u.totalRealMinutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed Records */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">Detailed Records</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3">Check In</th>
                        <th className="px-4 py-3">Check Out</th>
                        <th className="px-4 py-3">Work Time</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminHistoryQuery.data.records.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-medium text-slate-800">{formatDateShort(r.date)}</td>
                          <td className="px-4 py-3 text-slate-700">{r.fullName}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDateTime(r.startTime)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDateTime(r.endTime)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700">{r.realTimeLabel}</td>
                          <td className="px-4 py-3"><StatusPill status={r.status} autoEnded={r.autoEnded} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ═══ Admin: Team Activity ═══ */}
      {activeTab === "admin-activity" && isAdmin && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900">Team Website Activity</h2>
            </div>
            <DateRangePicker value={adminActivityRange} onChange={setAdminActivityRange} />
          </div>

          {adminActivityQuery.isLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : adminActivityQuery.data ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Active Time</th>
                      <th className="px-4 py-3">Idle Time</th>
                      <th className="px-4 py-3">Clicks</th>
                      <th className="px-4 py-3">Keystrokes</th>
                      <th className="px-4 py-3">Top Pages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminActivityQuery.data.userSummaries.map((u) => (
                      <tr key={u.userId} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{u.fullName}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">{u.totalActiveLabel}</td>
                        <td className="px-4 py-3 text-amber-600">{u.totalIdleLabel}</td>
                        <td className="px-4 py-3 text-slate-600">{u.totalClicks}</td>
                        <td className="px-4 py-3 text-slate-600">{u.totalKeys}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.topPages.slice(0, 3).map((tp) => (
                              <span
                                key={tp.page}
                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                              >
                                {getPageLabel(tp.page)}
                                <span className="text-slate-400">({tp.visits})</span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
