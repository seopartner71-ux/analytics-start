import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface KpiCardProps {
  label: string;
  value: string;
  change: number;
  positive: boolean;
  sparkData?: { v: number }[];
  chartColor?: string;
  compValue?: string;
  showComparison?: boolean;
}

export function KpiCard({ label, value, change, positive, sparkData, chartColor, compValue, showComparison }: KpiCardProps) {
  const color = chartColor || "hsl(var(--primary))";

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-4 pb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="kpi-value">{value}</p>
            {showComparison && compValue && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Б: {compValue}
              </p>
            )}
            {change !== 0 && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${positive ? "text-success" : "text-destructive"}`}>
                {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{change > 0 ? "+" : ""}{Math.abs(change)}%</span>
              </div>
            )}
          </div>
          {sparkData && sparkData.length > 0 && (
            <div className="w-20 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={color}
                    strokeWidth={1.5}
                    fill={`url(#spark-${label})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
