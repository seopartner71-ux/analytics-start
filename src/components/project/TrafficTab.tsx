import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, ExternalLink, Monitor, Smartphone, Tablet,
  TrendingUp, TrendingDown, Search, Globe, Megaphone, Users, Share2,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import { cn } from "@/lib/utils";
import { useDateRange } from "@/contexts/DateRangeContext";
import { supabase } from "@/integrations/supabase/client";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToPdf, exportToExcel, exportToWord, type ExcelSheet, type WordSection } from "@/lib/export-utils";
import {
  StandardKpiCard, GlassCard, useTabRefresh, TabLoadingOverlay,
  StandardChartTooltip, SkeletonChart,
} from "./shared-ui";

interface TrafficTabProps {
  projectId: string;
  projectName: string;
  projectUrl?: string;
}

/* ── Source colors (brand palette) ── */
const SOURCE_COLORS = {
  organic: "hsl(var(--chart-1))",
  direct: "hsl(var(--chart-2))",
  ad: "hsl(var(--chart-3))",
  social: "hsl(var(--chart-4))",
  referral: "hsl(var(--chart-5))",
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  organic: <Search className="h-4 w-4" />,
  direct: <Globe className="h-4 w-4" />,
  ad: <Megaphone className="h-4 w-4" />,
  social: <Users className="h-4 w-4" />,
  referral: <Share2 className="h-4 w-4" />,
};

const DEVICE_COLORS = {
  desktop: "hsl(var(--chart-1))",
  mobile: "hsl(var(--chart-3))",
  tablet: "hsl(var(--chart-5))",
};

/* ── Tooltip uses shared component ── */

/* ── No demo data — top pages come from real API or show empty ── */

/* ── Channel colors for dynamics chart ── */
const CHANNEL_COLORS: Record<string, string> = {
  organic: "#8B5CF6",
  direct: "#10B981",
  social: "#D946EF",
  referral: "#0EA5E9",
  ad: "#F59E0B",
};

const ALL_CHANNELS = ["organic", "direct", "social", "referral", "ad"] as const;

const SOURCE_MAP_CACHE: Record<string, keyof typeof CHANNEL_COLORS> = {};
function classifySource(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("organic") || n.includes("search") || n.includes("поиск")) return "organic";
  if (n.includes("direct") || n.includes("прям") || n.includes("internal") || n.includes("внутр")) return "direct";
  if (n.includes("social") || n.includes("соц")) return "social";
  if (n.includes("ad") || n.includes("реклам") || n.includes("paid") || n.includes("cpc")) return "ad";
  return "referral";
}

function parseByTimeSourceData(rawData: any, rangeFrom: Date): Array<Record<string, any>> {
  if (!rawData?.data?.length) return [];
  const timeLabels = rawData.time_intervals?.map((t: string[]) => t[0]?.split(" ")[0]) || [];
  const dayCount = timeLabels.length || (rawData.data[0]?.metrics?.[0]?.length ?? 0);

  // Build per-day aggregation
  const days: Record<string, any>[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(rangeFrom);
    d.setDate(d.getDate() + i);
    days.push({
      date: format(d, "yyyy-MM-dd"),
      label: format(d, "dd.MM"),
      organic: 0, direct: 0, social: 0, referral: 0, ad: 0,
    });
  }

  for (const row of rawData.data) {
    const sourceName = row.dimensions?.[0]?.name || "";
    const channel = classifySource(sourceName);
    const visits = row.metrics?.[0] || [];
    for (let i = 0; i < Math.min(visits.length, dayCount); i++) {
      days[i][channel] += Math.round(visits[i] || 0);
    }
  }

  return days;
}

interface DynamicsProps {
  appliedRange: { from: Date; to: Date };
  appliedCompRange: { from: Date; to: Date };
  showComparison: boolean;
  locale: any;
  lang: string;
  integration: any;
  channel: string;
}

function TrafficDynamicsChart({ appliedRange, appliedCompRange, showComparison, locale, lang, integration, channel }: DynamicsProps) {
  const dateFrom = format(appliedRange.from, "yyyy-MM-dd");
  const dateTo = format(appliedRange.to, "yyyy-MM-dd");
  const compDateFrom = format(appliedCompRange.from, "yyyy-MM-dd");
  const compDateTo = format(appliedCompRange.to, "yyyy-MM-dd");

  const fetchSourceDaily = useCallback(async (d1: string, d2: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-traffic-by-source-daily`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          access_token: integration.access_token,
          counter_id: integration.counter_id,
          date1: d1,
          date2: d2,
        }),
      }
    );
    if (!r.ok) throw new Error("Failed to fetch traffic by source");
    return r.json();
  }, [integration]);

  const { data: mainRaw, isLoading } = useQuery({
    queryKey: ["traffic-by-source-daily", integration?.counter_id, dateFrom, dateTo],
    queryFn: () => fetchSourceDaily(dateFrom, dateTo),
    enabled: !!integration?.access_token && !!integration?.counter_id,
  });

  const { data: compRaw } = useQuery({
    queryKey: ["traffic-by-source-daily-comp", integration?.counter_id, compDateFrom, compDateTo],
    queryFn: () => fetchSourceDaily(compDateFrom, compDateTo),
    enabled: !!integration?.access_token && !!integration?.counter_id && showComparison,
  });

  const data = useMemo(() => parseByTimeSourceData(mainRaw, appliedRange.from), [mainRaw, appliedRange.from]);
  const compData = useMemo(() => showComparison ? parseByTimeSourceData(compRaw, appliedCompRange.from) : [], [compRaw, appliedCompRange.from, showComparison]);

  // Merge comparison data aligned by index
  const merged = useMemo(() => {
    return data.map((d, i) => ({
      ...d,
      comp_organic: compData[i]?.organic ?? null,
      comp_direct: compData[i]?.direct ?? null,
      comp_social: compData[i]?.social ?? null,
      comp_referral: compData[i]?.referral ?? null,
    }));
  }, [data, compData]);

  const channelNames: Record<string, string> = lang === "ru"
    ? { organic: "Поисковые", direct: "Прямые", social: "Соцсети", referral: "Реферальные" }
    : { organic: "Organic", direct: "Direct", social: "Social", referral: "Referral" };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-3 shadow-xl text-xs">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {(["organic", "direct", "social", "referral"] as const).map(ch => {
          const item = payload.find((p: any) => p.dataKey === ch);
          const compItem = payload.find((p: any) => p.dataKey === `comp_${ch}`);
          if (!item) return null;
          return (
            <div key={ch} className="flex items-center justify-between gap-4 py-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHANNEL_COLORS[ch] }} />
                <span className="text-muted-foreground">{channelNames[ch]}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground tabular-nums">{item.value?.toLocaleString()}</span>
                {compItem?.value != null && (
                  <span className="text-muted-foreground tabular-nums">({compItem.value.toLocaleString()})</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {lang === "ru" ? "Динамика трафика" : "Traffic Dynamics"}
          </CardTitle>
          <div className="flex items-center gap-3">
            {(Object.keys(CHANNEL_COLORS) as (keyof typeof CHANNEL_COLORS)[]).map(ch => (
              <div key={ch} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHANNEL_COLORS[ch] }} />
                <span className="text-[11px] text-muted-foreground">{channelNames[ch]}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[320px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[320px] text-sm text-muted-foreground">
            {lang === "ru" ? "Нет данных за выбранный период" : "No data for selected period"}
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={merged} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <defs>
              {(Object.entries(CHANNEL_COLORS)).map(([key, color]) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip content={<CustomTooltip />} />
            {(["organic", "direct", "social", "referral"] as const).map(ch => (
              <Area
                key={ch}
                type="monotone"
                dataKey={ch}
                stackId="main"
                stroke={CHANNEL_COLORS[ch]}
                strokeWidth={2}
                fill={`url(#grad-${ch})`}
              />
            ))}
            {showComparison && (["organic", "direct", "social", "referral"] as const).map(ch => (
              <Area
                key={`comp_${ch}`}
                type="monotone"
                dataKey={`comp_${ch}`}
                stackId="comp"
                stroke={CHANNEL_COLORS[ch]}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                fill="none"
                strokeOpacity={0.4}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════ COMPONENT ══════════════════════ */
export function TrafficTab({ projectId, projectName, projectUrl }: TrafficTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;
  const contentRef = useRef<HTMLDivElement>(null);
  const { appliedRange, appliedCompRange, showComparison, applyVersion, channel } = useDateRange();

  const isRefreshing = useTabRefresh();

  const dateFrom = format(appliedRange.from, "yyyy-MM-dd");
  const dateTo = format(appliedRange.to, "yyyy-MM-dd");

  // Fetch integration for this project
  const { data: integration } = useQuery({
    queryKey: ["integration-metrika", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations").select("*")
        .eq("project_id", projectId).eq("service_name", "yandexMetrika").eq("connected", true).maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch real metrika stats from API (includes top pages + devices)
  const { data: liveStats, isLoading } = useQuery({
    queryKey: ["metrika-live-traffic", projectId, dateFrom, dateTo],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-stats`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            access_token: integration!.access_token,
            counter_id: integration!.counter_id,
            date1: dateFrom,
            date2: dateTo,
          }),
        }
      );
      if (!r.ok) throw new Error("Failed to fetch stats");
      return await r.json();
    },
    enabled: !!integration?.access_token && !!integration?.counter_id,
  });

  // Also fetch cached stats as fallback
  const { data: allStats = [] } = useQuery({
    queryKey: ["metrika-stats-all", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrika_stats").select("*").eq("project_id", projectId)
        .order("fetched_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const latestStat = allStats[0];

  // Build daily visits data from real stats only
  const dailyData = useMemo(() => {
    // Prefer live time series
    if (liveStats?.timeSeries?.data?.[0]?.metrics) {
      const metrics = liveStats.timeSeries.data[0].metrics;
      const visits = metrics[0] || [];
      return visits.map((v: number, i: number) => {
        const date = new Date(appliedRange.from);
        date.setDate(date.getDate() + i);
        return { date, visits: Math.round(v) };
      });
    }
    if (latestStat) {
      const visitsByDay = (latestStat.visits_by_day as any[]) || [];
      const dateFromParsed = parseISO(latestStat.date_from);
      return visitsByDay.map((entry: any, index: number) => {
        const date = new Date(dateFromParsed);
        date.setDate(date.getDate() + index);
        return { date, visits: entry.visits || 0 };
      });
    }
    return [];
  }, [liveStats, latestStat, appliedRange]);

  // Filter to applied range
  const filteredData = useMemo(() => {
    const from = appliedRange.from;
    const to = appliedRange.to;
    return dailyData.filter(d => d.date >= from && d.date <= to);
  }, [dailyData, appliedRange]);

  const totalVisits = filteredData.reduce((s, d) => s + d.visits, 0);

  // === 1. SOURCE DISTRIBUTION (Donut) ===
  const sourceData = useMemo(() => {
    // Prefer live traffic sources
    const srcArray = liveStats?.trafficSources?.data || (latestStat?.traffic_sources && Array.isArray(latestStat.traffic_sources) ? latestStat.traffic_sources : null);
    if (srcArray && Array.isArray(srcArray)) {
      const agg = new Map<string, number>();
      for (const row of srcArray) {
        // Live API format: row.dimensions[0].name + row.metrics[0]
        const rawName = row.dimensions?.[0]?.name || row.name || row.source || "";
        const visits = row.metrics?.[0] || row.visits || row.value || 0;
        const name = rawName.toLowerCase();
        let key = "referral";
        if (name.includes("organic") || name.includes("search") || name.includes("поиск")) key = "organic";
        else if (name.includes("direct") || name.includes("прям")) key = "direct";
        else if (name.includes("ad") || name.includes("реклам")) key = "ad";
        else if (name.includes("social") || name.includes("соц")) key = "social";
        else if (name.includes("internal") || name.includes("внутр")) key = "direct";
        agg.set(key, (agg.get(key) || 0) + visits);
      }
      return ["organic", "direct", "ad", "social", "referral"].map(key => ({
        key,
        name: t(`channels.${key}`),
        value: agg.get(key) || 0,
        pct: 0,
      }));
    }
    return [];
  }, [liveStats, latestStat, t]);

  // Calc percentages
  const sourceTotal = sourceData.reduce((s, d) => s + d.value, 0);
  const sourceWithPct = sourceData.map(s => ({
    ...s,
    pct: sourceTotal > 0 ? Math.round((s.value / sourceTotal) * 1000) / 10 : 0,
  })).filter(s => s.value > 0);

  // === 2. TOP PAGES (from live API) ===
  const topPages = useMemo(() => {
    if (!liveStats?.topPages?.data) return [];
    const totalVis = liveStats.topPages.data.reduce((s: number, r: any) => s + (r.metrics?.[0] || 0), 0);
    return liveStats.topPages.data.map((row: any) => {
      const url = row.dimensions?.[0]?.name || "";
      const visits = Math.round(row.metrics?.[0] || 0);
      // Extract path from URL
      let path = url;
      try { path = new URL(url).pathname; } catch {}
      return {
        path,
        title: path === "/" ? "Главная" : path,
        visits,
        pct: totalVis > 0 ? Math.round((visits / totalVis) * 1000) / 10 : 0,
        fullUrl: url,
      };
    });
  }, [liveStats]);

  // === 3. DEVICE DISTRIBUTION (from live API) ===
  const deviceData = useMemo(() => {
    if (!liveStats?.devices?.data) return [];
    const total = liveStats.devices.data.reduce((s: number, r: any) => s + (r.metrics?.[0] || 0), 0);
    const iconMap: Record<string, React.ReactNode> = {
      desktop: <Monitor className="h-5 w-5" />,
      mobile: <Smartphone className="h-5 w-5" />,
      tablet: <Tablet className="h-5 w-5" />,
    };
    const nameMap: Record<string, string> = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet" };
    return liveStats.devices.data.map((row: any) => {
      const rawKey = (row.dimensions?.[0]?.id || row.dimensions?.[0]?.name || "desktop").toLowerCase();
      const key = rawKey.includes("mobile") || rawKey.includes("смартфон") ? "mobile"
        : rawKey.includes("tablet") || rawKey.includes("планшет") ? "tablet" : "desktop";
      const visits = Math.round(row.metrics?.[0] || 0);
      return {
        key,
        name: nameMap[key] || key,
        value: visits,
        pct: total > 0 ? Math.round((visits / total) * 1000) / 10 : 0,
        icon: iconMap[key] || <Monitor className="h-5 w-5" />,
      };
    });
  }, [liveStats]);

  // Export
  const exportMeta = { projectName, tabName: t("portalNav.traffic"), periodA: `${format(appliedRange.from, "yyyy-MM-dd")} — ${format(appliedRange.to, "yyyy-MM-dd")}`, language: i18n.language };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!integration?.access_token || !integration?.counter_id) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Globe className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          {i18n.language === "ru"
            ? "Подключите Яндекс.Метрику в Интеграциях для отображения данных о трафике"
            : "Connect Yandex.Metrika in Integrations to view traffic data"}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6 transition-opacity duration-300", isRefreshing && "opacity-60")}>
      {isRefreshing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("project.analytics.loading")}
        </div>
      )}

      <div className="flex items-center justify-end" data-export-ignore>
        <ExportMenu
          onExportPdf={async () => { if (contentRef.current) await exportToPdf(contentRef.current, exportMeta); }}
          onExportExcel={async () => {
            const sheets: ExcelSheet[] = [{
              name: t("portalNav.traffic"),
              headers: [t("trafficTab.source"), t("trafficTab.visits"), t("trafficTab.share")],
              rows: sourceWithPct.map(s => [s.name, s.value, `${s.pct}%`]),
            }];
            exportToExcel(sheets, exportMeta);
          }}
          onExportWord={async () => {
            const sections: WordSection[] = [{
              title: t("portalNav.traffic"),
              paragraphs: sourceWithPct.map(s => `${s.name}: ${s.value.toLocaleString()} (${s.pct}%)`),
            }];
            await exportToWord(sections, exportMeta);
          }}
        />
      </div>

      <div ref={contentRef} className="space-y-6">
        {/* === 0. TRAFFIC DYNAMICS CHART === */}
        <TrafficDynamicsChart
          appliedRange={appliedRange}
          appliedCompRange={appliedCompRange}
          showComparison={showComparison}
          locale={locale}
          lang={i18n.language}
          integration={integration}
          channel={channel}
        />

        {/* === 1. SOURCES DONUT === */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {i18n.language === "ru" ? "Источники трафика" : "Traffic Sources"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Donut */}
              <div className="w-[220px] h-[220px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceWithPct}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {sourceWithPct.map((s) => (
                        <Cell key={s.key} fill={(SOURCE_COLORS as any)[s.key] || "hsl(var(--muted))"} />
                      ))}
                    </Pie>
                    <Tooltip content={<StandardChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-3 w-full">
                {sourceWithPct.map((s) => (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: (SOURCE_COLORS as any)[s.key] }} />
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {SOURCE_ICONS[s.key]}
                    </div>
                    <span className="text-sm font-medium text-foreground flex-1">{s.name}</span>
                    <span className="text-sm tabular-nums text-foreground font-semibold">{s.value.toLocaleString()}</span>
                    <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">{s.pct}%</span>
                  </div>
                ))}
                {/* Total */}
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <span className="w-3 h-3" />
                  <span className="w-4" />
                  <span className="text-sm font-semibold text-foreground flex-1">
                    {i18n.language === "ru" ? "Всего" : "Total"}
                  </span>
                  <span className="text-sm tabular-nums text-foreground font-bold">{sourceTotal.toLocaleString()}</span>
                  <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">100%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* === 2. TOP PAGES TABLE === */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {i18n.language === "ru" ? "Популярные страницы" : "Popular Pages"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {i18n.language === "ru" ? "Страница" : "Page"}
                    </th>
                    <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("trafficTab.visits", i18n.language === "ru" ? "Визиты" : "Visits")}
                    </th>
                    <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {i18n.language === "ru" ? "% от общего" : "% of total"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        {i18n.language === "ru" ? "Данные отсутствуют" : "No data available"}
                      </td>
                    </tr>
                  ) : topPages.map((page, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium">{page.title}</span>
                          {page.fullUrl && (
                            <a href={page.fullUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">{page.path}</span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-foreground">
                        {page.visits.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/60"
                              style={{ width: `${page.pct}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{page.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* === 3. DEVICE DISTRIBUTION === */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {i18n.language === "ru" ? "Устройства" : "Devices"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deviceData.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {i18n.language === "ru" ? "Данные отсутствуют" : "No data available"}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {deviceData.map((device) => (
                    <div
                      key={device.key}
                      className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50"
                    >
                      <div
                        className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${(DEVICE_COLORS as any)[device.key]}20` }}
                      >
                        <div style={{ color: (DEVICE_COLORS as any)[device.key] }}>
                          {device.icon}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{device.name}</p>
                        <p className="text-xl font-bold text-foreground tabular-nums">{device.value.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold tabular-nums" style={{ color: (DEVICE_COLORS as any)[device.key] }}>
                          {device.pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={deviceData} layout="vertical" barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} horizontal={false} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
                      <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={70} />
                      <Tooltip content={<StandardChartTooltip />} />
                      <Bar dataKey="value" name={i18n.language === "ru" ? "Визиты" : "Visits"} radius={[0, 6, 6, 0]}>
                        {deviceData.map((d) => (
                          <Cell key={d.key} fill={(DEVICE_COLORS as any)[d.key]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
