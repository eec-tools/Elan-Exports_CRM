import { useState, useEffect } from "react";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertCircle,
  CheckCircle2,
  X,
  Calendar,
  CheckSquare,
  Flag,
  Users,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { format } from "date-fns";

interface DailyTask {
  id: string;
  date: string;
  taskText: string;
  company: string | null;
  priority: string | null;
  owner: string | null;
  status: string;
  deadline: string | null;
  notes: string | null;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const PRIORITY_OPTIONS = ["Urgent", "High", "Medium", "Low"];
const STATUS_OPTIONS = ["Pending", "completed", "closed"];
const OWNER_OPTIONS: string[] = [];
const ALL_COMPANIES = ["EEC", "MTG", "Skin'd India", "Fresh Food Company"];

// Premium styling helpers
const priorityStyles = (p: string | null) => {
  switch (p) {
    case "Urgent":
      return "text-rose-600 font-bold bg-rose-50 border-rose-100";
    case "High":
      return "text-orange-600 font-semibold bg-orange-50 border-orange-100";
    case "Medium":
      return "text-amber-600 font-medium bg-amber-50 border-amber-100";
    case "Low":
      return "text-brand-600 font-medium bg-brand-50 border-brand-100";
    default:
      return "text-slate-500 font-medium bg-slate-50 border-slate-100";
  }
};

const statusStyles = (s: string) => {
  switch (s?.toLowerCase()) {
    case "pending":
      return "text-yellow-700 bg-yellow-100 border-yellow-200";
    case "completed":
      return "text-green-700 bg-green-100 border-green-200";
    case "closed":
      return "text-red-700 bg-red-100 border-red-200";
    default:
      return "text-slate-600 bg-slate-100 border-slate-200 text-[11px]";
  }
};

export default function DailyTasksPage() {
  const { user, isAdmin } = useAuth();
  const companyOptions = isAdmin
    ? ALL_COMPANIES
    : user?.assignedCompanies || [];
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [priorityStats, setPriorityStats] = useState<Record<string, number>>({
    Urgent: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dynamicOwnerOptions, setDynamicOwnerOptions] =
    useState<string[]>(OWNER_OPTIONS);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<DailyTask | null>(null);

  // Filter states
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterOwner, setFilterOwner] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Track edits locally before saving
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: keyof DailyTask;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const [res, membersRes] = await Promise.all([
        api.get("/daily-tasks", {
          params: {
            page,
            limit: 20,
            priority: filterPriority || undefined,
            status: filterStatus || undefined,
            owner: filterOwner || undefined,
            dateFrom: filterDateFrom || undefined,
            dateTo: filterDateTo || undefined,
          },
        }),
        api.get("/members/names"),
      ]);
      setTasks(res.data.data);
      setPagination(res.data.pagination);
      if (res.data.priorityStats) {
        setPriorityStats(res.data.priorityStats);
      }

      // Use full names from members API for owner dropdown
      if (membersRes.data && Array.isArray(membersRes.data)) {
        const memberFullNames = membersRes.data
          .map((fullName: string) =>
            fullName === "Admin User" ? "Shirali Shetty" : fullName,
          )
          .filter(Boolean);

        const combined = Array.from(
          new Set([...OWNER_OPTIONS, ...memberFullNames]),
        ).sort();
        setDynamicOwnerOptions(combined);
      }
    } catch {
      toast.error("Failed to load daily tasks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [
    page,
    filterPriority,
    filterStatus,
    filterOwner,
    filterDateFrom,
    filterDateTo,
  ]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const handleAddRow = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await api.post("/daily-tasks", {
        date: today,
        taskText: "",
        status: "Pending",
        owner: isAdmin ? undefined : (user?.fullName ?? undefined),
      });
      setTasks([res.data, ...tasks]);
      toast.success("New task row added");
      // Auto open the new row's task text to edit
      startEditing(res.data, "taskText");
    } catch {
      toast.error("Failed to add new task row");
    }
  };

  const handleDeleteClick = (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!taskToDelete) return;

    try {
      await api.delete(`/daily-tasks/${taskToDelete.id}`);
      setTasks(tasks.filter((t) => t.id !== taskToDelete.id));
      toast.success("Task deleted");
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const startEditing = (task: DailyTask, field: keyof DailyTask) => {
    setEditingCell({ id: task.id, field });

    let val = task[field] || "";
    if ((field === "date" || field === "deadline") && task[field]) {
      val = new Date(task[field] as string).toISOString().split("T")[0];
    }
    setEditValue(val as string);
  };

  const saveEdit = async (
    overrideValue?: string | React.FocusEvent | React.KeyboardEvent,
  ) => {
    if (!editingCell) return;
    const { id, field } = editingCell;

    const isOverrideString = typeof overrideValue === "string";
    const valToSave = isOverrideString ? (overrideValue as string) : editValue;

    const taskIndex = tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) {
      setEditingCell(null);
      return;
    }

    const originalTask = tasks[taskIndex];
    if (
      (originalTask[field] || "") === valToSave &&
      !(originalTask[field] === null && valToSave === "")
    ) {
      setEditingCell(null);
      return;
    }

    const updatedTasks = [...tasks];

    // Optimistic formatting
    let newFieldVal: string | null = valToSave;
    if (valToSave === "") newFieldVal = null;
    if ((field === "date" || field === "deadline") && newFieldVal) {
      newFieldVal = new Date(newFieldVal).toISOString();
    }

    updatedTasks[taskIndex] = { ...originalTask, [field]: newFieldVal };
    setTasks(updatedTasks);
    setEditingCell(null);

    try {
      await api.put(`/daily-tasks/${id}`, {
        [field]: valToSave === "" ? null : valToSave,
      });
    } catch {
      toast.error("Failed to save changes");
      updatedTasks[taskIndex] = originalTask;
      setTasks(updatedTasks);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const clearFilters = () => {
    setFilterPriority("");
    setFilterStatus("");
    setFilterOwner("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(1);
  };

  const hasActiveFilters =
    filterPriority ||
    filterStatus ||
    filterOwner ||
    filterDateFrom ||
    filterDateTo;

  if (loading && tasks.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-brand-500" />
            Daily Task Tracker
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            A dynamic spreadsheet view for updating and tracking everyday tasks.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleAddRow}
            className="gap-2 bg-brand-600 hover:bg-brand-700 text-white shadow-sm h-9"
          >
            <Plus className="h-4 w-4" /> Add Row
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="gap-2 bg-white hover:bg-slate-50 text-slate-700 shadow-sm border-slate-200 h-9"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin text-brand-500" : "text-slate-400"}`}
            />
            {refreshing ? "Syncing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* ── Priority Filter Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-5">
        {[
          {
            label: "Urgent",
            value: priorityStats.Urgent || 0,
            color: "rose",
            bg: "bg-rose-50",
            text: "text-rose-600",
            border: "border-rose-100",
          },
          {
            label: "High",
            value: priorityStats.High || 0,
            color: "orange",
            bg: "bg-orange-50",
            text: "text-orange-600",
            border: "border-orange-100",
          },
          {
            label: "Medium",
            value: priorityStats.Medium || 0,
            color: "amber",
            bg: "bg-amber-50",
            text: "text-amber-600",
            border: "border-amber-100",
          },
          {
            label: "Low",
            value: priorityStats.Low || 0,
            color: "brand",
            bg: "bg-brand-50",
            text: "text-brand-600",
            border: "border-brand-100",
          },
        ].map((s) => (
          <div
            key={s.label}
            onClick={() => {
              if (filterPriority === s.label) {
                setFilterPriority("");
              } else {
                setFilterPriority(s.label);
              }
              setPage(1);
            }}
            className={`rounded-xl border ${filterPriority === s.label ? "ring-2 ring-brand-500 shadow-md" : "border-slate-100 shadow-sm"} ${s.bg} p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-all`}
          >
            <div className={`rounded-lg p-2.5 bg-white`}>
              <Flag className={`h-5 w-5 ${s.text}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">
                Priority: {s.label}
              </p>
              <p className={`text-xl font-bold ${s.text}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-2 text-slate-400 border-r border-slate-100 pr-4 mr-1 hidden sm:flex">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-semibold text-slate-600">Filters</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 min-w-[240px]">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              className="bg-transparent text-sm w-full focus:outline-none text-slate-700"
              value={filterDateFrom}
              onChange={(e) => {
                setFilterDateFrom(e.target.value);
                setPage(1);
              }}
              title="From Date"
            />
            <span className="text-slate-400 text-xs font-medium">to</span>
            <input
              type="date"
              className="bg-transparent text-sm w-full focus:outline-none text-slate-700"
              value={filterDateTo}
              onChange={(e) => {
                setFilterDateTo(e.target.value);
                setPage(1);
              }}
              title="To Date"
            />
          </div>

          <select
            className="h-9 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 min-w-[130px]"
            value={filterPriority}
            onChange={(e) => {
              setFilterPriority(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Priorities</option>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select
            className="h-9 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 min-w-[130px]"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          {isAdmin ? (
            <select
              className="h-9 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 min-w-[130px]"
              value={filterOwner}
              onChange={(e) => {
                setFilterOwner(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Owners</option>
              {dynamicOwnerOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <div className="h-9 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 min-w-[130px] flex items-center capitalize">
              {user?.fullName ?? "Me"}
            </div>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 h-9 px-2 gap-1 ml-auto"
            >
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Spreadsheet Grid ── */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left border-collapse min-w-max">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="border-r border-slate-200 px-4 py-3 font-semibold min-w-[120px]">
                  Date
                </th>
                <th className="border-r border-slate-200 px-4 py-3 font-semibold min-w-[300px]">
                  Task Description
                </th>
                <th className="border-r border-slate-200 px-4 py-3 font-semibold min-w-[150px]">
                  Company
                </th>
                <th className="border-r border-slate-200 px-4 py-3 font-semibold min-w-[140px]">
                  Priority
                </th>
                <th className="border-r border-slate-200 px-4 py-3 font-semibold min-w-[140px]">
                  Owner
                </th>
                <th className="border-r border-slate-200 px-4 py-3 font-semibold min-w-[160px]">
                  Status
                </th>
                <th className="border-r border-slate-200 px-4 py-3 font-semibold min-w-[120px]">
                  Deadline
                </th>
                <th className="border-r border-slate-200 px-4 py-3 font-semibold min-w-[200px] max-w-[350px]">
                  Notes
                </th>
                <th className="px-3 py-3 font-semibold w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-16 text-center shadow-[inset_0_1px_0_#f1f5f9]"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2">
                        <CheckCircle2 className="h-6 w-6 text-brand-400" />
                      </div>
                      <p className="text-slate-600 font-medium text-base">
                        You're all caught up!
                      </p>
                      <p className="text-slate-400 text-sm max-w-[250px]">
                        {hasActiveFilters
                          ? "No tasks match your current filters."
                          : "You have no active daily tasks right now."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-text"
                  >
                    {/* DATE */}
                    <td
                      className="border-r border-slate-100 relative min-h-[44px] align-middle hover:bg-slate-100/50"
                      onClick={() => startEditing(task, "date")}
                    >
                      {editingCell?.id === task.id &&
                      editingCell?.field === "date" ? (
                        <input
                          autoFocus
                          type="date"
                          className="absolute inset-0 w-full h-full px-4 outline-none ring-2 ring-brand-500 ring-inset z-10 bg-white shadow-sm"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyDown}
                        />
                      ) : (
                        <div className="px-4 py-2.5 truncate text-slate-900 font-medium">
                          {task.date
                            ? format(new Date(task.date), "dd MMM yyyy")
                            : ""}
                        </div>
                      )}
                    </td>

                    {/* TASK TEXT */}
                    <td
                      className="border-r border-slate-100 relative align-middle hover:bg-slate-100/50"
                      onClick={() => startEditing(task, "taskText")}
                    >
                      {editingCell?.id === task.id &&
                      editingCell?.field === "taskText" ? (
                        <input
                          autoFocus
                          type="text"
                          className="absolute inset-0 w-full h-full px-4 outline-none ring-2 ring-brand-500 ring-inset z-10 bg-white shadow-sm"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyDown}
                        />
                      ) : (
                        <div className="px-4 py-2.5 font-medium text-slate-800 line-clamp-2 leading-relaxed">
                          {task.taskText || (
                            <span className="text-slate-300 italic font-normal">
                              Empty task...
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* COMPANY */}
                    <td
                      className="border-r border-slate-100 relative align-middle hover:bg-slate-100/50"
                      onClick={() => startEditing(task, "company")}
                    >
                      {editingCell?.id === task.id &&
                      editingCell?.field === "company" ? (
                        <select
                          autoFocus
                          className="absolute inset-0 w-full h-full px-3 outline-none ring-2 ring-brand-500 ring-inset z-10 bg-white shadow-sm cursor-pointer"
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value);
                            saveEdit(e.target.value);
                          }}
                          onBlur={saveEdit}
                        >
                          <option value="">None</option>
                          {companyOptions.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-4 py-2.5 flex items-center gap-1.5 font-medium text-slate-700">
                          {task.company ? (
                            <>
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              {task.company}
                            </>
                          ) : (
                            <span className="text-slate-400 italic font-normal">
                              None
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* PRIORITY */}
                    <td
                      className="border-r border-slate-100 relative align-middle hover:bg-slate-100/50"
                      onClick={() => startEditing(task, "priority")}
                    >
                      {editingCell?.id === task.id &&
                      editingCell?.field === "priority" ? (
                        <select
                          autoFocus
                          className="absolute inset-0 w-full h-full px-3 outline-none ring-2 ring-brand-500 ring-inset z-10 bg-white shadow-sm cursor-pointer"
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value);
                            saveEdit(e.target.value);
                          }}
                          onBlur={saveEdit}
                        >
                          <option value="">None</option>
                          {PRIORITY_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityStyles(task.priority)}`}
                          >
                            <Flag className="h-3 w-3 mr-1" />
                            {task.priority || "None"}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* OWNER */}
                    <td
                      className={`border-r border-slate-100 relative align-middle ${isAdmin ? "hover:bg-slate-100/50" : ""}`}
                      onClick={() => isAdmin && startEditing(task, "owner")}
                    >
                      {isAdmin &&
                      editingCell?.id === task.id &&
                      editingCell?.field === "owner" ? (
                        <select
                          autoFocus
                          className="absolute inset-0 w-full h-full px-3 outline-none ring-2 ring-brand-500 ring-inset z-10 bg-white shadow-sm cursor-pointer"
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value);
                            saveEdit(e.target.value);
                          }}
                          onBlur={saveEdit}
                        >
                          <option value="">Unassigned</option>
                          {dynamicOwnerOptions.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-4 py-2.5 flex items-center gap-1.5 font-medium w-max text-slate-700">
                          {task.owner ? (
                            <div className="bg-slate-100 text-slate-700 px-2 py-1 flex items-center gap-1.5 rounded w-max">
                              <Users className="h-3.5 w-3.5 text-slate-400" />
                              <span className="capitalize">{task.owner}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic w-max py-1">
                              Unassigned
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* STATUS */}
                    <td
                      className="border-r border-slate-100 relative align-middle hover:bg-slate-100/50"
                      onClick={() => startEditing(task, "status")}
                    >
                      {editingCell?.id === task.id &&
                      editingCell?.field === "status" ? (
                        <select
                          autoFocus
                          className="absolute inset-0 w-full h-full px-3 outline-none ring-2 ring-brand-500 ring-inset z-10 bg-white shadow-sm cursor-pointer"
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value);
                            saveEdit(e.target.value);
                          }}
                          onBlur={saveEdit}
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyles(task.status)} capitalize`}
                          >
                            {task.status?.toLowerCase() === "completed" && (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            {task.status?.toLowerCase() === "pending" && (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            )}
                            {task.status || "Pending"}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* DEADLINE */}
                    <td
                      className="border-r border-slate-100 relative align-middle hover:bg-slate-100/50"
                      onClick={() => startEditing(task, "deadline")}
                    >
                      {editingCell?.id === task.id &&
                      editingCell?.field === "deadline" ? (
                        <input
                          autoFocus
                          type="date"
                          className="absolute inset-0 w-full h-full px-4 outline-none ring-2 ring-brand-500 ring-inset z-10 bg-white shadow-sm"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyDown}
                        />
                      ) : (
                        <div className="px-4 py-2.5 text-slate-500 font-medium whitespace-nowrap">
                          {task.deadline
                            ? format(new Date(task.deadline), "dd MMM yyyy")
                            : ""}
                        </div>
                      )}
                    </td>

                    {/* NOTES */}
                    <td
                      className="border-r border-slate-100 relative align-middle hover:bg-slate-100/50"
                      onClick={() => startEditing(task, "notes")}
                    >
                      {editingCell?.id === task.id &&
                      editingCell?.field === "notes" ? (
                        <input
                          autoFocus
                          type="text"
                          className="absolute inset-0 w-full h-full px-4 outline-none ring-2 ring-brand-500 ring-inset z-10 bg-white shadow-sm"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyDown}
                        />
                      ) : (
                        <div className="px-4 py-2.5 text-slate-500 whitespace-pre-wrap break-words leading-relaxed max-w-[350px]">
                          {task.notes}
                        </div>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td
                      className="px-2 py-2 text-center align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                        onClick={(e) => handleDeleteClick(task, e)}
                        title="Delete Row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.pages > 1 && (
          <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium px-2">
              Showing page{" "}
              <span className="text-slate-900">{pagination.page}</span> of{" "}
              <span className="text-slate-900">{pagination.pages}</span>{" "}
              <span className="text-slate-400">({pagination.total} total)</span>
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage(page + 1)}
                className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation ── */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setTaskToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md p-6 bg-white rounded-xl shadow-2xl border-none">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Delete Daily Task
              </DialogTitle>
              <DialogDescription className="text-slate-500 mt-1">
                This will permanently remove this task row.
              </DialogDescription>
            </div>
          </div>
          {taskToDelete?.taskText && (
            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100 mb-6 font-medium line-clamp-2">
              "{taskToDelete.taskText}"
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200"
            >
              Yes, delete row
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
