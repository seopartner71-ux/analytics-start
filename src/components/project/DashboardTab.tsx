import { useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, differenceInDays } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Target, Search, ClipboardList, ChevronRight,
  Loader2, Globe, ExternalLink, Sparkles,
  Monitor, Smartphone, Tablet, Megaphone, Users, Share2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToPdf, exportToExcel, exportToWord, type ExcelSheet, type WordSection } from "@/lib/export-utils";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useDateRange } from "@/contexts/DateRangeContext";
import {
  StandardKpiCard, useTabRefresh, TabLoadingOverlay,
  StandardChartTooltip,
} from "./shared-ui";

interface DashboardTabProps {
  projectId: string;
  projectName: string;
  onSwitchTab: (tab: string) => void;
}

const SOURCE_COLORS: Record<string, string> = {
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

export function DashboardTab({ projectId, projectName, onSwitchTab }: DashboardTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;
  const contentRef = useRef<HTMLDivElement>(null);
  const { appliedRange, appliedCompRange, showComparison, channel } = useDateRange();
  const dateFrom = format(appliedRange.from, "yyyy-MM-dd");
  const dateTo = format(appliedRange.to, "yyyy-MM-dd");

  const isRefreshing = useTabRefresh();

  // Integration
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

  // Live stats from Metrika API
  const { data: liveStats, isLoading: isLoadingLive } = useQuery({
    queryKey: ["metrika-live-dashboard", projectId, dateFrom, dateTo],
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
    staleTime: 5 * 60 * 1000,
  });

  // Channel-filtered stats from Metrika API
  const { data: channelStats, isLoading: isLoadingChannel } = useQuery({
    queryKey: ["metrika-channel-stats", projectId, dateFrom, dateTo, channel],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-channel-stats`,
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
            channel,
          }),
        }
      );
      if (!r.ok) return null;
      return await r.json();
    },
    enabled: !!integration?.access_token && !!integration?.counter_id && channel !== "all",
    staleTime: 5 * 60 * 1000,
  });

  // Cached stats fallback
  const { data: allStats = [], isLoading: isLoadingCached } = useQuery({
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

  // Work logs
  const { data: workLogs = [] } = useQuery({
    queryKey: ["work_logs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_logs").select("*").eq("project_id", projectId)
        .order("task_date", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const isLoading = isLoadingLive || isLoadingCached || (channel !== "all" && isLoadingChannel);
  const latestStat = allStats[0];

  // KPIs — use channel-filtered data when channel is selected, otherwise full data
  const kpis = useMemo(() => {
    if (channel !== "all" && channelStats?.totals?.data?.[0]?.metrics) {
      const m = channelStats.totals.data[0].metrics;
      return {
        visits: Math.round(m[0] || 0),
        users: Math.round(m[1] || 0),
        bounceRate: Math.round((m[2] || 0) * 10) / 10,
        pageDepth: Math.round((m[3] || 0) * 100) / 100,
        avgDuration: Math.round(m[4] || 0),
      };
    }
    const totals = liveStats?.totals?.data?.[0]?.metrics;
    if (totals && totals.length >= 5) {
      return {
        visits: Math.round(totals[0]),
        users: Math.round(totals[1]),
        bounceRate: Math.round(totals[2] * 10) / 10,
        pageDepth: Math.round(totals[3] * 100) / 100,
        avgDuration: Math.round(totals[4]),
      };
    }
    if (latestStat) {
      return {
        visits: latestStat.total_visits,
        users: latestStat.total_users,
        bounceRate: Number(latestStat.bounce_rate),
        pageDepth: Number(latestStat.page_depth),
        avgDuration: latestStat.avg_duration_seconds,
      };
    }
    return { visits: 0, users: 0, bounceRate: 0, pageDepth: 0, avgDuration: 0 };
  }, [channel, channelStats, liveStats, latestStat]);

  // Daily chart data — use channel-filtered time series when available
  const dailyData = useMemo(() => {
    // Channel-filtered daily data
    if (channel !== "all" && channelStats?.timeSeries?.data?.[0]?.metrics) {
      const visits = channelStats.timeSeries.data[0].metrics[0] || [];
      return visits.map((v: number, i: number) => {
        const date = new Date(appliedRange.from);
        date.setDate(date.getDate() + i);
        return {
          date,
          dateStr: format(date, "dd MMM", { locale }),
          visits: Math.round(v),
        };
      });
    }
    // Full data
    if (liveStats?.timeSeries?.data?.[0]?.metrics) {
      const visits = liveStats.timeSeries.data[0].metrics[0] || [];
      return visits.map((v: number, i: number) => {
        const date = new Date(appliedRange.from);
        date.setDate(date.getDate() + i);
        return {
          date,
          dateStr: format(date, "dd MMM", { locale }),
          visits: Math.round(v),
        };
      });
    }
    if (latestStat) {
      const visitsByDay = (latestStat.visits_by_day as any[]) || [];
      const dateFromParsed = parseISO(latestStat.date_from);
      return visitsByDay.map((entry: any, index: number) => {
        const date = new Date(dateFromParsed);
        date.setDate(date.getDate() + index);
        return {
          date,
          dateStr: format(date, "dd MMM", { locale }),
          visits: entry.visits || 0,
        };
      });
    }
    return [];
  }, [channel, channelStats, liveStats, latestStat, appliedRange, locale]);

  // Source distribution
  const sourceData = useMemo(() => {
    const srcArray = liveStats?.trafficSources?.data;
    if (!srcArray || !Array.isArray(srcArray)) return [];
    const agg = new Map<string, number>();
    for (const row of srcArray) {
      const rawName = (row.dimensions?.[0]?.name || "").toLowerCase();
      const visits = row.metrics?.[0] || 0;
      let key = "referral";
      if (rawName.includes("organic") || rawName.includes("search") || rawName.includes("поиск")) key = "organic";
      else if (rawName.includes("direct") || rawName.includes("прям")) key = "direct";
      else if (rawName.includes("ad") || rawName.includes("реклам")) key = "ad";
      else if (rawName.includes("social") || rawName.includes("соц")) key = "social";
      else if (rawName.includes("internal") || rawName.includes("внутр")) key = "direct";
      agg.set(key, (agg.get(key) || 0) + visits);
    }
    const total = Array.from(agg.values()).reduce((s, v) => s + v, 0);
    return ["organic", "direct", "ad", "social", "referral"]
      .map(key => ({
        key,
        name: t(`channels.${key}`),
        value: agg.get(key) || 0,
        pct: total > 0 ? Math.round(((agg.get(key) || 0) / total) * 1000) / 10 : 0,
      }))
      .filter(s => s.value > 0);
  }, [liveStats, t]);

  // Top pages
  const topPages = useMemo(() => {
    if (!liveStats?.topPages?.data) return [];
    return liveStats.topPages.data.slice(0, 5).map((row: any) => {
      const url = row.dimensions?.[0]?.name || "";
      const visits = Math.round(row.metrics?.[0] || 0);
      let path = url;
      try { path = new URL(url).pathname; } catch {}
      return { path, visits, fullUrl: url };
    });
  }, [liveStats]);

  // Devices
  const deviceData = useMemo(() => {
    if (!liveStats?.devices?.data) return [];
    const total = liveStats.devices.data.reduce((s: number, r: any) => s + (r.metrics?.[0] || 0), 0);
    const iconMap: Record<string, React.ReactNode> = {
      desktop: <Monitor className="h-4 w-4" />,
      mobile: <Smartphone className="h-4 w-4" />,
      tablet: <Tablet className="h-4 w-4" />,
    };
    return liveStats.devices.data.map((row: any) => {
      const rawKey = (row.dimensions?.[0]?.id || row.dimensions?.[0]?.name || "desktop").toLowerCase();
      const key = rawKey.includes("mobile") || rawKey.includes("смартфон") ? "mobile"
        : rawKey.includes("tablet") || rawKey.includes("планшет") ? "tablet" : "desktop";
      const visits = Math.round(row.metrics?.[0] || 0);
      return {
        key,
        name: key === "desktop" ? "Desktop" : key === "mobile" ? "Mobile" : "Tablet",
        value: visits,
        pct: total > 0 ? Math.round((visits / total) * 1000) / 10 : 0,
        icon: iconMap[key] || <Monitor className="h-4 w-4" />,
      };
    });
  }, [liveStats]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // AI summary
  const aiSummary = useMemo(() => {
    const daysCount = differenceInDays(appliedRange.to, appliedRange.from) + 1;
    const avgDaily = Math.round(kpis.visits / Math.max(daysCount, 1));
    const bullets = [];

    bullets.push(
      i18n.language === "ru"
        ? `Среднее кол-во визитов: ${avgDaily.toLocaleString()} в день`
        : `Average daily visits: ${avgDaily.toLocaleString()}`
    );

    if (sourceData.length > 0) {
      const topSource = sourceData.reduce((a, b) => a.value > b.value ? a : b);
      bullets.push(
        i18n.language === "ru"
          ? `Лучший канал — ${topSource.name} (${topSource.pct}%)`
          : `Top channel — ${topSource.name} (${topSource.pct}%)`
      );
    }

    const bounceOk = kpis.bounceRate < 30;
    bullets.push(
      i18n.language === "ru"
        ? (bounceOk ? "Отказы в норме — ниже 30%" : `Отказы выше нормы — ${kpis.bounceRate.toFixed(1)}%`)
        : (bounceOk ? "Bounce rate is healthy — below 30%" : `Bounce rate is elevated — ${kpis.bounceRate.toFixed(1)}%`)
    );

    return bullets;
  }, [kpis, sourceData, appliedRange, i18n.language]);

  const kpiCards = [
    {
      label: i18n.language === "ru" ? "Визиты" : "Visits",
      value: kpis.visits.toLocaleString(),
      change: 0,
      sparkData: dailyData.map(d => ({ v: d.visits })),
      color: "hsl(var(--chart-1))",
    },
    {
      label: i18n.language === "ru" ? "Посетители" : "Users",
      value: kpis.users.toLocaleString(),
      change: 0,
      sparkData: [] as { v: number }[],
      color: "hsl(var(--chart-2))",
    },
    {
      label: i18n.language === "ru" ? "Отказы" : "Bounce Rate",
      value: `${kpis.bounceRate.toFixed(1)}`,
      unit: "%",
      change: 0,
      sparkData: [] as { v: number }[],
      color: "hsl(var(--chart-3))",
      invertChange: true,
    },
    {
      label: i18n.language === "ru" ? "Время на сайте" : "Avg. Duration",
      value: formatDuration(kpis.avgDuration),
      change: 0,
      sparkData: [] as { v: number }[],
      color: "hsl(var(--chart-5))",
    },
  ];

  // Export
  const exportMeta = { projectName, tabName: t("portalNav.overview", "Обзор"), periodA: `${dateFrom} — ${dateTo}`, language: i18n.language };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!integration?.access_token) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Globe className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          {i18n.language === "ru"
            ? "Подключите Яндекс.Метрику в Интеграциях для отображения данных"
            : "Connect Yandex.Metrika in Integrations to view data"}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6 transition-opacity duration-300", isRefreshing && "opacity-60")}>
      <TabLoadingOverlay show={isRefreshing} />

      <div className="flex items-center justify-end" data-export-ignore>
        <ExportMenu
          onExportPdf={async () => { if (contentRef.current) await exportToPdf(contentRef.current, exportMeta); }}
          onExportExcel={async () => {
            const sheets: ExcelSheet[] = [{ name: "Overview", headers: ["Visits", "Users", "Bounce Rate", "Duration"], rows: [[kpis.visits, kpis.users, `${kpis.bounceRate}%`, formatDuration(kpis.avgDuration)]] }];
            exportToExcel(sheets, exportMeta);
          }}
          onExportWord={async () => {
            const sections = [{ title: "Overview", paragraphs: kpiCards.map(k => `${k.label}: ${k.value}${k.unit || ""}`) }];
            await exportToWord(sections, exportMeta);
          }}
        />
      </div>

      <div ref={contentRef} className="space-y-6">
        {/* === 1. KPI GRID === */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi, i) => (
            <StandardKpiCard key={i} {...kpi} loading={isRefreshing} />
          ))}
        </div>

        {/* === 2. MAIN AREA CHART === */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {i18n.language === "ru" ? "Посещаемость" : "Website Traffic"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="ov-visitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="dateStr" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
                  <Tooltip content={<StandardChartTooltip />} />
                  <Area type="monotone" dataKey="visits" name={i18n.language === "ru" ? "Визиты" : "Visits"} stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#ov-visitGrad)" dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[320px] text-sm text-muted-foreground">
                {i18n.language === "ru" ? "Данные отсутствуют" : "No data available"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* === 3. SOURCES + DEVICES ROW === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Sources donut */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {i18n.language === "ru" ? "Источники трафика" : "Traffic Sources"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sourceData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="w-[160px] h-[160px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                          {sourceData.map((s) => (
                            <Cell key={s.key} fill={SOURCE_COLORS[s.key] || "hsl(var(--muted))"} />
                          ))}
                        </Pie>
                        <Tooltip content={<StandardChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {sourceData.map((s) => (
                      <div key={s.key} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SOURCE_COLORS[s.key] }} />
                        <span className="text-muted-foreground">{SOURCE_ICONS[s.key]}</span>
                        <span className="text-xs font-medium text-foreground flex-1">{s.name}</span>
                        <span className="text-xs tabular-nums font-semibold text-foreground">{s.value.toLocaleString()}</span>
                        <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-right">{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {i18n.language === "ru" ? "Данные отсутствуют" : "No data available"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Devices */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {i18n.language === "ru" ? "Устройства" : "Devices"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deviceData.length > 0 ? (
                <div className="space-y-4">
                  {deviceData.map((d) => (
                    <div key={d.key} className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${SOURCE_COLORS[d.key === "desktop" ? "organic" : d.key === "mobile" ? "ad" : "referral"]}15` }}>
                        <div className="text-muted-foreground">{d.icon}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground">{d.name}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{d.value.toLocaleString()} ({d.pct}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${d.pct}%`, background: SOURCE_COLORS[d.key === "desktop" ? "organic" : d.key === "mobile" ? "ad" : "referral"] }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {i18n.language === "ru" ? "Данные отсутствуют" : "No data available"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* === 4. TOP PAGES MINI === */}
        {topPages.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {i18n.language === "ru" ? "Популярные страницы" : "Top Pages"}
                </CardTitle>
                <button onClick={() => onSwitchTab("traffic")} className="text-xs text-primary hover:underline">
                  {i18n.language === "ru" ? "Все страницы →" : "All pages →"}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topPages.map((page: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                    <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground truncate block">{page.path}</span>
                    </div>
                    <span className="text-sm tabular-nums font-semibold text-foreground">{page.visits.toLocaleString()}</span>
                    {page.fullUrl && (
                      <a href={page.fullUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* === 5. AI MINI-SUMMARY === */}
        <Card className="border-border bg-card border-l-4 border-l-primary/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {i18n.language === "ru" ? "Главное за период" : "Period highlights"}
              </h3>
            </div>
            <ul className="space-y-2">
              {aiSummary.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="text-sm text-foreground/80">{bullet}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* === 6. QUICK LINKS GRID === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border bg-card cursor-pointer hover:shadow-md transition-shadow group" onClick={() => onSwitchTab("goals")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t("portalNav.conversions")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboardTab.details")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card cursor-pointer hover:shadow-md transition-shadow group" onClick={() => onSwitchTab("traffic")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t("portalNav.traffic")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboardTab.details")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card cursor-pointer hover:shadow-md transition-shadow group" onClick={() => onSwitchTab("worklog")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t("portalNav.workLog")}</p>
                <p className="text-xs text-muted-foreground">
                  {workLogs.length > 0
                    ? (i18n.language === "ru" ? `${workLogs.length} записей` : `${workLogs.length} entries`)
                    : t("project.worklog.noTasks")}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
