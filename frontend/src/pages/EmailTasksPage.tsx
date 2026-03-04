import { useState, useEffect } from "react";
import api from "@/api/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Mail, ExternalLink, RefreshCw, Edit, Save, Trash2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

export default function EmailTasksPage() {
    const [tasks, setTasks] = useState<EmailTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedTask, setSelectedTask] = useState<EmailTask | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<EmailTask | null>(null);

    const fetchTasks = async () => {
        try {
            const res = await api.get("/email-tasks");
            setTasks(res.data);
        } catch (error) {
            toast.error("Failed to load email tasks");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchTasks();
    };

    const updateTask = async (id: string, field: string, value: string) => {
        try {
            await api.put(`/email-tasks/${id}`, { [field]: value });
            setTasks((prev) =>
                prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
            );
            if (selectedTask && selectedTask.id === id) {
                setSelectedTask(prev => prev ? { ...prev, [field]: value } : prev);
            }
            toast.success("Task updated");
        } catch (error) {
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
        } catch (error) {
            toast.error("Failed to delete task");
        }
    };

    const handleRowClick = (task: EmailTask) => {
        setSelectedTask(task);
        setIsEditing(false); // Default to view mode
        setIsDialogOpen(true);
    };

    const handleEditClick = (task: EmailTask, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedTask(task);
        setIsEditing(true);
        setIsDialogOpen(true);
    };

    const statusColors: Record<string, string> = {
        "Not Started": "bg-gray-100 text-gray-800",
        "In Progress": "bg-yellow-100 text-yellow-800",
        "Completed": "bg-green-100 text-green-800",
    };

    const priorityColors: Record<string, string> = {
        "High": "text-red-600 font-semibold",
        "Medium": "text-orange-600 font-semibold",
        "Low": "text-green-600 font-semibold",
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Email Tasks</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage incoming email requests and assignments.
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            <div className="rounded-md border bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Sender</th>
                                <th className="px-4 py-3 font-medium max-w-[200px]">Subject</th>
                                <th className="px-4 py-3 font-medium">Task</th>
                                <th className="px-4 py-3 font-medium">Priority</th>
                                <th className="px-4 py-3 font-medium">Respondent</th>
                                <th className="px-4 py-3 font-medium">Notes</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {tasks.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Mail className="h-8 w-8 opacity-20" />
                                            <p>No email tasks found.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                tasks.map((task) => (
                                    <tr
                                        key={task.id}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                                        onClick={() => handleRowClick(task)}
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                            {format(new Date(task.dateReceived), "MMM d, h:mm a")}
                                        </td>
                                        <td className="px-4 py-3 font-medium">{task.senderAddress}</td>
                                        <td className="px-4 py-3">
                                            <div className="line-clamp-2" title={task.subject}>
                                                {task.subject}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-medium border px-2 py-0.5 rounded-full w-fit bg-secondary/50">
                                                    {task.task || "Uncategorized"}
                                                </span>
                                                {task.productCategory && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {task.productCategory}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={task.priority ? priorityColors[task.priority] : "text-muted-foreground"}>
                                                {task.priority || "None"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-muted-foreground">
                                                {task.respondent || "Unassigned"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="line-clamp-1 text-muted-foreground" title={task.notes || ""}>
                                                {task.notes || "No notes"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[task.status] || "bg-secondary text-secondary-foreground"}`}>
                                                {task.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1">
                                                {task.emailLink && (
                                                    <a
                                                        href={task.emailLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                                        title="Open Email"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={(e) => handleEditClick(task, e)}
                                                    className="inline-flex items-center justify-center p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
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
                                                    className="inline-flex items-center justify-center p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
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
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    {selectedTask && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center justify-between pb-2 border-b gap-4">
                                    <DialogTitle className="text-xl">
                                        {selectedTask.subject}
                                    </DialogTitle>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <Button
                                            variant={isEditing ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setIsEditing(!isEditing)}
                                            className="gap-2"
                                        >
                                            {isEditing ? (
                                                <>
                                                    <Save className="h-4 w-4" />
                                                    Done Editing
                                                </>
                                            ) : (
                                                <>
                                                    <Edit className="h-4 w-4" />
                                                    Edit Task
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                <DialogDescription className="pt-2 flex justify-between items-start">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-foreground">From:</span>
                                            <span>{selectedTask.senderAddress}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-foreground">Date:</span>
                                            <span>{format(new Date(selectedTask.dateReceived), "PPP 'at' p")}</span>
                                        </div>
                                    </div>
                                    {selectedTask.emailLink && (
                                        <Button variant="outline" size="sm" asChild className="gap-2">
                                            <a href={selectedTask.emailLink} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-4 w-4" />
                                                Open in Gmail
                                            </a>
                                        </Button>
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid grid-cols-2 gap-6 py-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground">Task Type</label>
                                        {isEditing ? (
                                            <select
                                                value={selectedTask.task || ""}
                                                onChange={(e) => updateTask(selectedTask.id, "task", e.target.value)}
                                                className="w-full mt-1.5 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                            >
                                                <option value="">Uncategorized</option>
                                                <option value="Support">Support</option>
                                                <option value="Sales Inquiry">Sales Inquiry</option>
                                                <option value="General Inquiry">General Inquiry</option>
                                                <option value="Partnership">Partnership</option>
                                            </select>
                                        ) : (
                                            <div className="mt-1.5 py-2 font-medium">
                                                {selectedTask.task || "Uncategorized"}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground">Priority</label>
                                        {isEditing ? (
                                            <select
                                                value={selectedTask.priority || ""}
                                                onChange={(e) => updateTask(selectedTask.id, "priority", e.target.value)}
                                                className={`w-full mt-1.5 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${selectedTask.priority ? priorityColors[selectedTask.priority] : ""}`}
                                            >
                                                <option value="">Set Priority...</option>
                                                <option value="High" className="text-red-600">High</option>
                                                <option value="Medium" className="text-orange-600">Medium</option>
                                                <option value="Low" className="text-green-600">Low</option>
                                            </select>
                                        ) : (
                                            <div className={`mt-1.5 py-2 font-medium ${selectedTask.priority ? priorityColors[selectedTask.priority] : ""}`}>
                                                {selectedTask.priority || "None"}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground">Status</label>
                                        {isEditing ? (
                                            <select
                                                value={selectedTask.status}
                                                onChange={(e) => updateTask(selectedTask.id, "status", e.target.value)}
                                                className={`w-full mt-1.5 px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-ring ${statusColors[selectedTask.status] || "bg-secondary text-secondary-foreground"}`}
                                            >
                                                <option value="Not Started">Not Started</option>
                                                <option value="In Progress">In Progress</option>
                                                <option value="Completed">Completed</option>
                                            </select>
                                        ) : (
                                            <div className="mt-1.5 py-2">
                                                <span className={`px-2 py-1 rounded-full text-sm font-medium ${statusColors[selectedTask.status] || "bg-secondary text-secondary-foreground"}`}>
                                                    {selectedTask.status}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground">Product Category</label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={selectedTask.productCategory || ""}
                                                onChange={(e) => setSelectedTask({ ...selectedTask, productCategory: e.target.value })}
                                                onBlur={(e) => updateTask(selectedTask.id, "productCategory", e.target.value)}
                                                className="w-full mt-1.5 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                                placeholder="E.g. Bamboo Toothbrush"
                                            />
                                        ) : (
                                            <div className="mt-1.5 py-2 font-medium">
                                                {selectedTask.productCategory || "None"}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-muted-foreground">Assigned Respondent</label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={selectedTask.respondent || ""}
                                                onChange={(e) => setSelectedTask({ ...selectedTask, respondent: e.target.value })}
                                                onBlur={(e) => updateTask(selectedTask.id, "respondent", e.target.value)}
                                                className="w-full mt-1.5 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                                placeholder="Assign to..."
                                            />
                                        ) : (
                                            <div className="mt-1.5 py-2 font-medium">
                                                {selectedTask.respondent || "Unassigned"}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </>
                    )}
                </DialogContent>
            </Dialog>

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
                        Are you sure you want to delete the task{" "}
                        {taskToDelete?.subject && (
                            <span className="font-medium">
                                "{taskToDelete.subject}"
                            </span>
                        )}
                        ? This action cannot be undone.
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
