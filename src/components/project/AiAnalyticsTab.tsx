import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Sparkles, Loader2, Wand2, Brain, Target, TrendingUp,
  CheckCircle2, ArrowRight, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDateRange } from "@/contexts/DateRangeContext";
import { AiInsightsBlock } from "./AiInsightsBlock";

interface AiAnalyticsTabProps {
  projectId: string;
  projectName: string;
  summary?: any;
  isAdmin: boolean;
  onSaveSummary: (summary: any) => void;
  trafficSources: any[];
  liveMetrics?: any;
}

interface Recommendation {
  text: string;
  priority: "high" | "medium" | "low";
  category: string;
}

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
};

export function AiAnalyticsTab({
  projectId, projectName, summary, isAdmin, onSaveSummary, trafficSources, liveMetrics,
}: AiAnalyticsTabProps) {
  const { t, i18n } = useTranslation();
  const { appliedRange } = useDateRange();
  const [generating, setGenerating] = useState(false);
  const [businessInsight, setBusinessInsight] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingDeep, setLoadingDeep] = useState(false);

  const generateDeepAnalysis = async () => {
    setLoadingDeep(true);
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
            traffic_sources: trafficSources,
            mode: "deep_analysis",
            live_metrics: liveMetrics || undefined,
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || data.error) {
        if (resp.status === 402) throw new Error(t("aiInsights.creditsExhausted"));
        if (resp.status === 429) throw new Error(t("aiInsights.rateLimited"));
        throw new Error(data.error || "AI generation failed");
      }

      if (data.summary) onSaveSummary(data.summary);
      if (data.business_insight) setBusinessInsight(data.business_insight);
      if (data.recommendations) setRecommendations(data.recommendations);

      if (!data.business_insight && !data.recommendations) {
        toast.info(i18n.language === "ru"
          ? "AI пока не вернул глубокий анализ — попробуйте позже"
          : "AI did not return deep analysis yet — try again later");
        return;
      }

      toast.success(t("aiInsights.generated"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingDeep(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-purple-500 to-pink-500 text-foreground shadow-lg shadow-primary/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("aiAnalytics.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("aiAnalytics.subtitle")}</p>
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={generateDeepAnalysis}
            disabled={loadingDeep}
            className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-primary-foreground shadow-lg shadow-primary/20"
          >
            {loadingDeep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {t("aiAnalytics.generateFull")}
          </Button>
        )}
      </div>

      {/* AI Summary block (existing) */}
      <AiInsightsBlock
        projectId={projectId}
        summary={summary}
        isAdmin={isAdmin}
        onSave={onSaveSummary}
        trafficSources={trafficSources}
        liveMetrics={liveMetrics}
      />

      {/* Business meaning block */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-xl border border-border overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-foreground">
              <Brain className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{t("aiAnalytics.businessMeaning")}</h3>
          </div>

          {loadingDeep ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[75%]" />
              <Skeleton className="h-4 w-[85%]" />
            </div>
          ) : businessInsight ? (
            <p className="text-sm text-foreground/90 leading-relaxed">{businessInsight}</p>
          ) : (
            <div className="text-center py-8">
              <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t("aiAnalytics.noAnalysis")}</p>
              {isAdmin && (
                <Button
                  variant="outline" size="sm"
                  className="mt-3 gap-1.5 text-xs"
                  onClick={generateDeepAnalysis}
                  disabled={loadingDeep}
                >
                  <Wand2 className="h-3 w-3" />
                  {t("aiAnalytics.runAnalysis")}
                </Button>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative rounded-xl border border-border overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-primary/5" />
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-foreground">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{t("aiAnalytics.recommendations")}</h3>
                <p className="text-[11px] text-muted-foreground">{t("aiAnalytics.recommendationsSubtitle")}</p>
              </div>
            </div>
            {recommendations.length > 0 && (
              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                {recommendations.length} {t("aiAnalytics.steps")}
              </Badge>
            )}
          </div>

          {loadingDeep ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 items-start">
                  <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                    <span className="text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{rec.text}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityColors[rec.priority]}`}>
                        {t(`aiAnalytics.priority.${rec.priority}`)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{rec.category}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-1" />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t("aiAnalytics.noRecommendations")}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
