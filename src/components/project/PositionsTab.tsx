import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ExternalLink, Search, TrendingUp, TrendingDown,
  Minus, Settings, AlertCircle, Trophy,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { GlassCard, StandardKpiCard, MetricTooltip, useTabRefresh, TabLoadingOverlay } from "./shared-ui";
import { useDateRange } from "@/contexts/DateRangeContext";
import { cn } from "@/lib/utils";

/* ── demo data generators ── */
function seedRand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

interface PositionsTabProps {
  projectId: string;
  hasTopvisor?: boolean;
  onNavigateSettings?: () => void;
}

const QUERIES_DEMO = [
  { query: "seo продвижение сайта", pos: 4, prev: 7, url: "/services/seo", freq: 3200 },
  { query: "раскрутка сайтов москва", pos: 8, prev: 6, url: "/services/promotion", freq: 2100 },
  { query: "аналитика трафика", pos: 2, prev: 3, url: "/analytics", freq: 1800 },
  { query: "контекстная реклама настройка", pos: 15, prev: 12, url: "/services/ppc", freq: 1500 },
  { query: "оптимизация сайта", pos: 5, prev: 5, url: "/services/optimization", freq: 1400 },
  { query: "продвижение интернет магазина", pos: 11, prev: 18, url: "/services/ecommerce", freq: 1200 },
  { query: "seo аудит", pos: 3, prev: 4, url: "/services/audit", freq: 980 },
  { query: "ссылочное продвижение", pos: 22, prev: 19, url: "/services/links", freq: 870 },
  { query: "локальное seo", pos: 6, prev: 9, url: "/services/local", freq: 760 },
  { query: "техническая оптимизация", pos: 9, prev: 11, url: "/services/tech", freq: 650 },
  { query: "контент маркетинг", pos: 14, prev: 14, url: "/blog/content", freq: 540 },
  { query: "юзабилити аудит", pos: 7, prev: 10, url: "/services/ux", freq: 420 },
];

function generateVisibilityChart(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const seed = i + 42;
    const current = 38 + seedRand(seed) * 20;
    const prev = 32 + seedRand(seed + 100) * 18;
    return {
      day: `${i + 1}`,
      current: Math.round(current * 10) / 10,
      prev: Math.round(prev * 10) / 10,
    };
  });
}

export function PositionsTab({ projectId, hasTopvisor = false, onNavigateSettings }: PositionsTabProps) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const { loading } = useTabRefresh();

  const [engine, setEngine] = useState("yandex");
  const [region, setRegion] = useState("moscow");
  const [group, setGroup] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Always use demo data for now — will plug Topvisor API later
  const queries = useMemo(() => {
    let filtered = [...QUERIES_DEMO];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => r.query.toLowerCase().includes(q));
    }
    return filtered;
  }, [searchQuery]);

  const visibilityData = useMemo(() => generateVisibilityChart(30), []);

  // KPI calculations
  const avgPos = queries.reduce((s, q) => s + q.pos, 0) / queries.length;
  const avgPrev = queries.reduce((s, q) => s + q.prev, 0) / queries.length;
  const posChange = avgPrev - avgPos; // positive = improved
  const visibility = Math.round((queries.filter((q) => q.pos <= 10).length / queries.length) * 100);

  const top3 = queries.filter((q) => q.pos <= 3).length;
  const top10 = queries.filter((q) => q.pos <= 10).length;
  const top30 = queries.filter((q) => q.pos <= 30).length;
  const outside = queries.length - top30;
  const total = queries.length;

  const ups = queries.filter((q) => q.pos < q.prev).length;
  const downs = queries.filter((q) => q.pos > q.prev).length;
  const stable = queries.filter((q) => q.pos === q.prev).length;

  const sparkData = visibilityData.slice(-14).map((d) => ({ v: d.current }));

  // Empty state
  if (!hasTopvisor) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Trophy className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">{t("positions.emptyTitle")}</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">{t("positions.emptyDesc")}</p>
        <Button className="gap-2" onClick={onNavigateSettings}>
          <Settings className="h-4 w-4" />
          {t("positions.configure")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {loading && <TabLoadingOverlay />}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StandardKpiCard
          label={t("positions.avgPosition")}
          value={avgPos.toFixed(1)}
          change={posChange}
          invertChange
          tooltipKey="avgPosition"
          sparkData={sparkData}
          loading={loading}
        />
        <StandardKpiCard
          label={t("positions.visibility")}
          value={`${visibility}%`}
          change={5.2}
          sparkData={sparkData}
          loading={loading}
        />

        {/* Distribution bar */}
        <GlassCard>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">{t("positions.distribution")}</span>
              <MetricTooltip metricKey="avgPosition" />
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {top3 > 0 && <div className="bg-emerald-500" style={{ width: `${(top3 / total) * 100}%` }} />}
              {(top10 - top3) > 0 && <div className="bg-primary" style={{ width: `${((top10 - top3) / total) * 100}%` }} />}
              {(top30 - top10) > 0 && <div className="bg-amber-500" style={{ width: `${((top30 - top10) / total) * 100}%` }} />}
              {outside > 0 && <div className="bg-muted-foreground/30" style={{ width: `${(outside / total) * 100}%` }} />}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Top 3: {top3}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />Top 10: {top10 - top3}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Top 30: {top30 - top10}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />{t("positions.outside")}: {outside}</span>
            </div>
          </CardContent>
        </GlassCard>

        {/* Ups/Downs */}
        <GlassCard>
          <CardContent className="p-4 space-y-2">
            <span className="text-xs text-muted-foreground font-medium">{t("positions.movement")}</span>
            <div className="flex items-baseline gap-4">
              <div className="flex items-center gap-1 text-emerald-500">
                <TrendingUp className="h-4 w-4" />
                <span className="text-lg font-bold">{ups}</span>
              </div>
              <div className="flex items-center gap-1 text-destructive">
                <TrendingDown className="h-4 w-4" />
                <span className="text-lg font-bold">{downs}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Minus className="h-4 w-4" />
                <span className="text-lg font-bold">{stable}</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">{t("positions.movementHint")}</p>
          </CardContent>
        </GlassCard>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={engine} onValueChange={setEngine}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="yandex">{t("engines.yandex")}</SelectItem>
            <SelectItem value="google">{t("engines.google")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="moscow">{isRu ? "Москва" : "Moscow"}</SelectItem>
            <SelectItem value="spb">{isRu ? "Санкт-Петербург" : "Saint Petersburg"}</SelectItem>
            <SelectItem value="all">{isRu ? "Все регионы" : "All regions"}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("positions.allGroups")}</SelectItem>
            <SelectItem value="brand">{isRu ? "Брендовые" : "Branded"}</SelectItem>
            <SelectItem value="commercial">{isRu ? "Коммерческие" : "Commercial"}</SelectItem>
            <SelectItem value="info">{isRu ? "Информационные" : "Informational"}</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("positions.searchPlaceholder")}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Visibility chart */}
      <GlassCard>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t("positions.visibilityChart")}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={visibilityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  backdropFilter: "blur(8px)",
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="current" name={t("positions.currentPeriod")} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="prev" name={t("positions.prevPeriod")} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </GlassCard>

      {/* Queries table */}
      <GlassCard>
        <CardContent className="p-0">
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-foreground">{t("positions.tableTitle")}</h3>
            <p className="text-xs text-muted-foreground">{t("positions.tableSubtitle", { count: queries.length })}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">{t("positions.colQuery")}</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">{t("positions.colPosition")}</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">{t("positions.colDelta")}</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">{t("positions.colUrl")}</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">{t("positions.colFreq")}</th>
                </tr>
              </thead>
              <tbody>
                {queries.map((q, i) => {
                  const delta = q.prev - q.pos; // positive = improved
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-3 text-foreground font-medium">{q.query}</td>
                      <td className="p-3 text-center">
                        <span className="text-foreground font-bold text-base">{q.pos}</span>
                      </td>
                      <td className="p-3 text-center">
                        {delta > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-500 font-medium">
                            <TrendingUp className="h-3.5 w-3.5" />+{delta}
                          </span>
                        ) : delta < 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-destructive font-medium">
                            <TrendingDown className="h-3.5 w-3.5" />{delta}
                          </span>
                        ) : (
                          <span className="text-muted-foreground"><Minus className="h-3.5 w-3.5 inline" /></span>
                        )}
                      </td>
                      <td className="p-3">
                        <a
                          href={q.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {q.url} <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{q.freq.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </GlassCard>
    </div>
  );
}
