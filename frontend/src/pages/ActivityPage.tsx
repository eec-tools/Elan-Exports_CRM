import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

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
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: () => api.get("/activity").then((r) => r.data),
  });

  const actionColor = (action: string) => {
    if (action.includes("create")) return "default" as const;
    if (action.includes("update") || action.includes("activate"))
      return "secondary" as const;
    if (action.includes("delete") || action.includes("deactivate"))
      return "destructive" as const;
    if (action.includes("login")) return "outline" as const;
    return "outline" as const;
  };

  const formatEntityType = (type: string) => {
    if (!type) return "Unknown";
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground mt-1">
          Recent actions across the CRM
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          No activity yet
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: Log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">
                        {log.user?.fullName ?? "System"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.user?.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionColor(log.action)}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatEntityType(log.entityType)}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                    {log.details
                      ? Object.entries(log.details as Record<string, unknown>)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {format(new Date(log.createdAt), "MMM d, HH:mm")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
