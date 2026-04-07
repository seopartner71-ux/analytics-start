import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format as fmtDate } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  TrendingUp, TrendingDown, BarChart3, Search, Loader2,
  MousePointerClick, Layers, Clock, Users, Target,
  CalendarDays, ArrowRightLeft, Filter,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, parseISO, subMonths, subDays, subYears, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import AiMonthlyReport from "./AiMonthlyReport";

interface Props {
  projectId: string;
}

type DateRange = { from: Date; to: Date };
type TrafficChannel = "all" | "organic" | "direct" | "referral" | "social" | "ad";

const CHANNEL_LABELS: Record<TrafficChannel, string> = {
  all: "Все визиты",
  organic: "Органический",
  direct: "Прямые заходы",
  referral: "Переходы по ссылкам",
  social: "Социальные сети",
  ad: "Реклама",
};

// Map Yandex Metrika source names to channel keys
const SOURCE_TO_CHANNEL: Record<string, TrafficChannel> = {
  "Search engine traffic": "organic",
  "Direct traffic": "direct",
  "Link traffic": "referral",
  "Social network traffic": "social",
  "Ad traffic": "ad",
  "Messenger traffic": "social",
  "Recommendation system traffic": "referral",
  "Internal traffic": "direct",
};

const PRESETS = [
  { key: "7d", label: "7 дней", days: 7 },
  { key: "14d", label: "14 дней", days: 14 },
  { key: "30d", label: "30 дней", days: 30 },
  { key: "thisMonth", label: "Этот месяц", days: 0 },
] as const;

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

// Dual tooltip for comparison mode
const DualTooltip = ({ active, payload, label, showComparison }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 min-w-[160px]">
      <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => {
        const isPrevious = p.dataKey === "previous";
        return (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
              {isPrevious ? "Период Б" : "Период А"}
            </span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: p.color }}>
              {typeof p.value === "number" ? p.value.toLocaleString("ru-RU") : p.value}
            </span>
          </div>
        );
      })}
      {showComparison && payload.length === 2 && payload[0].value > 0 && payload[1].value > 0 && (
        <div className="border-t border-border mt-1.5 pt-1">
          <span className={cn(
            "text-xs font-semibold",
            payload[0].value >= payload[1].value ? "text-emerald-500" : "text-red-500"
          )}>
            Δ {payload[0].value >= payload[1].value ? "+" : ""}
            {Math.round(((payload[0].value - payload[1].value) / payload[1].value) * 1000) / 10}%
          </span>
        </div>
      )}
    </div>
  );
};

export default function ProjectAnalyticsTab({ projectId }: Props) {
  const today = new Date();

  // ── Filter state ──
  const [range, setRange] = useState<DateRange>({ from: subDays(today, 30), to: today });
  const [appliedRange, setAppliedRange] = useState<DateRange>({ from: subDays(today, 30), to: today });
  const [activePreset, setActivePreset] = useState<string>("30d");
  const [showComparison, setShowComparison] = useState(false);
  const [compRange, setCompRange] = useState<DateRange>({
    from: subDays(today, 61), to: subDays(today, 31),
  });
  const [appliedCompRange, setAppliedCompRange] = useState<DateRange>({
    from: subDays(today, 61), to: subDays(today, 31),
  });
  const [channel, setChannel] = useState<TrafficChannel>("all");

  // ── Data queries ──
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

  // ── Project config + fallback to integrations table ──
  const { data: project } = useQuery({
    queryKey: ["project-tv-config", projectId],
    queryFn: async () => {
      const { data: proj } = await supabase
        .from("projects")
        .select("topvisor_project_id, topvisor_api_key, topvisor_user_id, metrika_counter_id")
        .eq("id", projectId)
        .maybeSingle();

      // If project-level fields are empty, fallback to integrations table
      if (!proj?.topvisor_api_key || !proj?.topvisor_project_id) {
        const { data: tvIntegration } = await supabase
          .from("integrations")
          .select("api_key, external_project_id, counter_id")
          .eq("project_id", projectId)
          .eq("service_name", "topvisor")
          .eq("connected", true)
          .maybeSingle();

        if (tvIntegration?.api_key && tvIntegration?.external_project_id) {
          return {
            topvisor_api_key: tvIntegration.api_key,
            topvisor_project_id: tvIntegration.external_project_id,
            topvisor_user_id: tvIntegration.counter_id || proj?.topvisor_user_id,
            metrika_counter_id: proj?.metrika_counter_id,
          };
        }
      }

      return proj;
    },
    enabled: !!projectId,
  });

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

  // ── Goals data for AI report ──
  const { data: integration } = useQuery({
    queryKey: ["integration-metrika-analytics", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations").select("*")
        .eq("project_id", projectId).eq("service_name", "yandexMetrika").eq("connected", true)
        .maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  const dateFrom30 = fmtDate(subDays(today, 30), "yyyy-MM-dd");
  const dateTo30 = fmtDate(today, "yyyy-MM-dd");

  const { data: goalsData = [] } = useQuery({
    queryKey: ["metrika-goals-ai", projectId, dateFrom30, dateTo30],
    queryFn: async () => {
      if (!integration?.access_token || !integration?.counter_id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-goals`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: integration.access_token, counter_id: integration.counter_id,
            date1: dateFrom30, date2: dateTo30,
          }),
        }
      );
      const data = await resp.json();
      return (data.goals || []) as { id: number; name: string; reaches: number; conversionRate: number; change: number; daily?: number[] }[];
    },
    enabled: !!integration?.access_token && !!integration?.counter_id,
    staleTime: 30 * 60_000,
  });

  // Search traffic goals for chart
  const { data: searchGoalsData = [], isLoading: searchGoalsLoading } = useQuery({
    queryKey: ["metrika-goals-search", projectId, dateFrom30, dateTo30],
    queryFn: async () => {
      if (!integration?.access_token || !integration?.counter_id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-goals`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: integration.access_token, counter_id: integration.counter_id,
            date1: dateFrom30, date2: dateTo30,
            traffic_source: "organic",
          }),
        }
      );
      const data = await resp.json();
      return (data.goals || []) as { id: number; name: string; reaches: number; conversionRate: number; change: number; daily?: number[] }[];
    },
    enabled: !!integration?.access_token && !!integration?.counter_id,
    staleTime: 30 * 60_000,
  });

  // Build chart data for search goals
  const searchGoalsChartData = useMemo(() => {
    if (!searchGoalsData.length) return [];
    const maxLen = Math.max(...searchGoalsData.map(g => g.daily?.length || 0));
    const result = [];
    const startDate = subDays(today, 30);
    for (let i = 0; i < maxLen; i++) {
      const dateObj = new Date(startDate);
      dateObj.setDate(dateObj.getDate() + i);
      const entry: any = { day: format(dateObj, "dd.MM", { locale: ru }) };
      let total = 0;
      searchGoalsData.forEach(g => {
        const val = g.daily?.[i] || 0;
        entry[g.name] = val;
        total += val;
      });
      entry.total = total;
      result.push(entry);
    }
    return result;
  }, [searchGoalsData, today]);

  const GOAL_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  // ── Keywords parsing ──
  const keywords = useMemo(() => {
    if (!topvisorData?.result) return [];
    const result = topvisorData.result;
    const rows = Array.isArray(result) ? result : result?.keywords || [];

    return rows
      .filter((row: any) => row?.name)
      .map((row: any) => {
        const positionsObj = row.positions || row.position || {};
        let latestPos: number | null = null;
        let prevPos: number | null = null;

        for (const regionKey of Object.keys(positionsObj)) {
          const regionData = positionsObj[regionKey];
          if (typeof regionData === "object" && regionData !== null) {
            const dates = Object.keys(regionData).sort();
            if (dates.length >= 1) {
              const lastVal = regionData[dates[dates.length - 1]];
              latestPos = typeof lastVal === "object" ? Number(lastVal?.position) : Number(lastVal);
            }
            if (dates.length >= 2) {
              const prevVal = regionData[dates[dates.length - 2]];
              prevPos = typeof prevVal === "object" ? Number(prevVal?.position) : Number(prevVal);
            }
          }
        }

        const pos = latestPos && latestPos > 0 ? latestPos : null;
        const prev = prevPos && prevPos > 0 ? prevPos : null;
        const change = pos && prev ? prev - pos : 0;

        return { keyword: row.name as string, position: pos || 0, change };
      })
      .filter((k: any) => k.position > 0)
      .sort((a: any, b: any) => a.position - b.position);
  }, [topvisorData]);

  // ── Position distribution ──
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

  // ── Daily traffic data ──
  const dailyData = useMemo(() => {
    if (!metrikaStats?.visits_by_day) return [];
    const days = metrikaStats.visits_by_day as { day: string; visits: number }[];
    const dateFrom = parseISO(metrikaStats.date_from);
    return days.map((d, i) => {
      const date = new Date(dateFrom);
      date.setDate(date.getDate() + i);
      return { date, dateStr: format(date, "dd.MM", { locale: ru }), visits: d.visits || 0 };
    });
  }, [metrikaStats]);

  // Filter daily data by applied range
  const filteredData = useMemo(
    () => dailyData.filter(d => d.date >= appliedRange.from && d.date <= appliedRange.to),
    [dailyData, appliedRange],
  );

  const filteredCompData = useMemo(
    () => dailyData.filter(d => d.date >= appliedCompRange.from && d.date <= appliedCompRange.to),
    [dailyData, appliedCompRange],
  );

  // ── Channel-filtered ratio ──
  const channelVisitRatio = useMemo(() => {
    if (channel === "all" || !metrikaStats?.traffic_sources) return 1;
    const sources = metrikaStats.traffic_sources as { source: string; visits: number }[];
    const totalAll = sources.reduce((s, src) => s + (src.visits || 0), 0);
    if (totalAll === 0) return 1;
    const channelVisits = sources
      .filter(src => SOURCE_TO_CHANNEL[src.source] === channel)
      .reduce((s, src) => s + (src.visits || 0), 0);
    return channelVisits / totalAll;
  }, [metrikaStats, channel]);

  // Merged chart data for comparison (with channel filter applied)
  const trafficChart = useMemo(() => {
    const applyRatio = (v: number) => Math.round(v * channelVisitRatio);
    if (!showComparison) {
      if (filteredData.length > 0) return filteredData.map(d => ({ date: d.dateStr, visits: applyRatio(d.visits) }));
      return metrikaHistory.map(h => ({
        date: format(parseISO(h.date_from), "dd MMM", { locale: ru }),
        visits: applyRatio(h.total_visits),
      }));
    }
    const maxLen = Math.max(filteredData.length, filteredCompData.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      result.push({
        date: filteredData[i]?.dateStr || `${i + 1}`,
        visits: applyRatio(filteredData[i]?.visits || 0),
        previous: applyRatio(filteredCompData[i]?.visits || 0),
      });
    }
    return result;
  }, [filteredData, filteredCompData, metrikaHistory, showComparison, channelVisitRatio]);

  const totalVisits = Math.round(
    (filteredData.length > 0
      ? filteredData.reduce((s, d) => s + d.visits, 0)
      : (metrikaStats?.total_visits || 0)) * channelVisitRatio
  );
  const totalUsers = Math.round((metrikaStats?.total_users || 0) * channelVisitRatio);
  const bounceRate = metrikaStats ? Number(metrikaStats.bounce_rate) : 0;
  const avgDuration = metrikaStats ? metrikaStats.avg_duration_seconds : 0;
  const pageDepth = metrikaStats ? Number(metrikaStats.page_depth) : 0;

  const compTotalVisits = Math.round(filteredCompData.reduce((s, d) => s + d.visits, 0) * channelVisitRatio);
  const visitsChange = showComparison && compTotalVisits > 0
    ? Math.round(((totalVisits - compTotalVisits) / compTotalVisits) * 1000) / 10
    : 0;

  const avgPosition = useMemo(() => {
    if (keywords.length === 0) return 0;
    return keywords.reduce((acc, k) => acc + k.position, 0) / keywords.length;
  }, [keywords]);

  // ── Filter handlers ──
  const handlePreset = useCallback((key: string, days: number) => {
    const now = new Date();
    let newRange: DateRange;
    if (key === "thisMonth") {
      newRange = { from: startOfMonth(now), to: now };
    } else {
      newRange = { from: subDays(now, days), to: now };
    }
    setActivePreset(key);
    setRange(newRange);
    setAppliedRange(newRange);
    const compDays = differenceInDays(newRange.to, newRange.from);
    const newComp = { from: subDays(newRange.from, compDays + 1), to: subDays(newRange.from, 1) };
    setCompRange(newComp);
    setAppliedCompRange(newComp);
  }, []);

  const handleApply = useCallback(() => {
    setAppliedRange({ ...range });
    if (showComparison) setAppliedCompRange({ ...compRange });
    setActivePreset("");
  }, [range, compRange, showComparison]);

  const handleToggleComparison = useCallback((on: boolean) => {
    setShowComparison(on);
    if (on) {
      const days = differenceInDays(range.to, range.from);
      const nr = { from: subDays(range.from, days + 1), to: subDays(range.from, 1) };
      setCompRange(nr);
      setAppliedCompRange(nr);
    }
  }, [range]);

  const handleCompPreset = useCallback((type: "previous" | "lastYear") => {
    const days = differenceInDays(range.to, range.from);
    let nr: DateRange;
    if (type === "previous") {
      nr = { from: subDays(range.from, days + 1), to: subDays(range.from, 1) };
    } else {
      nr = { from: subYears(range.from, 1), to: subYears(range.to, 1) };
    }
    setCompRange(nr);
    setAppliedCompRange(nr);
  }, [range]);

  const isLoading = metrikaLoading || tvLoading;
  const hasMetrika = !!metrikaStats;
  const hasTopvisor = keywords.length > 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ═══════════ FILTER BAR ═══════════ */}
      <Card className="border-border bg-card">
        <div className="p-3 space-y-2.5">
          {/* Row 1: Presets + Date pickers + Channel */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Presets */}
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                variant={activePreset === p.key ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={() => handlePreset(p.key, p.days)}
              >
                {p.label}
              </Button>
            ))}

            <div className="w-px h-5 bg-border mx-1" />

            {/* Period A */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 px-2.5">
                  <CalendarDays className="h-3 w-3" />
                  {format(range.from, "dd.MM.yy")} — {format(range.to, "dd.MM.yy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: range.from, to: range.to }}
                  onSelect={(r: any) => {
                    if (r?.from && r?.to) { setRange({ from: r.from, to: r.to }); setActivePreset(""); }
                    else if (r?.from) { setRange({ from: r.from, to: r.from }); setActivePreset(""); }
                  }}
                  numberOfMonths={1} locale={ru} weekStartsOn={1}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* Comparison toggle */}
            <div className="flex items-center gap-1.5">
              <Switch
                checked={showComparison}
                onCheckedChange={handleToggleComparison}
                className="scale-75"
              />
              <Label
                className="text-[11px] text-muted-foreground cursor-pointer flex items-center gap-1"
                onClick={() => handleToggleComparison(!showComparison)}
              >
                <ArrowRightLeft className="h-3 w-3" />
                Сравнение
              </Label>
            </div>

            {/* Period B (visible when comparison on) */}
            {showComparison && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 px-2.5 border-dashed">
                    <CalendarDays className="h-3 w-3" />
                    {format(compRange.from, "dd.MM.yy")} — {format(compRange.to, "dd.MM.yy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: compRange.from, to: compRange.to }}
                    onSelect={(r: any) => {
                      if (r?.from && r?.to) setCompRange({ from: r.from, to: r.to });
                      else if (r?.from) setCompRange({ from: r.from, to: r.from });
                    }}
                    numberOfMonths={1} locale={ru} weekStartsOn={1}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}

            <div className="w-px h-5 bg-border mx-1" />

            {/* Traffic channel */}
            <Select value={channel} onValueChange={(v) => setChannel(v as TrafficChannel)}>
              <SelectTrigger className="w-[170px] h-7 text-[11px]">
                <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CHANNEL_LABELS) as TrafficChannel[]).map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {CHANNEL_LABELS[ch]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Apply */}
            <Button size="sm" className="h-7 text-[11px] px-3 ml-auto" onClick={handleApply}>
              Применить
            </Button>
          </div>

          {/* Row 2: Comparison presets (when active) */}
          {showComparison && (
            <div className="flex items-center gap-2 pt-1.5 border-t border-border/50">
              <span className="text-[11px] text-muted-foreground">Пресеты:</span>
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleCompPreset("previous")}>
                Предыдущий период
              </Button>
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleCompPreset("lastYear")}>
                Год к году
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* AI Monthly Report */}
      <AiMonthlyReport
        projectId={projectId}
        metrikaStats={metrikaStats || null}
        keywords={keywords}
        goals={goalsData}
      />

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
              {showComparison && visitsChange !== 0 && (
                <span className={cn(
                  "text-[10px] font-semibold",
                  visitsChange >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {visitsChange >= 0 ? "+" : ""}{visitsChange}%
                </span>
              )}
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

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Traffic chart */}
        <Card className="lg:col-span-3 bg-card rounded-lg shadow-sm border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              {channel === "all" ? "Органический трафик" : CHANNEL_LABELS[channel]}
            </h3>
            {showComparison && (
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-primary rounded" /> Период А</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[hsl(var(--chart-3))] rounded" style={{ borderBottom: "1px dashed" }} /> Период Б</span>
              </div>
            )}
          </div>
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
                  <linearGradient id="trafficGradA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="trafficGradB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip content={<DualTooltip showComparison={showComparison} />} />
                <Area
                  type="monotone"
                  dataKey="visits"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#trafficGradA)"
                  name="Визиты"
                />
                {showComparison && (
                  <Area
                    type="monotone"
                    dataKey="previous"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    fill="url(#trafficGradB)"
                    name="Период Б"
                  />
                )}
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
                  const isPositive = kw.change > 0;
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
