import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Download, Sun, Moon, Loader2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ReportView, type ReportData, type ReportModule, type ReportType } from "./ReportView";
import { generateDailyVisits, generatePagesData, type DateRange } from "@/lib/data-generators";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";

export default function ReportPreviewPage() {
  const { id, shareToken } = useParams<{ id: string; shareToken: string }>();
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const reportRef = useRef<HTMLDivElement>(null);
  const [lightMode, setLightMode] = useState(searchParams.get("light") === "1");
  const [exporting, setExporting] = useState(false);

  const projectId = id;
  const modulesParam = searchParams.get("modules");
  const periodParam = searchParams.get("period") || "currentMonth";
  const reportTypeParam = (searchParams.get("type") || "combined") as ReportType;

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["report-project", projectId, shareToken],
    queryFn: async () => {
      if (shareToken) {
        const { data, error } = await supabase.rpc("get_shared_project", { p_share_token: shareToken });
        if (error) throw error;
        return data?.[0] ?? null;
      }
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId || !!shareToken,
  });

  const { data: template } = useQuery({
    queryKey: ["report-template", projectId || project?.id],
    queryFn: async () => {
      const pid = projectId || project?.id;
      const { data, error } = await supabase.from("report_templates" as any).select("*").eq("project_id", pid!).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!(projectId || project?.id),
  });

  const { data: workLogs = [] } = useQuery({
    queryKey: ["report-worklogs", projectId || project?.id],
    queryFn: async () => {
      const pid = projectId || project?.id;
      if (shareToken) {
        const { data, error } = await supabase.rpc("get_shared_work_logs", { p_project_id: pid! });
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await supabase.from("work_logs").select("*").eq("project_id", pid!).order("task_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!(projectId || project?.id),
  });

  const { data: metrikaStats } = useQuery({
    queryKey: ["report-metrika", projectId || project?.id],
    queryFn: async () => {
      const pid = projectId || project?.id;
      const { data, error } = await supabase.from("metrika_stats").select("*").eq("project_id", pid!).order("fetched_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!(projectId || project?.id),
  });

  const { data: cachedReport } = useQuery({
    queryKey: ["report-cached", projectId || project?.id],
    queryFn: async () => {
      const pid = projectId || project?.id;
      const now = new Date();
      const { data, error } = await supabase.from("cached_reports").select("*").eq("project_id", pid!).eq("report_year", now.getFullYear()).eq("report_month", now.getMonth()).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!(projectId || project?.id),
  });

  const modules: ReportModule[] = useMemo(() => {
    if (modulesParam) {
      const keys = modulesParam.split(",");
      const savedModules = template?.modules as any[] | undefined;
      return keys.map((key) => {
        const saved = savedModules?.find((m: any) => m.key === key);
        return { key, enabled: true, comment: saved?.comment };
      });
    }
    if (template?.modules && Array.isArray(template.modules)) {
      return (template.modules as any[]).map((m: any) => ({ key: m.key, enabled: m.enabled ?? true, comment: m.comment }));
    }
    return ["kpi", "traffic", "sources", "seo", "seo_visibility", "seo_branded", "positions", "ads_kpi", "ads_traffic", "ads_campaigns", "channel_goals", "pages", "worklog", "ai"].map((key) => ({ key, enabled: true }));
  }, [modulesParam, template]);

  const reportData: ReportData | null = useMemo(() => {
    if (!project) return null;

    const now = new Date();
    const isLastMonth = periodParam === "lastMonth";
    const refDate = isLastMonth ? subMonths(now, 1) : now;
    const from = startOfMonth(refDate);
    const to = isLastMonth ? endOfMonth(refDate) : now;
    const range: DateRange = { from, to };

    // Traffic chart
    let trafficChart: ReportData["trafficChart"] = [];
    if (metrikaStats?.visits_by_day && Array.isArray(metrikaStats.visits_by_day)) {
      trafficChart = (metrikaStats.visits_by_day as any[]).map((d: any) => ({
        dateStr: d.date ? format(new Date(d.date), "dd.MM") : d.dateStr || "",
        search: Math.round((d.visits || 0) * 0.45),
        direct: Math.round((d.visits || 0) * 0.25),
        social: Math.round((d.visits || 0) * 0.12),
        referral: Math.round((d.visits || 0) * 0.08),
        ads: Math.round((d.visits || 0) * 0.10),
      }));
    } else {
      const daily = generateDailyVisits(range);
      trafficChart = daily.map((d) => ({
        dateStr: d.dateStr,
        search: Math.round(d.visits * 0.45),
        direct: Math.round(d.visits * 0.25),
        social: Math.round(d.visits * 0.12),
        referral: Math.round(d.visits * 0.08),
        ads: Math.round(d.visits * 0.10),
      }));
    }

    const totalVisits = metrikaStats?.total_visits || trafficChart.reduce((s, d) => s + d.search + d.direct + d.social + d.referral + (d.ads || 0), 0);
    const totalUsers = metrikaStats?.total_users || Math.round(totalVisits * 0.72);
    const bounceRate = metrikaStats?.bounce_rate || 32.1;
    const avgDuration = metrikaStats?.avg_duration_seconds || 165;
    const durationStr = `${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, "0")}`;

    const kpis = [
      { label: "Визиты", value: totalVisits.toLocaleString(), change: 12.3 },
      { label: "Посетители", value: totalUsers.toLocaleString(), change: 8.7 },
      { label: "Отказы", value: `${Number(bounceRate).toFixed(1)}`, suffix: "%", change: -3.1, invertPositive: true },
      { label: "Время на сайте", value: durationStr, change: 5.2 },
    ];

    const sources = metrikaStats?.traffic_sources;
    let sourcesChart: ReportData["sourcesChart"];
    if (sources && Array.isArray(sources) && sources.length > 0) {
      sourcesChart = (sources as any[]).map((s: any) => ({ name: s.name || s.source, value: s.value || s.visits }));
    } else {
      sourcesChart = [
        { name: "Поисковые", value: Math.round(totalVisits * 0.45) },
        { name: "Прямые", value: Math.round(totalVisits * 0.25) },
        { name: "Реклама", value: Math.round(totalVisits * 0.10) },
        { name: "Социальные", value: Math.round(totalVisits * 0.12) },
        { name: "Реферальные", value: Math.round(totalVisits * 0.08) },
      ];
    }

    const topPages = generatePagesData(range, project.url || "").slice(0, 10);

    const seoQueries = [
      { query: "seo продвижение", clicks: 342, impressions: 4200, position: 5.2 },
      { query: "раскрутка сайта", clicks: 218, impressions: 3800, position: 8.4 },
      { query: "аналитика трафика", clicks: 156, impressions: 2100, position: 6.1 },
      { query: "контекстная реклама", clicks: 134, impressions: 1900, position: 9.3 },
      { query: "оптимизация сайта", clicks: 98, impressions: 1500, position: 11.2 },
    ];

    const aiData = cachedReport?.report_data as any;
    let aiSummary = "";
    if (aiData?.ai_summary) {
      const s = aiData.ai_summary;
      aiSummary = [s.happened, s.why, s.recommendation].filter(Boolean).join("\n\n");
    }

    // SEO visibility data
    const seoVisibility = { avgPosition: 14.2, top10Pct: 42, top3Pct: 18, totalKeywords: 156 };
    const brandedVsNonBranded = { branded: Math.round(totalVisits * 0.15), nonBranded: Math.round(totalVisits * 0.30) };

    // Ads data
    const adsVisits = Math.round(totalVisits * 0.10);
    const adsKpis = [
      { label: "Расход", value: `${(adsVisits * 28).toLocaleString()} ₽`, change: 5.1 },
      { label: "Клики", value: adsVisits.toLocaleString(), change: 12.4 },
      { label: "CPC", value: "28 ₽", change: -6.2, invertPositive: true },
      { label: "CTR", value: "3.8", suffix: "%", change: 1.9 },
      { label: "CPA", value: `${Math.round(adsVisits * 28 / Math.max(1, Math.round(adsVisits * 0.034))).toLocaleString()} ₽`, change: -4.5, invertPositive: true },
    ];

    const adsTrafficChart = trafficChart.map((d) => ({ dateStr: d.dateStr, ads: d.ads || 0 }));

    const adsCampaigns = [
      { name: "Поиск — Бренд", visits: Math.round(adsVisits * 0.35), bounceRate: 22.4, conversions: Math.round(adsVisits * 0.035 * 0.35), cost: Math.round(adsVisits * 0.35 * 18) },
      { name: "Поиск — Конкуренты", visits: Math.round(adsVisits * 0.25), bounceRate: 38.1, conversions: Math.round(adsVisits * 0.025 * 0.25), cost: Math.round(adsVisits * 0.25 * 42) },
      { name: "РСЯ — Ретаргетинг", visits: Math.round(adsVisits * 0.20), bounceRate: 28.7, conversions: Math.round(adsVisits * 0.04 * 0.20), cost: Math.round(adsVisits * 0.20 * 22) },
      { name: "VK Ads — Лидогенерация", visits: Math.round(adsVisits * 0.12), bounceRate: 45.3, conversions: Math.round(adsVisits * 0.02 * 0.12), cost: Math.round(adsVisits * 0.12 * 35) },
      { name: "Поиск — Общие запросы", visits: Math.round(adsVisits * 0.08), bounceRate: 41.2, conversions: Math.round(adsVisits * 0.015 * 0.08), cost: Math.round(adsVisits * 0.08 * 55) },
    ];

    const channelGoals = [
      { name: "SEO (органика)", value: Math.round(totalVisits * 0.45 * 0.034), color: "#3b82f6" },
      { name: "Контекстная реклама", value: Math.round(adsVisits * 0.028), color: "#8b5cf6" },
      { name: "Прямые заходы", value: Math.round(totalVisits * 0.25 * 0.042), color: "#22c55e" },
      { name: "Социальные сети", value: Math.round(totalVisits * 0.12 * 0.018), color: "#f97316" },
      { name: "Рефералы", value: Math.round(totalVisits * 0.08 * 0.025), color: "#ef4444" },
    ];

    return {
      projectName: project.name,
      projectUrl: project.url || undefined,
      agencyLogoUrl: undefined,
      clientLogoUrl: template?.client_logo_url || project.logo_url || undefined,
      period: { from, to },
      reportType: reportTypeParam,
      kpis,
      trafficChart,
      sourcesChart,
      seoQueries,
      topPages,
      workLogs: (workLogs || []).map((w: any) => ({
        description: w.description,
        category: w.category || "seo",
        status: w.status,
        date: w.task_date,
        link: w.link_url || undefined,
      })),
      aiSummary,
      seoVisibility,
      brandedVsNonBranded,
      adsKpis,
      adsTrafficChart,
      adsCampaigns,
      channelGoals,
    };
  }, [project, metrikaStats, workLogs, cachedReport, template, periodParam, reportTypeParam]);

  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf().set({
        margin: 0,
        filename: `report-${project?.name || "project"}-${format(new Date(), "yyyy-MM-dd")}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      } as any).from(reportRef.current).save();
      toast.success("PDF сохранён");
    } catch (err: any) {
      console.error(err);
      toast.error("Ошибка экспорта PDF");
    } finally {
      setExporting(false);
    }
  };

  if (loadingProject) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!project || !reportData) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Проект не найден</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground truncate">{project.name} — Отчёт</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLightMode(!lightMode)}>
              {lightMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru")}>
              <Globe className="h-4 w-4" />
            </Button>
            <Button size="sm" className="gap-1.5 h-8" onClick={handleExportPdf} disabled={exporting}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              PDF
            </Button>
          </div>
        </div>
      </div>
      <ReportView ref={reportRef} data={reportData} modules={modules} lightMode={lightMode} />
    </div>
  );
}
