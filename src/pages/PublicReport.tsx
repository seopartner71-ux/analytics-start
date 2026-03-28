import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download, TrendingUp, TrendingDown, CheckCircle2,
  ExternalLink, Mail, Phone, User, Globe,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { generateDailyVisits, computeKpis, type DateRange } from "@/lib/data-generators";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

const PublicReport = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();

  const modulesParam = searchParams.get("modules");
  const enabledModules = modulesParam ? modulesParam.split(",") : ["kpi", "traffic", "sources", "seo", "pages", "worklog", "ai"];
  const showCompare = searchParams.get("compare") === "1";

  // Fetch project
  const { data: project, isLoading } = useQuery({
    queryKey: ["public-report-project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch work logs
  const { data: workLogs = [] } = useQuery({
    queryKey: ["public-report-worklogs", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_logs").select("*").eq("project_id", id!).order("task_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && enabledModules.includes("worklog"),
  });

  // Fetch report template for logo
  const { data: template } = useQuery({
    queryKey: ["report_template_public", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates" as any)
        .select("*")
        .eq("project_id", id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const toggleLang = () => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");

  const currentMonth = new Date().getMonth();
  const monthName = t(`publicReport.months.${currentMonth}`);

  const now = new Date();
  const range: DateRange = { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  const dailyVisits = generateDailyVisits(range);
  const kpiBase = computeKpis(dailyVisits);

  const kpis = [
    { label: t("publicReport.kpi.visits"), value: kpiBase.totalVisits.toLocaleString(), change: 12.3, suffix: "" },
    { label: t("publicReport.kpi.bounceRate"), value: kpiBase.bounceRate.toFixed(1), change: -3.1, suffix: "%" },
    { label: t("publicReport.kpi.depth"), value: kpiBase.depth.toFixed(1), change: 5.2, suffix: "" },
    { label: t("publicReport.kpi.positions"), value: "14.2", change: -8.5, suffix: "" },
  ];

  const isPositive = (change: number, idx: number) => {
    if (idx === 1 || idx === 3) return change < 0;
    return change > 0;
  };

  const sourceData = [
    { name: t("project.analytics.organic"), value: 52 },
    { name: t("project.analytics.direct"), value: 25 },
    { name: t("project.analytics.social"), value: 13 },
    { name: t("project.analytics.referral"), value: 10 },
  ];

  const seoQueries = [
    { query: "seo продвижение", clicks: 342, impressions: 4200, ctr: 8.1, position: 5.2 },
    { query: "раскрутка сайта", clicks: 218, impressions: 3800, ctr: 5.7, position: 8.4 },
    { query: "аналитика трафика", clicks: 156, impressions: 2100, ctr: 7.4, position: 6.1 },
    { query: "контекстная реклама", clicks: 134, impressions: 1900, ctr: 7.1, position: 9.3 },
    { query: "оптимизация сайта", clicks: 98, impressions: 1500, ctr: 6.5, position: 11.2 },
  ];

  const clientLogoUrl = template?.client_logo_url || project?.logo_url;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <Button variant="outline" size="sm" onClick={toggleLang} className="gap-1.5 bg-card shadow-md text-xs">
          <Globe className="h-3.5 w-3.5" />
          {t("publicReport.langSwitch")}
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          {clientLogoUrl ? (
            <img src={clientLogoUrl} alt="Logo" className="h-20 w-20 rounded-2xl object-cover mx-auto mb-6 shadow-lg border border-border" />
          ) : (
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-6 shadow-lg">
              {(project?.name || "R").slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
            {t("publicReport.title", { month: monthName })}
          </h1>
          <p className="text-lg text-muted-foreground">{project?.name} — {project?.url}</p>
          <Button className="mt-6 gap-2" size="lg">
            <Download className="h-4 w-4" />
            {t("publicReport.downloadPdf")}
          </Button>
        </div>

        {/* KPI */}
        {enabledModules.includes("kpi") && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-5">{t("publicReport.kpi.title")}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((kpi, i) => {
                const positive = isPositive(kpi.change, i);
                return (
                  <Card key={i} className="border-border/60">
                    <CardContent className="p-5">
                      <p className="text-sm text-muted-foreground mb-1">{kpi.label}</p>
                      <p className="text-3xl font-bold text-foreground">{kpi.value}{kpi.suffix}</p>
                      <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${positive ? "text-emerald-500" : "text-destructive"}`}>
                        {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        <span>{Math.abs(kpi.change)}%</span>
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          {positive ? t("publicReport.growth") : t("publicReport.decline")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Traffic chart */}
        {enabledModules.includes("traffic") && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-5">{t("publicReport.trafficDynamics")}</h2>
            <Card className="border-border/60">
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={trafficData}>
                    <defs>
                      <linearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#reportGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Sources */}
        {enabledModules.includes("sources") && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-5">{t("project.analytics.trafficSources")}</h2>
            <Card className="border-border/60">
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>
        )}

        {/* SEO queries */}
        {enabledModules.includes("seo") && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-5">{t("seoTab.queriesTable")}</h2>
            <Card className="border-border/60">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground">{t("seoTab.query")}</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">{t("seoTab.clicks")}</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">{t("seoTab.impressions")}</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">CTR</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">{t("seoTab.position")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seoQueries.slice(0, 10).map((q, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="p-3 text-foreground">{q.query}</td>
                          <td className="p-3 text-right text-foreground">{q.clicks}</td>
                          <td className="p-3 text-right text-muted-foreground">{q.impressions}</td>
                          <td className="p-3 text-right text-muted-foreground">{q.ctr.toFixed(1)}%</td>
                          <td className="p-3 text-right text-muted-foreground">{q.position.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Work log */}
        {enabledModules.includes("worklog") && workLogs.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-5">{t("publicReport.completedWork")}</h2>
            <div className="space-y-2">
              {workLogs.filter((w) => w.status === "done").map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span className="flex-1 text-sm text-foreground">{task.description}</span>
                  {task.link_url && (
                    <a href={task.link_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <ExternalLink className="h-3 w-3" />
                        {t("publicReport.viewResult")}
                      </Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Summary */}
        {enabledModules.includes("ai") && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-5">{t("aiAnalytics.title")}</h2>
            <Card className="border-border/60 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-6">
                <p className="text-sm text-foreground leading-relaxed">
                  {i18n.language === "ru"
                    ? "Трафик за отчётный период вырос на 12%. Основной драйвер — органический поиск. Рекомендуется продолжить работу над контентом в разделе «Блог» и оптимизировать мета-теги для коммерческих страниц."
                    : "Traffic grew by 12% during the reporting period. The main driver is organic search. It is recommended to continue content work in the 'Blog' section and optimize meta tags for commercial pages."}
                </p>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-border/60 pt-8 mt-12 text-center">
          <p className="mt-4 text-xs text-muted-foreground/60">Powered by StatPulse</p>
        </footer>
      </div>
    </div>
  );
};

export default PublicReport;
