import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Minus, AlertTriangle, CheckCircle2, Target, Lightbulb, BarChart3,
  Search, Globe, Megaphone, Share2, Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TrafficSource {
  source: string;
  visits: number;
}

interface GoalData {
  id: number;
  name: string;
  reaches: number;
  conversionRate: number;
  change: number;
}

interface Props {
  projectId: string;
  metrikaStats: {
    total_visits: number;
    total_users: number;
    bounce_rate: number | string;
    page_depth: number | string;
    avg_duration_seconds: number;
    date_from: string;
    date_to: string;
    visits_by_day: any;
    traffic_sources: any;
  } | null;
  keywords: { keyword: string; position: number; change: number }[];
  goals?: GoalData[];
}

interface ReportData {
  general: {
    happened: string;
    why: string;
    recommendation: string;
  };
  channels: Record<string, { insight: string; trend: "up" | "down" | "stable" }>;
  business_insight?: string;
  recommendations?: { text: string; priority: string; category: string }[];
  goals_insight?: string;
}

type ChannelKey = "search" | "direct" | "ad" | "social" | "referral";

const CHANNEL_OPTIONS: { key: ChannelKey; label: string; icon: any }[] = [
  { key: "search", label: "Поисковый", icon: Search },
  { key: "direct", label: "Прямой", icon: Globe },
  { key: "ad", label: "Рекламный", icon: Megaphone },
  { key: "social", label: "Соцсети", icon: Share2 },
  { key: "referral", label: "Реферальный", icon: Link },
];

const CHANNEL_LABELS: Record<string, string> = {
  search: "Поисковый",
  direct: "Прямой",
  ad: "Рекламный",
  social: "Социальный",
  referral: "Реферальный",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

const CATEGORY_ICONS: Record<string, string> = {
  SEO: "🔍", Content: "✍️", Technical: "⚙️", UX: "🎨",
  Ads: "📢", Analytics: "📊", Links: "🔗", Conversions: "🎯",
};

const CHANNEL_ICONS: Record<string, any> = {
  search: Search, direct: Globe, ad: Megaphone, social: Share2, referral: Link,
};

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function AiMonthlyReport({ projectId, metrikaStats, keywords, goals = [] }: Props) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedChannels, setSelectedChannels] = useState<ChannelKey[]>(["search"]);
  const [includeGoals, setIncludeGoals] = useState(true);

  const toggleChannel = (ch: ChannelKey) => {
    setSelectedChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const handleGenerate = async () => {
    if (selectedChannels.length === 0) {
      toast.error("Выберите хотя бы один канал трафика");
      return;
    }
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Необходима авторизация");

      const sources = (metrikaStats?.traffic_sources || []) as TrafficSource[];
      const dailyVisits = (metrikaStats?.visits_by_day || []) as { day: string; visits: number }[];

      const liveMetrics: Record<string, any> = {
        dateFrom: metrikaStats?.date_from,
        dateTo: metrikaStats?.date_to,
        visits: metrikaStats?.total_visits,
        users: metrikaStats?.total_users,
        bounceRate: metrikaStats?.bounce_rate,
        pageDepth: metrikaStats?.page_depth,
        avgDuration: metrikaStats?.avg_duration_seconds,
        dailyVisits: dailyVisits.slice(-14),
        sourceBreakdown: sources.map(s => {
          const total = sources.reduce((acc, src) => acc + src.visits, 0);
          return { name: s.source, value: s.visits, pct: total > 0 ? Math.round((s.visits / total) * 100) : 0 };
        }),
        selectedChannels,
      };

      // Add keywords context
      if (keywords.length > 0) {
        const top3 = keywords.filter(k => k.position <= 3).length;
        const top10 = keywords.filter(k => k.position <= 10).length;
        const top30 = keywords.filter(k => k.position <= 30).length;
        const avgPos = keywords.reduce((s, k) => s + k.position, 0) / keywords.length;
        const improved = keywords.filter(k => k.change > 0).length;
        const declined = keywords.filter(k => k.change < 0).length;

        liveMetrics.keywordsContext = {
          total: keywords.length,
          top3, top10, top30,
          avgPosition: avgPos.toFixed(1),
          improved, declined,
          topKeywords: keywords.slice(0, 15).map(k => `${k.keyword} (pos ${k.position}, ${k.change > 0 ? "+" : ""}${k.change})`),
        };
      }

      // Add goals context
      if (includeGoals && goals.length > 0) {
        liveMetrics.goalsContext = {
          total: goals.length,
          totalReaches: goals.reduce((s, g) => s + g.reaches, 0),
          avgConversionRate: (goals.reduce((s, g) => s + g.conversionRate, 0) / goals.length).toFixed(2),
          goals: goals.slice(0, 10).map(g => ({
            name: g.name,
            reaches: g.reaches,
            cr: g.conversionRate,
            change: g.change,
          })),
        };
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-summary`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project_id: projectId,
            language: "ru",
            mode: "deep_analysis",
            live_metrics: liveMetrics,
            traffic_sources: sources,
          }),
        }
      );

      const data = await resp.json();
      if (!resp.ok || data.error) throw new Error(data.error || "Ошибка генерации");

      const result: ReportData = {
        general: data.summary?.general || { happened: "", why: "", recommendation: "" },
        channels: data.summary?.channels || {},
        business_insight: data.business_insight,
        recommendations: data.recommendations,
        goals_insight: data.goals_insight,
      };

      setReport(result);
      setExpanded(true);
      toast.success("Отчёт сгенерирован");
    } catch (err: any) {
      toast.error(err.message || "Ошибка");
    } finally {
      setGenerating(false);
    }
  };

  // Channel selection UI block
  const ChannelSelector = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {CHANNEL_OPTIONS.map(({ key, label, icon: Icon }) => {
        const checked = selectedChannels.includes(key);
        return (
          <label
            key={key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 cursor-pointer transition-all text-[12px] font-medium select-none",
              checked
                ? "border-primary bg-primary/10 text-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50"
            )}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={() => toggleChannel(key)}
              className="h-3.5 w-3.5 rounded-[4px]"
            />
            <Icon className="h-3 w-3" />
            {label}
          </label>
        );
      })}

      {goals.length > 0 && (
        <>
          <div className="w-px h-5 bg-border mx-0.5" />
          <label className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 cursor-pointer transition-all text-[12px] font-medium select-none",
            includeGoals
              ? "border-primary bg-primary/10 text-foreground shadow-sm"
              : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50"
          )}>
            <Checkbox
              checked={includeGoals}
              onCheckedChange={(v) => setIncludeGoals(!!v)}
              className="h-3.5 w-3.5 rounded-[4px]"
            />
            <Target className="h-3 w-3" />
            Цели и конверсии ({goals.length})
          </label>
        </>
      )}
    </div>
  );

  if (!report && !generating) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-purple-500/5 overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">AI-аналитика за месяц</h3>
                <p className="text-[11px] text-muted-foreground">
                  Профессиональный SEO-отчёт на основе данных Метрики
                  {keywords.length > 0 ? ` и ${keywords.length} ключевых слов` : ""}
                  {goals.length > 0 ? ` • ${goals.length} целей` : ""}
                </p>
              </div>
            </div>
            <Button
              onClick={handleGenerate}
              className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-primary-foreground shadow-lg shadow-primary/20"
            >
              <Sparkles className="h-4 w-4" />
              Сгенерировать отчёт
            </Button>
          </div>
          <ChannelSelector />
        </div>
      </Card>
    );
  }

  if (generating) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-purple-500/5">
        <div className="p-8 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center animate-pulse">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <Loader2 className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Анализирую данные...</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Каналы: {selectedChannels.map(ch => CHANNEL_LABELS[ch]).join(", ")}
              {includeGoals && goals.length > 0 ? " + конверсии" : ""}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (!report) return null;

  // Filter channels to only show selected ones
  const displayChannels = Object.entries(report.channels)
    .filter(([key]) => selectedChannels.includes(key as ChannelKey));

  return (
    <Card className="border-primary/20 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-card to-purple-500/10 px-5 py-3.5 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI-отчёт за месяц</h3>
            <p className="text-[10px] text-muted-foreground">
              {metrikaStats?.date_from} — {metrikaStats?.date_to}
              {" • "}
              {selectedChannels.map(ch => CHANNEL_LABELS[ch]).join(", ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="sm"
            className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-primary"
            onClick={() => { setReport(null); }}
          >
            Настроить
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            <Sparkles className="h-3 w-3" />
            Обновить
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-5 space-y-5">
              {/* General analysis — 3 blocks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { key: "happened", icon: BarChart3, label: "Что произошло", color: "text-primary" },
                  { key: "why", icon: AlertTriangle, label: "Почему", color: "text-amber-500" },
                  { key: "recommendation", icon: Lightbulb, label: "Рекомендация", color: "text-emerald-500" },
                ].map(({ key, icon: Icon, label, color }, i) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="rounded-lg border border-border bg-muted/20 p-3.5"
                  >
                    <div className={cn("flex items-center gap-2 mb-2", color)}>
                      <Icon className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
                    </div>
                    <p className="text-[13px] text-foreground leading-relaxed">
                      {report.general[key as keyof typeof report.general] || "—"}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Channel breakdown — only selected */}
              {displayChannels.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Анализ по выбранным каналам
                  </h4>
                  <div className={cn(
                    "grid gap-2.5",
                    displayChannels.length <= 2 ? "grid-cols-1 sm:grid-cols-2" :
                    displayChannels.length <= 3 ? "grid-cols-1 sm:grid-cols-3" :
                    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
                  )}>
                    {displayChannels.map(([key, data], i) => {
                      const Icon = CHANNEL_ICONS[key] || Globe;
                      return (
                        <motion.div
                          key={key}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3 + i * 0.08 }}
                          className="rounded-lg border border-border bg-card p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-[11px] font-semibold text-foreground">
                                {CHANNEL_LABELS[key] || key}
                              </span>
                            </div>
                            <TrendIcon trend={data.trend} />
                          </div>
                          <p className="text-[12px] text-muted-foreground leading-relaxed">
                            {data.insight}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Goals insight */}
              {report.goals_insight && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-emerald-500" />
                    <span className="text-[12px] font-semibold text-emerald-500 uppercase tracking-wide">
                      Цели и конверсии
                    </span>
                  </div>
                  <p className="text-[13px] text-foreground leading-relaxed">{report.goals_insight}</p>
                </motion.div>
              )}

              {/* Business insight */}
              {report.business_insight && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="rounded-lg border border-primary/15 bg-primary/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-[12px] font-semibold text-primary uppercase tracking-wide">Бизнес-выводы</span>
                  </div>
                  <p className="text-[13px] text-foreground leading-relaxed">{report.business_insight}</p>
                </motion.div>
              )}

              {/* Recommendations */}
              {report.recommendations && report.recommendations.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <h4 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    План действий
                  </h4>
                  <div className="space-y-2">
                    {report.recommendations.map((rec, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.65 + i * 0.08 }}
                        className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                      >
                        <span className="text-base shrink-0 mt-0.5">
                          {CATEGORY_ICONS[rec.category] || "📋"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-foreground leading-relaxed">{rec.text}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className={cn("text-[9px] px-1.5 h-5", PRIORITY_STYLES[rec.priority])}>
                            {rec.priority === "high" ? "Высокий" : rec.priority === "medium" ? "Средний" : "Низкий"}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] px-1.5 h-5">
                            {rec.category}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
