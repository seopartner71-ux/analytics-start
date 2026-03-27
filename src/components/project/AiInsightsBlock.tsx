import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Pencil, Check, X, ChevronDown, ChevronUp, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AiInsightsBlockProps {
  projectId?: string;
  summary?: {
    happened: string;
    why: string;
    recommendation: string;
  };
  isAdmin: boolean;
  onSave?: (summary: { happened: string; why: string; recommendation: string }) => void;
}

const defaultSummary = {
  happened: "",
  why: "",
  recommendation: "",
};

export function AiInsightsBlock({ projectId, summary = defaultSummary, isAdmin, onSave }: AiInsightsBlockProps) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [draft, setDraft] = useState(summary);
  const [generating, setGenerating] = useState(false);

  const hasSummary = summary.happened || summary.why || summary.recommendation;

  const handleSave = () => {
    onSave?.(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(summary);
    setEditing(false);
  };

  const handleGenerate = async () => {
    if (!projectId) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectRef}.supabase.co/functions/v1/generate-ai-summary`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project_id: projectId,
            language: i18n.language,
          }),
        }
      );
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      if (data.summary) {
        const generated = {
          happened: data.summary.happened || "",
          why: data.summary.why || "",
          recommendation: data.summary.recommendation || "",
        };
        onSave?.(generated);
        toast.success(t("aiInsights.generated"));
      }
    } catch (err: any) {
      toast.error(err.message || "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const sections = [
    { key: "happened" as const, icon: "📊", label: t("aiInsights.happened") },
    { key: "why" as const, icon: "🔍", label: t("aiInsights.why") },
    { key: "recommendation" as const, icon: "💡", label: t("aiInsights.recommendation") },
  ];

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
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                  {t("aiInsights.generate")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                  onClick={() => { setDraft(summary); setEditing(true); }}
                >
                  <Pencil className="h-3 w-3" />
                  {t("aiInsights.edit")}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
            >
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
                  {sections.map((s) => (
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
                <div className="space-y-3">
                  {sections.map((s, i) =>
                    summary[s.key] ? (
                      <motion.div
                        key={s.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15, duration: 0.4 }}
                        className="flex gap-3"
                      >
                        <span className="text-base mt-0.5 shrink-0">{s.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-0.5">{s.label}</p>
                          <p className="text-sm text-foreground leading-relaxed">{summary[s.key]}</p>
                        </div>
                      </motion.div>
                    ) : null
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">{t("aiInsights.empty")}</p>
                  {isAdmin && (
                    <div className="flex gap-2 justify-center mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={handleGenerate}
                        disabled={generating}
                      >
                        <Wand2 className="h-3 w-3" />
                        {t("aiInsights.generate")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => setEditing(true)}
                      >
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
