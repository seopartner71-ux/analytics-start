import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wand2, Loader2, ChevronUp, ChevronDown, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ruError } from "@/lib/error-messages";

interface Recommendation {
  priority: "high" | "medium" | "low";
  action: string;
  reason: string;
}

interface AuditInsights {
  verdict: string;
  key_findings: string[];
  recommendations: Recommendation[];
}

interface Props {
  jobId: string;
  projectId: string;
  isAdmin?: boolean;
}

const STORAGE_PREFIX = "audit-insights:";

export function AuditInsightsBlock({ jobId, projectId, isAdmin = true }: Props) {
  const [insights, setInsights] = useState<AuditInsights | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Load cached for this job
  useEffect(() => {
    if (!jobId) return;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + jobId);
      if (raw) {
        const parsed = JSON.parse(raw);
        setInsights(parsed.insights ?? null);
        setGeneratedAt(parsed.generated_at ?? null);
      } else {
        setInsights(null);
        setGeneratedAt(null);
      }
    } catch {
      setInsights(null);
    }
  }, [jobId]);

  const handleGenerate = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Вы не авторизованы");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-insights`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ job_id: jobId, project_id: projectId }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || data.error) {
        if (resp.status === 402) throw new Error("AI-кредиты исчерпаны. Пополните баланс.");
        if (resp.status === 429) throw new Error("Слишком много запросов. Попробуйте через минуту.");
        throw new Error(data.error || "Не удалось сгенерировать выводы");
      }

      setInsights(data.insights);
      setGeneratedAt(data.generated_at);
      try {
        localStorage.setItem(
          STORAGE_PREFIX + jobId,
          JSON.stringify({ insights: data.insights, generated_at: data.generated_at })
        );
      } catch { /* ignore quota */ }
      toast.success("AI-выводы готовы");
    } catch (err: any) {
      toast.error(ruError(err, "Не удалось сгенерировать AI-выводы"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative rounded-xl border border-primary/20 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-purple-500/5 to-primary/8" />
      <div className="absolute inset-0 bg-card/60" />

      <div className="relative p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 text-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Выводы и рекомендации AI</h3>
              <p className="text-[11px] text-muted-foreground">
                {generatedAt
                  ? `Сгенерировано: ${new Date(generatedAt).toLocaleString("ru-RU")}`
                  : "Краткий разбор результатов аудита"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                {insights ? "Перегенерировать" : "Сгенерировать"}
              </Button>
            )}
            {insights && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-8"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AI анализирует результаты аудита…</p>
            </motion.div>
          ) : insights && expanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden space-y-4"
            >
              {/* Verdict */}
              {insights.verdict && (
                <div className="flex gap-3">
                  <span className="text-base mt-0.5 shrink-0">📊</span>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-0.5">Вердикт</p>
                    <p className="text-sm text-foreground leading-relaxed">{insights.verdict}</p>
                  </div>
                </div>
              )}

              {/* Key findings */}
              {insights.key_findings?.length > 0 && (
                <div className="flex gap-3">
                  <span className="text-base mt-0.5 shrink-0">🔍</span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Ключевые выводы</p>
                    <ul className="space-y-1.5">
                      {insights.key_findings.map((f, i) => (
                        <li key={i} className="text-sm text-foreground leading-relaxed flex gap-2">
                          <span className="text-primary mt-1 shrink-0">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {insights.recommendations?.length > 0 && (
                <div className="flex gap-3">
                  <span className="text-base mt-0.5 shrink-0">💡</span>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Рекомендации</p>
                    {insights.recommendations.map((r, i) => (
                      <Card key={i} className="bg-background/50 border-border p-3">
                        <div className="flex items-start gap-2.5">
                          <PriorityIcon priority={r.priority} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <PriorityBadge priority={r.priority} />
                            </div>
                            <p className="text-sm font-medium text-foreground leading-snug mb-1">
                              {r.action}
                            </p>
                            {r.reason && (
                              <p className="text-xs text-muted-foreground leading-relaxed">{r.reason}</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : !insights ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-4"
            >
              <p className="text-sm text-muted-foreground mb-3">
                Получите AI-разбор результатов аудита: вердикт, ключевые выводы и приоритетные рекомендации.
              </p>
              {isAdmin && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleGenerate}>
                  <Wand2 className="h-3 w-3" /> Сгенерировать выводы
                </Button>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function PriorityIcon({ priority }: { priority: string }) {
  if (priority === "high") return <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />;
  if (priority === "medium") return <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />;
  return <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    high: { label: "Высокий приоритет", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    medium: { label: "Средний приоритет", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    low: { label: "Низкий приоритет", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  };
  const cfg = map[priority] ?? map.low;
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold border", cfg.cls)}>
      {cfg.label}
    </Badge>
  );
}
