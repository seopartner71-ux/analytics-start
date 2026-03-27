import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronRight, ChevronDown, Search, Globe, ArrowUpDown, TrendingUp, TrendingDown, Loader2, CalendarIcon, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import { format, subDays, subYears, differenceInDays } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SearchSystemsTabProps {
  projectId: string;
}

/* ── Brand icons ── */
const YandexIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none">
    <rect width="24" height="24" rx="4" fill="#FC3F1D" />
    <path d="M13.64 18H15.6V6H13.17C10.47 6 9.04 7.47 9.04 9.63C9.04 11.45 9.93 12.47 11.52 13.56L9 18H11.13L13.93 13.11L12.74 12.31C11.39 11.39 10.73 10.68 10.73 9.5C10.73 8.26 11.56 7.56 13.17 7.56H13.64V18Z" fill="white" />
  </svg>
);
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09a6.96 6.96 0 0 1 0-4.17V7.07H2.18a11.02 11.02 0 0 0 0 9.86l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

/* ── Colors ── */
const YANDEX_COLOR = "hsl(15 95% 55%)";
const GOOGLE_COLOR = "hsl(217 91% 60%)";
const OTHER_COLOR = "hsl(var(--muted-foreground))";
const ENGINE_COLORS = [YANDEX_COLOR, GOOGLE_COLOR, OTHER_COLOR];
const ENGINE_KEYS = ["yandex", "google", "other"] as const;

/* ── Data types ── */
interface Phrase {
  name: string;
  visits: number;
  visitors: number;
  bounce: number;
  depth: number;
  duration: number;
  prevVisits?: number;
  prevBounce?: number;
  prevDepth?: number;
  prevDuration?: number;
}
interface SubChannel {
  name: string;
  visits: number;
  visitors: number;
  bounce: number;
  depth: number;
  duration: number;
  prevVisits?: number;
  prevBounce?: number;
  prevDepth?: number;
  prevDuration?: number;
  phrases: Phrase[];
}
interface EngineData {
  engine: string;
  key: string;
  icon: React.ReactNode;
  visits: number;
  visitors: number;
  bounce: number;
  depth: number;
  duration: number;
  prevVisits?: number;
  prevBounce?: number;
  prevDepth?: number;
  prevDuration?: number;
  subChannels: SubChannel[];
}

interface TrendPoint {
  date: string;
  yandex: number;
  google: number;
  other: number;
  yandexPrev?: number;
  googlePrev?: number;
  otherPrev?: number;
}

/* ── Parse real Metrika API response into our data structures ── */
function parseMetrikaData(raw: any): { engines: EngineData[]; trend: TrendPoint[] } {
  const engineMap = new Map<string, { phrases: Phrase[]; visits: number; visitors: number; bounce: number; depth: number; duration: number }>();

  // Parse phrases grouped by engine
  const rows = raw?.phrases?.data || [];
  for (const row of rows) {
    const dims = row.dimensions || [];
    const mets = row.metrics || [];
    const engineName = dims[0]?.name || "Другие";
    const phrase = dims[1]?.name || "(not set)";

    if (!engineMap.has(engineName)) {
      engineMap.set(engineName, { phrases: [], visits: 0, visitors: 0, bounce: 0, depth: 0, duration: 0 });
    }
    const entry = engineMap.get(engineName)!;
    entry.phrases.push({
      name: phrase,
      visits: Math.round(mets[0] || 0),
      visitors: Math.round(mets[1] || 0),
      bounce: Math.round((mets[2] || 0) * 10) / 10,
      depth: Math.round((mets[3] || 0) * 10) / 10,
      duration: Math.round(mets[4] || 0),
    });
  }

  // Engine-level totals from API
  const engineRows = raw?.engines?.data || [];
  for (const row of engineRows) {
    const name = row.dimensions?.[0]?.name || "Другие";
    if (engineMap.has(name)) {
      const e = engineMap.get(name)!;
      e.visits = Math.round(row.metrics?.[0] || 0);
      e.visitors = Math.round(row.metrics?.[1] || 0);
      e.bounce = Math.round((row.metrics?.[2] || 0) * 10) / 10;
      e.depth = Math.round((row.metrics?.[3] || 0) * 10) / 10;
      e.duration = Math.round(row.metrics?.[4] || 0);
    }
  }

  const classifyEngine = (name: string): { key: string; label: string; icon: React.ReactNode } => {
    const lower = name.toLowerCase();
    if (lower.includes("yandex") || lower.includes("яндекс"))
      return { key: "yandex", label: name, icon: <YandexIcon /> };
    if (lower.includes("google"))
      return { key: "google", label: name, icon: <GoogleIcon /> };
    return { key: "other", label: name, icon: <Globe className="h-4 w-4 text-muted-foreground" /> };
  };

  // Group by our 3 buckets: yandex, google, other
  const buckets = new Map<string, EngineData>();
  for (const [engineName, data] of engineMap.entries()) {
    const cls = classifyEngine(engineName);
    if (!buckets.has(cls.key)) {
      buckets.set(cls.key, {
        engine: cls.key === "yandex" ? "Яндекс" : cls.key === "google" ? "Google" : "Другие",
        key: cls.key,
        icon: cls.icon,
        visits: 0, visitors: 0, bounce: 0, depth: 0, duration: 0,
        subChannels: [],
      });
    }
    const bucket = buckets.get(cls.key)!;
    bucket.subChannels.push({
      name: engineName,
      visits: data.visits || data.phrases.reduce((s, p) => s + p.visits, 0),
      visitors: data.visitors || data.phrases.reduce((s, p) => s + p.visitors, 0),
      bounce: data.bounce || (data.phrases.length ? +(data.phrases.reduce((s, p) => s + p.bounce, 0) / data.phrases.length).toFixed(1) : 0),
      depth: data.depth || (data.phrases.length ? +(data.phrases.reduce((s, p) => s + p.depth, 0) / data.phrases.length).toFixed(1) : 0),
      duration: data.duration || (data.phrases.length ? Math.round(data.phrases.reduce((s, p) => s + p.duration, 0) / data.phrases.length) : 0),
      phrases: data.phrases,
    });
  }

  // Aggregate bucket totals
  const engines: EngineData[] = [];
  for (const [, bucket] of buckets) {
    bucket.visits = bucket.subChannels.reduce((s, c) => s + c.visits, 0);
    bucket.visitors = bucket.subChannels.reduce((s, c) => s + c.visitors, 0);
    bucket.bounce = bucket.subChannels.length ? +(bucket.subChannels.reduce((s, c) => s + c.bounce, 0) / bucket.subChannels.length).toFixed(1) : 0;
    bucket.depth = bucket.subChannels.length ? +(bucket.subChannels.reduce((s, c) => s + c.depth, 0) / bucket.subChannels.length).toFixed(1) : 0;
    bucket.duration = bucket.subChannels.length ? Math.round(bucket.subChannels.reduce((s, c) => s + c.duration, 0) / bucket.subChannels.length) : 0;
    engines.push(bucket);
  }
  // Sort by visits desc
  engines.sort((a, b) => b.visits - a.visits);

  // Ensure all 3 buckets exist
  for (const key of ENGINE_KEYS) {
    if (!engines.find((e) => e.key === key)) {
      engines.push({
        engine: key === "yandex" ? "Яндекс" : key === "google" ? "Google" : "Другие",
        key, icon: key === "yandex" ? <YandexIcon /> : key === "google" ? <GoogleIcon /> : <Globe className="h-4 w-4 text-muted-foreground" />,
        visits: 0, visitors: 0, bounce: 0, depth: 0, duration: 0, subChannels: [],
      });
    }
  }

  // Parse trend
  const trendRows = raw?.trend?.data || [];
  const timeLabels = raw?.trend?.time_intervals || [];
  const trendMap = new Map<string, Partial<TrendPoint>>();

  for (const row of trendRows) {
    const engineName = row.dimensions?.[0]?.name || "";
    const cls = classifyEngine(engineName);
    const dailyVisits: number[] = row.metrics?.[0] || [];
    dailyVisits.forEach((v: number, i: number) => {
      const dateLabel = timeLabels[i] ? format(new Date(timeLabels[i][0]), "dd.MM") : String(i);
      if (!trendMap.has(dateLabel)) trendMap.set(dateLabel, { date: dateLabel, yandex: 0, google: 0, other: 0 });
      const pt = trendMap.get(dateLabel)!;
      (pt as any)[cls.key] = ((pt as any)[cls.key] || 0) + Math.round(v);
    });
  }

  const trend: TrendPoint[] = Array.from(trendMap.values()).map((p) => ({
    date: p.date!, yandex: p.yandex || 0, google: p.google || 0, other: p.other || 0,
  }));

  return { engines, trend };
}

/* ── Demo data fallback ── */
function buildDemoData(): { engines: EngineData[]; trend: TrendPoint[] } {
  const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  const mkPhrases = (prefix: string, n: number): Phrase[] =>
    Array.from({ length: n }, (_, i) => ({
      name: `${prefix} запрос ${i + 1}`,
      visits: rnd(10, 800), visitors: rnd(8, 600), bounce: rnd(15, 65),
      depth: +(rnd(10, 50) / 10).toFixed(1), duration: rnd(20, 400),
    }));

  const mkSub = (name: string, phrases: Phrase[]): SubChannel => ({
    name,
    visits: phrases.reduce((s, p) => s + p.visits, 0),
    visitors: phrases.reduce((s, p) => s + p.visitors, 0),
    bounce: +(phrases.reduce((s, p) => s + p.bounce, 0) / phrases.length).toFixed(1),
    depth: +(phrases.reduce((s, p) => s + p.depth, 0) / phrases.length).toFixed(1),
    duration: Math.round(phrases.reduce((s, p) => s + p.duration, 0) / phrases.length),
    phrases,
  });

  const mkEngine = (engine: string, key: string, icon: React.ReactNode, subs: SubChannel[]): EngineData => ({
    engine, key, icon,
    visits: subs.reduce((s, c) => s + c.visits, 0),
    visitors: subs.reduce((s, c) => s + c.visitors, 0),
    bounce: +(subs.reduce((s, c) => s + c.bounce, 0) / subs.length).toFixed(1),
    depth: +(subs.reduce((s, c) => s + c.depth, 0) / subs.length).toFixed(1),
    duration: Math.round(subs.reduce((s, c) => s + c.duration, 0) / subs.length),
    subChannels: subs,
  });

  const engines = [
    mkEngine("Яндекс", "yandex", <YandexIcon />, [mkSub("Яндекс: Поиск", mkPhrases("ya-search", 8))]),
    mkEngine("Google", "google", <GoogleIcon />, [mkSub("Google: Поиск", mkPhrases("g-search", 10))]),
    mkEngine("Другие", "other", <Globe className="h-4 w-4 text-muted-foreground" />, [mkSub("Bing", mkPhrases("bing", 3))]),
  ];

  const trend: TrendPoint[] = Array.from({ length: 30 }, (_, i) => ({
    date: format(subDays(new Date(), 29 - i), "dd.MM"),
    yandex: rnd(200, 600), google: rnd(300, 800), other: rnd(30, 150),
  }));

  return { engines, trend };
}

/* ── Helpers ── */
const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const bounceColor = (v: number) =>
  v > 50 ? "text-destructive" : v > 30 ? "text-orange-400" : "text-foreground";

const calcDelta = (cur: number, prev?: number) => {
  if (prev === undefined || prev === 0) return undefined;
  return Math.round(((cur - prev) / prev) * 100);
};

const DeltaBadge = ({ current, prev }: { current: number; prev?: number }) => {
  const d = calcDelta(current, prev);
  if (d === undefined) return null;
  const positive = d >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium ml-1", positive ? "text-emerald-500" : "text-destructive")}>
      {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {positive ? "+" : ""}{d}%
    </span>
  );
};

const PrevLabel = ({ value, comparison }: { value?: number; comparison: boolean }) => {
  if (!comparison || value === undefined) return null;
  return <span className="block text-[10px] text-muted-foreground">было: {value.toLocaleString()}</span>;
};

type SortKey = "visits" | "visitors" | "bounce" | "depth" | "duration";

/* ══════════════════════ COMPONENT ══════════════════════ */
export function SearchSystemsTab({ projectId }: SearchSystemsTabProps) {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = i18n.language === "ru" ? ru : enUS;

  const today = new Date();
  const [range, setRange] = useState<{ from: Date; to: Date }>({ from: subDays(today, 30), to: today });
  const [appliedRange, setAppliedRange] = useState(range);
  const [showComparison, setShowComparison] = useState(false);
  const [compRange, setCompRange] = useState<{ from: Date; to: Date }>({ from: subYears(subDays(today, 30), 1), to: subYears(today, 1) });
  const [appliedCompRange, setAppliedCompRange] = useState(compRange);
  const [activePreset, setActivePreset] = useState<string>("30d");

  const PRESETS = [
    { key: "7d", days: 7 },
    { key: "14d", days: 14 },
    { key: "30d", days: 30 },
    { key: "90d", days: 90 },
  ] as const;

  const handlePreset = (key: string, days: number) => {
    const nr = { from: subDays(today, days), to: today };
    setActivePreset(key);
    setRange(nr);
    setAppliedRange(nr);
    const cr = { from: subYears(nr.from, 1), to: subYears(nr.to, 1) };
    setCompRange(cr);
    setAppliedCompRange(cr);
  };

  const handleCompPreset = (type: "previous" | "lastYear") => {
    const days = differenceInDays(range.to, range.from);
    const nr = type === "previous"
      ? { from: subDays(range.from, days + 1), to: subDays(range.from, 1) }
      : { from: subYears(range.from, 1), to: subYears(range.to, 1) };
    setCompRange(nr);
  };

  const handleToggleComparison = (on: boolean) => {
    setShowComparison(on);
    if (on) {
      const nr = { from: subYears(range.from, 1), to: subYears(range.to, 1) };
      setCompRange(nr);
      setAppliedCompRange(nr);
    }
  };

  const handleApply = () => {
    setAppliedRange({ ...range });
    setActivePreset("");
    if (showComparison) setAppliedCompRange({ ...compRange });
    toast.success(t("project.analytics.applied", "Период применён"));
  };

  // Fetch integration info for this project
  const { data: integration } = useQuery({
    queryKey: ["integration-metrika", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations")
        .select("access_token, counter_id")
        .eq("project_id", projectId)
        .eq("service_name", "yandexMetrika")
        .eq("connected", true)
        .maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch real search phrases from Metrika
  const { data: realData, isLoading } = useQuery({
    queryKey: ["search-phrases", projectId, integration?.counter_id, format(appliedRange.from, "yyyy-MM-dd"), format(appliedRange.to, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !integration?.access_token || !integration?.counter_id) return null;

      const startDate = format(appliedRange.from, "yyyy-MM-dd");
      const endDate = format(appliedRange.to, "yyyy-MM-dd");

      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-search-phrases`;
      const response = await fetch(funcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          access_token: integration.access_token,
          counter_id: integration.counter_id,
          date1: startDate,
          date2: endDate,
        }),
      });

      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!integration?.access_token && !!integration?.counter_id,
    staleTime: 5 * 60 * 1000,
  });

  const { engines, trend } = useMemo(() => {
    if (realData?.phrases) {
      return parseMetrikaData(realData);
    }
    return buildDemoData();
  }, [realData]);
  const [expandedEngines, setExpandedEngines] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("visits");
  const [sortAsc, setSortAsc] = useState(false);
  const [visibleEngines, setVisibleEngines] = useState<Set<string>>(new Set(ENGINE_KEYS));

  const toggleEngine = (e: string) => setExpandedEngines((p) => { const n = new Set(p); n.has(e) ? n.delete(e) : n.add(e); return n; });
  const toggleSub = (s: string) => setExpandedSubs((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const toggleVisible = (key: string) => setVisibleEngines((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filteredData = useMemo(() => {
    const q = search.toLowerCase();
    let d = engines;
    if (q) {
      d = d.map((eng) => ({
        ...eng,
        subChannels: eng.subChannels.map((sub) => ({
          ...sub,
          phrases: sub.phrases.filter((p) => p.name.toLowerCase().includes(q)),
        })).filter((sub) => sub.phrases.length > 0),
      })).filter((eng) => eng.subChannels.length > 0);
    }
    return d.filter((eng) => visibleEngines.has(eng.key));
  }, [engines, search, visibleEngines]);

  const sortFn = (a: any, b: any) => (sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]);

  /* ── Chart data ── */
  const pieData = useMemo(() => {
    const total = engines.reduce((s, e) => s + e.visits, 0);
    return engines.map((e, i) => ({ name: e.engine, value: e.visits, pct: total ? Math.round((e.visits / total) * 100) : 0, fill: ENGINE_COLORS[i] }));
  }, [engines]);

  const barData = useMemo(() =>
    engines.flatMap((eng, ei) => eng.subChannels.map((sub) => ({ name: sub.name, visits: sub.visits, color: ENGINE_COLORS[ei] }))),
  [engines]);

  /* ── Trend chart tooltip ── */
  const TrendTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs space-y-1">
        <p className="font-medium text-foreground">{label}</p>
        {payload.filter((p: any) => !p.dataKey.includes("Prev")).map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-semibold text-foreground">{p.value.toLocaleString()}</span>
            {showComparison && (() => {
              const prevKey = `${p.dataKey}Prev`;
              const prevEntry = payload.find((pp: any) => pp.dataKey === prevKey);
              if (!prevEntry) return null;
              const d = calcDelta(p.value, prevEntry.value);
              return (
                <span className={cn("text-[10px]", d !== undefined && d >= 0 ? "text-emerald-500" : "text-destructive")}>
                  ({prevEntry.value.toLocaleString()}{d !== undefined ? `, ${d >= 0 ? "+" : ""}${d}%` : ""})
                </span>
              );
            })()}
          </div>
        ))}
      </div>
    );
  };

  const ChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="font-medium text-foreground">{d.name}</p>
        <p className="text-muted-foreground">{t("searchSystems.visits")}: <span className="text-foreground font-semibold">{(d.visits ?? d.value)?.toLocaleString()}</span></p>
        {d.pct !== undefined && <p className="text-muted-foreground">{t("searchSystems.share")}: {d.pct}%</p>}
      </div>
    );
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground" onClick={() => handleSort(k)}>
      {label}<ArrowUpDown className="h-3 w-3" />
    </Button>
  );

  const engineLabels: Record<string, string> = { yandex: "Яндекс", google: "Google", other: t("searchSystems.otherEngines") };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isRealData = !!realData?.phrases;

  return (
    <div className="space-y-6">
      {/* Data source indicator */}
      {!isRealData && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 flex items-center gap-2">
          <Globe className="h-3.5 w-3.5" />
          {t("searchSystems.demoDataHint")}
        </div>
      )}

      {/* ── Full Filter Bar ── */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          {/* Presets */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                variant={activePreset === p.key ? "default" : "outline"}
                size="sm" className="h-7 text-xs px-3"
                onClick={() => handlePreset(p.key, p.days)}
              >
                {`${p.days}${i18n.language === "ru" ? "д" : "d"}`}
              </Button>
            ))}
          </div>

          {/* Period A | VS | Period B | Toggle | Apply */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period A */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {t("comparison.a", "А")}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 min-w-[170px]">
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(range.from, "dd.MM.yy", { locale: dateFnsLocale })} — {format(range.to, "dd.MM.yy", { locale: dateFnsLocale })}
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
                    numberOfMonths={2} locale={dateFnsLocale}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* VS */}
            <span className="text-xs font-bold text-muted-foreground px-1">VS</span>

            {/* Period B */}
            <div className={cn("flex items-center gap-1.5 transition-opacity", !showComparison && "opacity-40 pointer-events-none")}>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {t("comparison.b", "Б")}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 min-w-[170px]" disabled={!showComparison}>
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(compRange.from, "dd.MM.yy", { locale: dateFnsLocale })} — {format(compRange.to, "dd.MM.yy", { locale: dateFnsLocale })}
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
                    numberOfMonths={2} locale={dateFnsLocale}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Toggle */}
            <div className="flex items-center gap-2 ml-1">
              <Switch id="ss-comp" checked={showComparison} onCheckedChange={handleToggleComparison} className="scale-90" />
              <Label htmlFor="ss-comp" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" />
                {t("comparison.enable", "Сравнение")}
              </Label>
            </div>

            {/* Apply */}
            <Button size="sm" className="h-8 text-xs ml-auto" onClick={handleApply}>
              {t("project.analytics.apply", "Применить")}
            </Button>
          </div>

          {/* Comparison presets */}
          {showComparison && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">{t("comparison.presets", "Пресеты")}:</span>
              <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={() => handleCompPreset("previous")}>
                {t("project.analytics.prevPeriod", "Предыдущий период")}
              </Button>
              <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={() => handleCompPreset("lastYear")}>
                {t("project.analytics.lastYear", "Год назад")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
              <defs>
                {ENGINE_KEYS.map((k, i) => (
                  <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ENGINE_COLORS[i]} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={ENGINE_COLORS[i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip content={<TrendTooltip />} />
              {ENGINE_KEYS.map((k, i) => visibleEngines.has(k) && (
                <Area key={k} type="monotone" dataKey={k} name={engineLabels[k]} stroke={ENGINE_COLORS[i]} fill={`url(#grad-${k})`} strokeWidth={2} dot={false} />
              ))}
              {showComparison && ENGINE_KEYS.map((k, i) => visibleEngines.has(k) && (
                <Area key={`${k}Prev`} type="monotone" dataKey={`${k}Prev`} name={`${engineLabels[k]} (prev)`} stroke={ENGINE_COLORS[i]} fill="none" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          {/* Interactive legend */}
          <div className="flex items-center justify-center gap-4 mt-3">
            {ENGINE_KEYS.map((k, i) => (
              <button key={k} onClick={() => toggleVisible(k)} className={cn("flex items-center gap-1.5 text-xs transition-opacity", visibleEngines.has(k) ? "opacity-100" : "opacity-40")}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ENGINE_COLORS[i] }} />
                {engineLabels[k]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Pie + Bar row ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("searchSystems.shareChart")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} strokeWidth={2} stroke="hsl(var(--card))">
                  {pieData.map((d, i) => <Cell key={i} fill={ENGINE_COLORS[i]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-1">
              {pieData.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ENGINE_COLORS[i] }} />{d.name} — {d.pct}%
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("searchSystems.subChannelChart")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="visits" radius={[0, 4, 4, 0]} barSize={18}>
                  {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchSystems.searchPlaceholder")} className="pl-9 h-9 text-sm" />
      </div>

      {/* ── Table ── */}
      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="w-[260px] text-xs">{t("searchSystems.name")}</TableHead>
                <TableHead className="text-right text-xs"><SortBtn k="visits" label={t("searchSystems.visits")} /></TableHead>
                {showComparison && <TableHead className="text-right text-xs">{t("searchSystems.change")}</TableHead>}
                <TableHead className="text-right text-xs"><SortBtn k="visitors" label={t("searchSystems.visitors")} /></TableHead>
                <TableHead className="text-right text-xs"><SortBtn k="bounce" label={t("searchSystems.bounce")} /></TableHead>
                <TableHead className="text-right text-xs"><SortBtn k="depth" label={t("searchSystems.depth")} /></TableHead>
                <TableHead className="text-right text-xs"><SortBtn k="duration" label={t("searchSystems.duration")} /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...filteredData].sort(sortFn).map((eng) => {
                const engOpen = expandedEngines.has(eng.engine);
                return (
                  <>
                    {/* Level 1 */}
                    <TableRow key={eng.engine} className="cursor-pointer hover:bg-muted/40 border-border" onClick={() => toggleEngine(eng.engine)}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          {engOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          {eng.icon}{eng.engine}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {eng.visits.toLocaleString()}
                        <PrevLabel value={eng.prevVisits} comparison={showComparison} />
                      </TableCell>
                      {showComparison && <TableCell className="text-right text-sm"><DeltaBadge current={eng.visits} prev={eng.prevVisits} /></TableCell>}
                      <TableCell className="text-right text-sm">{eng.visitors.toLocaleString()}</TableCell>
                      <TableCell className={cn("text-right text-sm", bounceColor(eng.bounce))}>
                        {eng.bounce}%{showComparison && <DeltaBadge current={eng.bounce} prev={eng.prevBounce} />}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {eng.depth}{showComparison && <DeltaBadge current={eng.depth} prev={eng.prevDepth} />}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatTime(eng.duration)}{showComparison && <DeltaBadge current={eng.duration} prev={eng.prevDuration} />}
                      </TableCell>
                    </TableRow>

                    {/* Level 2 */}
                    {engOpen && [...eng.subChannels].sort(sortFn).map((sub) => {
                      const subKey = `${eng.engine}::${sub.name}`;
                      const subOpen = expandedSubs.has(subKey);
                      return (
                        <>
                          <TableRow key={subKey} className="cursor-pointer hover:bg-muted/30 border-border bg-muted/10" onClick={() => toggleSub(subKey)}>
                            <TableCell className="text-sm pl-10">
                              <div className="flex items-center gap-2">
                                {subOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                {sub.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {sub.visits.toLocaleString()}
                              <PrevLabel value={sub.prevVisits} comparison={showComparison} />
                            </TableCell>
                            {showComparison && <TableCell className="text-right text-sm"><DeltaBadge current={sub.visits} prev={sub.prevVisits} /></TableCell>}
                            <TableCell className="text-right text-sm">{sub.visitors.toLocaleString()}</TableCell>
                            <TableCell className={cn("text-right text-sm", bounceColor(sub.bounce))}>
                              {sub.bounce}%{showComparison && <DeltaBadge current={sub.bounce} prev={sub.prevBounce} />}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {sub.depth}{showComparison && <DeltaBadge current={sub.depth} prev={sub.prevDepth} />}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatTime(sub.duration)}{showComparison && <DeltaBadge current={sub.duration} prev={sub.prevDuration} />}
                            </TableCell>
                          </TableRow>

                          {/* Level 3 */}
                          {subOpen && [...sub.phrases].sort(sortFn).map((phrase) => (
                            <TableRow key={`${subKey}::${phrase.name}`} className="border-border bg-muted/5">
                              <TableCell className="text-xs text-muted-foreground pl-16">{phrase.name}</TableCell>
                              <TableCell className="text-right text-xs">
                                {phrase.visits.toLocaleString()}
                                <PrevLabel value={phrase.prevVisits} comparison={showComparison} />
                              </TableCell>
                              {showComparison && <TableCell className="text-right text-xs"><DeltaBadge current={phrase.visits} prev={phrase.prevVisits} /></TableCell>}
                              <TableCell className="text-right text-xs">{phrase.visitors.toLocaleString()}</TableCell>
                              <TableCell className={cn("text-right text-xs", bounceColor(phrase.bounce))}>
                                {phrase.bounce}%{showComparison && <DeltaBadge current={phrase.bounce} prev={phrase.prevBounce} />}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {phrase.depth}{showComparison && <DeltaBadge current={phrase.depth} prev={phrase.prevDepth} />}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {formatTime(phrase.duration)}{showComparison && <DeltaBadge current={phrase.duration} prev={phrase.prevDuration} />}
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
                    })}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
