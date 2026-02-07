import { TrendingUp } from "lucide-react";
import { useDashboardStats } from "@/hooks/use-dashboard";
import { useBodyLogs } from "@/hooks/use-body-logs";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { WeightChart } from "@/components/dashboard/WeightChart";
import { MeasuresChart } from "@/components/dashboard/MeasuresChart";
import { CoachWidget } from "@/components/dashboard/CoachWidget";

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useDashboardStats(60);
  const { data: bodyLogs } = useBodyLogs("default_user", undefined, undefined, 0, 200);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Carregando dashboard...</div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">
          Não foi possível carregar os dados. Verifique se o backend está rodando.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <SummaryCards stats={stats} />

      <CoachWidget />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <WeightChart data={stats.weight_history} />
        <MeasuresChart bodyLogs={bodyLogs ?? []} />
      </div>
    </div>
  );
}
