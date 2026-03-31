import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, CheckCircle2, ExternalLink, Globe, BarChart3,
  Sparkles, AlertTriangle,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { ArtifactCard } from "@/components/project/ArtifactCard";
import { supabase } from "@/integrations/supabase/client";

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

  const { data: cachedReport } = useQuery({
    queryKey: ["shared-cached-report", project?.id],
    queryFn: async () => {
      const now = new Date();
      const { data, error } = await supabase
        .from("cached_reports")
        .select("*")
        .eq("project_id", project!.id)
        .eq("report_year", now.getFullYear())
        .eq("report_month", now.getMonth())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id,
  });

  // Fetch real metrika stats for this project
  const { data: metrikaStats } = useQuery({
    queryKey: ["shared-metrika-stats", project?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrika_stats")
        .select("*")
        .eq("project_id", project!.id)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id,
  });

  const currentMonth = new Date().getMonth();
  const monthName = t(`publicReport.months.${currentMonth}`);
  const completedTasks = workLogs.filter((wl) => wl.status === "done");

  const kpis = [
    { label: t("publicReport.kpi.visits"), value: metrikaStats ? metrikaStats.total_visits.toLocaleString() : "—", change: 0, suffix: "" },
    { label: t("publicReport.kpi.bounceRate"), value: metrikaStats ? Number(metrikaStats.bounce_rate).toFixed(1) : "—", change: 0, suffix: "%" },
    { label: t("publicReport.kpi.depth"), value: metrikaStats ? Number(metrikaStats.page_depth).toFixed(1) : "—", change: 0, suffix: "" },
    { label: t("publicReport.kpi.positions"), value: "—", change: 0, suffix: "" },
  ];

  const isPositive = (change: number, idx: number) => {
    if (idx === 1 || idx === 3) return change < 0;
    return change > 0;
  };

  const aiSummary = cachedReport?.report_data && typeof cachedReport.report_data === 'object' && 'ai_summary' in (cachedReport.report_data as any)
    ? (cachedReport.report_data as any).ai_summary
    : null;

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

  // Check link expiry
  const expiresAt = (project as any).share_link_expires_at;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">{t("publicReport.expired")}</h2>
          <p className="text-muted-foreground max-w-md">{t("publicReport.expiredDesc")}</p>
        </div>
      </div>
    );
  }

  const aiSections = aiSummary ? [
    { key: "happened", icon: "📊", label: t("aiInsights.happened") },
    { key: "why", icon: "🔍", label: t("aiInsights.why") },
    { key: "recommendation", icon: "💡", label: t("aiInsights.recommendation") },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {project.logo_url ? (
              <img src={project.logo_url} alt={project.name} className="h-7 w-7 rounded object-cover" />
            ) : (
              <BarChart3 className="h-5 w-5 text-primary" />
            )}
            <span className="text-sm font-medium text-foreground truncate">{project.name}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">• {monthName}</span>
          </div>
          <Button variant="outline" size="sm" onClick={toggleLang} className="gap-1.5 text-xs h-8">
            <Globe className="h-3.5 w-3.5" />
            {i18n.language === "ru" ? "EN" : "RU"}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          {project.logo_url ? (
            <img src={project.logo_url} alt={project.name} className="h-20 w-20 rounded-2xl object-cover mx-auto mb-4 shadow-lg" />
          ) : (
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-4 shadow-lg">
              {project.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-2">
            {t("publicReport.title", { month: monthName })}
          </h1>
          <p className="text-muted-foreground">{project.name}{project.url ? ` — ${project.url}` : ""}</p>
        </motion.div>

        {/* AI Insights (read-only) */}
        {aiSummary && (aiSummary.happened || aiSummary.why || aiSummary.recommendation) && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-10"
          >
            <div className="relative rounded-xl border border-primary/20 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-purple-500/5 to-primary/8" />
              <div className="absolute inset-0 bg-card/60 backdrop-blur-sm" />
              <div className="relative p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{t("aiInsights.title")}</h3>
                    <p className="text-[11px] text-muted-foreground">{t("aiInsights.subtitle")}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {aiSections.map((s, i) =>
                    aiSummary[s.key] ? (
                      <motion.div
                        key={s.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.15 }}
                        className="flex gap-3"
                      >
                        <span className="text-base mt-0.5 shrink-0">{s.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-0.5">{s.label}</p>
                          <p className="text-sm text-foreground leading-relaxed">{aiSummary[s.key]}</p>
                        </div>
                      </motion.div>
                    ) : null
                  )}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* KPIs */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-foreground mb-5">{t("publicReport.kpi.title")}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {kpis.map((kpi, i) => {
              const positive = isPositive(kpi.change, i);
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}>
                  <Card className="border-border/60">
                    <CardContent className="p-4 sm:p-5">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1">{kpi.label}</p>
                      <p className="text-2xl sm:text-3xl font-bold text-foreground">{kpi.value}{kpi.suffix}</p>
                      <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${positive ? "text-success" : "text-destructive"}`}>
                        {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        <span>{Math.abs(kpi.change)}%</span>
                        <span className="text-xs font-normal text-muted-foreground ml-1 hidden sm:inline">
                          {positive ? t("publicReport.growth") : t("publicReport.decline")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Traffic Chart */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-foreground mb-5">{t("publicReport.trafficDynamics")}</h2>
          <Card className="border-border/60">
            <CardContent className="p-4 sm:p-6">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={metrikaStats ? (metrikaStats.visits_by_day as any[] || []) : []}>
                  <defs>
                    <linearGradient id="shareGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#shareGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {/* Completed Work with Artifact Cards */}
        {completedTasks.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-5">{t("publicReport.completedWork")}</h2>
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 flex-wrap sm:flex-nowrap">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                  <span className="flex-1 text-sm text-foreground">{task.description}</span>
                  {task.link_url && <ArtifactCard url={task.link_url} />}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All Work Logs */}
        {workLogs.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-5">{t("project.worklog.title")}</h2>
            <div className="space-y-2">
              {workLogs.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 flex-wrap sm:flex-nowrap">
                  <CheckCircle2 className={`h-5 w-5 shrink-0 ${task.status === "done" ? "text-success" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-foreground">{task.description}</span>
                    <span className="text-xs text-muted-foreground ml-2">{task.task_date}</span>
                  </div>
                  {task.link_url && <ArtifactCard url={task.link_url} />}
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
