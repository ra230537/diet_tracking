import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeightHistoryEntry } from "@/lib/types";

interface WeightChartProps {
  data: WeightHistoryEntry[];
}

export function WeightChart({ data }: WeightChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evolução do Peso</CardTitle>
      </CardHeader>
      <CardContent>
        {formatted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado de peso registrado ainda.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }}
                stroke="hsl(0 0% 20%)"
              />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }}
                stroke="hsl(0 0% 20%)"
                unit=" kg"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0 0% 10%)",
                  border: "1px solid hsl(0 0% 20%)",
                  borderRadius: "8px",
                  color: "white",
                }}
                labelStyle={{ color: "hsl(0 0% 60%)" }}
              />
              <Line
                type="monotone"
                dataKey="weight_kg"
                name="Peso (kg)"
                stroke="hsl(250 80% 65%)"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(250 80% 65%)" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
