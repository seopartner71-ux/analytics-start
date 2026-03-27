import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Rocket, Copy, Check, Info, Plus, X, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface ReportBuilderTabProps {
  projectId?: string;
  shareToken?: string | null;
}

interface CustomField {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
}

const MODULES = [
  { key: "kpi", labelRu: "KPI и ключевые метрики", labelEn: "KPIs & Key Metrics" },
  { key: "traffic", labelRu: "График посещаемости", labelEn: "Traffic Chart" },
  { key: "sources", labelRu: "Источники трафика", labelEn: "Traffic Sources" },
  { key: "seo", labelRu: "SEO-аналитика (запросы)", labelEn: "SEO Analytics (Queries)" },
  { key: "searchSystems", labelRu: "Детальный отчёт по поисковикам", labelEn: "Search Systems Detail Report" },
  { key: "pages", labelRu: "Страницы входа", labelEn: "Landing Pages" },
  { key: "goals", labelRu: "Цели и конверсии", labelEn: "Goals & Conversions" },
  { key: "worklog", labelRu: "Список выполненных работ", labelEn: "Completed Work Log" },
  { key: "ai", labelRu: "AI-инсайты", labelEn: "AI Insights" },
] as const;

export function ReportBuilderTab({ projectId, shareToken }: ReportBuilderTabProps) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";

  const [selected, setSelected] = useState<Set<string>>(new Set(MODULES.map((m) => m.key)));
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
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

  const addCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: "", content: "", enabled: true },
    ]);
  };

  const updateCustomField = (id: string, updates: Partial<CustomField>) => {
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const enabledCustomFields = customFields.filter((f) => f.enabled && f.title.trim());
  const noneSelected = selected.size === 0 && enabledCustomFields.length === 0;

  const handleGenerate = () => {
    if (noneSelected) return;
    const base = shareToken
      ? `${window.location.origin}/share/${shareToken}`
      : `${window.location.origin}/report/${projectId}`;
    const params = new URLSearchParams();
    params.set("modules", Array.from(selected).join(","));
    if (enabledCustomFields.length > 0) {
      params.set("custom", JSON.stringify(enabledCustomFields.map((f) => ({ title: f.title, content: f.content }))));
    }
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
                <Checkbox checked={selected.has(m.key)} onCheckedChange={() => toggle(m.key)} />
                <span className="text-sm font-medium text-foreground">
                  {isRu ? m.labelRu : m.labelEn}
                </span>
              </label>
            ))}
          </div>

          {/* Custom fields section */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t("reportBuilder.customFields")}</h3>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addCustomField}>
                <Plus className="h-3 w-3" />
                {t("reportBuilder.addField")}
              </Button>
            </div>

            {customFields.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("reportBuilder.noCustomFields")}</p>
            )}

            {customFields.map((field) => (
              <div key={field.id} className="p-3 rounded-lg border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={field.enabled}
                    onCheckedChange={(v) => updateCustomField(field.id, { enabled: !!v })}
                  />
                  <Input
                    value={field.title}
                    onChange={(e) => updateCustomField(field.id, { title: e.target.value })}
                    placeholder={t("reportBuilder.fieldTitlePlaceholder")}
                    className="h-8 text-sm flex-1"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeCustomField(field.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea
                  value={field.content}
                  onChange={(e) => updateCustomField(field.id, { content: e.target.value })}
                  placeholder={t("reportBuilder.fieldContentPlaceholder")}
                  rows={3}
                  className="text-sm"
                />
              </div>
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
          <Button onClick={handleGenerate} disabled={noneSelected} className="w-full gap-2" size="lg">
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
