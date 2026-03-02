import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Factory, FileText, UserCog, Loader2 } from "lucide-react";

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
    </div>
  );
}
