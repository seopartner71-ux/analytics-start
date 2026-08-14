import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactMoney, money } from "@/lib/finance";
import type { ForecastPoint } from "@/lib/forecast";
import { EmptyState } from "./primitives";

/** Кривая денег: точка «сейчас» — факт, дальше пунктирный прогноз. */
export function CashForecastChart({ series, height = 260 }: { series: ForecastPoint[]; height?: number }) {
  if (!series.length) return <EmptyState text="Недостаточно данных для прогноза" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={40}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tickLine={false} axisLine={false} width={56}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v) => compactMoney(Number(v))} />
        <Tooltip
          cursor={{ stroke: "hsl(var(--border))" }}
          contentStyle={{
            background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
            borderRadius: 8, fontSize: 12,
          }}
          formatter={(v: unknown) => [money(Number(v)), "Прогноз остатка"]}
        />
        <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
        <Area
          type="monotone" dataKey="projected"
          stroke="hsl(var(--primary))" strokeWidth={1.75} strokeDasharray="4 3"
          fill="url(#gForecast)" dot={false} isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
