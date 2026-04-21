import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileSearch, AlertTriangle, AlertCircle, Clock, RefreshCw, Loader2,
  Globe, Search, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ERROR_NAMES_RU: Record<string, string> = {
  INSIGNIFICANT_CGI_PARAMETER: "Незначимые CGI-параметры",
  ERROR_IN_ROBOTS_TXT: "Ошибки в robots.txt",
  MAIN_PAGE_ERROR: "Ошибка главной страницы",
  NO_SITEMAP_MODIFICATIONS: "Нет изменений в Sitemap",
  CONNECT_FAILED: "Ошибка подключения",
  MAIN_MIRROR_IS_NOT_HTTPS: "Главное зеркало не HTTPS",
  FAVICON_ERROR: "Ошибка favicon",
  NOT_IN_SPRAV: "Организация не в Яндекс.Справочнике",
  FAVICON_PROBLEM: "Проблемы с favicon",
  DNS_ERROR: "Ошибка DNS",
  MAIN_PAGE_REDIRECTS: "Редиректы на главной",
  DOCUMENTS_MISSING_DESCRIPTION: "Нет описания у страниц",
  ERRORS_IN_SITEMAPS: "Ошибки в Sitemap",
  NOT_MOBILE_FRIENDLY: "Не оптимизирован для мобильных",
  URL_ALERT_5XX: "5xx ошибки на URL",
  URL_ALERT_4XX: "4xx ошибки на URL",
  DUPLICATE_CONTENT_ATTRS: "Дублированные content-атрибуты",
  BIG_FAVICON_ABSENT: "Нет большого favicon",
  NO_SITEMAPS: "Нет Sitemap",
  DOCUMENTS_MISSING_TITLE: "Нет заголовка у страниц",
  NO_REGIONS: "Не указан регион",
  TOO_MANY_DOMAINS_ON_SEARCH: "Слишком много доменов в поиске",
  SSL_CERTIFICATE_ERROR: "Ошибка SSL-сертификата",
  DUPLICATE_PAGES: "Дублированные страницы",
  DISALLOWED_IN_ROBOTS: "Закрыто в robots.txt",
  NO_ROBOTS_TXT: "Нет robots.txt",
  NO_METRIKA_COUNTER: "Нет счётчика Яндекс.Метрики",
  SOFT_404: "Программный 404 (soft 404)",
  THREATS: "Обнаружены угрозы безопасности",
  NO_METRIKA_COUNTER_BINDING: "Не привязан счётчик Метрики",
  NO_METRIKA_COUNTER_CRAWL_ENABLED: "Не включён обход Метрикой",
  SLOW_AVG_RESPONSE_TIME: "Медленное время ответа",
};

const ERROR_DETAILS_RU: Record<string, { description: string; recommendation: string }> = {
  INSIGNIFICANT_CGI_PARAMETER: {
    description: "Яндекс обнаружил URL с незначимыми CGI-параметрами, которые создают дубли страниц в индексе.",
    recommendation: "Настройте директиву Clean-param в robots.txt или используйте canonical-теги.",
  },
  ERROR_IN_ROBOTS_TXT: {
    description: "В файле robots.txt найдены синтаксические ошибки, которые могут помешать корректному обходу сайта.",
    recommendation: "Проверьте robots.txt через валидатор Яндекс.Вебмастера и исправьте ошибки.",
  },
  MAIN_PAGE_ERROR: {
    description: "Главная страница сайта возвращает ошибку или недоступна для робота.",
    recommendation: "Убедитесь, что главная страница отдаёт HTTP 200 и доступна без авторизации.",
  },
  NO_SITEMAP_MODIFICATIONS: {
    description: "Sitemap не обновлялся длительное время, что снижает скорость индексации.",
    recommendation: "Настройте автоматическую генерацию sitemap.xml с актуальными датами lastmod.",
  },
  CONNECT_FAILED: {
    description: "Робот не может подключиться к серверу — сайт недоступен.",
    recommendation: "Проверьте доступность сервера, настройки firewall и DNS.",
  },
  MAIN_MIRROR_IS_NOT_HTTPS: {
    description: "Основное зеркало использует HTTP вместо HTTPS.",
    recommendation: "Настройте SSL-сертификат и 301-редирект с HTTP на HTTPS.",
  },
  FAVICON_ERROR: {
    description: "Favicon сайта недоступен или содержит ошибки.",
    recommendation: "Разместите корректный favicon.ico в корне сайта.",
  },
  NOT_IN_SPRAV: {
    description: "Организация не найдена в Яндекс.Справочнике.",
    recommendation: "Зарегистрируйте организацию в Яндекс.Бизнесе и привяжите сайт.",
  },
  FAVICON_PROBLEM: {
    description: "Проблемы с отображением favicon — формат или размер не соответствуют требованиям.",
    recommendation: "Используйте favicon в формате ICO или PNG размером не менее 120×120 px.",
  },
  DNS_ERROR: {
    description: "DNS-записи домена некорректны или DNS-серверы не отвечают.",
    recommendation: "Проверьте настройки DNS у регистратора домена.",
  },
  MAIN_PAGE_REDIRECTS: {
    description: "Главная страница выполняет редирект, что замедляет индексацию.",
    recommendation: "Уберите цепочки редиректов с главной страницы.",
  },
  DOCUMENTS_MISSING_DESCRIPTION: {
    description: "У части страниц отсутствует мета-тег description.",
    recommendation: "Добавьте уникальные мета-описания (до 160 символов) для всех важных страниц.",
  },
  ERRORS_IN_SITEMAPS: {
    description: "В Sitemap обнаружены ошибки: нерабочие ссылки или некорректный формат.",
    recommendation: "Валидируйте sitemap.xml, уберите 404 URL.",
  },
  NOT_MOBILE_FRIENDLY: {
    description: "Сайт не оптимизирован для мобильных устройств.",
    recommendation: "Внедрите адаптивную вёрстку (responsive design).",
  },
  URL_ALERT_5XX: {
    description: "Обнаружены URL с серверными ошибками 5xx.",
    recommendation: "Проверьте логи сервера и устраните причины 500/502/503 ошибок.",
  },
  URL_ALERT_4XX: {
    description: "Обнаружены URL с ошибками 4xx (страницы не найдены).",
    recommendation: "Настройте 301-редиректы с удалённых страниц на актуальные.",
  },
  BIG_FAVICON_ABSENT: {
    description: "Отсутствует большой favicon (touch-icon) для мобильных устройств.",
    recommendation: "Добавьте apple-touch-icon размером 180×180 px.",
  },
  NO_SITEMAPS: {
    description: "На сайте не обнаружен файл sitemap.xml.",
    recommendation: "Создайте sitemap.xml и добавьте его в robots.txt.",
  },
  DOCUMENTS_MISSING_TITLE: {
    description: "У части страниц отсутствует тег title.",
    recommendation: "Добавьте уникальные title (до 70 символов) для каждой страницы.",
  },
  NO_REGIONS: {
    description: "Для сайта не указан регион.",
    recommendation: "Укажите регион в Яндекс.Вебмастере или привяжите организацию в Справочнике.",
  },
  SSL_CERTIFICATE_ERROR: {
    description: "SSL-сертификат недействителен, просрочен или установлен некорректно.",
    recommendation: "Обновите SSL-сертификат и проверьте цепочку.",
  },
  DUPLICATE_PAGES: {
    description: "Обнаружены дублированные страницы.",
    recommendation: "Используйте rel=canonical и настройте 301-редиректы.",
  },
  DISALLOWED_IN_ROBOTS: {
    description: "Важные страницы заблокированы в robots.txt.",
    recommendation: "Проверьте правила Disallow и разблокируйте нужные разделы.",
  },
  NO_ROBOTS_TXT: {
    description: "Файл robots.txt отсутствует.",
    recommendation: "Создайте robots.txt с корректными правилами.",
  },
  NO_METRIKA_COUNTER: {
    description: "На сайте не установлен счётчик Яндекс.Метрики.",
    recommendation: "Установите код Яндекс.Метрики на все страницы сайта.",
  },
  SOFT_404: {
    description: "Обнаружены «мягкие 404» — страницы с кодом 200, но без контента.",
    recommendation: "Настройте корректный HTTP-код 404 для несуществующих страниц.",
  },
  THREATS: {
    description: "Обнаружены угрозы безопасности: вредоносный код или фишинг.",
    recommendation: "Немедленно проверьте сайт на вирусы и удалите вредоносный код.",
  },
  NO_METRIKA_COUNTER_BINDING: {
    description: "Счётчик Метрики не привязан к сайту в Вебмастере.",
    recommendation: "Привяжите счётчик Яндекс.Метрики в настройках Вебмастера.",
  },
  NO_METRIKA_COUNTER_CRAWL_ENABLED: {
    description: "Не включён обход сайта роботом Метрики.",
    recommendation: "Включите «Разрешить обход роботом Метрики» в настройках счётчика.",
  },
  SLOW_AVG_RESPONSE_TIME: {
    description: "Среднее время ответа сервера слишком высокое.",
    recommendation: "Оптимизируйте серверную часть: кэширование, CDN, уменьшите время ответа до 200 мс.",
  },
  DUPLICATE_CONTENT_ATTRS: {
    description: "Найдены страницы с дублированными content-атрибутами.",
    recommendation: "Сделайте title и description уникальными для каждой страницы.",
  },
  TOO_MANY_DOMAINS_ON_SEARCH: {
    description: "В поиске слишком много зеркал домена.",
    recommendation: "Настройте главное зеркало и 301-редиректы.",
  },
};

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Клики (28 дн.)</p>
                <p className="text-lg font-bold text-foreground">{Number(gClicks).toLocaleString("ru-RU")}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Показы</p>
                <p className="text-lg font-bold text-foreground">{Number(gImpressions).toLocaleString("ru-RU")}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* Errors table with descriptions */}
      <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Замечания по сайту</h3>
          <Badge variant="secondary" className="text-[10px] h-5">{siteErrors.length}</Badge>
        </div>
        {siteErrors.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-[hsl(142,71%,45%)]/30" />
            <p className="text-[13px] text-muted-foreground">Ошибок не обнаружено</p>
          </div>
        ) : (
          <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
            {siteErrors.map((err) => {
              const isNew = err.status === "Новая";
              const translatedName = ERROR_NAMES_RU[err.error_type] || err.error_type;
              const details = ERROR_DETAILS_RU[err.error_type];
              return (
                <div
                  key={err.id}
                  className={cn(
                    "rounded-lg border p-3 space-y-2 transition-colors",
                    isNew ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/10"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className={cn("h-4 w-4 mt-0.5 shrink-0", isNew ? "text-destructive" : "text-amber-500")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{translatedName}</p>
                      {err.url && err.url !== "—" && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{err.url}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px]",
                          err.source === "yandex" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--chart-2))]/10 text-[hsl(var(--chart-2))]"
                        )}
                      >
                        {err.source === "yandex" ? "Яндекс" : "Google"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{format(parseISO(err.detected_at), "dd.MM.yy")}</span>
                      {isNew ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-destructive hover:text-foreground px-2"
                          onClick={() => markReviewed.mutate(err.id)}
                        >
                          Новая
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">✓</span>
                      )}
                    </div>
                  </div>
                  {details && (
                    <div className="ml-7 space-y-1.5">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {details.description}
                      </p>
                      <div className="flex items-start gap-1.5 p-2 rounded-md bg-primary/5 border border-primary/10">
                        <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <p className="text-xs text-foreground/80 leading-relaxed">
                          <span className="font-medium text-primary">Рекомендация:</span>{" "}
                          {details.recommendation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
