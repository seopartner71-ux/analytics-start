import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Eye, Save, Link2, Copy, Check, Loader2, Upload, X,
  BarChart3, TrendingUp, PieChart, KeyRound, AlertTriangle,
  FileSearch, ClipboardList, Sparkles, GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReportBuilderTabProps {
  projectId?: string;
  shareToken?: string | null;
  projectLogo?: string | null;
}

interface ReportModule {
  key: string;
  icon: React.ElementType;
  enabled: boolean;
}

const DEFAULT_MODULES: Omit<ReportModule, "enabled">[] = [
  { key: "kpi", icon: BarChart3 },
  { key: "traffic", icon: TrendingUp },
  { key: "sources", icon: PieChart },
  { key: "seo", icon: KeyRound },
  { key: "indexing", icon: AlertTriangle },
  { key: "pages", icon: FileSearch },
  { key: "worklog", icon: ClipboardList },
  { key: "ai", icon: Sparkles },
];

export function ReportBuilderTab({ projectId, shareToken, projectLogo }: ReportBuilderTabProps) {
  const { t } = useTranslation();

  const [modules, setModules] = useState<ReportModule[]>(
    DEFAULT_MODULES.map((m) => ({ ...m, enabled: true }))
  );
  const [defaultPeriod, setDefaultPeriod] = useState("currentMonth");
  const [showComparison, setShowComparison] = useState(true);
  const [clientLogo, setClientLogo] = useState<string | null>(projectLogo ?? null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const toggleModule = (key: string) => {
    setModules((prev) => prev.map((m) => (m.key === key ? { ...m, enabled: !m.enabled } : m)));
  };

  const enabledCount = modules.filter((m) => m.enabled).length;

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setModules((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const handleGenerate = useCallback(async () => {
    if (enabledCount === 0) return;
    setPublishing(true);
    // simulate async
    await new Promise((r) => setTimeout(r, 1200));
    const base = shareToken
      ? `${window.location.origin}/share/${shareToken}`
      : `${window.location.origin}/report/${projectId}`;
    const params = new URLSearchParams();
    params.set("modules", modules.filter((m) => m.enabled).map((m) => m.key).join(","));
    params.set("period", defaultPeriod);
    if (showComparison) params.set("compare", "1");
    const url = `${base}?${params.toString()}`;
    setGeneratedUrl(url);
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(t("rb.linkCopied"));
    setTimeout(() => setCopied(false), 2000);
    setPublishing(false);
  }, [enabledCount, modules, defaultPeriod, showComparison, shareToken, projectId, t]);

  const handleCopy = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success(t("rb.linkCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setClientLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{t("rb.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("rb.subtitle")}</p>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Eye className="h-4 w-4" /> {t("rb.preview")}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Save className="h-4 w-4" /> {t("rb.saveTemplate")}
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={enabledCount === 0 || publishing}
          onClick={handleGenerate}
        >
          {publishing ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {t("rb.publishing")}</>
          ) : (
            <><Link2 className="h-4 w-4" /> {t("rb.generateLink")}</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Modules list — 2 cols */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("rb.modulesTitle")}</h2>
          <div className="space-y-2">
            {modules.map((mod, idx) => {
              const Icon = mod.icon;
              return (
                <Card
                  key={mod.key}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "border transition-all cursor-grab active:cursor-grabbing",
                    mod.enabled
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card opacity-60",
                    dragIdx === idx && "ring-2 ring-primary/40 scale-[1.02]"
                  )}
                >
                  <CardContent className="flex items-center gap-4 py-3 px-4">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <div className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                      mod.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{t(`rb.mod.${mod.key}.name`)}</p>
                      <p className="text-xs text-muted-foreground">{t(`rb.mod.${mod.key}.desc`)}</p>
                    </div>
                    <Switch checked={mod.enabled} onCheckedChange={() => toggleModule(mod.key)} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Settings sidebar — 1 col */}
        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("rb.settingsTitle")}</h2>

          {/* Client logo */}
          <Card className="border-border bg-card">
            <CardContent className="py-4 px-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{t("rb.branding")}</p>
              <div className="flex items-center gap-3">
                {clientLogo ? (
                  <div className="relative">
                    <img src={clientLogo} alt="Logo" className="h-12 w-12 rounded-lg object-cover border border-border" />
                    <button
                      onClick={() => setClientLogo(null)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="h-12 w-12 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground/40" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                )}
                <p className="text-xs text-muted-foreground">{t("rb.logoHint")}</p>
              </div>
            </CardContent>
          </Card>

          {/* Default period */}
          <Card className="border-border bg-card">
            <CardContent className="py-4 px-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{t("rb.defaultPeriod")}</p>
              <Select value={defaultPeriod} onValueChange={setDefaultPeriod}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="currentMonth">{t("rb.periodCurrent")}</SelectItem>
                  <SelectItem value="lastMonth">{t("rb.periodLast")}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Comparison toggle */}
          <Card className="border-border bg-card">
            <CardContent className="py-4 px-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t("rb.comparisonToggle")}</p>
                <p className="text-xs text-muted-foreground">{t("rb.comparisonHint")}</p>
              </div>
              <Switch checked={showComparison} onCheckedChange={setShowComparison} />
            </CardContent>
          </Card>

          {/* Generated link */}
          {generatedUrl && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-4 px-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t("rb.accessLink")}</p>
                <div className="flex gap-2">
                  <Input readOnly value={generatedUrl} className="text-xs h-9" />
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
