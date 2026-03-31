import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Eye, Save, Link2, Copy, Check, Loader2, Upload, X,
  BarChart3, TrendingUp, PieChart, KeyRound, AlertTriangle,
  FileSearch, ClipboardList, Sparkles, GripVertical, ListOrdered,
  Sun, Moon, MessageSquare, Search, Megaphone, Target,
  DollarSign, MousePointerClick, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { ReportType } from "@/components/report/ReportView";

interface ReportBuilderTabProps {
  projectId?: string;
  shareToken?: string | null;
  projectLogo?: string | null;
}

interface ReportModule {
  key: string;
  icon: React.ElementType;
  enabled: boolean;
  comment?: string;
  group: "seo" | "ads" | "general";
}

const MODULE_DEFS: { key: string; icon: React.ElementType; group: "seo" | "ads" | "general"; nameRu: string; descRu: string }[] = [
  // General
  { key: "kpi", icon: BarChart3, group: "general", nameRu: "KPI и ключевые метрики", descRu: "Визиты, отказы, глубина, время" },
  { key: "traffic", icon: TrendingUp, group: "general", nameRu: "График трафика", descRu: "Динамика по каналам" },
  { key: "sources", icon: PieChart, group: "general", nameRu: "Источники трафика", descRu: "Круговая диаграмма каналов" },
  { key: "pages", icon: FileSearch, group: "general", nameRu: "Лендинги", descRu: "Топ-10 популярных страниц" },
  { key: "worklog", icon: ClipboardList, group: "general", nameRu: "Журнал работ", descRu: "Выполненные задачи агентства" },
  { key: "ai", icon: Sparkles, group: "general", nameRu: "AI-аналитика", descRu: "Инсайты и рекомендации" },
  { key: "channel_goals", icon: Target, group: "general", nameRu: "Доля каналов в конверсиях", descRu: "SEO vs Реклама: стоимость лидов" },
  // SEO
  { key: "seo_visibility", icon: Eye, group: "seo", nameRu: "Поисковая видимость", descRu: "Средняя позиция, ТОП-3/10 из Topvisor" },
  { key: "positions", icon: ListOrdered, group: "seo", nameRu: "Позиции и динамика", descRu: "График динамики позиций" },
  { key: "seo", icon: KeyRound, group: "seo", nameRu: "Поисковые запросы", descRu: "Ключевые слова из GSC/Вебмастера" },
  { key: "seo_branded", icon: Search, group: "seo", nameRu: "Брендовый vs Небрендовый", descRu: "Разделение трафика по типу запросов" },
  { key: "indexing", icon: AlertTriangle, group: "seo", nameRu: "Индексация и ошибки", descRu: "Данные Яндекс/Google Webmasters" },
  // Ads
  { key: "ads_kpi", icon: DollarSign, group: "ads", nameRu: "Эффективность рекламы", descRu: "Расход, CPC, CTR, CPA" },
  { key: "ads_traffic", icon: Megaphone, group: "ads", nameRu: "Рекламный трафик", descRu: "Динамика платных визитов" },
  { key: "ads_campaigns", icon: Layers, group: "ads", nameRu: "Топ кампаний", descRu: "Визиты, конверсии, расход по кампаниям" },
];

const GROUP_LABELS = {
  general: { emoji: "📊", label: "Общая аналитика" },
  seo: { emoji: "🔍", label: "Модули SEO" },
  ads: { emoji: "💰", label: "Модули Рекламы" },
};

function buildModules(reportType: ReportType, saved?: any[]): ReportModule[] {
  const comments: Record<string, string> = {};
  const enabledKeys = new Set<string>();
  const orderMap = new Map<string, number>();

  if (saved && saved.length > 0) {
    saved.forEach((m: any, i: number) => {
      if (m.comment) comments[m.key] = m.comment;
      if (m.enabled) enabledKeys.add(m.key);
      orderMap.set(m.key, i);
    });
  }

  let defs = MODULE_DEFS.filter((d) => {
    if (reportType === "seo") return d.group !== "ads";
    if (reportType === "ads") return d.group !== "seo";
    return true;
  });

  // Sort by saved order if exists
  if (orderMap.size > 0) {
    defs = [...defs].sort((a, b) => (orderMap.get(a.key) ?? 999) - (orderMap.get(b.key) ?? 999));
  }

  return defs.map((d) => ({
    key: d.key,
    icon: d.icon,
    enabled: saved ? enabledKeys.has(d.key) : true,
    comment: comments[d.key] || "",
    group: d.group,
  }));
}

export function ReportBuilderTab({ projectId, shareToken, projectLogo }: ReportBuilderTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [reportType, setReportType] = useState<ReportType>("combined");
  const [modules, setModules] = useState<ReportModule[]>(buildModules("combined"));
  const [defaultPeriod, setDefaultPeriod] = useState("currentMonth");
  const [showComparison, setShowComparison] = useState(true);
  const [lightModeForPdf, setLightModeForPdf] = useState(false);
  const [clientLogo, setClientLogo] = useState<string | null>(projectLogo ?? null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expandedComment, setExpandedComment] = useState<string | null>(null);

  const { data: template } = useQuery({
    queryKey: ["report_template", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("report_templates" as any).select("*").eq("project_id", projectId!).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (template && !loaded) {
      const savedType = (template as any).report_type || "combined";
      setReportType(savedType);
      const savedModules = template.modules as any[];
      if (Array.isArray(savedModules) && savedModules.length > 0) {
        setModules(buildModules(savedType, savedModules));
      } else {
        setModules(buildModules(savedType));
      }
      setDefaultPeriod(template.default_period || "currentMonth");
      setShowComparison(template.show_comparison ?? true);
      setClientLogo(template.client_logo_url || projectLogo || null);
      setLoaded(true);
    }
  }, [template, loaded, projectLogo]);

  // When report type changes, rebuild modules keeping enabled state
  const handleTypeChange = (newType: ReportType) => {
    setReportType(newType);
    setModules((prev) => {
      const prevMap = new Map(prev.map((m) => [m.key, m]));
      return buildModules(newType).map((m) => ({
        ...m,
        enabled: prevMap.get(m.key)?.enabled ?? true,
        comment: prevMap.get(m.key)?.comment || "",
      }));
    });
  };

  const toggleModule = (key: string) => {
    setModules((prev) => prev.map((m) => (m.key === key ? { ...m, enabled: !m.enabled } : m)));
  };

  const updateComment = (key: string, comment: string) => {
    setModules((prev) => prev.map((m) => (m.key === key ? { ...m, comment } : m)));
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

  const handleSave = useCallback(async () => {
    if (!projectId) return;
    setSaving(true);
    const payload = {
      project_id: projectId,
      modules: modules.map((m) => ({ key: m.key, enabled: m.enabled, comment: m.comment || "", group: m.group })),
      default_period: defaultPeriod,
      show_comparison: showComparison,
      client_logo_url: clientLogo,
    };
    try {
      if (template?.id) {
        const { error } = await supabase.from("report_templates" as any).update({ ...payload, updated_at: new Date().toISOString() } as any).eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("report_templates" as any).insert(payload as any);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["report_template", projectId] });
      toast.success(t("rb.saved"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }, [projectId, modules, defaultPeriod, showComparison, clientLogo, template, queryClient, t]);

  const handleGenerate = useCallback(async () => {
    if (enabledCount === 0) return;
    setPublishing(true);
    await handleSave();
    const base = `${window.location.origin}/report/${projectId}`;
    const params = new URLSearchParams();
    params.set("modules", modules.filter((m) => m.enabled).map((m) => m.key).join(","));
    params.set("period", defaultPeriod);
    params.set("type", reportType);
    if (showComparison) params.set("compare", "1");
    if (lightModeForPdf) params.set("light", "1");
    const url = `${base}?${params.toString()}`;
    setGeneratedUrl(url);
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(t("rb.linkCopied"));
    setTimeout(() => setCopied(false), 2000);
    setPublishing(false);
  }, [enabledCount, modules, defaultPeriod, showComparison, lightModeForPdf, reportType, projectId, t, handleSave]);

  const handleCopy = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success(t("rb.linkCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePreview = () => {
    const params = new URLSearchParams();
    params.set("modules", modules.filter((m) => m.enabled).map((m) => m.key).join(","));
    params.set("period", defaultPeriod);
    params.set("type", reportType);
    if (showComparison) params.set("compare", "1");
    if (lightModeForPdf) params.set("light", "1");
    params.set("preview", "1");
    window.open(`${window.location.origin}/report/${projectId}?${params.toString()}`, "_blank");
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    const ext = file.name.split(".").pop();
    const filePath = `report-logos/${projectId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("project-logos").upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error(uploadError.message); return; }
    const { data: publicUrl } = supabase.storage.from("project-logos").getPublicUrl(filePath);
    setClientLogo(publicUrl.publicUrl);
    toast.success(t("project.settingsTab.logoUploaded"));
  };

  // Group modules for display
  const groupedModules = {
    general: modules.filter((m) => m.group === "general"),
    seo: modules.filter((m) => m.group === "seo"),
    ads: modules.filter((m) => m.group === "ads"),
  };

  const renderModuleCard = (mod: ReportModule, globalIdx: number) => {
    const def = MODULE_DEFS.find((d) => d.key === mod.key);
    const Icon = mod.icon;
    const isExpanded = expandedComment === mod.key;
    return (
      <div key={mod.key}>
        <Card
          draggable
          onDragStart={() => handleDragStart(globalIdx)}
          onDragOver={(e) => handleDragOver(e, globalIdx)}
          onDragEnd={handleDragEnd}
          className={cn(
            "border transition-all cursor-grab active:cursor-grabbing",
            mod.enabled
              ? mod.group === "ads"
                ? "border-purple-500/50 bg-purple-500/5"
                : mod.group === "seo"
                ? "border-blue-500/50 bg-blue-500/5"
                : "border-primary/50 bg-primary/5"
              : "border-border bg-card opacity-60",
            dragIdx === globalIdx && "ring-2 ring-primary/40 scale-[1.02]"
          )}
        >
          <CardContent className="flex items-center gap-3 py-2.5 px-3">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <div className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
              mod.enabled
                ? mod.group === "ads" ? "bg-purple-500/10 text-purple-400" : mod.group === "seo" ? "bg-blue-500/10 text-blue-400" : "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{def?.nameRu || mod.key}</p>
              <p className="text-xs text-muted-foreground">{def?.descRu || ""}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setExpandedComment(isExpanded ? null : mod.key)}>
              <MessageSquare className={cn("h-3 w-3", mod.comment ? "text-primary" : "text-muted-foreground/40")} />
            </Button>
            <Switch checked={mod.enabled} onCheckedChange={() => toggleModule(mod.key)} />
          </CardContent>
        </Card>
        {isExpanded && (
          <div className="mt-1 ml-12 mr-4">
            <Textarea
              placeholder="Комментарий аналитика к этому блоку..."
              value={mod.comment || ""}
              onChange={(e) => updateComment(mod.key, e.target.value)}
              className="text-xs min-h-[50px] resize-none"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t("rb.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("rb.subtitle")}</p>
      </div>

      {/* Report Type Selector */}
      <div className="flex items-center gap-2">
        {([
          { type: "seo" as ReportType, icon: Search, label: "SEO", color: "bg-blue-500/10 text-blue-400 border-blue-500/40" },
          { type: "ads" as ReportType, icon: Megaphone, label: "Реклама", color: "bg-purple-500/10 text-purple-400 border-purple-500/40" },
          { type: "combined" as ReportType, icon: BarChart3, label: "Комбинированный", color: "bg-primary/10 text-primary border-primary/40" },
        ]).map(({ type, icon: Icon, label, color }) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            className={cn("gap-1.5 transition-all", reportType === type ? cn(color, "border") : "opacity-60")}
            onClick={() => handleTypeChange(type)}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePreview}>
          <Eye className="h-4 w-4" /> {t("rb.preview")}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={saving} onClick={handleSave}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("rb.saveTemplate")}
        </Button>
        <Button size="sm" className="gap-1.5" disabled={enabledCount === 0 || publishing} onClick={handleGenerate}>
          {publishing ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("rb.publishing")}</> : <><Link2 className="h-4 w-4" /> {t("rb.generateLink")}</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Modules */}
        <div className="lg:col-span-2 space-y-5">
          {(["general", "seo", "ads"] as const).map((group) => {
            const mods = groupedModules[group];
            if (mods.length === 0) return null;
            const { emoji, label } = GROUP_LABELS[group];
            return (
              <div key={group}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span>{emoji}</span> {label}
                </h2>
                <div className="space-y-1.5">
                  {mods.map((mod) => {
                    const globalIdx = modules.indexOf(mod);
                    return renderModuleCard(mod, globalIdx);
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("rb.settingsTitle")}</h2>

          <Card className="border-border bg-card">
            <CardContent className="py-3 px-4 space-y-2">
              <p className="text-sm font-medium text-foreground">{t("rb.branding")}</p>
              <div className="flex items-center gap-3">
                {clientLogo ? (
                  <div className="relative">
                    <img src={clientLogo} alt="Logo" className="h-10 w-10 rounded-lg object-cover border border-border" />
                    <button onClick={() => setClientLogo(null)} className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : (
                  <label className="h-10 w-10 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground/40" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                )}
                <p className="text-xs text-muted-foreground">{t("rb.logoHint")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="py-3 px-4 space-y-2">
              <p className="text-sm font-medium text-foreground">{t("rb.defaultPeriod")}</p>
              <Select value={defaultPeriod} onValueChange={setDefaultPeriod}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="currentMonth">{t("rb.periodCurrent")}</SelectItem>
                  <SelectItem value="lastMonth">{t("rb.periodLast")}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t("rb.comparisonToggle")}</p>
                <p className="text-xs text-muted-foreground">{t("rb.comparisonHint")}</p>
              </div>
              <Switch checked={showComparison} onCheckedChange={setShowComparison} />
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  {lightModeForPdf ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
                  Light Mode для PDF
                </p>
                <p className="text-xs text-muted-foreground">Светлая тема для печати</p>
              </div>
              <Switch checked={lightModeForPdf} onCheckedChange={setLightModeForPdf} />
            </CardContent>
          </Card>

          {generatedUrl && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-3 px-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t("rb.accessLink")}</p>
                <div className="flex gap-2">
                  <Input readOnly value={generatedUrl} className="text-xs h-8" />
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
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
