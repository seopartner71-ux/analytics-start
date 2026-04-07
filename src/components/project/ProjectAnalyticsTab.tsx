import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, BarChart3, Search, Loader2,
  MousePointerClick, Layers, Clock, Users, Target,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, parseISO, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--muted-foreground))",
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ProjectAnalyticsTab({ projectId }: Props) {
  // ── Metrika stats (latest snapshot) ──
  const { data: metrikaStats, isLoading: metrikaLoading } = useQuery({
    queryKey: ["metrika-stats-analytics", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrika_stats")
        .select("*")
        .eq("project_id", projectId)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // ── All metrika snapshots for chart (last 6 months) ──
  const { data: metrikaHistory = [] } = useQuery({
    queryKey: ["metrika-history-analytics", projectId],
    queryFn: async () => {
      const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("metrika_stats")
        .select("date_from, date_to, total_visits, total_users, fetched_at")
        .eq("project_id", projectId)
        .gte("date_from", sixMonthsAgo)
        .order("date_from", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  // ── Project Topvisor config ──
  const { data: project } = useQuery({
    queryKey: ["project-tv-config", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("topvisor_project_id, topvisor_api_key, topvisor_user_id, metrika_counter_id")
        .eq("id", projectId)
        .maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  // ── Topvisor positions (last 2 checks) ──
  const { data: topvisorData, isLoading: tvLoading } = useQuery({
    queryKey: ["tv-positions-analytics", projectId, project?.topvisor_project_id],
    queryFn: async () => {
      if (!project?.topvisor_api_key || !project?.topvisor_project_id) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const now = new Date();
      const date2 = format(now, "yyyy-MM-dd");
      const date1 = format(subMonths(now, 1), "yyyy-MM-dd");

      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/topvisor-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "get-positions",
            api_key: project.topvisor_api_key,
            user_id: project.topvisor_user_id,
            project_id: project.topvisor_project_id,
            payload: {
              project_id: project.topvisor_project_id,
              dates: [date1, date2],
              show_headers: 1,
              positions_fields: ["position"],
            },
          }),
        }
      );
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!project?.topvisor_api_key && !!project?.topvisor_project_id,
    staleTime: 10 * 60_000,
  });

  // ── Parse Topvisor keywords ──
  const keywords = useMemo(() => {
    if (!topvisorData?.result) return [];
    const result = topvisorData.result;
    const headers = result?.headers || [];
    const rows = Array.isArray(result) ? result : result?.keywords || [];

    return rows
      .filter((row: any) => row?.name)
      .map((row: any) => {
        const positionsObj = row.positions || row.position || {};
        let latestPos: number | null = null;
        let prevPos: number | null = null;

        // Try to extract positions from the nested structure
        for (const regionKey of Object.keys(positionsObj)) {
          const regionData = positionsObj[regionKey];
          if (typeof regionData === "object" && regionData !== null) {
            const dates = Object.keys(regionData).sort();
            if (dates.length >= 1) {
              const lastDate = dates[dates.length - 1];
              const lastVal = regionData[lastDate];
              latestPos = typeof lastVal === "object" ? Number(lastVal?.position) : Number(lastVal);
            }
            if (dates.length >= 2) {
              const prevDate = dates[dates.length - 2];
              const prevVal = regionData[prevDate];
              prevPos = typeof prevVal === "object" ? Number(prevVal?.position) : Number(prevVal);
            }
          }
        }

        const pos = latestPos && latestPos > 0 ? latestPos : null;
        const prev = prevPos && prevPos > 0 ? prevPos : null;
        const change = pos && prev ? prev - pos : 0; // positive = improved

        return {
          keyword: row.name as string,
          position: pos || 0,
          change,
        };
      })
      .filter((k: any) => k.position > 0)
      .sort((a: any, b: any) => a.position - b.position);
  }, [topvisorData]);

  // ── Position distribution for pie chart ──
  const posDistribution = useMemo(() => {
    const top3 = keywords.filter(k => k.position <= 3).length;
    const top10 = keywords.filter(k => k.position > 3 && k.position <= 10).length;
    const top30 = keywords.filter(k => k.position > 10 && k.position <= 30).length;
    const outside = keywords.filter(k => k.position > 30).length;
    return [
      { name: "Топ 3", value: top3 },
      { name: "Топ 10", value: top10 },
      { name: "Топ 30", value: top30 },
      { name: "За топ 30", value: outside },
    ].filter(d => d.value > 0);
  }, [keywords]);

  // ── Metrika chart data ──
  const trafficChart = useMemo(() => {
    if (metrikaStats?.visits_by_day) {
      const days = metrikaStats.visits_by_day as { day: string; visits: number }[];
      if (days.length > 0) {
        return days.map(d => ({
          date: d.day,
          visits: d.visits,
        }));
      }
    }
    // Fallback: use history snapshots
    return metrikaHistory.map(h => ({
      date: format(parseISO(h.date_from), "dd MMM", { locale: ru }),
      visits: h.total_visits,
    }));
  }, [metrikaStats, metrikaHistory]);

  const isLoading = metrikaLoading || tvLoading;

  const totalVisits = metrikaStats?.total_visits || 0;
  const totalUsers = metrikaStats?.total_users || 0;
  const bounceRate = metrikaStats ? Number(metrikaStats.bounce_rate) : 0;
  const avgDuration = metrikaStats ? metrikaStats.avg_duration_seconds : 0;
  const pageDepth = metrikaStats ? Number(metrikaStats.page_depth) : 0;

  // Average position from Topvisor
  const avgPosition = useMemo(() => {
    if (keywords.length === 0) return 0;
    const sum = keywords.reduce((acc, k) => acc + k.position, 0);
    return sum / keywords.length;
  }, [keywords]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasMetrika = !!metrikaStats;
  const hasTopvisor = keywords.length > 0;

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Визиты</p>
              <p className="text-xl font-bold text-foreground">{totalVisits.toLocaleString("ru-RU")}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[hsl(var(--chart-2))]/10 flex items-center justify-center">
              <Users className="h-4.5 w-4.5 text-[hsl(var(--chart-2))]" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Посетители</p>
              <p className="text-xl font-bold text-foreground">{totalUsers.toLocaleString("ru-RU")}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[hsl(var(--chart-3))]/10 flex items-center justify-center">
              <Target className="h-4.5 w-4.5 text-[hsl(var(--chart-3))]" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ср. позиция</p>
              <p className="text-xl font-bold text-foreground">{avgPosition > 0 ? avgPosition.toFixed(1) : "—"}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[hsl(var(--chart-4))]/10 flex items-center justify-center">
              <Search className="h-4.5 w-4.5 text-[hsl(var(--chart-4))]" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ключевых слов</p>
              <p className="text-xl font-bold text-foreground">{keywords.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Metrika mini-stats */}
      {hasMetrika && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-card rounded-lg shadow-sm border border-border p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <MousePointerClick className="h-3.5 w-3.5" />
              <span className="text-[11px]">Отказы</span>
            </div>
            <p className="text-lg font-bold text-foreground">{bounceRate}%</p>
          </Card>
          <Card className="bg-card rounded-lg shadow-sm border border-border p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Layers className="h-3.5 w-3.5" />
              <span className="text-[11px]">Глубина</span>
            </div>
            <p className="text-lg font-bold text-foreground">{pageDepth.toFixed(1)}</p>
          </Card>
          <Card className="bg-card rounded-lg shadow-sm border border-border p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[11px]">Время на сайте</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatDuration(avgDuration)}</p>
          </Card>
        </div>
      )}

      {/* Two-column: Traffic chart + Position distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Traffic chart */}
        <Card className="lg:col-span-3 bg-card rounded-lg shadow-sm border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Органический трафик</h3>
          {trafficChart.length === 0 ? (
            <div className="py-16 text-center">
              <BarChart3 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
              <p className="text-[13px] text-muted-foreground">
                {hasMetrika ? "Нет данных за период" : "Подключите Яндекс.Метрику на вкладке «Интеграции»"}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trafficChart}>
                <defs>
                  <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="visits"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#trafficGrad)"
                  name="Визиты"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Position distribution pie */}
        <Card className="lg:col-span-2 bg-card rounded-lg shadow-sm border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Распределение позиций</h3>
          {posDistribution.length === 0 ? (
            <div className="py-16 text-center">
              <Target className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
              <p className="text-[13px] text-muted-foreground">
                {hasTopvisor ? "Нет данных" : "Подключите Topvisor на вкладке «Интеграции»"}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={posDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={45}
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {posDistribution.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Keywords table */}
      <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Ключевые слова (Topvisor)</h3>
          <Badge variant="secondary" className="text-[10px] h-5">{keywords.length}</Badge>
        </div>
        {keywords.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-[13px] text-muted-foreground">
              {project?.topvisor_api_key
                ? "Нет данных о позициях"
                : "Подключите Topvisor на вкладке «Интеграции»"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ключевое слово</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-24">Позиция</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-28">Изменение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {keywords.map((kw, i) => {
                  const isPositive = kw.change > 0; // position went down = improved
                  const isNegative = kw.change < 0;
                  return (
                    <tr key={i} className={cn("hover:bg-muted/30 transition-colors", i % 2 === 1 && "bg-muted/10")}>
                      <td className="px-4 py-2.5 text-foreground">{kw.keyword}</td>
                      <td className="px-4 py-2.5 text-center font-medium text-foreground">{kw.position}</td>
                      <td className="px-4 py-2.5 text-center">
                        {kw.change !== 0 ? (
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[12px] font-medium",
                            isPositive && "text-[hsl(142,71%,45%)]",
                            isNegative && "text-destructive"
                          )}>
                            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {isPositive ? `+${kw.change}` : `${kw.change}`}
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
