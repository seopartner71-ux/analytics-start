import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Eye, Save, Link2, Copy, Check, Loader2, Upload, X,
  BarChart3, TrendingUp, PieChart, KeyRound, AlertTriangle,
  FileSearch, ClipboardList, Sparkles, GripVertical, ListOrdered,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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

const MODULE_ICONS: Record<string, React.ElementType> = {
  kpi: BarChart3, traffic: TrendingUp, sources: PieChart, seo: KeyRound,
  indexing: AlertTriangle, pages: FileSearch, worklog: ClipboardList, ai: Sparkles,
  positions: ListOrdered,
};

const DEFAULT_MODULE_KEYS = ["kpi", "traffic", "sources", "seo", "indexing", "pages", "worklog", "ai", "positions"];

function modulesFromKeys(keys: string[], enabledKeys?: string[]): ReportModule[] {
  return keys.map((key) => ({
    key,
    icon: MODULE_ICONS[key] || BarChart3,
    enabled: enabledKeys ? enabledKeys.includes(key) : true,
  }));
}

export function ReportBuilderTab({ projectId, shareToken, projectLogo }: ReportBuilderTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [modules, setModules] = useState<ReportModule[]>(modulesFromKeys(DEFAULT_MODULE_KEYS));
  const [defaultPeriod, setDefaultPeriod] = useState("currentMonth");
  const [showComparison, setShowComparison] = useState(true);
  const [clientLogo, setClientLogo] = useState<string | null>(projectLogo ?? null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load existing template
  const { data: template } = useQuery({
    queryKey: ["report_template", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates" as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!projectId,
  });

  // Hydrate state from DB template
  useEffect(() => {
    if (template && !loaded) {
      const savedModules = template.modules as any[];
      if (Array.isArray(savedModules) && savedModules.length > 0) {
        const keys = savedModules.map((m: any) => m.key);
        const enabledKeys = savedModules.filter((m: any) => m.enabled).map((m: any) => m.key);
        // Merge: saved order first, then any new defaults not in saved
        const allKeys = [...keys, ...DEFAULT_MODULE_KEYS.filter((k) => !keys.includes(k))];
        setModules(modulesFromKeys(allKeys, enabledKeys));
      }
      setDefaultPeriod(template.default_period || "currentMonth");
      setShowComparison(template.show_comparison ?? true);
      setClientLogo(template.client_logo_url || projectLogo || null);
      setLoaded(true);
    }
  }, [template, loaded, projectLogo]);

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

  // Save template to DB
  const handleSave = useCallback(async () => {
    if (!projectId) return;
    setSaving(true);
    const payload = {
      project_id: projectId,
      modules: modules.map((m) => ({ key: m.key, enabled: m.enabled })),
      default_period: defaultPeriod,
      show_comparison: showComparison,
      client_logo_url: clientLogo,
    };
    try {
      if (template?.id) {
        const { error } = await supabase
          .from("report_templates" as any)
          .update({ ...payload, updated_at: new Date().toISOString() } as any)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("report_templates" as any)
          .insert(payload as any);
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

  // Generate link (save first, then build URL)
  const handleGenerate = useCallback(async () => {
    if (enabledCount === 0) return;
    setPublishing(true);
    await handleSave();
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
  }, [enabledCount, modules, defaultPeriod, showComparison, shareToken, projectId, t, handleSave]);

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
    if (showComparison) params.set("compare", "1");
    params.set("preview", "1");
    const url = `${window.location.origin}/report/${projectId}?${params.toString()}`;
    window.open(url, "_blank");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t("rb.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("rb.subtitle")}</p>
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
          {publishing ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {t("rb.publishing")}</>
          ) : (
            <><Link2 className="h-4 w-4" /> {t("rb.generateLink")}</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    mod.enabled ? "border-primary/50 bg-primary/5" : "border-border bg-card opacity-60",
                    dragIdx === idx && "ring-2 ring-primary/40 scale-[1.02]"
                  )}
                >
                  <CardContent className="flex items-center gap-4 py-3 px-4">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <div className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                      mod.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-4 w-4" />
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

        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("rb.settingsTitle")}</h2>

          <Card className="border-border bg-card">
            <CardContent className="py-4 px-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{t("rb.branding")}</p>
              <div className="flex items-center gap-3">
                {clientLogo ? (
                  <div className="relative">
                    <img src={clientLogo} alt="Logo" className="h-12 w-12 rounded-lg object-cover border border-border" />
                    <button onClick={() => setClientLogo(null)} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
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

          <Card className="border-border bg-card">
            <CardContent className="py-4 px-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{t("rb.defaultPeriod")}</p>
              <Select value={defaultPeriod} onValueChange={setDefaultPeriod}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="currentMonth">{t("rb.periodCurrent")}</SelectItem>
                  <SelectItem value="lastMonth">{t("rb.periodLast")}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="py-4 px-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t("rb.comparisonToggle")}</p>
                <p className="text-xs text-muted-foreground">{t("rb.comparisonHint")}</p>
              </div>
              <Switch checked={showComparison} onCheckedChange={setShowComparison} />
            </CardContent>
          </Card>

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
