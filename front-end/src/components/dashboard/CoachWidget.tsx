import { useEffect } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  ArrowRight,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  OctagonAlert,
  Activity,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCheckStagnation, useApplySuggestion, useDismissSuggestion } from "@/hooks/use-coach";
import { toast } from "@/hooks/use-toast";
import type { AnalysisState } from "@/lib/types";

/* ── Helpers ────────────────────────────────────────────────── */

const stateConfig: Record<
  AnalysisState,
  { icon: React.ElementType; label: string; color: string; border: string; bg: string }
> = {
  weight_loss: {
    icon: TrendingDown,
    label: "Perda de Peso",
    color: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-950/10",
  },
  slow_gain: {
    icon: AlertTriangle,
    label: "Ganho Lento",
    color: "text-yellow-500",
    border: "border-yellow-500/30",
    bg: "bg-yellow-950/10",
  },
  optimal: {
    icon: Check,
    label: "Zona Perfeita",
    color: "text-green-500",
    border: "border-green-500/20",
    bg: "bg-green-950/10",
  },
  high_velocity: {
    icon: Zap,
    label: "Ganho Rápido",
    color: "text-orange-400",
    border: "border-orange-500/30",
    bg: "bg-orange-950/10",
  },
};

/* ── Healthy Zone constants (kg/month) ── */
const HEALTHY_MIN = 0.5;
const HEALTHY_MAX = 1.5;
const METER_DISPLAY_MAX = 2.5; // max value shown on the meter

/* ── Component ──────────────────────────────────────────────── */

export function CoachWidget() {
  const stagnation = useCheckStagnation();
  const applySuggestion = useApplySuggestion();
  const dismissSuggestion = useDismissSuggestion();

  useEffect(() => {
    stagnation.mutate({ user_id: "default_user" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => {
    if (!stagnation.data) return;
    applySuggestion.mutate(
      {
        user_id: "default_user",
        calorie_adjustment: stagnation.data.suggested_calorie_adjustment ?? 0,
        carb_adjustment_g: stagnation.data.suggested_carb_adjustment_g ?? 0,
        w_curr: stagnation.data.current_week_avg_weight,
        w_prev: stagnation.data.previous_week_avg_weight,
      },
      {
        onSuccess: () => {
          toast({
            title: "Sugestão aplicada!",
            description: "As metas de carboidrato e calorias foram atualizadas.",
          });
          stagnation.mutate({ user_id: "default_user" });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível aplicar a sugestão.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDismiss = () => {
    if (!stagnation.data) return;
    dismissSuggestion.mutate(
      {
        user_id: "default_user",
        w_curr: stagnation.data.current_week_avg_weight,
        w_prev: stagnation.data.previous_week_avg_weight,
      },
      {
        onSuccess: () => {
          toast({
            title: "Sugestão dispensada",
            description: "Não será exibida novamente até novos dados de peso.",
          });
          stagnation.mutate({ user_id: "default_user" });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível dispensar a sugestão.",
            variant: "destructive",
          });
        },
      }
    );
  };

  /* Loading */
  if (stagnation.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Coach Analisando...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  /* Error / no data */
  if (stagnation.isError || !stagnation.data) {
    return null;
  }

  const d = stagnation.data;
  const state = (d.analysis_state ?? "optimal") as AnalysisState;
  const cfg = stateConfig[state];
  const StateIcon = cfg.icon;
  const monthlyGain = d.monthly_projection;

  /* ── Awaiting new data (already adjusted) ── */
  const isAwaitingData = !d.is_stagnating && d.message.includes("Ajuste já realizado");

  if (isAwaitingData) {
    return (
      <Card className="border-blue-500/20 bg-blue-950/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            Coach — Aguardando Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{d.message}</p>
          <WeightComparison d={d} accentColor="blue" />
        </CardContent>
      </Card>
    );
  }

  /* ── Cutting Alert (always on top if present) ── */
  const cuttingAlert = d.suggest_cutting && d.cutting_reasons.length > 0;

  /* Determine if there's a calorie adjustment */
  const hasAdjustment = d.suggested_calorie_adjustment != null && d.suggested_calorie_adjustment !== 0;
  const isReduction = (d.suggested_calorie_adjustment ?? 0) < 0;

  return (
    <div className="space-y-3">
      {/* 🛑 Cutting Alert */}
      {cuttingAlert && (
        <Card className="border-red-500/40 bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-400">
              <OctagonAlert className="h-5 w-5" />
              Alerta: Recomendado Iniciar Cutting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {d.cutting_reasons.map((reason, i) => (
              <p key={i} className="text-sm text-red-300/90">
                {reason}
              </p>
            ))}
            {d.current_body_fat_percent != null && (
              <div className="flex items-center gap-2 mt-2 text-xs text-red-400/70">
                <Activity className="h-3.5 w-3.5" />
                BF% atual: {d.current_body_fat_percent}%
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Coach Card */}
      <Card className={`${cfg.border} ${cfg.bg}`}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <StateIcon className={`h-4 w-4 ${cfg.color}`} />
            Coach — {cfg.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{d.message}</p>

          {/* ── Monthly Projection + Healthy Zone Meter ── */}
          <MonthlyProjectionMeter
            monthlyGain={monthlyGain}
            weeklyRate={d.weekly_rate}
            weeksElapsed={d.weeks_elapsed}
            cfg={cfg}
          />

          {/* Weight comparison */}
          <WeightComparison
            d={d}
            accentColor={
              state === "optimal"
                ? "green"
                : state === "weight_loss"
                  ? "red"
                  : state === "high_velocity"
                    ? "orange"
                    : "yellow"
            }
          />

          {/* Body measurement changes (if available) */}
          {(d.waist_change_cm != null || d.arm_change_cm != null) && (
            <div className="grid grid-cols-2 gap-3">
              {d.waist_change_cm != null && (
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Δ Cintura</p>
                  <p className={`text-base font-bold tabular-nums ${d.waist_change_cm > 0.5 ? "text-red-400" : "text-muted-foreground"}`}>
                    {d.waist_change_cm >= 0 ? "+" : ""}
                    {d.waist_change_cm.toFixed(1)} cm
                  </p>
                </div>
              )}
              {d.arm_change_cm != null && (
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Δ Braço</p>
                  <p className={`text-base font-bold tabular-nums ${d.arm_change_cm > 0.1 ? "text-green-400" : "text-muted-foreground"}`}>
                    {d.arm_change_cm >= 0 ? "+" : ""}
                    {d.arm_change_cm.toFixed(1)} cm
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Calorie/Carb Adjustment Card ── */}
          {hasAdjustment && d.current_calories != null && d.suggested_calories != null && (
            <AdjustmentCard d={d} isReduction={isReduction} />
          )}

          {/* Apply / Dismiss buttons */}
          {d.is_stagnating && hasAdjustment && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleApply}
                disabled={applySuggestion.isPending}
                className={`flex-1 text-white ${
                  isReduction
                    ? "bg-orange-600 hover:bg-orange-700"
                    : state === "weight_loss"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-yellow-600 hover:bg-yellow-700"
                }`}
              >
                {applySuggestion.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {isReduction ? "Aceitar Redução" : "Aceitar Sugestão"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDismiss}
                disabled={dismissSuggestion.isPending}
              >
                {dismissSuggestion.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Dispensar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Monthly Projection Meter ──────────────────────────────── */

function MonthlyProjectionMeter({
  monthlyGain,
  weeklyRate,
  weeksElapsed,
  cfg,
}: {
  monthlyGain: number;
  weeklyRate: number;
  weeksElapsed: number;
  cfg: { color: string; border: string; bg: string };
}) {
  // Clamp for display
  const displayVal = Math.max(0, Math.min(monthlyGain, METER_DISPLAY_MAX));
  const percentage = (displayVal / METER_DISPLAY_MAX) * 100;

  // Healthy zone positions
  const healthyStartPct = (HEALTHY_MIN / METER_DISPLAY_MAX) * 100;
  const healthyEndPct = (HEALTHY_MAX / METER_DISPLAY_MAX) * 100;

  return (
    <div className="space-y-3">
      {/* Primary metric */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Projeção Mensal</p>
          <p className={`text-2xl font-bold tabular-nums ${cfg.color}`}>
            {monthlyGain >= 0 ? "+" : ""}
            {monthlyGain.toFixed(2)} kg/mês
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Taxa Semanal</p>
          <p className={`text-sm font-medium tabular-nums ${cfg.color}`}>
            {weeklyRate >= 0 ? "+" : ""}
            {weeklyRate.toFixed(3)} kg/sem
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            ({weeksElapsed.toFixed(1)} sem. analisadas)
          </p>
        </div>
      </div>

      {/* Healthy Zone Meter */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>0</span>
          <span className="text-green-500 font-medium">Zona Saudável (0.5 – 1.5 kg)</span>
          <span>{METER_DISPLAY_MAX}</span>
        </div>
        <div className="relative h-3 rounded-full bg-muted/50 overflow-hidden">
          {/* Healthy zone highlight */}
          <div
            className="absolute top-0 bottom-0 bg-green-500/20 border-x border-green-500/40"
            style={{
              left: `${healthyStartPct}%`,
              width: `${healthyEndPct - healthyStartPct}%`,
            }}
          />
          {/* Current value indicator */}
          <div
            className={`absolute top-0 bottom-0 left-0 rounded-full transition-all duration-500 ${
              monthlyGain < HEALTHY_MIN
                ? "bg-yellow-500/60"
                : monthlyGain <= HEALTHY_MAX
                  ? "bg-green-500/60"
                  : "bg-orange-500/60"
            }`}
            style={{ width: `${Math.max(percentage, 1)}%` }}
          />
          {/* Needle marker */}
          <div
            className="absolute top-[-2px] bottom-[-2px] w-[3px] rounded-full bg-white shadow-md transition-all duration-500"
            style={{ left: `calc(${percentage}% - 1.5px)` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Lento</span>
          <span>Ideal</span>
          <span>Rápido</span>
        </div>
      </div>
    </div>
  );
}

/* ── Adjustment Card ───────────────────────────────────────── */

function AdjustmentCard({
  d,
  isReduction,
}: {
  d: {
    suggested_calorie_adjustment: number | null;
    suggested_carb_adjustment_g: number | null;
    current_carbs_g: number | null;
    current_carbs_per_kg: number | null;
    suggested_carbs_g: number | null;
    suggested_carbs_per_kg: number | null;
    current_calories: number | null;
    suggested_calories: number | null;
  };
  isReduction: boolean;
}) {
  const kcalAdj = d.suggested_calorie_adjustment ?? 0;
  const carbAdj = d.suggested_carb_adjustment_g ?? 0;
  const accentColor = isReduction ? "orange" : "yellow";
  const suggestedTextColor = isReduction ? "text-orange-400" : "text-green-400";
  const suggestedSubColor = isReduction ? "text-orange-400/70" : "text-green-400/70";

  const borderColor = isReduction ? "border-orange-500/20" : "border-yellow-500/20";
  const headerBg = isReduction ? "bg-orange-950/30" : "bg-yellow-950/30";
  const headerText = isReduction ? "text-orange-400" : "text-yellow-400";
  const footerBg = isReduction ? "bg-orange-950/20" : "bg-yellow-950/20";
  const footerBorder = isReduction ? "border-orange-500/20" : "border-yellow-500/20";

  return (
    <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
      <div className={`${headerBg} px-4 py-2 text-xs font-semibold ${headerText} flex items-center gap-1.5`}>
        {isReduction ? (
          <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <TrendingUp className="h-3.5 w-3.5" />
        )}
        {isReduction ? "Sugestão de Redução" : "Sugestão de Aumento"}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4">
        {/* Current (Before) */}
        <div className="text-center space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Atual</p>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Calorias</p>
            <p className="text-base font-bold tabular-nums">{d.current_calories} kcal</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Carboidratos</p>
            <p className="text-base font-bold tabular-nums">{d.current_carbs_g}g</p>
            {d.current_carbs_per_kg != null && (
              <p className="text-xs text-muted-foreground">{d.current_carbs_per_kg} g/kg</p>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <ArrowRight className={`h-5 w-5 ${isReduction ? "text-orange-500" : "text-yellow-500"}`} />
        </div>

        {/* Suggested (After) */}
        <div className="text-center space-y-2">
          <p className={`text-[10px] uppercase tracking-wider ${suggestedTextColor} font-medium`}>Sugerido</p>
          <div className="space-y-1">
            <p className={`text-xs ${suggestedSubColor}`}>Calorias</p>
            <p className={`text-base font-bold tabular-nums ${suggestedTextColor}`}>{d.suggested_calories} kcal</p>
          </div>
          <div className="space-y-1">
            <p className={`text-xs ${suggestedSubColor}`}>Carboidratos</p>
            <p className={`text-base font-bold tabular-nums ${suggestedTextColor}`}>{d.suggested_carbs_g}g</p>
            {d.suggested_carbs_per_kg != null && (
              <p className={`text-xs ${suggestedSubColor}`}>{d.suggested_carbs_per_kg} g/kg</p>
            )}
          </div>
        </div>
      </div>
      <div className={`border-t ${footerBorder} ${footerBg} px-4 py-2 text-xs text-muted-foreground text-center`}>
        {kcalAdj >= 0 ? "+" : ""}{kcalAdj} kcal / {carbAdj >= 0 ? "+" : ""}{carbAdj}g de carboidrato
      </div>
    </div>
  );
}

/* ── Weight Comparison ─────────────────────────────────────── */

function WeightComparison({
  d,
  accentColor,
}: {
  d: { previous_week_avg_weight: number; current_week_avg_weight: number; weight_change_kg: number };
  accentColor: "green" | "yellow" | "red" | "orange" | "blue";
}) {
  const colorMap = {
    green: {
      bg: "bg-green-950/30",
      border: "border-green-500/20",
      text: "text-green-400",
      sub: "text-green-500/70",
    },
    yellow: {
      bg: "bg-yellow-950/30",
      border: "border-yellow-500/20",
      text: "text-yellow-400",
      sub: "text-yellow-500/70",
    },
    red: {
      bg: "bg-red-950/30",
      border: "border-red-500/20",
      text: "text-red-400",
      sub: "text-red-500/70",
    },
    orange: {
      bg: "bg-orange-950/30",
      border: "border-orange-500/20",
      text: "text-orange-400",
      sub: "text-orange-500/70",
    },
    blue: {
      bg: "bg-blue-950/30",
      border: "border-blue-500/20",
      text: "text-blue-400",
      sub: "text-blue-500/70",
    },
  };
  const c = colorMap[accentColor];

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-muted/50 p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">Peso Anterior</p>
        <p className="text-lg font-bold tabular-nums">{d.previous_week_avg_weight} kg</p>
      </div>
      <div className={`rounded-xl ${c.bg} border ${c.border} p-3 text-center`}>
        <p className={`text-xs ${c.text} mb-1`}>Peso Atual</p>
        <p className={`text-lg font-bold tabular-nums ${c.text}`}>{d.current_week_avg_weight} kg</p>
        <p className={`text-xs ${c.sub} mt-0.5`}>
          {d.weight_change_kg >= 0 ? "+" : ""}
          {d.weight_change_kg} kg
        </p>
      </div>
    </div>
  );
}
