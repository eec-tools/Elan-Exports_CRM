import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, CheckCircle, XCircle } from "lucide-react";
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

  const createMutation = useMutation({
    mutationFn: (d: { permission: string; reason: string }) =>
      api.post("/access-requests", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      setDialogOpen(false);
      toast.success("Request submitted");
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

  const statusColor = (s: string) => {
    switch (s) {
      case "approved":
        return "default" as const;
      case "rejected":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Access Requests</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? "Review permission requests"
              : "Request additional permissions"}
          </p>
        </div>
        {!isAdmin && (
          <Button
            onClick={() => {
              setPermission("buyers");
              setReason("");
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          No access requests
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-neutral-300 dark:border-neutral-700">
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  User
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Permission
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Reason
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Status
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Date
                </TableHead>
                {isAdmin && (
                  <TableHead className="w-28 border-r border-neutral-300 dark:border-neutral-700">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r: AccessRequest) => (
                <TableRow
                  key={r.id}
                  className="border-b border-neutral-300 dark:border-neutral-700 last:border-0 hover:bg-muted/30"
                >
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    <div>
                      <p className="font-medium text-sm">{r.user?.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.user?.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    <Badge variant="outline" className="capitalize">
                      {r.permission}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm border-r border-neutral-300 dark:border-neutral-700">
                    {r.reason}
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    <Badge
                      variant={statusColor(r.status)}
                      className="capitalize"
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm border-r border-neutral-300 dark:border-neutral-700">
                    {format(new Date(r.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                      {r.status === "pending" && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Approve"
                            onClick={() =>
                              reviewMutation.mutate({
                                id: r.id,
                                status: "approved",
                              })
                            }
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reject"
                            onClick={() =>
                              reviewMutation.mutate({
                                id: r.id,
                                status: "rejected",
                              })
                            }
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Access</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ permission, reason });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Permission</Label>
              <Select value={permission} onValueChange={setPermission}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyers">Buyers</SelectItem>
                  <SelectItem value="suppliers">Suppliers</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="reports">Reports</SelectItem>
                  <SelectItem value="vault">Vault</SelectItem>
                  <SelectItem value="task_tracker">Task Tracker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                placeholder="Why do you need this access?"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
