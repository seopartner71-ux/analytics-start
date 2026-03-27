import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, CheckCircle2, ExternalLink, Globe, BarChart3,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { trafficData, kpiData } from "@/data/projects";

const ShareView = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { t, i18n } = useTranslation();

  const toggleLang = () => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["shared-project", shareToken],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_shared_project", { p_share_token: shareToken! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!shareToken,
  });

  const { data: workLogs = [] } = useQuery({
    queryKey: ["shared-work-logs", project?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_shared_work_logs", { p_project_id: project!.id });
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id,
  });

  const currentMonth = new Date().getMonth();
  const monthName = t(`publicReport.months.${currentMonth}`);
  const completedTasks = workLogs.filter((wl) => wl.status === "done");

  const kpis = [
    { label: t("publicReport.kpi.visits"), value: kpiData.visits.value.toLocaleString(), change: kpiData.visits.change, suffix: "" },
    { label: t("publicReport.kpi.bounceRate"), value: kpiData.bounceRate.value.toFixed(1), change: kpiData.bounceRate.change, suffix: "%" },
    { label: t("publicReport.kpi.depth"), value: kpiData.depth.value.toFixed(1), change: kpiData.depth.change, suffix: "" },
    { label: t("publicReport.kpi.positions"), value: kpiData.positions.value.toFixed(1), change: kpiData.positions.change, suffix: "" },
  ];

  const isPositive = (change: number, idx: number) => {
    if (idx === 1 || idx === 3) return change < 0;
    return change > 0;
  };

  if (loadingProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("common.error")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <Button variant="outline" size="sm" onClick={toggleLang} className="gap-1.5 bg-card shadow-md text-xs">
          <Globe className="h-3.5 w-3.5" />
          {i18n.language === "ru" ? "EN" : "RU"}
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">StatPulse</span>
          </div>
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mb-4 shadow-lg">
            {project.name.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
            {t("publicReport.title", { month: monthName })}
          </h1>
          <p className="text-lg text-muted-foreground">{project.name} — {project.url}</p>
        </div>

        {/* KPIs */}
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
                    <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${positive ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
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

        {/* Traffic Chart */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-5">{t("publicReport.trafficDynamics")}</h2>
          <Card className="border-border/60">
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={trafficData}>
                  <defs>
                    <linearGradient id="shareGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="visitors" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#shareGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {/* Completed Work */}
        {completedTasks.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-5">{t("publicReport.completedWork")}</h2>
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />
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

        {/* All Work Logs (read-only) */}
        {workLogs.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-5">{t("project.worklog.title")}</h2>
            <div className="space-y-2">
              {workLogs.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
                  <CheckCircle2 className={`h-5 w-5 shrink-0 ${task.status === "done" ? "text-[hsl(var(--success))]" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <span className="text-sm text-foreground">{task.description}</span>
                    <span className="text-xs text-muted-foreground ml-2">{task.task_date}</span>
                  </div>
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

        <footer className="border-t border-border/60 pt-8 mt-12 text-center">
          <p className="text-xs text-muted-foreground/60">Powered by StatPulse</p>
        </footer>
      </div>
    </div>
  );
};

export default ShareView;
