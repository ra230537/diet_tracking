import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Weight, Percent, Flame } from "lucide-react";
import type { DashboardStats } from "@/lib/types";

interface SummaryCardsProps {
  stats: DashboardStats;
}

export function SummaryCards({ stats }: SummaryCardsProps) {
  const latestWeight = stats.latest_body_log?.weight_kg ?? "—";
  const latestBf =
    stats.latest_body_log?.calculated_body_fat_percent ??
    stats.latest_body_log?.bio_body_fat_percent ??
    null;
  const plan = stats.current_plan_summary;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {/* Weight */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Peso Atual
          </CardTitle>
          <Weight className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {latestWeight !== "—" ? `${latestWeight} kg` : "—"}
          </div>
          {stats.weight_history.length >= 2 && (
            <p className="text-xs text-muted-foreground mt-1">
              {(() => {
                const first = stats.weight_history[0].weight_kg;
                const last =
                  stats.weight_history[stats.weight_history.length - 1].weight_kg;
                const diff = last - first;
                return diff >= 0
                  ? `+${diff.toFixed(1)} kg no período`
                  : `${diff.toFixed(1)} kg no período`;
              })()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* BF% */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            % Gordura Corporal
          </CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {latestBf !== null ? `${latestBf.toFixed(1)}%` : "—"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {latestBf !== null ? "Pollock 7 dobras / Bioimpedância" : "Sem dados de composição"}
          </p>
        </CardContent>
      </Card>

      {/* Calories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Calorias (Meta vs Real)
          </CardTitle>
          <Flame className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {plan
              ? `${Math.round(plan.actual_calories)} / ${Math.round(plan.target_calories)}`
              : "—"}
          </div>
          {plan && (
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(plan.target_calories - plan.actual_calories)} kcal restantes
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
