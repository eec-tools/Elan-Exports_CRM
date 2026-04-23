import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  Calendar,
  Clock,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  MoreVertical,
  Paperclip,
  Square,
  Timer,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  checkoutProofs?: Array<{
    url: string;
    name: string;
    mimeType?: string;
    size?: number;
  }>;
  checkoutProofCount?: number;
}

interface CheckoutProofUpload {
  url: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

interface AttendanceProofFile {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
}

interface TodayAttendanceResponse {
  date: string;
  workStartTime: string;
  workEndTime: string;
  earliestCheckoutTime?: string;
  minHoursPresent: number;
  attendance: AttendanceRecord | null;
  isWorking: boolean;
}

interface AdminAttendanceRow {
  attendanceId: string | null;
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

interface ApiErrorResponse {
  error?: string;
}

/* ─── Helpers ──────────────────────────────────────── */

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function formatDateShort(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(Math.max(0, minutes) / 60);
  const m = Math.max(0, minutes) % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as AxiosError<ApiErrorResponse>).response?.data?.error || fallback;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageProof(file: AttendanceProofFile): boolean {
  if (file.mimeType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.url) || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
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
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  return (
    <span className="font-mono text-3xl font-extrabold tracking-wider tabular-nums bg-linear-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
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
  const { isAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"my" | "history" | "admin" | "admin-history">(
    isAdmin ? "admin" : "my"
  );
  const [historyRange, setHistoryRange] = useState("30d");
  const [adminHistoryRange, setAdminHistoryRange] = useState("30d");
  const [selectedAdminEmployee, setSelectedAdminEmployee] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { type: "record"; attendanceId: string; name: string; date: string }
    | { type: "user"; userId: string; name: string; from: string; to: string }
    | null
  >(null);
  const [checkoutProofs, setCheckoutProofs] = useState<CheckoutProofUpload[]>([]);
  const [isUploadingProofs, setIsUploadingProofs] = useState(false);
  const [isWeekendWork, setIsWeekendWork] = useState(false);
  const [proofViewerOpen, setProofViewerOpen] = useState(false);
  const [selectedProofRecord, setSelectedProofRecord] = useState<HistoryRecord | null>(null);
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);

  /* ─── Queries ────────────────────────────────────── */

  const todayQuery = useQuery<TodayAttendanceResponse>({
    queryKey: ["attendance-today"],
    queryFn: () => api.get("/attendance/today").then((r) => r.data),
    refetchInterval: 30000,
    enabled: !isAdmin,
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
    enabled: !isAdmin && activeTab === "history",
  });

  const adminHistoryParams = getDateRangeParams(adminHistoryRange);
  const adminHistoryQuery = useQuery<AdminHistoryResponse>({
    queryKey: ["admin-attendance-history", adminHistoryRange],
    queryFn: () => api.get("/attendance/admin/history", { params: adminHistoryParams }).then((r) => r.data),
    enabled: isAdmin && activeTab === "admin-history",
  });

  const earliestCheckoutMs = todayQuery.data?.earliestCheckoutTime
    ? new Date(todayQuery.data.earliestCheckoutTime).getTime()
    : null;
  const isCheckoutWindowOpen =
    typeof earliestCheckoutMs === "number" && !Number.isNaN(earliestCheckoutMs)
      ? Date.now() >= earliestCheckoutMs
      : true;
  const draftStorageKey =
    user?.id && todayQuery.data?.date
      ? `attendance-proof-draft:${user.id}:${new Date(todayQuery.data.date).toISOString().slice(0, 10)}`
      : null;

  /* ─── Reset employee filter on range change ──────── */

  useEffect(() => {
    setSelectedAdminEmployee(null);
  }, [adminHistoryRange]);

  /* ─── Derived admin history data ─────────────────── */

  const filteredRecords = selectedAdminEmployee
    ? (adminHistoryQuery.data?.records ?? []).filter((r) => r.userId === selectedAdminEmployee)
    : (adminHistoryQuery.data?.records ?? []);

  const adminTeamRows = (adminTodayQuery.data?.rows ?? []).filter((r) => {
    if (user?.id && r.userId === user.id) return false;

    const email = r.email.toLowerCase();
    const name = r.fullName.toLowerCase();

    return !email.includes("admin") && !name.includes("admin");
  });

  /* ─── Mutations ──────────────────────────────────── */

  const startMutation = useMutation({
    mutationFn: () => api.post("/attendance/start", { isWeekendWork }),
    onSuccess: () => {
      toast.success("Checked in successfully!");
      if (draftStorageKey) localStorage.removeItem(draftStorageKey);
      setCheckoutProofs([]);
      setLoadedDraftKey(null);
      setIsWeekendWork(false);
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-admin-today"] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Could not check in")),
  });

  const endMutation = useMutation({
    mutationFn: (proofFiles: CheckoutProofUpload[]) => api.post("/attendance/end", { proofFiles }),
    onSuccess: () => {
      toast.success("Checked out successfully!");
      if (draftStorageKey) localStorage.removeItem(draftStorageKey);
      setCheckoutProofs([]);
      setLoadedDraftKey(null);
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-admin-today"] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Could not check out")),
  });

  const deleteMutation = useMutation({
    mutationFn: (attendanceId: string) => api.delete(`/attendance/admin/${attendanceId}`),
    onSuccess: () => {
      toast.success("Attendance record removed.");
      queryClient.invalidateQueries({ queryKey: ["attendance-admin-today"] });
      queryClient.invalidateQueries({ queryKey: ["admin-attendance-history"] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Could not remove record")),
  });

  const deleteUserMutation = useMutation({
    mutationFn: ({ userId, from, to }: { userId: string; from: string; to: string }) =>
      api.delete(`/attendance/admin/user/${userId}`, { params: { from, to } }),
    onSuccess: () => {
      toast.success("Employee attendance records removed.");
      queryClient.invalidateQueries({ queryKey: ["attendance-admin-today"] });
      queryClient.invalidateQueries({ queryKey: ["admin-attendance-history"] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Could not remove records")),
  });

  const confirmDelete = useCallback((attendanceId: string, name: string, date: string) => {
    setPendingDelete({ type: "record", attendanceId, name, date });
  }, []);

  const confirmDeleteUser = useCallback((userId: string, name: string, from: string, to: string) => {
    setPendingDelete({ type: "user", userId, name, from, to });
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    if (pendingDelete.type === "record") {
      deleteMutation.mutate(pendingDelete.attendanceId);
    } else {
      deleteUserMutation.mutate({ userId: pendingDelete.userId, from: pendingDelete.from, to: pendingDelete.to });
    }
    setPendingDelete(null);
  }, [pendingDelete, deleteMutation, deleteUserMutation]);

  const handleProofFileSelection = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const incomingFiles = Array.from(files);
    if (checkoutProofs.length + incomingFiles.length > 10) {
      toast.error("You can upload a maximum of 10 work proof files.");
      return;
    }

    setIsUploadingProofs(true);

    try {
      const uploaded = await Promise.all(
        incomingFiles.map(async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          const res = await api.post("/attendance/upload-proof", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          return res.data as CheckoutProofUpload;
        }),
      );

      setCheckoutProofs((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} proof file${uploaded.length > 1 ? "s" : ""} uploaded.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not upload work proof files"));
    } finally {
      setIsUploadingProofs(false);
    }
  }, [checkoutProofs.length]);

  const removeProofAtIndex = useCallback((index: number) => {
    setCheckoutProofs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const heartbeatMutation = useMutation({
    mutationFn: () => api.post("/attendance/heartbeat"),
  });
  const { mutate: sendHeartbeat } = heartbeatMutation;

  // Heartbeat while working (employees only)
  useEffect(() => {
    if (isAdmin || !todayQuery.data?.isWorking) return;
    const interval = setInterval(() => sendHeartbeat(), 60000);
    return () => clearInterval(interval);
  }, [isAdmin, todayQuery.data?.isWorking, sendHeartbeat]);

  /* ─── Derived ────────────────────────────────────── */

  const attendance = todayQuery.data?.attendance;
  const startAtMs = attendance?.startTime ? new Date(attendance.startTime).getTime() : null;
  const hasStarted =
    typeof startAtMs === "number" && !Number.isNaN(startAtMs)
      ? startAtMs <= Date.now()
      : false;
  const isWorking = Boolean(todayQuery.data?.isWorking && hasStarted);
  const isScheduledEarly = Boolean(todayQuery.data?.isWorking && attendance?.startTime && !hasStarted);
  const isDone = Boolean(attendance?.endTime);

  const checkInStage = !attendance?.startTime
    ? "not-started"
    : isScheduledEarly
      ? "scheduled"
      : isWorking
        ? "working"
        : "completed";

  const selectedProofs = selectedProofRecord?.checkoutProofs ?? [];

  const openProofViewer = useCallback((record: HistoryRecord) => {
    setSelectedProofRecord(record);
    setProofViewerOpen(true);
  }, []);

  useEffect(() => {
    if (!draftStorageKey) return;

    if (checkInStage !== "working") {
      localStorage.removeItem(draftStorageKey);
      setLoadedDraftKey(null);
      return;
    }

    if (loadedDraftKey === draftStorageKey) return;

    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) {
        setCheckoutProofs([]);
      } else {
        const parsed = JSON.parse(raw) as CheckoutProofUpload[];
        setCheckoutProofs(Array.isArray(parsed) ? parsed.slice(0, 10) : []);
      }
    } catch {
      setCheckoutProofs([]);
    }

    setLoadedDraftKey(draftStorageKey);
  }, [draftStorageKey, loadedDraftKey, checkInStage]);

  useEffect(() => {
    if (!draftStorageKey || checkInStage !== "working") return;
    localStorage.setItem(draftStorageKey, JSON.stringify(checkoutProofs));
  }, [checkoutProofs, draftStorageKey, checkInStage]);

  /* ─── Render ─────────────────────────────────────── */

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance & Activity</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin
              ? "Monitor team attendance, track work hours, and view employee analytics."
              : "Track your check-ins, check-outs, and work activity."}
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 border border-slate-200 p-2">
        {!isAdmin && (
          <>
            <TabButton active={activeTab === "my"} onClick={() => setActiveTab("my")} icon={Clock}>
              My Attendance
            </TabButton>
            <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")} icon={Calendar}>
              My History
            </TabButton>
          </>
        )}
        {isAdmin && (
          <>
            <TabButton active={activeTab === "admin"} onClick={() => setActiveTab("admin")} icon={Users}>
              Team Today
            </TabButton>
            <TabButton active={activeTab === "admin-history"} onClick={() => setActiveTab("admin-history")} icon={TrendingUp}>
              Team Analytics
            </TabButton>
          </>
        )}
      </div>

      {/* ═══ My Attendance Tab (employees only) ═══ */}
      {!isAdmin && activeTab === "my" && (
        <div className="space-y-6">
          {/* Hero Check-In/Check-Out Card */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-linear-to-br from-white via-white to-slate-50 p-6 shadow-sm">
            <div className="absolute top-0 right-0 w-48 h-48 bg-linear-to-bl from-emerald-50 to-transparent rounded-bl-full opacity-60" />

            <div className="relative flex flex-col items-center gap-6 md:flex-row md:justify-between">
              {/* Status + Timer */}
              <div className="flex flex-col items-center md:items-start gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${isWorking ? "bg-emerald-500 animate-pulse" : isDone ? "bg-slate-300" : "bg-amber-400"}`} />
                  <span className="text-lg font-bold text-slate-800">
                    {checkInStage === "not-started" && "Ready to Check In"}
                    {checkInStage === "scheduled" && "Checked In Early"}
                    {checkInStage === "working" && "Currently Working"}
                    {checkInStage === "completed" && "Day Completed ✓"}
                  </span>
                </div>

                {isScheduledEarly && attendance?.startTime && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                    You checked in before your schedule. Session will start at {formatDateTime(attendance.startTime)}.
                  </p>
                )}

                {isWorking && attendance?.startTime && (
                  <LiveTimer startTime={attendance.startTime} />
                )}

                {isDone && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                    <p className="text-sm text-emerald-700">Total work time</p>
                    <p className="text-lg font-bold text-emerald-800">{formatMinutes(attendance?.realTimeMinutes ?? 0)}</p>
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
                  <>
                    {[0, 6].includes(new Date().getDay()) && (
                      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                        <input
                          type="checkbox"
                          checked={isWeekendWork}
                          onChange={(e) => setIsWeekendWork(e.target.checked)}
                          className="h-4 w-4 rounded accent-emerald-600"
                        />
                        <span>
                          I am working today ({new Date().getDay() === 6 ? "Saturday" : "Sunday"}) —
                          this day will count as a <strong>paid workday</strong>
                        </span>
                      </label>
                    )}
                    <Button
                      onClick={() => startMutation.mutate()}
                      disabled={startMutation.isPending || todayQuery.isLoading}
                      className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 px-8 py-6 text-base rounded-xl transition-all hover:scale-105"
                    >
                      {startMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                      Check In
                    </Button>
                  </>
                )}

                {checkInStage === "working" && (
                  <div className="w-full space-y-3">
                    <input
                      id="attendance-proof-upload"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void handleProofFileSelection(e.target.files);
                        e.currentTarget.value = "";
                      }}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploadingProofs || checkoutProofs.length >= 10}
                      onClick={() => document.getElementById("attendance-proof-upload")?.click()}
                      className="w-full gap-2 border-slate-300 text-slate-700"
                    >
                      {isUploadingProofs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {isUploadingProofs ? "Uploading..." : "Upload Today's Work Proofs"}
                    </Button>

                    <div className="text-xs text-slate-500">
                      Upload at least 1 proof file (PDF/image/doc). Maximum 10 files. Files remain saved here until checkout.
                    </div>

                    {!isCheckoutWindowOpen && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                        Checkout is allowed only in the last 1 hour of your shift. You can check out after {formatDateTime(todayQuery.data?.earliestCheckoutTime ?? null)}.
                      </div>
                    )}

                    {checkoutProofs.length > 0 && (
                      <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 space-y-1.5">
                        {checkoutProofs.map((proof, index) => (
                          <div key={`${proof.url}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs">
                            <div className="flex min-w-0 items-center gap-1.5 text-slate-700">
                              <Paperclip className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{proof.name}</span>
                            </div>
                            <button
                              type="button"
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                              onClick={() => removeProofAtIndex(index)}
                              aria-label="Remove proof file"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      onClick={() => endMutation.mutate(checkoutProofs)}
                      disabled={endMutation.isPending || isUploadingProofs || checkoutProofs.length < 1 || !isCheckoutWindowOpen}
                      className="w-full gap-2 bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20 px-8 py-6 text-base rounded-xl transition-all hover:scale-105"
                    >
                      {endMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                      Check Out
                    </Button>
                  </div>
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
              />
              <StatCard
                label="Work Time"
                value={formatMinutes(attendance.realTimeMinutes)}
                icon={Timer}
                color="violet"
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
            </div>
          </div>
        </div>
      )}

      {/* ═══ My History Tab (employees only) ═══ */}
      {!isAdmin && activeTab === "history" && (
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
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(historyQuery.data.records ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
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
                  <StatCard label="Total Team" value={adminTeamRows.length} icon={Users} color="slate" />
                  <StatCard
                    label="Checked In"
                    value={adminTeamRows.filter((r) => r.startTime).length}
                    icon={LogIn}
                    color="emerald"
                  />
                  <StatCard
                    label="Working Now"
                    value={adminTeamRows.filter((r) => r.isWorking).length}
                    icon={Timer}
                    color="blue"
                  />
                  <StatCard
                    label="Absent"
                    value={adminTeamRows.filter((r) => !r.startTime).length}
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
                        <th className="px-4 py-3">Schedule</th>
                        <th className="px-4 py-3">Check In</th>
                        <th className="px-4 py-3">Check Out</th>
                        <th className="px-4 py-3">Work Time</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminTeamRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                            No team members found.
                          </td>
                        </tr>
                      ) : (
                        adminTeamRows.map((row) => (
                          <tr key={row.userId} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-800">{row.fullName}</p>
                              <p className="text-xs text-slate-400">{row.email}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                              {row.workStartTime} – {row.workEndTime}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600 whitespace-nowrap">{formatDateTime(row.startTime)}</span>
                                {row.lateLogin && (
                                  <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                                    Late
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {row.isWorking ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Working
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>{formatDateTime(row.endTime)}</span>
                                  {row.earlyLogout && (
                                    <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200 px-1.5 py-0.5 text-xs font-semibold text-orange-700">
                                      Early
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{row.realTimeLabel}</td>
                            <td className="px-4 py-3"><StatusPill status={row.status} autoEnded={row.autoEnded} /></td>
                            <td className="px-4 py-3">
                              {row.attendanceId && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 gap-2"
                                      onClick={() => confirmDelete(row.attendanceId!, row.fullName, formatDateShort(new Date().toISOString()))}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </td>
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

      {/* ═══ Admin: Team Analytics & History ═══ */}
      {activeTab === "admin-history" && isAdmin && (
        <div className="space-y-6">
          {/* Header + Date Range */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900">Team Attendance Analytics</h2>
            </div>
            <DateRangePicker value={adminHistoryRange} onChange={setAdminHistoryRange} />
          </div>

          {adminHistoryQuery.isLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : adminHistoryQuery.data ? (
            <>
              {/* Team Overview Stats */}
              {(() => {
                const summaries = adminHistoryQuery.data.userSummaries;
                const avgRate = summaries.length > 0
                  ? Math.round(summaries.reduce((sum, u) => sum + (u.totalDays > 0 ? (u.presentDays / u.totalDays) * 100 : 0), 0) / summaries.length)
                  : 0;
                const totalAbsences = summaries.reduce((sum, u) => sum + u.absentDays, 0);
                const totalWorkMinutes = summaries.reduce((sum, u) => sum + u.totalRealMinutes, 0);
                return (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <StatCard label="Team Members" value={summaries.length} icon={Users} color="slate" />
                    <StatCard label="Avg Attendance" value={`${avgRate}%`} icon={TrendingUp} color="emerald" />
                    <StatCard label="Total Absences" value={totalAbsences} icon={Eye} color="rose" />
                    <StatCard label="Total Work Time" value={formatMinutes(totalWorkMinutes)} icon={Timer} color="violet" />
                  </div>
                );
              })()}

              {/* Employee Analytics Cards */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Employee Overview</h3>
                  <p className="text-xs text-slate-400">Click a card to filter records below</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {adminHistoryQuery.data.userSummaries.map((u) => {
                    const attendanceRate = u.totalDays > 0 ? Math.round((u.presentDays / u.totalDays) * 100) : 0;
                    const isSelected = selectedAdminEmployee === u.userId;
                    const rateColor = attendanceRate >= 80 ? "emerald" : attendanceRate >= 60 ? "amber" : "rose";
                    return (
                      <div
                        key={u.userId}
                        onClick={() => setSelectedAdminEmployee(isSelected ? null : u.userId)}
                        className={`relative cursor-pointer text-left rounded-xl border p-4 transition-all hover:shadow-md ${
                          isSelected
                            ? "border-slate-900 bg-slate-900 shadow-lg"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        {/* Name + Rate + 3-dot */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0 flex-1">
                            <p className={`font-semibold text-sm truncate ${isSelected ? "text-white" : "text-slate-800"}`}>
                              {u.fullName}
                            </p>
                            <p className={`text-xs mt-0.5 truncate ${isSelected ? "text-slate-400" : "text-slate-400"}`}>
                              {u.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <span className={`text-xl font-bold ${
                              isSelected
                                ? rateColor === "emerald" ? "text-emerald-400" : rateColor === "amber" ? "text-amber-400" : "text-rose-400"
                                : rateColor === "emerald" ? "text-emerald-600" : rateColor === "amber" ? "text-amber-600" : "text-rose-600"
                            }`}>
                              {attendanceRate}%
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className={`rounded-md p-1 transition-colors ${
                                    isSelected
                                      ? "text-slate-400 hover:bg-slate-700 hover:text-white"
                                      : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  }`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 gap-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDeleteUser(u.userId, u.fullName, adminHistoryParams.from, adminHistoryParams.to);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove All Records
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Attendance Rate Bar */}
                        <div className={`h-1.5 rounded-full mb-3 ${isSelected ? "bg-slate-700" : "bg-slate-100"}`}>
                          <div
                            className={`h-full rounded-full transition-all ${
                              rateColor === "emerald" ? "bg-emerald-500" : rateColor === "amber" ? "bg-amber-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${attendanceRate}%` }}
                          />
                        </div>

                        {/* Stats Row */}
                        <div className={`grid grid-cols-3 gap-2 text-xs ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
                          <div className="text-center">
                            <p className={`text-base font-bold ${isSelected ? "text-emerald-400" : "text-emerald-600"}`}>{u.presentDays}</p>
                            <p>Present</p>
                          </div>
                          <div className="text-center">
                            <p className={`text-base font-bold ${isSelected ? "text-rose-400" : "text-rose-600"}`}>{u.absentDays}</p>
                            <p>Absent</p>
                          </div>
                          <div className="text-center">
                            <p className={`text-base font-bold ${isSelected ? "text-white" : "text-slate-700"}`}>{formatMinutes(u.totalRealMinutes)}</p>
                            <p>Worked</p>
                          </div>
                        </div>

                        {/* Flags */}
                        {(u.lateLoginDays > 0 || u.earlyLogoutDays > 0 || u.autoEndedDays > 0) && (
                          <div className="mt-3 pt-3 border-t border-dashed border-slate-200 flex flex-wrap gap-2">
                            {u.lateLoginDays > 0 && (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                isSelected ? "bg-amber-900/40 text-amber-300" : "bg-amber-50 border border-amber-200 text-amber-700"
                              }`}>
                                {u.lateLoginDays}× Late
                              </span>
                            )}
                            {u.earlyLogoutDays > 0 && (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                isSelected ? "bg-orange-900/40 text-orange-300" : "bg-orange-50 border border-orange-200 text-orange-700"
                              }`}>
                                {u.earlyLogoutDays}× Early Out
                              </span>
                            )}
                            {u.autoEndedDays > 0 && (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                isSelected ? "bg-slate-700 text-slate-300" : "bg-slate-100 border border-slate-200 text-slate-600"
                              }`}>
                                <Zap className="h-3 w-3 mr-1" />{u.autoEndedDays}× Auto-Absent
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Records Table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">
                    {selectedAdminEmployee
                      ? `Records — ${adminHistoryQuery.data.userSummaries.find((u) => u.userId === selectedAdminEmployee)?.fullName ?? "Selected Member"}`
                      : "All Records"}
                    <span className="ml-2 text-xs font-normal text-slate-400">({filteredRecords.length})</span>
                  </h3>
                  {selectedAdminEmployee && (
                    <button
                      onClick={() => setSelectedAdminEmployee(null)}
                      className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        {!selectedAdminEmployee && <th className="px-4 py-3">Member</th>}
                        <th className="px-4 py-3">Check In</th>
                        <th className="px-4 py-3">Check Out</th>
                        <th className="px-4 py-3">Work Time</th>
                        <th className="px-4 py-3">Idle Time</th>
                        <th className="px-4 py-3">Flags</th>
                        <th className="px-4 py-3">Documents</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td
                            colSpan={selectedAdminEmployee ? 9 : 10}
                            className="px-4 py-12 text-center text-slate-400"
                          >
                            No attendance records found for this period.
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((r) => (
                          <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                              {formatDateShort(r.date)}
                            </td>
                            {!selectedAdminEmployee && (
                              <td className="px-4 py-3">
                                <p className="font-semibold text-slate-800 text-xs whitespace-nowrap">{r.fullName}</p>
                                <p className="text-xs text-slate-400">{r.email}</p>
                              </td>
                            )}
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {formatDateTime(r.startTime)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {formatDateTime(r.endTime)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                              {r.realTimeLabel}
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                              {r.idleTimeLabel}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {r.lateLogin && (
                                  <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                    Late
                                  </span>
                                )}
                                {r.earlyLogout && (
                                  <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs font-semibold text-orange-700">
                                    Early Out
                                  </span>
                                )}
                                {!r.lateLogin && !r.earlyLogout && (
                                  <span className="text-xs text-slate-300">—</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {(r.checkoutProofs?.length ?? 0) > 0 ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 border-slate-300 text-slate-700 text-xs px-2"
                                  onClick={() => openProofViewer(r)}
                                >
                                  <Eye className="h-3 w-3" />
                                  View ({r.checkoutProofs?.length ?? 0})
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-300">None</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill status={r.status} autoEnded={r.autoEnded} />
                            </td>
                            <td className="px-4 py-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 gap-2"
                                    onClick={() => confirmDelete(r.id, r.fullName ?? "", formatDateShort(r.date))}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.type === "user" ? "Remove All Attendance Records?" : "Remove Attendance Record?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.type === "user"
                ? `This will permanently delete all attendance records for ${pendingDelete.name} from ${pendingDelete.from} to ${pendingDelete.to}. This action cannot be undone.`
                : `This will permanently delete ${pendingDelete?.name}'s attendance record for ${pendingDelete?.date}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-600"
            >
              {pendingDelete?.type === "user" ? "Remove All" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Proof Viewer Dialog */}
      <Dialog open={proofViewerOpen} onOpenChange={setProofViewerOpen}>
        <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden bg-white border-slate-200">
          <DialogHeader className="border-b border-slate-100 p-5">
            <DialogTitle className="text-xl font-bold text-slate-900">Attendance Work Documents</DialogTitle>
            <DialogDescription className="mt-1 text-slate-500">
              {selectedProofRecord
                ? `${selectedProofRecord.fullName ?? "Member"} · ${formatDateShort(selectedProofRecord.date)} · Check In ${formatDateTime(selectedProofRecord.startTime)} · Check Out ${formatDateTime(selectedProofRecord.endTime)}`
                : "Review uploaded attendance files"}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto p-5">
            {selectedProofs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No work documents were uploaded for this attendance record.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {selectedProofs.map((file, index) => (
                  <div key={`${file.url}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600">
                        {isImageProof(file) ? <Paperclip className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800" title={file.name}>{file.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{file.mimeType ?? "Unknown type"} · {formatFileSize(file.size)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 border-slate-300"
                        onClick={() => window.open(file.url, "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => window.open(file.url, "_blank", "noopener,noreferrer")}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
