import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rocket, Copy, Check, Info } from "lucide-react";
import { toast } from "sonner";

interface ReportBuilderTabProps {
  projectId?: string;
  shareToken?: string | null;
}

const MODULES = [
  { key: "kpi", labelRu: "KPI и ключевые метрики", labelEn: "KPIs & Key Metrics" },
  { key: "traffic", labelRu: "График посещаемости", labelEn: "Traffic Chart" },
  { key: "sources", labelRu: "Источники трафика", labelEn: "Traffic Sources" },
  { key: "seo", labelRu: "SEO-аналитика (запросы)", labelEn: "SEO Analytics (Queries)" },
  { key: "pages", labelRu: "Страницы входа", labelEn: "Landing Pages" },
  { key: "goals", labelRu: "Цели и конверсии", labelEn: "Goals & Conversions" },
  { key: "worklog", labelRu: "Список выполненных работ", labelEn: "Completed Work Log" },
  { key: "ai", labelRu: "AI-инсайты", labelEn: "AI Insights" },
] as const;

export function ReportBuilderTab({ projectId, shareToken }: ReportBuilderTabProps) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";

  const [selected, setSelected] = useState<Set<string>>(new Set(MODULES.map((m) => m.key)));
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(MODULES.map((m) => m.key)));
  const deselectAll = () => setSelected(new Set());

  const noneSelected = selected.size === 0;

  const handleGenerate = () => {
    if (noneSelected) return;
    const base = shareToken
      ? `${window.location.origin}/share/${shareToken}`
      : `${window.location.origin}/report/${projectId}`;
    const params = new URLSearchParams();
    params.set("modules", Array.from(selected).join(","));
    const url = `${base}?${params.toString()}`;
    setGeneratedUrl(url);
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(t("reportBuilder.linkCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopy = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success(t("reportBuilder.linkCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">{t("reportBuilder.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("reportBuilder.description")}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Quick actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAll}>
              {t("reportBuilder.selectAll")}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={deselectAll}>
              {t("reportBuilder.deselectAll")}
            </Button>
          </div>

          {/* Module checkboxes */}
          <div className="space-y-3">
            {MODULES.map((m) => (
              <label
                key={m.key}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 transition-colors cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(m.key)}
                  onCheckedChange={() => toggle(m.key)}
                />
                <span className="text-sm font-medium text-foreground">
                  {isRu ? m.labelRu : m.labelEn}
                </span>
              </label>
            ))}
          </div>

          {/* Hint when nothing selected */}
          {noneSelected && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
              <Info className="h-4 w-4 shrink-0" />
              {t("reportBuilder.selectHint")}
            </div>
          )}

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={noneSelected}
            className="w-full gap-2"
            size="lg"
          >
            <Rocket className="h-4 w-4" />
            {t("reportBuilder.generate")}
          </Button>

          {/* Generated link preview */}
          {generatedUrl && (
            <div className="space-y-2 p-4 rounded-lg border border-primary/30 bg-primary/5">
              <p className="text-xs font-medium text-muted-foreground">{t("reportBuilder.linkPreview")}</p>
              <div className="flex gap-2">
                <Input readOnly value={generatedUrl} className="text-xs h-9" />
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
