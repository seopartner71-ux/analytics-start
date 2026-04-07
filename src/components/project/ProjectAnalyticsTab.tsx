import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3, Search, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
}

export default function ProjectAnalyticsTab({ projectId }: Props) {
  const { data: analytics = [], isLoading: analyticsLoading } = useQuery({
    queryKey: ["project-analytics", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_analytics")
        .select("*")
        .eq("project_id", projectId)
        .order("month", { ascending: true })
        .limit(12);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: keywords = [], isLoading: keywordsLoading } = useQuery({
    queryKey: ["project-keywords", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_keywords")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const isLoading = analyticsLoading || keywordsLoading;

  const totalVisits = analytics.reduce((sum, a) => sum + (a.organic_traffic || 0), 0);
  const latestAvgPos = analytics.length > 0 ? analytics[analytics.length - 1].avg_position : 0;

  const chartData = analytics.map(a => ({
    month: format(parseISO(a.month), "LLL yy", { locale: ru }),
    traffic: a.organic_traffic,
  }));

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card rounded-lg shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Всего визитов</p>
              <p className="text-2xl font-bold text-foreground">{totalVisits.toLocaleString("ru-RU")}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-card rounded-lg shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[hsl(var(--chart-2))]/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-[hsl(var(--chart-2))]" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Средняя позиция</p>
              <p className="text-2xl font-bold text-foreground">{Number(latestAvgPos).toFixed(1)}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-card rounded-lg shadow-sm border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[hsl(var(--chart-4))]/10 flex items-center justify-center">
              <Search className="h-5 w-5 text-[hsl(var(--chart-4))]" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Ключевых слов</p>
              <p className="text-2xl font-bold text-foreground">{keywords.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Traffic chart */}
      <Card className="bg-card rounded-lg shadow-sm border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Органический трафик по месяцам</h3>
        {chartData.length === 0 ? (
          <div className="py-16 text-center">
            <BarChart3 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-[13px] text-muted-foreground">Нет данных</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Line
                type="monotone"
                dataKey="traffic"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--primary))" }}
                name="Визиты"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Keywords table */}
      <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Ключевые слова</h3>
          <Badge variant="secondary" className="text-[10px] h-5">{keywords.length}</Badge>
        </div>
        {keywords.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-[13px] text-muted-foreground">Нет данных</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ключевое слово</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-24">Позиция</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-28">Изменение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {keywords.map((kw, i) => {
                  const change = kw.position_change || 0;
                  const isPositive = change < 0; // lower position = better
                  const isNegative = change > 0;
                  return (
                    <tr key={kw.id} className={cn("hover:bg-muted/30 transition-colors", i % 2 === 1 && "bg-muted/10")}>
                      <td className="px-4 py-2.5 text-foreground">{kw.keyword}</td>
                      <td className="px-4 py-2.5 text-center font-medium text-foreground">{kw.position}</td>
                      <td className="px-4 py-2.5 text-center">
                        {change !== 0 ? (
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[12px] font-medium",
                            isPositive && "text-[hsl(142,71%,45%)]",
                            isNegative && "text-destructive"
                          )}>
                            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {isPositive ? `-${Math.abs(change)}` : `+${change}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[12px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
