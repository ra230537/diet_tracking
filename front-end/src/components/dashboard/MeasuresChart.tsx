import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BodyLogResponse } from "@/lib/types";

interface MeasuresChartProps {
  bodyLogs: BodyLogResponse[];
}

export function MeasuresChart({ bodyLogs }: MeasuresChartProps) {
  const data = bodyLogs
    .filter((log) => log.circ_waist || log.circ_right_arm)
    .map((log) => ({
      date: new Date(log.date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      cintura: log.circ_waist ?? 0,
      braco: log.circ_right_arm ?? 0,
    }))
    .reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cintura vs Braço (Qualidade do Bulk)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado de medidas registrado ainda.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }}
                stroke="hsl(0 0% 20%)"
              />
              <YAxis
                tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }}
                stroke="hsl(0 0% 20%)"
                unit=" cm"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0 0% 10%)",
                  border: "1px solid hsl(0 0% 20%)",
                  borderRadius: "8px",
                  color: "white",
                }}
              />
              <Legend />
              <Bar
                dataKey="cintura"
                name="Cintura (cm)"
                fill="hsl(0 70% 50%)"
                radius={[4, 4, 0, 0]}
                opacity={0.7}
              />
              <Line
                type="monotone"
                dataKey="braco"
                name="Braço (cm)"
                stroke="hsl(150 70% 50%)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
