import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Pencil, Check, X, ChevronDown, ChevronUp, Loader2, Wand2,
  Search, Megaphone, Globe, Share2, Link, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useDateRange } from "@/contexts/DateRangeContext";

// Types for the new channel-based summary
interface ChannelInsight {
  insight: string;
  trend: "up" | "down" | "stable";
}

interface AiSummaryData {
  general: {
    happened: string;
    why: string;
    recommendation: string;
  };
  channels: {
    search?: ChannelInsight;
    direct?: ChannelInsight;
    ad?: ChannelInsight;
    social?: ChannelInsight;
    referral?: ChannelInsight;
  };
}

// Backward compat: old format
interface LegacySummary {
  happened: string;
  why: string;
  recommendation: string;
}

interface LiveMetrics {
  dateFrom?: string;
  dateTo?: string;
  visits?: number;
  users?: number;
  bounceRate?: number;
  pageDepth?: number;
  avgDuration?: number;
  dailyVisits?: { date: string; visits: number }[];
  sourceBreakdown?: { name: string; value: number; pct: number }[];
  topPages?: { path: string; visits: number }[];
  devices?: { name: string; value: number; pct: number }[];
}

interface AiInsightsBlockProps {
  projectId?: string;
  summary?: AiSummaryData | LegacySummary;
  isAdmin: boolean;
  onSave?: (summary: AiSummaryData) => void;
  trafficSources?: { source: string; visits: number }[];
  liveMetrics?: LiveMetrics;
}

type ChannelKey = "general" | "search" | "direct" | "ad" | "social" | "referral";

const CHANNEL_CONFIG: { key: ChannelKey; icon: typeof Search; colorClass: string }[] = [
  { key: "general", icon: LayoutGrid, colorClass: "from-primary to-purple-500" },
  { key: "search", icon: Search, colorClass: "from-emerald-500 to-teal-600" },
  { key: "direct", icon: Globe, colorClass: "from-blue-500 to-indigo-600" },
  { key: "ad", icon: Megaphone, colorClass: "from-orange-500 to-red-500" },
  { key: "social", icon: Share2, colorClass: "from-pink-500 to-rose-600" },
  { key: "referral", icon: Link, colorClass: "from-violet-500 to-purple-600" },
];

function normalizeSummary(raw: AiSummaryData | LegacySummary | undefined): AiSummaryData {
  if (!raw) return { general: { happened: "", why: "", recommendation: "" }, channels: {} };
  if ("general" in raw && raw.general) return raw as AiSummaryData;
  // Legacy format
  const legacy = raw as LegacySummary;
  return {
    general: { happened: legacy.happened || "", why: legacy.why || "", recommendation: legacy.recommendation || "" },
    channels: {},
  };
}

function TrendDot({ trend }: { trend?: "up" | "down" | "stable" }) {
  if (!trend || trend === "stable") return null;
  return (
    <span
      className={cn(
        "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
        trend === "up" ? "bg-emerald-500" : "bg-red-500"
      )}
    />
  );
}

export function AiInsightsBlock({ projectId, summary: rawSummary, isAdmin, onSave, trafficSources, liveMetrics }: AiInsightsBlockProps) {
  const { t, i18n } = useTranslation();
  const { channel: globalChannel, setChannel: setGlobalChannel } = useDateRange();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Map global channel to AI block's channel key
  const channelToKey = (ch: string): ChannelKey => {
    if (ch === "all") return "general";
    if (ch === "organic") return "search";
    return ch as ChannelKey;
  };
  const keyToChannel = (key: ChannelKey): string => {
    if (key === "general") return "all";
    if (key === "search") return "organic";
    return key;
  };

  const activeChannel = channelToKey(globalChannel);
  const handleChannelClick = (key: ChannelKey) => {
    setGlobalChannel(keyToChannel(key) as any);
  };

  const summary = useMemo(() => normalizeSummary(rawSummary), [rawSummary]);
  const [draft, setDraft] = useState(summary.general);

  const hasSummary = summary.general.happened || summary.general.why || summary.general.recommendation;
  const hasChannels = Object.keys(summary.channels).length > 0;

  const handleSave = () => {
    onSave?.({ ...summary, general: draft });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(summary.general);
    setEditing(false);
  };

  const handleGenerate = async () => {
    if (!projectId) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

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
            language: i18n.language,
            traffic_sources: trafficSources || [],
            live_metrics: liveMetrics || undefined,
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || data.error) {
        if (resp.status === 402) throw new Error(t("aiInsights.creditsExhausted", "AI credits exhausted. Please top up your balance in Settings → Workspace → Usage."));
        if (resp.status === 429) throw new Error(t("aiInsights.rateLimited", "Too many requests. Please wait a moment and try again."));
        throw new Error(data.error || "AI generation failed");
      }

      if (data.summary) {
        const normalized = normalizeSummary(data.summary);
        onSave?.(normalized);
        setGlobalChannel("all");
        toast.success(t("aiInsights.generated"));
      }
    } catch (err: any) {
      toast.error(err.message || "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const generalSections = [
    { key: "happened" as const, icon: "📊", label: t("aiInsights.happened") },
    { key: "why" as const, icon: "🔍", label: t("aiInsights.why") },
    { key: "recommendation" as const, icon: "💡", label: t("aiInsights.recommendation") },
  ];

  const activeChannelData = activeChannel === "general"
    ? null
    : summary.channels[activeChannel as keyof typeof summary.channels];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-xl border border-primary/20 overflow-hidden"
    >
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-purple-500/5 to-primary/8 backdrop-blur-sm" />
      <div className="absolute inset-0 bg-card/60" />

      <div className="relative p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("aiInsights.title")}</h3>
              <p className="text-[11px] text-muted-foreground">{t("aiInsights.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && !editing && (
              <>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                  onClick={handleGenerate} disabled={generating}
                >
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  {t("aiInsights.generate")}
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                  onClick={() => { setDraft(summary.general); setEditing(true); }}
                >
                  <Pencil className="h-3 w-3" />
                  {t("aiInsights.edit")}
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setExpanded(!expanded)}>
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
              {generating ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{t("aiInsights.generating")}</p>
                </div>
              ) : editing ? (
                <div className="space-y-4">
                  {generalSections.map((s) => (
                    <div key={s.key} className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <span>{s.icon}</span> {s.label}
                      </label>
                      <Textarea
                        value={draft[s.key]}
                        onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                        rows={2}
                        className="bg-background/60 border-primary/15 text-sm resize-none"
                        placeholder={t("aiInsights.placeholder")}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSave}>
                      <Check className="h-3 w-3" /> {t("common.save")}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={handleCancel}>
                      <X className="h-3 w-3" /> {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : hasSummary ? (
                <div className="space-y-4">
                  {/* Channel badges row — scrollable on mobile */}
                  {hasChannels && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                      {CHANNEL_CONFIG.map(({ key, icon: Icon, colorClass }) => {
                        const isActive = activeChannel === key;
                        const channelData = key === "general" ? null : summary.channels[key as keyof typeof summary.channels];
                        const trend = channelData?.trend;

                        return (
                          <button
                            key={key}
                            onClick={() => handleChannelClick(key)}
                            className={cn(
                              "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0",
                              isActive
                                ? `bg-gradient-to-r ${colorClass} text-white shadow-sm`
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {t(`aiInsights.channels.${key}`)}
                            {key !== "general" && <TrendDot trend={trend} />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Content area with animation */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeChannel}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                    >
                      {activeChannel === "general" ? (
                        <div className="space-y-3">
                          {generalSections.map((s, i) =>
                            summary.general[s.key] ? (
                              <motion.div
                                key={s.key}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1, duration: 0.3 }}
                                className="flex gap-3"
                              >
                                <span className="text-base mt-0.5 shrink-0">{s.icon}</span>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">{s.label}</p>
                                  <p className="text-sm text-foreground leading-relaxed">{summary.general[s.key]}</p>
                                </div>
                              </motion.div>
                            ) : null
                          )}
                        </div>
                      ) : activeChannelData ? (
                        <div className="flex gap-3 items-start">
                          <div className={cn(
                            "flex items-center justify-center h-8 w-8 rounded-lg shrink-0 bg-gradient-to-br text-white",
                            CHANNEL_CONFIG.find(c => c.key === activeChannel)?.colorClass
                          )}>
                            {(() => {
                              const cfg = CHANNEL_CONFIG.find(c => c.key === activeChannel);
                              const Icon = cfg?.icon || Search;
                              return <Icon className="h-4 w-4" />;
                            })()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs font-semibold text-muted-foreground">
                                {t(`aiInsights.channels.${activeChannel}`)}
                              </p>
                              <span className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                activeChannelData.trend === "up" && "bg-emerald-500/15 text-emerald-500",
                                activeChannelData.trend === "down" && "bg-red-500/15 text-red-500",
                                activeChannelData.trend === "stable" && "bg-muted text-muted-foreground",
                              )}>
                                {activeChannelData.trend === "up" && "↑"}
                                {activeChannelData.trend === "down" && "↓"}
                                {activeChannelData.trend === "stable" && "→"}
                                {t(`aiInsights.trend.${activeChannelData.trend}`)}
                              </span>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed">{activeChannelData.insight}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t("aiInsights.noChannelData", "Нет данных по этому каналу")}
                        </p>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">{t("aiInsights.empty")}</p>
                  {isAdmin && (
                    <div className="flex gap-2 justify-center mt-3">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleGenerate} disabled={generating}>
                        <Wand2 className="h-3 w-3" />
                        {t("aiInsights.generate")}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditing(true)}>
                        <Pencil className="h-3 w-3" />
                        {t("aiInsights.addSummary")}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
