import { useState, useEffect, useMemo } from "react";
import api from "@/api/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Loader2,
  ExternalLink,
  RefreshCw,
  Edit,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  MailOpen,
  LayoutGrid,
  AlertCircle,
  Clock,
  CheckCircle2,
  UserX,
  Search,
  X,
  Flag,
  ListTodo,
  Tag,
  UserSquare2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EmailTask {
  id: string;
  dateReceived: string;
  senderAddress: string;
  subject: string;
  task: string | null;
  productCategory: string | null;
  priority: string | null;
  respondent: string | null;
  status: string;
  notes: string | null;
  emailLink: string | null;
  createdAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const TASK_OPTIONS = [
  "Intro Email",
  "Intro Email Follow-up",
  "Info Pending from Supplier",
  "Certs Pending from Supplier",
  "Share Contract",
  "Contract Clarification",
  "Signed Contract Follow-up",
  "Send Reminder",
  "J&K Coordination",
  "CH Australia Tasks",
  "Geotex Pakistan Tasks",
  "Supplier Sourcing",
  "Supplier Update",
  "Supplier inquired for business",
  "Catalog",
  "Commission percentage query",
  "Sample feedback",
  "Sample update",
  "Price Feedback",
  "Prices shared",
  "Query on new sample development of peanut butter",
  "Order follow up",
  "Order related",
  "Signed contract received",
  "Payment confirmation",
  "Shipment confirmation",
  "Request for product specification and call meeting",
  "Invitation to visit stall",
  "Meeting request",
  "Initial discussion with buyer",
  "New Business",
  "New inquiry for home tex",
  "Bed & Bath Linen Inquiry",
  "Wet Wipe Inquiry",
  "Peanut butter order inquiry",
  "Rice tender inquiry",
  "Wine tender discussion",
  "Wine Order discussion",
  "Rugs for hotel",
  "Flag inquiry",
  "Africa market inquiry",
  "Audit, Inspection coordination",
  "Handover rice category",
];

const PRODUCT_CATEGORY_OPTIONS = [
  "Dried Fruits",
  "Biscuits",
  "Chocolates",
  "Fertiliser",
  "Fresh Fruits & Vegetables",
  "Ground Spices",
  "Instant Noodle",
  "Juices",
  "Lentils",
  "Oil",
  "Nuts",
  "Pasta",
  "Peanut Butter",
  "Pet Food",
  "Rice",
  "Sugar",
  "Seafood",
  "Super Foods",
  "Apparel",
  "Home Textiles",
  "Condoms",
  "Sports Wear",
  "Sauces",
  "Coconut product",
  "Stationery",
  "Hotel and Hospitals",
  "Wine",
  "Hotel Textile",
  "Home Decor",
  "Rally towel",
  "Wet wipe",
  "Flag",
  "Wheat Flour",
];

const RESPONDENT_OPTIONS = [
  "vandana",
  "shirali",
  "mohita",
  "buyer",
  "supplier",
  "N/A",
  "fahad",
  "madan",
];

export default function EmailTasksPage() {
  const [tasks, setTasks] = useState<EmailTask[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<EmailTask | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<EmailTask | null>(null);

  // Filters
  const [filterTask, setFilterTask] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRespondent, setFilterRespondent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get("/email-tasks", {
        params: {
          page,
          limit: 20,
          task: filterTask || undefined,
          priority: filterPriority || undefined,
          status: filterStatus || undefined,
          respondent: filterRespondent || undefined
        }
      });
      setTasks(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error("Failed to load email tasks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [page, filterTask, filterPriority, filterStatus, filterRespondent]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const updateTask = async (id: string, field: string, value: string) => {
    try {
      await api.put(`/email-tasks/${id}`, { [field]: value });
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
      );
      if (selectedTask && selectedTask.id === id) {
        setSelectedTask((prev) => (prev ? { ...prev, [field]: value } : prev));
      }
      toast.success("Task updated successfully", { duration: 2000 });
    } catch {
      toast.error("Failed to update task");
    }
  };

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      await api.delete(`/email-tasks/${taskToDelete.id}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
      if (selectedTask?.id === taskToDelete.id) {
        setIsDialogOpen(false);
        setSelectedTask(null);
      }
      toast.success("Task deleted");
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const handleRowClick = (task: EmailTask) => {
    setSelectedTask(task);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleEditClick = (task: EmailTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTask(task);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const statusStyles = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "In Progress":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "Incomplete":
        return "bg-rose-100 text-rose-700 border-rose-200";
      case "Not Started":
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const priorityStyles = (priority: string | null) => {
    switch (priority) {
      case "Urgent":
        return "text-rose-600 font-bold bg-rose-50 border-rose-100";
      case "High":
        return "text-orange-600 font-semibold bg-orange-50 border-orange-100";
      case "Medium":
        return "text-amber-600 font-medium bg-amber-50 border-amber-100";
      case "Low":
        return "text-emerald-600 font-medium bg-emerald-50 border-emerald-100";
      default:
        return "text-slate-500 font-medium bg-slate-50 border-slate-100";
    }
  };

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      highPriority: tasks.filter(t => t.priority === "Urgent" || t.priority === "High").length,
      unassigned: tasks.filter(t => !t.respondent || t.respondent.toLowerCase() === "unassigned").length,
      pending: tasks.filter(t => t.status === "In Progress" || t.status === "Not Started").length,
    };
  }, [tasks]);

  const filteredTasks = tasks.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.senderAddress && t.senderAddress.toLowerCase().includes(q))
    );
  });

  const hasActiveFilters = filterTask || filterPriority || filterStatus || filterRespondent || searchQuery;

  if (loading && tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MailOpen className="h-6 w-6 text-emerald-500" />
            Email Task Tracker
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage incoming email requests, prioritize tasks, and assign team members.
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="gap-2 bg-white hover:bg-slate-50 text-slate-700 shadow-sm border-slate-200 transition-all h-9"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-emerald-500" : "text-slate-400"}`} />
          {refreshing ? "Syncing..." : "Refresh Inbox"}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-5">
        {[
          { icon: <LayoutGrid className="h-5 w-5 text-blue-600" />, label: "Tasks Loaded", value: stats.total, bg: "bg-blue-50" },
          { icon: <AlertCircle className="h-5 w-5 text-rose-600" />, label: "High/Urgent", value: stats.highPriority, bg: "bg-rose-50" },
          { icon: <Clock className="h-5 w-5 text-amber-600" />, label: "Pending Execution", value: stats.pending, bg: "bg-amber-50" },
          { icon: <UserX className="h-5 w-5 text-slate-600" />, label: "Unassigned", value: stats.unassigned, bg: "bg-slate-100" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-100 bg-white p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className={`rounded-lg p-2.5 ${s.bg}`}>{s.icon}</div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className="text-xl font-bold text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-2 text-slate-400 border-r border-slate-100 pr-4 mr-1 hidden sm:flex">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-semibold text-slate-600">Filters</span>
        </div>
        
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search subjects or senders..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 border-slate-200 bg-slate-50 focus:bg-white text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterTask}
            onChange={(e) => { setFilterTask(e.target.value); setPage(1); }}
            className="h-9 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-700 min-w-[140px]"
          >
            <option value="">All Task Types</option>
            {TASK_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }}
            className="h-9 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-700 min-w-[130px]"
          >
            <option value="">All Priorities</option>
            {["Urgent", "High", "Medium", "Low"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="h-9 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-700 min-w-[130px]"
          >
            <option value="">All Statuses</option>
            {["Not Started", "In Progress", "Incomplete", "Completed"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={filterRespondent}
            onChange={(e) => { setFilterRespondent(e.target.value); setPage(1); }}
            className="h-9 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-700 min-w-[140px]"
          >
            <option value="">All Respondents</option>
            <option value="Unassigned">Unassigned</option>
            {RESPONDENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterTask(""); setFilterPriority(""); setFilterStatus(""); setFilterRespondent(""); setSearchQuery(""); setPage(1);
              }}
              className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 h-9 px-2 gap-1"
            >
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left relative">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                {["Date", "Sender", "Subject / Task", "Assignment", "Status", "Actions"].map((h, i) => (
                  <th key={h} className={`px-5 py-3.5 font-semibold ${i === 5 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2">
                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                      </div>
                      <p className="text-slate-600 font-medium text-base">You're all caught up!</p>
                      <p className="text-slate-400 text-sm max-w-[250px]">
                        {hasActiveFilters ? "No tasks match your current filter criteria." : "There are no email tasks currently taking up your inbox space."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-emerald-50/40 transition-colors cursor-pointer group"
                    onClick={() => handleRowClick(task)}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap align-top">
                      <p className="text-slate-900 font-medium">{format(new Date(task.dateReceived), "MMM d")}</p>
                      <p className="text-xs text-slate-400">{format(new Date(task.dateReceived), "h:mm a")}</p>
                    </td>

                    <td className="px-5 py-3.5 align-top">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">
                          {task.senderAddress.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-slate-700 font-medium truncate max-w-[180px]" title={task.senderAddress}>
                          {task.senderAddress}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 align-top max-w-[300px]">
                      <p className="text-slate-900 font-medium line-clamp-2 mb-1.5 group-hover:text-emerald-700 transition-colors" title={task.subject}>
                        {task.subject}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {task.task ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium border px-1.5 py-0.5 rounded-md bg-slate-50 border-slate-200 text-slate-600">
                            <ListTodo className="h-3 w-3 text-slate-400" />
                            {task.task}
                          </span>
                        ) : (
                           <span className="inline-flex items-center gap-1 text-[11px] font-medium border px-1.5 py-0.5 rounded-md bg-rose-50 border-rose-100 text-rose-600">
                            Uncategorized
                          </span>
                        )}
                        {task.productCategory && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium border px-1.5 py-0.5 rounded-md bg-slate-50 border-slate-200 text-slate-500">
                            <Tag className="h-3 w-3 text-slate-400" />
                            {task.productCategory}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 align-top">
                      <div className="flex flex-col gap-2 items-start">
                        {task.respondent ? (
                          <div className="flex items-center gap-1.5 text-slate-700 text-sm font-medium bg-slate-100 px-2 py-1 rounded-md">
                            <UserSquare2 className="h-3.5 w-3.5 text-slate-400" />
                            {task.respondent}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm italic py-1">Unassigned</span>
                        )}
                        <span className={`text-[11px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${priorityStyles(task.priority)}`}>
                          <Flag className="h-3 w-3" />
                          {task.priority || "No Priority"}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 align-top">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyles(task.status)}`}>
                        {task.status === "Completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {task.status === "In Progress" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {task.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 align-top text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {task.emailLink && (
                          <a
                            href={task.emailLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
                            title="Open Email"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          onClick={(e) => handleEditClick(task, e)}
                          className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                          title="Edit Task"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTaskToDelete(task);
                            setDeleteDialogOpen(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {pagination && pagination.pages > 1 && (
          <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium px-2">
              Showing page <span className="text-slate-900">{pagination.page}</span> of <span className="text-slate-900">{pagination.pages}</span> <span className="text-slate-400">({pagination.total} total)</span>
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-white rounded-xl shadow-2xl border-none">
          {selectedTask && (
            <>
              <div className="bg-slate-50 p-5 px-6 border-b border-slate-100 flex items-start justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900 pr-4 leading-tight">
                    {selectedTask.subject}
                  </DialogTitle>
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                    <span>From: <span className="font-medium text-slate-700">{selectedTask.senderAddress}</span></span>
                    <span className="text-slate-300">•</span>
                    <span>Received: {format(new Date(selectedTask.dateReceived), "MMM d, yyyy 'at' h:mm a")}</span>
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                   {selectedTask.emailLink && (
                    <Button variant="outline" size="sm" asChild className="h-8 text-xs bg-white shadow-sm border-slate-200 hover:bg-slate-50 text-slate-600 hidden sm:flex">
                      <a href={selectedTask.emailLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Email
                      </a>
                    </Button>
                  )}
                  <Button
                    variant={isEditing ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className={`h-8 text-xs transition-all shadow-sm ${isEditing ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-white border hover:bg-slate-50 text-slate-700"}`}
                  >
                    {isEditing ? <><Save className="h-3.5 w-3.5 mr-1.5" /> Done Editing</> : <><Edit className="h-3.5 w-3.5 mr-1.5" /> Edit Task</>}
                  </Button>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category / Task Type</label>
                    {isEditing ? (
                      <select
                        value={selectedTask.task || ""}
                        onChange={(e) => updateTask(selectedTask.id, "task", e.target.value)}
                        className="h-9 px-3 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                      >
                        <option value="">Uncategorized</option>
                        {TASK_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <div className="h-9 flex items-center px-3 bg-slate-50 rounded-md text-sm text-slate-800 border border-slate-100">
                        {selectedTask.task || "Uncategorized"}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority Level</label>
                    {isEditing ? (
                      <select
                        value={selectedTask.priority || ""}
                        onChange={(e) => updateTask(selectedTask.id, "priority", e.target.value)}
                        className={`h-9 px-3 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm ${selectedTask.priority === "Urgent" ? "text-rose-600 font-bold" : ""}`}
                      >
                        <option value="">Set Priority...</option>
                        <option value="Urgent" className="text-rose-600 font-bold">Urgent</option>
                        <option value="High" className="text-orange-600 font-semibold">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    ) : (
                      <div className={`h-9 flex w-max items-center px-3 rounded-md text-sm border ${priorityStyles(selectedTask.priority)}`}>
                        {selectedTask.priority || "None"}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
                    {isEditing ? (
                      <select
                        value={selectedTask.status}
                        onChange={(e) => updateTask(selectedTask.id, "status", e.target.value)}
                        className="h-9 px-3 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Incomplete">Incomplete</option>
                        <option value="Completed">Completed</option>
                      </select>
                    ) : (
                      <div className={`h-9 flex w-max items-center px-3 rounded-md text-sm font-semibold border ${statusStyles(selectedTask.status)}`}>
                        {selectedTask.status}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Product Line</label>
                    {isEditing ? (
                      <select
                        value={selectedTask.productCategory || ""}
                        onChange={(e) => updateTask(selectedTask.id, "productCategory", e.target.value)}
                        className="h-9 px-3 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                      >
                        <option value="">Select Category...</option>
                        {PRODUCT_CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <div className="h-9 flex items-center px-3 bg-slate-50 rounded-md text-sm text-slate-800 border border-slate-100">
                        {selectedTask.productCategory || "None specified"}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2 border-t border-slate-100 pt-5 mt-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assigned To</label>
                    {isEditing ? (
                      <select
                        value={selectedTask.respondent || ""}
                        onChange={(e) => updateTask(selectedTask.id, "respondent", e.target.value)}
                        className="h-9 px-3 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm w-full sm:w-1/2"
                      >
                        <option value="">Unassigned</option>
                        {RESPONDENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <div className="h-9 flex w-max items-center px-3 bg-blue-50 text-blue-700 rounded-md text-sm font-medium border border-blue-100">
                        <UserSquare2 className="h-4 w-4 mr-2 opacity-70"/>
                        {selectedTask.respondent || "Unassigned"}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Internal Notes</label>
                    {isEditing ? (
                      <Textarea
                        value={selectedTask.notes || ""}
                        onChange={(e) => updateTask(selectedTask.id, "notes", e.target.value)}
                        className="min-h-[100px] text-sm border-slate-200 bg-white placeholder:text-slate-400 focus:ring-emerald-500/50 shadow-sm resize-y"
                        placeholder="Add some notes about this task..."
                      />
                    ) : (
                      <div className="min-h-[100px] bg-slate-50 p-4 rounded-lg text-sm text-slate-700 border border-slate-100 whitespace-pre-wrap leading-relaxed">
                        {selectedTask.notes || <span className="text-slate-400 italic">No notes added yet.</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setTaskToDelete(null); }}>
        <DialogContent className="sm:max-w-md p-6 bg-white rounded-xl shadow-2xl border-none">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">Delete Email Task</DialogTitle>
              <DialogDescription className="text-slate-500 mt-1">This action cannot be undone.</DialogDescription>
            </div>
          </div>
          <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100 mb-6 font-medium line-clamp-2">
            "{taskToDelete?.subject}"
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200">
              Yes, delete task
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
