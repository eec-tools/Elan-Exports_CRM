import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Factory,
  FileText,
  UserCog,
  Loader2,
  Video,
  HardDrive,
  ExternalLink,
} from "lucide-react";

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats").then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards = [
    {
      title: "Total Buyers",
      value: stats?.totalBuyers ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Total Suppliers",
      value: stats?.totalSuppliers ?? 0,
      icon: Factory,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Total Reports",
      value: stats?.totalReports ?? 0,
      icon: FileText,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      title: "Active Users",
      value: stats?.activeUsers ?? 0,
      icon: UserCog,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to Élan Exports CRM
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Quick Links ── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Links</h2>
        <div className="flex gap-3 flex-wrap">
          <a
            href="https://meet.google.com/pqs-znoa-jwk?authuser=0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:shadow-md transition-all hover:border-red-200 hover:bg-red-50 group"
          >
            <div className="rounded-md bg-red-50 p-1.5 group-hover:bg-red-100 transition-colors">
              <Video className="h-4 w-4 text-red-600" />
            </div>
            Google Meet
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
          <a
            href="https://drive.google.com/drive/folders/1GfVddDUKMlzeoiQ_vFpuFptukawWnbwW"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:shadow-md transition-all hover:border-blue-200 hover:bg-blue-50 group"
          >
            <div className="rounded-md bg-blue-50 p-1.5 group-hover:bg-blue-100 transition-colors">
              <HardDrive className="h-4 w-4 text-blue-600" />
            </div>
            Google Drive
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
        </div>
      </div>
    </div>
  );
}
