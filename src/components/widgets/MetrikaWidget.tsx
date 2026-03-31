import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Clock, MousePointerClick, Layers, Loader2, BarChart3 } from "lucide-react";
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
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";

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

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">Я</span>
            </div>
            {t("widgets.metrika.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">Я</span>
            </div>
            {t("widgets.metrika.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground max-w-xs">
              {isRu
                ? "Подключите Яндекс.Метрику и синхронизируйте данные на вкладке «Интеграции»."
                : "Connect Yandex.Metrika and sync data on the Integrations tab."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = (stats.visits_by_day as { day: string; visits: number }[]) || [];
  const kpis = {
    bounceRate: Number(stats.bounce_rate),
    pageDepth: Number(stats.page_depth),
    avgTime: formatDuration(stats.avg_duration_seconds),
  };

  const miniCards = [
    { label: t("widgets.metrika.bounceRate"), value: `${kpis.bounceRate}%`, icon: <MousePointerClick className="h-4 w-4" /> },
    { label: t("widgets.metrika.pageDepth"), value: kpis.pageDepth.toFixed(1), icon: <Layers className="h-4 w-4" /> },
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
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {new Date(stats.fetched_at).toLocaleString()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
