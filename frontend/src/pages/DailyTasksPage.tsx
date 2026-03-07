import { useState, useEffect } from "react";
import api from "@/api/client";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { startOfDay, endOfDay, format } from "date-fns";

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
const STATUS_OPTIONS = ["not started", "inprogress", "completed", "closed"];
const OWNER_OPTIONS = ["vandana", "shirali", "madan", "mohita", "fahad"];
const COMPANY_OPTIONS = ["EEC", "MTG", "Skin'd India", "Fresh Food Company"];

// Basic priority color
const getPriorityColor = (p: string | null) => {
    switch (p) {
        case "Urgent": return "text-purple-600 font-bold bg-purple-50";
        case "High": return "text-red-600 font-semibold bg-red-50";
        case "Medium": return "text-orange-600 font-semibold bg-orange-50";
        case "Low": return "text-green-600 font-semibold bg-green-50";
        default: return "";
    }
}

// Basic status color
const getStatusColor = (s: string) => {
    switch (s?.toLowerCase()) {
        case "inprogress": return "text-yellow-800 bg-yellow-100";
        case "completed": return "text-green-800 bg-green-100";
        case "closed": return "text-gray-800 bg-gray-300";
        default: return "text-gray-800 bg-gray-100";
    }
}

export default function DailyTasksPage() {
    const [tasks, setTasks] = useState<DailyTask[]>([]);
    const [pagination, setPagination] = useState<PaginationData | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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
    const [editingCell, setEditingCell] = useState<{ id: string, field: keyof DailyTask } | null>(null);
    const [editValue, setEditValue] = useState<string>("");

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const res = await api.get("/daily-tasks", { params: { page, limit: 20 } });
            setTasks(res.data.data);
            setPagination(res.data.pagination);
        } catch (error) {
            toast.error("Failed to load daily tasks");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [page]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchTasks();
    };

    const handleAddRow = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await api.post("/daily-tasks", {
                date: today,
                taskText: "",
                status: "not started"
            });
            setTasks([res.data, ...tasks]);
            toast.success("New task row added");
        } catch (error) {
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
            setTasks(tasks.filter(t => t.id !== taskToDelete.id));
            toast.success("Task deleted");
            setDeleteDialogOpen(false);
            setTaskToDelete(null);
        } catch (error) {
            toast.error("Failed to delete task");
        }
    };

    const startEditing = (task: DailyTask, field: keyof DailyTask) => {
        setEditingCell({ id: task.id, field });

        let val = task[field] || "";
        if ((field === "date" || field === "deadline") && task[field]) {
            // For date pickers, format YYYY-MM-DD
            val = new Date(task[field] as string).toISOString().split('T')[0];
        }
        setEditValue(val as string);
    };

    const saveEdit = async (overrideValue?: string | React.FocusEvent | React.KeyboardEvent) => {
        if (!editingCell) return;
        const { id, field } = editingCell;

        const isOverrideString = typeof overrideValue === "string";
        const valToSave = isOverrideString ? (overrideValue as string) : editValue;

        // Optimistic update
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex === -1) {
            setEditingCell(null);
            return;
        }

        const originalTask = tasks[taskIndex];
        // If unchanged, do nothing
        if ((originalTask[field] || "") === valToSave) {
            setEditingCell(null);
            return;
        }

        const updatedTasks = [...tasks];

        // Formatting specific fields optimistically
        let newFieldVal: string | null = valToSave;
        if (valToSave === "") newFieldVal = null;
        if ((field === "date" || field === "deadline") && newFieldVal) {
            newFieldVal = new Date(newFieldVal).toISOString();
        }

        updatedTasks[taskIndex] = { ...originalTask, [field]: newFieldVal };
        setTasks(updatedTasks);
        setEditingCell(null);

        try {
            await api.put(`/daily-tasks/${id}`, { [field]: valToSave === "" ? null : valToSave });
        } catch (error) {
            // Revert on error
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
    }

    const filteredTasks = tasks.filter(task => {
        if (filterPriority && task.priority !== filterPriority) return false;
        if (filterStatus && task.status !== filterStatus) return false;
        if (filterOwner && task.owner !== filterOwner) return false;

        if (filterDateFrom || filterDateTo) {
            if (!task.date) return false;
            const taskDate = new Date(task.date);

            if (filterDateFrom && taskDate < startOfDay(new Date(filterDateFrom))) return false;
            if (filterDateTo && taskDate > endOfDay(new Date(filterDateTo))) return false;
        }

        return true;
    });

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Daily Task Tracker</h1>
                    <p className="text-muted-foreground mt-1">
                        A spreadsheet-style view for updating and tracking daily tasks.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={handleAddRow}
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add Row
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="gap-2 focus:outline-none"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <input
                    type="date"
                    className="px-3 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    placeholder="From Date"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <input
                    type="date"
                    className="px-3 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    placeholder="To Date"
                />
                <select
                    className="px-3 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={filterPriority}
                    onChange={e => setFilterPriority(e.target.value)}
                >
                    <option value="">All Priorities</option>
                    {PRIORITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select
                    className="px-3 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                >
                    <option value="">All Statuses</option>
                    {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select
                    className="px-3 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={filterOwner}
                    onChange={e => setFilterOwner(e.target.value)}
                >
                    <option value="">All Owners</option>
                    {OWNER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {(filterPriority || filterStatus || filterOwner || filterDateFrom || filterDateTo) && (
                    <button
                        onClick={clearFilters}
                        className="text-sm text-muted-foreground hover:text-foreground underline whitespace-nowrap"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            <div className="rounded-md border bg-white flex-1 overflow-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-100 text-gray-700 uppercase font-semibold text-xs sticky top-0 z-10">
                        <tr>
                            <th className="border-b border-r px-4 py-3 min-w-[120px]">Date</th>
                            <th className="border-b border-r px-4 py-3 min-w-[300px]">Task</th>
                            <th className="border-b border-r px-4 py-3 min-w-[150px]">Company</th>
                            <th className="border-b border-r px-4 py-3 min-w-[120px]">Priority</th>
                            <th className="border-b border-r px-4 py-3 min-w-[120px]">Owner</th>
                            <th className="border-b border-r px-4 py-3 min-w-[150px]">Status</th>
                            <th className="border-b border-r px-4 py-3 min-w-[120px]">Deadline</th>
                            <th className="border-b border-r px-4 py-3 min-w-[200px]">Notes</th>
                            <th className="border-b px-2 py-3 w-10 text-center"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTasks.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                                    {tasks.length === 0 ? 'No tasks yet. Click "Add Row" to start.' : 'No tasks match the active filters.'}
                                </td>
                            </tr>
                        ) : (
                            filteredTasks.map((task) => (
                                <tr key={task.id} className="hover:bg-gray-50 border-b group">
                                    {/* DATE */}
                                    <td
                                        className="border-r px-4 py-2 cursor-pointer relative min-h-[40px]"
                                        onClick={() => startEditing(task, "date")}
                                    >
                                        {editingCell?.id === task.id && editingCell?.field === "date" ? (
                                            <input
                                                autoFocus
                                                type="date"
                                                className="w-full h-full p-1 absolute inset-0 outline-none ring-2 ring-primary z-10"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={saveEdit}
                                                onKeyDown={handleKeyDown}
                                            />
                                        ) : task.date ? format(new Date(task.date), "dd MMM yyyy") : ""}
                                    </td>

                                    {/* TASK TEXT */}
                                    <td
                                        className="border-r px-4 py-2 cursor-pointer relative"
                                        onClick={() => startEditing(task, "taskText")}
                                    >
                                        {editingCell?.id === task.id && editingCell?.field === "taskText" ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                className="w-full h-full px-2 absolute inset-0 outline-none ring-2 ring-primary z-10"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={saveEdit}
                                                onKeyDown={handleKeyDown}
                                            />
                                        ) : (task.taskText || <span className="text-gray-400 italic">Empty</span>)}
                                    </td>

                                    {/* COMPANY */}
                                    <td
                                        className="border-r px-4 py-2 cursor-pointer relative"
                                        onClick={() => startEditing(task, "company")}
                                    >
                                        {editingCell?.id === task.id && editingCell?.field === "company" ? (
                                            <select
                                                autoFocus
                                                className="w-full h-full bg-white absolute inset-0 outline-none ring-2 ring-primary z-10 px-1"
                                                value={editValue}
                                                onChange={(e) => {
                                                    setEditValue(e.target.value);
                                                    saveEdit(e.target.value);
                                                }}
                                                onBlur={saveEdit}
                                            >
                                                <option value="">None</option>
                                                {COMPANY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        ) : task.company}
                                    </td>

                                    {/* PRIORITY */}
                                    <td
                                        className={`border-r px-4 py-2 cursor-pointer ${getPriorityColor(task.priority)} relative`}
                                        onClick={() => startEditing(task, "priority")}
                                    >
                                        {editingCell?.id === task.id && editingCell?.field === "priority" ? (
                                            <select
                                                autoFocus
                                                className="w-full h-full bg-white absolute inset-0 outline-none ring-2 ring-primary z-10"
                                                value={editValue}
                                                onChange={(e) => {
                                                    setEditValue(e.target.value);
                                                    saveEdit(e.target.value);
                                                }}
                                                onBlur={saveEdit}
                                            >
                                                <option value="">None</option>
                                                {PRIORITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        ) : task.priority}
                                    </td>

                                    {/* OWNER */}
                                    <td
                                        className="border-r px-4 py-2 cursor-pointer relative"
                                        onClick={() => startEditing(task, "owner")}
                                    >
                                        {editingCell?.id === task.id && editingCell?.field === "owner" ? (
                                            <select
                                                autoFocus
                                                className="w-full h-full bg-white absolute inset-0 outline-none ring-2 ring-primary z-10 px-1"
                                                value={editValue}
                                                onChange={(e) => {
                                                    setEditValue(e.target.value);
                                                    saveEdit(e.target.value);
                                                }}
                                                onBlur={saveEdit}
                                            >
                                                <option value="">Unassigned</option>
                                                {OWNER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        ) : task.owner}
                                    </td>

                                    {/* STATUS */}
                                    <td
                                        className={`border-r px-4 py-2 cursor-pointer relative font-medium`}
                                        onClick={() => startEditing(task, "status")}
                                    >
                                        {editingCell?.id === task.id && editingCell?.field === "status" ? (
                                            <select
                                                autoFocus
                                                className="w-full h-full bg-white text-black absolute inset-0 outline-none ring-2 ring-primary z-10 font-normal"
                                                value={editValue}
                                                onChange={(e) => {
                                                    setEditValue(e.target.value);
                                                    saveEdit(e.target.value);
                                                }}
                                                onBlur={saveEdit}
                                            >
                                                {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        ) : (
                                            <span className={`px-2 py-0.5 rounded-sm inline-block w-full text-center ${getStatusColor(task.status)}`}>
                                                {task.status}
                                            </span>
                                        )}
                                    </td>

                                    {/* DEADLINE */}
                                    <td
                                        className="border-r px-4 py-2 cursor-pointer relative text-gray-500"
                                        onClick={() => startEditing(task, "deadline")}
                                    >
                                        {editingCell?.id === task.id && editingCell?.field === "deadline" ? (
                                            <input
                                                autoFocus
                                                type="date"
                                                className="w-full h-full p-1 absolute inset-0 outline-none ring-2 ring-primary z-10 text-black"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={saveEdit}
                                                onKeyDown={handleKeyDown}
                                            />
                                        ) : task.deadline ? format(new Date(task.deadline), "dd MMM yyyy") : ""}
                                    </td>

                                    {/* NOTES */}
                                    <td
                                        className="border-r px-4 py-2 cursor-pointer relative"
                                        onClick={() => startEditing(task, "notes")}
                                    >
                                        {editingCell?.id === task.id && editingCell?.field === "notes" ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                className="w-full h-full px-2 absolute inset-0 outline-none ring-2 ring-primary z-10"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={saveEdit}
                                                onKeyDown={handleKeyDown}
                                            />
                                        ) : <span className="line-clamp-1">{task.notes}</span>}
                                    </td>

                                    {/* ACTIONS */}
                                    <td className="px-2 py-2 text-center align-middle">
                                        <button
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
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

            {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(page - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= pagination.pages}
                            onClick={() => setPage(page + 1)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            <Dialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) setTaskToDelete(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete task</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete this task
                        {taskToDelete?.taskText && (
                            <span className="font-medium"> "{taskToDelete.taskText}"</span>
                        )}? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={confirmDelete}
                        >
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
