import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileSearch, AlertTriangle, AlertCircle, Clock, RefreshCw, Loader2,
  Globe, Search, CheckCircle2, XCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

export default function SiteHealthDetailTab({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: healthMetrics = [], isLoading: healthLoading } = useQuery({
    queryKey: ["site-health", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_health")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: siteErrors = [], isLoading: errorsLoading } = useQuery({
    queryKey: ["site-errors", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_errors")
        .select("*")
        .eq("project_id", projectId)
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Helper to get metric value
  const getMetric = (source: string, name: string) => {
    const m = healthMetrics.find(h => h.source === source && h.metric_name === name);
    return m?.metric_value || "0";
  };

  const getMetricDate = (source: string, name: string) => {
    const m = healthMetrics.find(h => h.source === source && h.metric_name === name);
    return m?.updated_at || null;
  };

  // Aggregate top-level KPIs
  const indexedPages = Number(getMetric("yandex", "indexed_pages")) + Number(getMetric("google", "indexed_pages"));
  const totalPages = Number(getMetric("yandex", "total_pages")) + Number(getMetric("google", "total_pages"));
  const crawlErrors = siteErrors.filter(e => e.status === "Новая").length;
  const warnings = Number(getMetric("yandex", "warnings")) + Number(getMetric("google", "warnings"));

  const lastUpdate = useMemo(() => {
    if (healthMetrics.length === 0) return null;
    const dates = healthMetrics.map(m => new Date(m.updated_at).getTime());
    return new Date(Math.max(...dates));
  }, [healthMetrics]);

  // Yandex metrics
  const yIndexed = getMetric("yandex", "indexed_pages");
  const ySitemapStatus = getMetric("yandex", "sitemap_status");
  const yLastCrawl = getMetricDate("yandex", "last_crawl");
  const yandexErrors = siteErrors.filter(e => e.source === "yandex");

  // Google metrics
  const gClicks = getMetric("google", "clicks");
  const gImpressions = getMetric("google", "impressions");
  const gCtr = getMetric("google", "ctr");
  const gPosition = getMetric("google", "avg_position");
  const gTopQueries = useMemo(() => {
    const raw = getMetric("google", "top_queries");
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {
      return [];
    }
  }, [healthMetrics]);

  // Mark error as reviewed
  const markReviewed = useMutation({
    mutationFn: async (errorId: string) => {
      const { error } = await supabase
        .from("site_errors")
        .update({ status: "Просмотрена" })
        .eq("id", errorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-errors", projectId] });
      toast.success("Статус обновлён");
    },
  });

  const isLoading = healthLoading || errorsLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Состояние сайта</h3>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-[11px] text-muted-foreground">
              Обновлено: {format(lastUpdate, "dd.MM.yyyy HH:mm")}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[12px] gap-1.5"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Не авторизован");
                const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
                const resp = await fetch(
                  `https://${projectRef}.supabase.co/functions/v1/fetch-site-health`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${session.access_token}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ project_id: projectId }),
                  }
                );
                const result = await resp.json();
                if (!resp.ok) throw new Error(result.error || "Ошибка обновления");
                queryClient.invalidateQueries({ queryKey: ["site-health", projectId] });
                queryClient.invalidateQueries({ queryKey: ["site-errors", projectId] });
                const parts: string[] = [];
                if (result.results?.yandex === "ok") parts.push("Яндекс ✓");
                else if (result.results?.yandex) parts.push(`Яндекс: ${result.results.yandex}`);
                if (result.results?.google === "ok") parts.push("Google ✓");
                else if (result.results?.google) parts.push(`Google: ${result.results.google}`);
                toast.success(parts.length > 0 ? `Обновлено: ${parts.join(", ")}` : "Нет подключённых сервисов для обновления");
              } catch (e: any) {
                toast.error(e.message || "Ошибка при обновлении данных");
              } finally {
                setRefreshing(false);
              }
            }}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Обновить данные
          </Button>
        </div>
      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileSearch className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Индексация</p>
              <p className="text-xl font-bold text-foreground">
                {indexedPages > 0 ? indexedPages.toLocaleString("ru-RU") : "—"}
                {totalPages > 0 && (
                  <span className="text-[12px] text-muted-foreground font-normal"> / {totalPages.toLocaleString("ru-RU")}</span>
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card className={cn("bg-card rounded-lg shadow-sm border border-border p-4", crawlErrors > 0 && "border-destructive/30")}>
          <div className="flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", crawlErrors > 0 ? "bg-destructive/10" : "bg-muted")}>
              <AlertCircle className={cn("h-4 w-4", crawlErrors > 0 ? "text-destructive" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ошибки</p>
              <p className={cn("text-xl font-bold", crawlErrors > 0 ? "text-destructive" : "text-foreground")}>{crawlErrors}</p>
            </div>
          </div>
        </Card>

        <Card className={cn("bg-card rounded-lg shadow-sm border border-border p-4", warnings > 0 && "border-[hsl(var(--chart-4))]/30")}>
          <div className="flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", warnings > 0 ? "bg-[hsl(var(--chart-4))]/10" : "bg-muted")}>
              <AlertTriangle className={cn("h-4 w-4", warnings > 0 ? "text-[hsl(var(--chart-4))]" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Предупреждения</p>
              <p className={cn("text-xl font-bold", warnings > 0 ? "text-[hsl(var(--chart-4))]" : "text-foreground")}>{warnings}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Последнее обновление</p>
              <p className="text-sm font-bold text-foreground">
                {lastUpdate ? format(lastUpdate, "dd.MM.yy HH:mm") : "—"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Two columns: Yandex + Google */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Yandex Webmaster */}
        <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">Я</span>
            </div>
            <h3 className="text-sm font-semibold text-foreground">Яндекс Вебмастер</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Индексация</p>
                <p className="text-lg font-bold text-foreground">{Number(yIndexed).toLocaleString("ru-RU")} стр.</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Sitemap</p>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  {ySitemapStatus === "ok" ? (
                    <><CheckCircle2 className="h-4 w-4 text-[hsl(142,71%,45%)]" /> Подключен</>
                  ) : (
                    <><XCircle className="h-4 w-4 text-muted-foreground" /> {ySitemapStatus || "Не настроен"}</>
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Последний обход</p>
              <p className="text-sm font-medium text-foreground">
                {yLastCrawl ? format(parseISO(yLastCrawl), "dd.MM.yyyy HH:mm") : "—"}
              </p>
            </div>

            {yandexErrors.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase mb-2">Ошибки сканирования</p>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {yandexErrors.slice(0, 10).map(e => (
                    <div key={e.id} className="flex items-start gap-2 p-2 rounded bg-destructive/5 text-[12px]">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate">{e.url || "—"}</p>
                        <p className="text-muted-foreground">{e.error_type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {yandexErrors.length === 0 && Number(yIndexed) === 0 && (
              <div className="py-6 text-center">
                <Globe className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                <p className="text-[12px] text-muted-foreground">
                  Подключите Яндекс Вебмастер на вкладке «Интеграции»
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Google Search Console */}
        <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <div className="h-6 w-6 rounded bg-[hsl(var(--chart-2))]/10 flex items-center justify-center">
              <Search className="h-3.5 w-3.5 text-[hsl(var(--chart-2))]" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Google Search Console</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Клики (28 дн.)</p>
                <p className="text-lg font-bold text-foreground">{Number(gClicks).toLocaleString("ru-RU")}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Показы</p>
                <p className="text-lg font-bold text-foreground">{Number(gImpressions).toLocaleString("ru-RU")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Средний CTR</p>
                <p className="text-lg font-bold text-foreground">{Number(gCtr).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Ср. позиция</p>
                <p className="text-lg font-bold text-foreground">{Number(gPosition).toFixed(1)}</p>
              </div>
            </div>

            {/* Top queries table */}
            {gTopQueries.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase mb-2">Топ запросов</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 font-medium text-muted-foreground">Запрос</th>
                        <th className="text-center py-1.5 font-medium text-muted-foreground w-16">Клики</th>
                        <th className="text-center py-1.5 font-medium text-muted-foreground w-16">Показы</th>
                        <th className="text-center py-1.5 font-medium text-muted-foreground w-16">Позиция</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {gTopQueries.map((q: any, i: number) => (
                        <tr key={i} className={cn("hover:bg-muted/30", i % 2 === 1 && "bg-muted/10")}>
                          <td className="py-1.5 text-foreground truncate max-w-[180px]">{q.query}</td>
                          <td className="py-1.5 text-center text-foreground">{q.clicks}</td>
                          <td className="py-1.5 text-center text-foreground">{q.impressions}</td>
                          <td className="py-1.5 text-center text-foreground">{Number(q.position).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              Number(gClicks) === 0 && Number(gImpressions) === 0 && (
                <div className="py-6 text-center">
                  <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-[12px] text-muted-foreground">
                    Добавьте данные Google Search Console
                  </p>
                </div>
              )
            )}
          </div>
        </Card>
      </div>

      {/* Errors table */}
      <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Все ошибки</h3>
          <Badge variant="secondary" className="text-[10px] h-5">{siteErrors.length}</Badge>
        </div>
        {siteErrors.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-[hsl(142,71%,45%)]/30" />
            <p className="text-[13px] text-muted-foreground">Ошибок не обнаружено</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Тип ошибки</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-24">Источник</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">URL</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-28">Дата</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-32">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {siteErrors.map((err, i) => {
                  const isNew = err.status === "Новая";
                  return (
                    <tr
                      key={err.id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors",
                        isNew && "bg-destructive/5",
                        !isNew && i % 2 === 1 && "bg-muted/10"
                      )}
                    >
                      <td className="px-4 py-2.5 text-foreground">{err.error_type}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px]",
                            err.source === "yandex" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--chart-2))]/10 text-[hsl(var(--chart-2))]"
                          )}
                        >
                          {err.source === "yandex" ? "Яндекс" : "Google"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[250px]">{err.url || "—"}</td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground text-[12px]">
                        {format(parseISO(err.detected_at), "dd.MM.yy")}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isNew ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] text-destructive hover:text-foreground"
                            onClick={() => markReviewed.mutate(err.id)}
                          >
                            Новая
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Просмотрена</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
