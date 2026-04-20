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

const CHANNEL_COLORS: Record<TrafficChannel, string> = {
  all: "hsl(var(--primary))",
  organic: "#8B5CF6",
  direct: "#10B981",
  referral: "#0EA5E9",
  social: "#D946EF",
  ad: "#F59E0B",
};

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

  // ── Data queries — fetch ALL metrika snapshots and merge ──
  const { data: allMetrikaStats = [], isLoading: metrikaLoading } = useQuery({
    queryKey: ["metrika-stats-analytics", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrika_stats")
        .select("*")
        .eq("project_id", projectId)
        .order("date_from", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  // Merge all snapshots into a single "latest" object with combined daily data
  const metrikaStats = useMemo(() => {
    if (allMetrikaStats.length === 0) return null;
    // Use the most recent snapshot as the base for KPI values
    const latest = allMetrikaStats[allMetrikaStats.length - 1];
    // Merge all visits_by_day across snapshots using actual dates
    const mergedDays = new Map<string, number>();
    for (const snap of allMetrikaStats) {
      const days = snap.visits_by_day as any[];
      if (!Array.isArray(days)) continue;
      const dateFrom = parseISO(snap.date_from);
      days.forEach((d, i) => {
        let dateKey: string;
        if (d.date) {
          dateKey = typeof d.date === "string" ? d.date : format(new Date(d.date), "yyyy-MM-dd");
        } else {
          const dt = new Date(dateFrom);
          dt.setDate(dt.getDate() + (d.day ? d.day - 1 : i));
          dateKey = format(dt, "yyyy-MM-dd");
        }
        // Later snapshots overwrite earlier ones for the same date
        mergedDays.set(dateKey, d.visits || 0);
      });
    }
    // Convert merged map to sorted array
    const sortedDays = Array.from(mergedDays.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, visits]) => ({ date, visits }));

    return {
      ...latest,
      visits_by_day: sortedDays,
      date_from: sortedDays[0]?.date || latest.date_from,
      date_to: sortedDays[sortedDays.length - 1]?.date || latest.date_to,
    };
  }, [allMetrikaStats]);

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
    queryKey: ["tv-positions-analytics", projectId, project?.topvisor_project_id, project?.topvisor_api_key],
    queryFn: async () => {
      if (!project?.topvisor_api_key || !project?.topvisor_project_id || !project?.topvisor_user_id) {
        console.warn("[Topvisor] Missing config:", { 
          api_key: !!project?.topvisor_api_key, 
          project_id: project?.topvisor_project_id,
          user_id: project?.topvisor_user_id 
        });
        return null;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const now = new Date();
      const date2 = format(now, "yyyy-MM-dd");
      const date1 = format(subMonths(now, 1), "yyyy-MM-dd");

      console.log("[Topvisor] Fetching rankings history:", { 
        project_id: project.topvisor_project_id, 
        user_id: project.topvisor_user_id, 
        date_from: date1, date_to: date2 
      });

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
            action: "get-rankings-history",
            api_key: project.topvisor_api_key,
            user_id: project.topvisor_user_id,
            payload: {
              project_id: project.topvisor_project_id,
              date_from: date1,
              date_to: date2,
              show_headers: 1,
            },
          }),
        }
      );
      const data = await r.json();
      if (!r.ok) {
        console.error("[Topvisor] API error:", r.status, data);
        return null;
      }
      console.log("[Topvisor] Got data, keywords count:", data?.result?.keywords?.length || (Array.isArray(data?.result) ? data.result.length : 0));
      return data;
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

  // ── Fetch LIVE traffic data from Metrika API ──
  const { data: liveMetrikaData } = useQuery({
    queryKey: ["metrika-live-stats", projectId, dateFrom30, dateTo30],
    queryFn: async () => {
      if (!integration?.access_token || !integration?.counter_id) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-stats`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: integration.access_token,
            counter_id: integration.counter_id,
            date1: dateFrom30,
            date2: dateTo30,
          }),
        }
      );
      if (!resp.ok) return null;
      return resp.json();
    },
    enabled: !!integration?.access_token && !!integration?.counter_id,
    staleTime: 5 * 60_000,
  });

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

  // Search/channel traffic goals for chart — reacts to channel filter and applied date range
  const channelGoalsDateFrom = fmtDate(appliedRange.from, "yyyy-MM-dd");
  const channelGoalsDateTo = fmtDate(appliedRange.to, "yyyy-MM-dd");
  const channelTrafficSource = channel === "all" ? undefined : channel;

  const { data: searchGoalsData = [], isLoading: searchGoalsLoading } = useQuery({
    queryKey: ["metrika-goals-channel", projectId, channelGoalsDateFrom, channelGoalsDateTo, channel],
    queryFn: async () => {
      if (!integration?.access_token || !integration?.counter_id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const body: any = {
        access_token: integration.access_token, counter_id: integration.counter_id,
        date1: channelGoalsDateFrom, date2: channelGoalsDateTo,
      };
      if (channelTrafficSource) body.traffic_source = channelTrafficSource;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-goals`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await resp.json();
      return (data.goals || []) as { id: number; name: string; reaches: number; conversionRate: number; change: number; daily?: number[] }[];
    },
    enabled: !!integration?.access_token && !!integration?.counter_id,
    staleTime: 5 * 60_000,
  });

  // Build chart data for search goals
  const searchGoalsChartData = useMemo(() => {
    if (!searchGoalsData.length) return [];
    const maxLen = Math.max(...searchGoalsData.map(g => g.daily?.length || 0));
    const result = [];
    const startDate = appliedRange.from;
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
  }, [searchGoalsData, appliedRange]);

  // ── Fetch top organic search phrases from Metrika ──
  const { data: searchPhrasesRaw = [], isLoading: searchPhrasesLoading } = useQuery({
    queryKey: ["metrika-search-phrases", projectId, dateFrom30, dateTo30],
    queryFn: async () => {
      if (!integration?.access_token || !integration?.counter_id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-search-phrases`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: integration.access_token,
            counter_id: integration.counter_id,
            date1: dateFrom30,
            date2: dateTo30,
          }),
        }
      );
      if (!resp.ok) return [];
      const json = await resp.json();
      // phrases is the raw Metrika API response: { data: [{ dimensions: [{name},...], metrics: [visits, users, bounceRate, ...] }] }
      const rawPhrases = json.phrases?.data || [];
      // Aggregate by phrase (dimension[1]), skip rows where phrase is empty
      const phraseMap = new Map<string, { visits: number; users: number; bounceRateSum: number; count: number }>();
      for (const row of rawPhrases) {
        const phrase = row.dimensions?.[1]?.name || "";
        if (!phrase || phrase === "(not set)") continue;
        const existing = phraseMap.get(phrase) || { visits: 0, users: 0, bounceRateSum: 0, count: 0 };
        existing.visits += row.metrics?.[0] || 0;
        existing.users += row.metrics?.[1] || 0;
        existing.bounceRateSum += row.metrics?.[2] || 0;
        existing.count += 1;
        phraseMap.set(phrase, existing);
      }
      return Array.from(phraseMap.entries())
        .map(([phrase, d]) => ({
          phrase,
          visits: Math.round(d.visits),
          users: Math.round(d.users),
          bounceRate: d.count > 0 ? Math.round(d.bounceRateSum / d.count * 10) / 10 : 0,
        }))
        .sort((a, b) => b.visits - a.visits);
    },
    enabled: !!integration?.access_token && !!integration?.counter_id,
    staleTime: 30 * 60_000,
  });

  const topSearchPhrases = useMemo(() => {
    const raw = Array.isArray(searchPhrasesRaw) ? searchPhrasesRaw : [];
    return raw.slice(0, 15);
  }, [searchPhrasesRaw]);

  const GOAL_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  // ── Keywords parsing (with per-date positions for table) ──
  const { keywords, keywordDates } = useMemo(() => {
    if (!topvisorData?.result) return { keywords: [], keywordDates: [] as string[] };
    const result = topvisorData.result;
    const rows = Array.isArray(result) ? result : result?.keywords || [];
    const allDatesSet = new Set<string>();

    const parsed = rows
      .filter((row: any) => row?.name)
      .map((row: any) => {
        const positionsObj = row.positionsData || row.positions || row.position || {};
        const entries = Object.entries(positionsObj);
        const datePositions: Record<string, number> = {};

        for (const [key, val] of entries) {
          if (typeof val === "object" && val !== null && !Array.isArray(val)) {
            const valObj = val as Record<string, any>;
            if ("position" in valObj) {
              const datePart = key.split(":")[0];
              const posVal = Number(valObj.position);
              if (posVal > 0) {
                datePositions[datePart] = posVal;
                allDatesSet.add(datePart);
              }
            } else {
              for (const [dateKey, dateVal] of Object.entries(valObj)) {
                const posVal = typeof dateVal === "object" ? Number((dateVal as any)?.position) : Number(dateVal);
                if (posVal > 0) {
                  datePositions[dateKey] = posVal;
                  allDatesSet.add(dateKey);
                }
              }
            }
          }
        }

        const sortedDates = Object.keys(datePositions).sort();
        const latestPos = sortedDates.length > 0 ? datePositions[sortedDates[sortedDates.length - 1]] : 0;
        const prevPos = sortedDates.length > 1 ? datePositions[sortedDates[sortedDates.length - 2]] : null;
        const change = latestPos > 0 && prevPos && prevPos > 0 ? prevPos - latestPos : 0;

        return {
          keyword: row.name as string,
          position: latestPos,
          change,
          frequency: row.target?.split?.(",")?.[0] || "--",
          datePositions,
        };
      })
      .filter((k: any) => k.position > 0)
      .sort((a: any, b: any) => a.position - b.position);

    const keywordDates = Array.from(allDatesSet).sort().reverse(); // newest first
    return { keywords: parsed, keywordDates };
  }, [topvisorData]);

  const topProjectPositions = useMemo(() => keywords.slice(0, 50), [keywords]);

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

  // ── Daily traffic data — prefer live API data, fallback to cached ──
  const dailyData = useMemo(() => {
    // Try live Metrika API data first
    if (liveMetrikaData?.timeSeries?.data?.[0]?.metrics?.[0]) {
      const timeLabels = liveMetrikaData.timeSeries.time_intervals || [];
      const visits = liveMetrikaData.timeSeries.data[0].metrics[0];
      return visits.map((v: number, i: number) => {
        const dateStr = timeLabels[i]?.[0];
        const date = dateStr ? new Date(dateStr) : new Date();
        return { date, dateStr: format(date, "dd.MM", { locale: ru }), visits: Math.round(v) };
      });
    }
    // Fallback to merged cached data
    if (!metrikaStats?.visits_by_day) return [];
    const raw = metrikaStats.visits_by_day as any[];
    return raw
      .filter(d => d.date)
      .map(d => {
        const date = new Date(d.date);
        return { date, dateStr: format(date, "dd.MM", { locale: ru }), visits: d.visits || 0 };
      });
  }, [liveMetrikaData, metrikaStats]);

  // Filter daily data by applied range — only show days that have real data
  const filteredData = useMemo(() => {
    if (dailyData.length === 0) return [];
    const lastDataDate = dailyData[dailyData.length - 1].date;
    const rangeEnd = appliedRange.to > lastDataDate ? lastDataDate : appliedRange.to;
    const days = differenceInDays(rangeEnd, appliedRange.from);
    if (days < 0) return [];
    const dailyMap = new Map(dailyData.map(d => [format(d.date, "yyyy-MM-dd"), d as { date: Date; dateStr: string; visits: number }]));
    const result = [];
    for (let i = 0; i <= days; i++) {
      const date = new Date(appliedRange.from);
      date.setDate(date.getDate() + i);
      const key = format(date, "yyyy-MM-dd");
      const existing = dailyMap.get(key);
      result.push({
        date,
        dateStr: format(date, "dd.MM", { locale: ru }),
        visits: (existing as any)?.visits || 0,
      });
    }
    return result;
  }, [dailyData, appliedRange]);

  const filteredCompData = useMemo(() => {
    if (dailyData.length === 0) return [];
    const lastDataDate = dailyData[dailyData.length - 1].date;
    const rangeEnd = appliedCompRange.to > lastDataDate ? lastDataDate : appliedCompRange.to;
    const days = differenceInDays(rangeEnd, appliedCompRange.from);
    if (days < 0) return [];
    const dailyMap = new Map(dailyData.map(d => [format(d.date, "yyyy-MM-dd"), d as { date: Date; dateStr: string; visits: number }]));
    const result = [];
    for (let i = 0; i <= days; i++) {
      const date = new Date(appliedCompRange.from);
      date.setDate(date.getDate() + i);
      const key = format(date, "yyyy-MM-dd");
      const existing = dailyMap.get(key);
      result.push({
        date,
        dateStr: format(date, "dd.MM", { locale: ru }),
        visits: (existing as any)?.visits || 0,
      });
    }
    return result;
  }, [dailyData, appliedCompRange]);

  // ── Channel ratios for splitting ──
  const channelRatios = useMemo(() => {
    if (!metrikaStats?.traffic_sources) return {} as Record<string, number>;
    const sources = metrikaStats.traffic_sources as { source: string; visits: number }[];
    const totalAll = sources.reduce((s, src) => s + (src.visits || 0), 0);
    if (totalAll === 0) return {} as Record<string, number>;
    const ratios: Record<string, number> = { organic: 0, direct: 0, referral: 0, social: 0, ad: 0 };
    for (const src of sources) {
      const ch = SOURCE_TO_CHANNEL[src.source];
      if (ch && ch !== "all") ratios[ch] = (ratios[ch] || 0) + (src.visits || 0);
    }
    for (const k of Object.keys(ratios)) ratios[k] = ratios[k] / totalAll;
    return ratios;
  }, [metrikaStats]);

  // ── Channel-filtered ratio ──
  const channelVisitRatio = useMemo(() => {
    if (channel === "all" || !metrikaStats?.traffic_sources) return 1;
    return channelRatios[channel] || 0;
  }, [metrikaStats, channel, channelRatios]);

  const ALL_CHANNELS = ["organic", "direct", "social", "referral", "ad"] as const;

  // Merged chart data for comparison (with channel filter applied)
  const trafficChart = useMemo(() => {
    const applyRatio = (v: number) => Math.round(v * channelVisitRatio);
    const buildRow = (dateStr: string, visits: number) => {
      if (channel === "all") {
        const row: any = { date: dateStr };
        for (const ch of ALL_CHANNELS) {
          row[ch] = Math.round(visits * (channelRatios[ch] || 0));
        }
        return row;
      }
      return { date: dateStr, visits: applyRatio(visits) };
    };

    if (!showComparison) {
      if (filteredData.length > 0) return filteredData.map(d => buildRow(d.dateStr, d.visits));
      return metrikaHistory.map(h => buildRow(format(parseISO(h.date_from), "dd MMM", { locale: ru }), h.total_visits));
    }
    const maxLen = Math.max(filteredData.length, filteredCompData.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      const row = buildRow(filteredData[i]?.dateStr || `${i + 1}`, filteredData[i]?.visits || 0);
      row.previous = applyRatio(filteredCompData[i]?.visits || 0);
      result.push(row);
    }
    return result;
  }, [filteredData, filteredCompData, metrikaHistory, showComparison, channelVisitRatio, channel, channelRatios]);

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
              {channel === "all" ? "Все визиты" : CHANNEL_LABELS[channel]}
            </h3>
            {channel === "all" && !showComparison && (
              <div className="flex flex-wrap items-center gap-3 text-[10px]">
                {ALL_CHANNELS.map(ch => (
                  <span key={ch} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHANNEL_COLORS[ch] }} />
                    {CHANNEL_LABELS[ch]}
                  </span>
                ))}
              </div>
            )}
            {channel !== "all" && showComparison && (
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 rounded" style={{ background: CHANNEL_COLORS[channel] }} /> Период А</span>
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
          ) : channel === "all" && !showComparison ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trafficChart}>
                <defs>
                  {ALL_CHANNELS.map(ch => (
                    <linearGradient key={ch} id={`grad-ch-${ch}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHANNEL_COLORS[ch]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHANNEL_COLORS[ch]} stopOpacity={0} />
                    </linearGradient>
                  ))}
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
                  formatter={(value: number, name: string) => [value.toLocaleString("ru-RU"), CHANNEL_LABELS[name as TrafficChannel] || name]}
                />
                {ALL_CHANNELS.map(ch => (
                  <Area
                    key={ch}
                    type="monotone"
                    dataKey={ch}
                    stackId="channels"
                    stroke={CHANNEL_COLORS[ch]}
                    strokeWidth={1.5}
                    fill={`url(#grad-ch-${ch})`}
                    name={ch}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trafficChart}>
                <defs>
                  <linearGradient id="trafficGradA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHANNEL_COLORS[channel]} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={CHANNEL_COLORS[channel]} stopOpacity={0} />
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
                  stroke={CHANNEL_COLORS[channel]}
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

        {/* Top organic search queries */}
        <Card className="lg:col-span-2 bg-card rounded-lg shadow-sm border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Топ поисковые запросы</h3>
          {!integration?.access_token ? (
            <div className="py-16 text-center">
              <Search className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
              <p className="text-[13px] text-muted-foreground">Подключите Яндекс.Метрику на вкладке «Интеграции»</p>
            </div>
          ) : searchPhrasesLoading ? (
            <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : topSearchPhrases.length === 0 ? (
            <div className="py-16 text-center">
              <Search className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
              <p className="text-[13px] text-muted-foreground">Нет данных по поисковым запросам</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {topSearchPhrases.map((phrase, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                    <span className="text-xs text-foreground truncate">{phrase.phrase}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-medium tabular-nums">{phrase.visits.toLocaleString("ru-RU")}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {phrase.bounceRate.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Search Traffic Goals Chart */}
      {integration?.access_token && (
        <Card className="bg-card rounded-lg shadow-sm border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Конверсии по целям ({channel === "all" ? "весь трафик" : CHANNEL_LABELS[channel].toLowerCase()})
              </h3>
            </div>
            {searchGoalsData.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Всего: <strong className="text-foreground">{searchGoalsData.reduce((s, g) => s + g.reaches, 0)}</strong></span>
              </div>
            )}
          </div>

          {searchGoalsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : searchGoalsData.length === 0 ? (
            <div className="py-12 text-center">
              <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
              <p className="text-[13px] text-muted-foreground">Нет данных о конверсиях по поисковому трафику</p>
            </div>
          ) : (
            <>
              {/* KPI row for search goals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {searchGoalsData.slice(0, 4).map((g, i) => (
                  <div key={g.id} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <p className="text-[10px] text-muted-foreground truncate mb-1">{g.name}</p>
                    <p className="text-lg font-bold text-foreground tabular-nums">{g.reaches}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">CR</span>
                      <span className="text-[11px] font-semibold text-foreground">{g.conversionRate}%</span>
                      {g.change !== 0 && (
                        <span className={cn(
                          "text-[10px] font-semibold ml-1",
                          g.change > 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                          {g.change > 0 ? "+" : ""}{Math.round(g.change)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Stacked area chart */}
              {searchGoalsChartData.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={searchGoalsChartData}>
                    <defs>
                      {searchGoalsData.map((g, i) => (
                        <linearGradient key={g.id} id={`goalGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GOAL_COLORS[i % GOAL_COLORS.length]} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={GOAL_COLORS[i % GOAL_COLORS.length]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {searchGoalsData.map((g, i) => (
                      <Area
                        key={g.id}
                        type="monotone"
                        dataKey={g.name}
                        stackId="goals"
                        stroke={GOAL_COLORS[i % GOAL_COLORS.length]}
                        strokeWidth={1.5}
                        fill={`url(#goalGrad${i})`}
                        name={g.name}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </Card>
      )}
      <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Запросы</h3>
          <Badge variant="secondary" className="text-[10px] h-5">{keywords.length}</Badge>
        </div>
        {!project?.topvisor_api_key || !project?.topvisor_project_id || !project?.topvisor_user_id ? (
          <div className="py-16 text-center">
            <Search className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-[13px] text-muted-foreground mb-1">Topvisor не подключён</p>
            <p className="text-[11px] text-muted-foreground/70">
              Заполните API-ключ, User ID и Project ID Topvisor в настройках проекта
            </p>
          </div>
        ) : tvLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : topProjectPositions.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-[13px] text-muted-foreground mb-1">Нет данных по позициям проекта</p>
            <p className="text-[11px] text-muted-foreground/70">
              Проверьте, что в проекте Topvisor (ID: {project.topvisor_project_id}) добавлены ключевые слова и сделан хотя бы один съём позиций
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-8">#</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Запросы ({keywords.length})</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-20">Частота</th>
                  {keywordDates.slice(0, 5).map(date => (
                    <th key={date} className="text-center px-3 py-2.5 font-medium text-muted-foreground w-24 whitespace-nowrap">
                      {format(new Date(date), "dd.MM.yyyy")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {topProjectPositions.map((item, i) => {
                  const dates = keywordDates.slice(0, 5);
                  return (
                    <tr key={`${item.keyword}-${i}`} className={cn("hover:bg-muted/30 transition-colors", i % 2 === 1 && "bg-muted/10")}>
                      <td className="px-4 py-2 text-muted-foreground text-[11px]">{i + 1}</td>
                      <td className="px-4 py-2 text-foreground">{item.keyword}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground tabular-nums">{item.frequency}</td>
                      {dates.map((date, di) => {
                        const pos = item.datePositions[date];
                        const prevDate = dates[di + 1];
                        const prevPos = prevDate ? item.datePositions[prevDate] : undefined;
                        let bgClass = "";
                        if (pos) {
                          if (pos <= 3) bgClass = "bg-emerald-500/20 text-emerald-400";
                          else if (pos <= 10) bgClass = "bg-emerald-500/10 text-emerald-300";
                          else if (pos <= 30) bgClass = "bg-amber-500/10 text-amber-400";
                          else bgClass = "bg-red-500/10 text-red-400";
                        }
                        const delta = pos && prevPos ? prevPos - pos : null;
                        return (
                          <td key={date} className={cn("px-3 py-2 text-center tabular-nums", bgClass)}>
                            {pos ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-semibold">{pos}</span>
                                {delta !== null && delta !== 0 && (
                                  <span className={cn("text-[10px]", delta > 0 ? "text-emerald-500" : "text-red-500")}>
                                    {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      })}
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
