import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface MacroProgressBarProps {
  label: string;
  actual: number;
  target: number;
  unit: string;
  colorClass?: string;
  /** If provided, shows actual g/kg value next to the label. null = no weight available, show "–" */
  perKgActual?: number | null;
}

export function MacroProgressBar({
  label,
  actual,
  target,
  unit,
  colorClass = "bg-primary",
  perKgActual,
}: MacroProgressBarProps) {
  const percentage = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
  const isOver = actual > target;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          {perKgActual !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {perKgActual !== null ? `${perKgActual.toFixed(1)} g/kg` : "–"}
            </span>
          )}
        </div>
        <span className={cn("tabular-nums", isOver && "text-red-400")}>
          {Math.round(actual)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="relative">
        <Progress value={percentage} className="h-2.5" />
        <div
          className={cn("absolute inset-0 h-2.5 rounded-full transition-all", colorClass)}
          style={{ width: `${Math.min(percentage, 100)}%`, opacity: 0.9 }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-right">
        {percentage.toFixed(0)}%{isOver && " (excedido!)"}
      </p>
    </div>
  );
}
