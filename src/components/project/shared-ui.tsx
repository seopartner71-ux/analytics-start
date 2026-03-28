import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpRight, ArrowDownRight, Minus, HelpCircle } from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer,
} from "recharts";
import { useDateRange } from "@/contexts/DateRangeContext";

/* ═══════════════════════════════════════════════════════
   1. GlassCard — glassmorphism card wrapper
   ═══════════════════════════════════════════════════════ */
export function GlassCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card className={cn(
      "relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow",
      className
    )} {...props}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-primary/[0.02] pointer-events-none" />
      <div className="relative">{children}</div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
   2. MetricTooltip — "?" icon with explanation
   ═══════════════════════════════════════════════════════ */
const METRIC_TOOLTIPS: Record<string, { ru: string; en: string }> = {
  bounceRate: {
    ru: "Процент посетителей, которые ушли с сайта, просмотрев только одну страницу. Чем ниже — тем лучше.",
    en: "Percentage of visitors who left after viewing just one page. Lower is better.",
  },
  ctr: {
    ru: "Click-Through Rate — отношение кликов к показам. Показывает, как часто пользователи нажимают на вашу ссылку в поиске.",
    en: "Click-Through Rate — ratio of clicks to impressions. Shows how often users click your link in search results.",
  },
  avgPosition: {
    ru: "Средняя позиция сайта в результатах поиска. Чем ближе к 1 — тем лучше.",
    en: "Average position of your site in search results. Closer to 1 is better.",
  },
  conversionRate: {
    ru: "Процент посетителей, которые выполнили целевое действие (заявка, звонок, покупка).",
    en: "Percentage of visitors who completed a target action (form submission, call, purchase).",
  },
  pageDepth: {
    ru: "Среднее количество страниц, которые просматривает один посетитель за визит.",
    en: "Average number of pages viewed per visit by a single user.",
  },
  avgDuration: {
    ru: "Среднее время, которое посетитель проводит на сайте за один визит.",
    en: "Average time a visitor spends on the site per visit.",
  },
  lcp: {
    ru: "Largest Contentful Paint — время загрузки главного контента на странице. До 2.5с — хорошо.",
    en: "Largest Contentful Paint — time to load the main content. Under 2.5s is good.",
  },
  fid: {
    ru: "First Input Delay — задержка отклика на первое действие пользователя. До 100мс — хорошо.",
    en: "First Input Delay — delay before the page responds to first user input. Under 100ms is good.",
  },
  cls: {
    ru: "Cumulative Layout Shift — смещение элементов при загрузке. До 0.1 — хорошо.",
    en: "Cumulative Layout Shift — visual stability during load. Under 0.1 is good.",
  },
  visits: {
    ru: "Общее количество посещений сайта за выбранный период.",
    en: "Total number of site visits for the selected period.",
  },
  visitors: {
    ru: "Уникальные пользователи, посетившие сайт за выбранный период.",
    en: "Unique users who visited the site during the selected period.",
  },
  healthScore: {
    ru: "Общая оценка технического состояния сайта на основе найденных ошибок.",
    en: "Overall site health score based on detected technical errors.",
  },
};

export function MetricTooltip({ metricKey }: { metricKey: string }) {
  const { i18n } = useTranslation();
  const tip = METRIC_TOOLTIPS[metricKey];
  if (!tip) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
          {i18n.language === "ru" ? tip.ru : tip.en}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ═══════════════════════════════════════════════════════
   3. StandardKpiCard — unified KPI card with sparkline
   ═══════════════════════════════════════════════════════ */
interface StandardKpiCardProps {
  label: string;
  value: string;
  unit?: string;
  change?: number;
  sparkData?: { v: number }[];
  color?: string;
  tooltipKey?: string;
  /** For bounce rate — negative change is good */
  invertChange?: boolean;
  loading?: boolean;
}

export function StandardKpiCard({
  label, value, unit, change = 0, sparkData = [],
  color = "hsl(var(--primary))", tooltipKey, invertChange, loading,
}: StandardKpiCardProps) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const goodDirection = invertChange ? isNegative : isPositive;

  if (loading) {
    return (
      <GlassCard>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex items-end justify-between gap-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-10 w-20" />
          </div>
        </CardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="group">
      <CardContent className="p-5">
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          {tooltipKey && <MetricTooltip metricKey={tooltipKey} />}
          {change !== 0 && (
            <span className={cn(
              "ml-auto inline-flex items-center gap-0.5 text-xs font-semibold rounded-full px-1.5 py-0.5",
              goodDirection
                ? "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
                : "text-red-500 bg-red-500/10 dark:text-red-400"
            )}>
              {isPositive ? <ArrowUpRight className="h-3 w-3" /> : isNegative ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {value}
            {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
          </p>
          {sparkData.length > 2 && (
            <div className="w-24 h-10 opacity-70 group-hover:opacity-100 transition-opacity">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={color}
                    strokeWidth={1.5}
                    fill={`url(#spark-${label.replace(/\s/g, "")})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </GlassCard>
  );
}

/* ═══════════════════════════════════════════════════════
   4. useTabRefresh — skeleton loading hook
   ═══════════════════════════════════════════════════════ */
export function useTabRefresh(duration = 500) {
  const { applyVersion } = useDateRange();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prevVersion = useRef(applyVersion);

  useEffect(() => {
    if (applyVersion !== prevVersion.current) {
      prevVersion.current = applyVersion;
      setIsRefreshing(true);
      const timer = setTimeout(() => setIsRefreshing(false), duration);
      return () => clearTimeout(timer);
    }
  }, [applyVersion, duration]);

  return isRefreshing;
}

/* ═══════════════════════════════════════════════════════
   5. TabLoadingOverlay — skeleton overlay
   ═══════════════════════════════════════════════════════ */
export function TabLoadingOverlay({ show }: { show: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
      <div className="h-3.5 w-3.5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
      {t("project.analytics.loading", "Обновление данных...")}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   6. ChartTooltipContent — standard chart tooltip
   ═══════════════════════════════════════════════════════ */
export function StandardChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 min-w-[140px]">
      {label && <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || p.stroke }} />
            {p.name}
          </span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: p.color || p.stroke }}>
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   7. SkeletonChart — placeholder for charts
   ═══════════════════════════════════════════════════════ */
export function SkeletonChart({ height = 300 }: { height?: number }) {
  return (
    <div className="space-y-3" style={{ height }}>
      <div className="flex items-end justify-between gap-2 h-full">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}
