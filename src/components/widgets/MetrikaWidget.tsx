import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { metrikaVisitsData, metrikaKpis } from "@/data/projects";
import { Clock, MousePointerClick, Layers, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MetrikaWidgetProps {
  projectId?: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MetrikaWidget({ projectId }: MetrikaWidgetProps) {
  const { t } = useTranslation();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["metrika-stats", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrika_stats")
        .select("*")
        .eq("project_id", projectId!)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const hasRealData = !!stats;
  const chartData = hasRealData
    ? (stats.visits_by_day as { day: string; visits: number }[])
    : metrikaVisitsData;

  const kpis = hasRealData
    ? {
        bounceRate: Number(stats.bounce_rate),
        pageDepth: Number(stats.page_depth),
        avgTime: formatDuration(stats.avg_duration_seconds),
      }
    : metrikaKpis;

  const miniCards = [
    { label: t("widgets.metrika.bounceRate"), value: `${kpis.bounceRate}%`, icon: <MousePointerClick className="h-4 w-4" /> },
    { label: t("widgets.metrika.pageDepth"), value: typeof kpis.pageDepth === "number" ? kpis.pageDepth.toFixed(1) : kpis.pageDepth, icon: <Layers className="h-4 w-4" /> },
    { label: t("widgets.metrika.avgTime"), value: kpis.avgTime, icon: <Clock className="h-4 w-4" /> },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">Я</span>
          </div>
          {t("widgets.metrika.title")}
          {hasRealData && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {new Date(stats.fetched_at).toLocaleString()}
            </span>
          )}
          {!hasRealData && !isLoading && (
            <span className="ml-auto text-xs font-normal text-muted-foreground italic">
              {t("widgets.metrika.demoData")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="metrikaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Area type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#metrikaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <div className="grid grid-cols-3 gap-3">
          {miniCards.map((card) => (
            <div key={card.label} className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                {card.icon}
                <span className="text-xs">{card.label}</span>
              </div>
              <p className="text-lg font-bold text-foreground">{card.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
