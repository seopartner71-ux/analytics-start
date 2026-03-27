import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download, TrendingUp, TrendingDown, CheckCircle2,
  ExternalLink, Mail, Phone, User, Globe,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart,
} from "recharts";
import { MetrikaWidget } from "@/components/widgets/MetrikaWidget";
import { WebmasterWidget } from "@/components/widgets/WebmasterWidget";
import { GSCWidget } from "@/components/widgets/GSCWidget";
import { TopvisorWidget } from "@/components/widgets/TopvisorWidget";
import { demoProjects, trafficData, kpiData } from "@/data/projects";

const PublicReport = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();

  const project = demoProjects.find((p) => p.id === id) || demoProjects[0];
  const currentMonth = new Date().getMonth();
  const monthName = t(`publicReport.months.${currentMonth}`);
  const completedTasks = project.tasks.filter((task) => task.done);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");
  };

  const kpis = [
    { label: t("publicReport.kpi.visits"), value: kpiData.visits.value.toLocaleString(), change: kpiData.visits.change, suffix: "" },
    { label: t("publicReport.kpi.bounceRate"), value: kpiData.bounceRate.value.toFixed(1), change: kpiData.bounceRate.change, suffix: "%" },
    { label: t("publicReport.kpi.depth"), value: kpiData.depth.value.toFixed(1), change: kpiData.depth.change, suffix: "" },
    { label: t("publicReport.kpi.positions"), value: kpiData.positions.value.toFixed(1), change: kpiData.positions.change, suffix: "" },
  ];

  const isPositive = (change: number, idx: number) => {
    if (idx === 1) return change < 0;
    if (idx === 3) return change < 0;
    return change > 0;
  };

  const hasIntegration = (key: string) => project.integrations.find((i) => i.key === key)?.connected ?? false;

  return (
    <div className="min-h-screen bg-background">
      {/* Floating language switcher */}
      <div className="fixed top-4 right-4 z-50">
        <Button variant="outline" size="sm" onClick={toggleLang} className="gap-1.5 bg-card shadow-md text-xs">
          <Globe className="h-3.5 w-3.5" />
          {t("publicReport.langSwitch")}
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground text-3xl font-bold mb-6 shadow-lg">
            {project.name.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
            {t("publicReport.title", { month: monthName })}
          </h1>
          <p className="text-lg text-muted-foreground">{project.name} — {project.url}</p>
          <Button className="mt-6 gap-2" size="lg">
            <Download className="h-4 w-4" />
            {t("publicReport.downloadPdf")}
          </Button>
        </div>

        {/* KPI Cards */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-5">{t("publicReport.kpi.title")}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, i) => {
              const positive = isPositive(kpi.change, i);
              return (
                <Card key={i} className="border-border/60 overflow-hidden">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground mb-1">{kpi.label}</p>
                    <p className="text-3xl font-bold text-foreground">
                      {kpi.value}{kpi.suffix}
                    </p>
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
                    <linearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} label={{ value: t("project.analytics.month"), position: "insideBottom", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} label={{ value: t("project.analytics.visitors"), angle: -90, position: "insideLeft", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="visitors" name={t("project.analytics.visitors")} stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#reportGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {/* Service Widgets */}
        {(hasIntegration("yandexMetrika") || hasIntegration("yandexWebmaster") || hasIntegration("googleSearchConsole") || hasIntegration("topvisor")) && (
          <section className="mb-12">
            <div className="grid gap-6 lg:grid-cols-2">
              {hasIntegration("yandexMetrika") && <MetrikaWidget />}
              {hasIntegration("yandexWebmaster") && <WebmasterWidget />}
              {hasIntegration("googleSearchConsole") && <GSCWidget />}
              {hasIntegration("topvisor") && <TopvisorWidget />}
            </div>
          </section>
        )}

        {/* Completed Work */}
        {completedTasks.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-5">{t("publicReport.completedWork")}</h2>
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />
                  <span className="flex-1 text-sm text-foreground">{task.text}</span>
                  {task.link && (
                    <a href={task.link} target="_blank" rel="noopener noreferrer">
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

        {/* Footer */}
        <footer className="border-t border-border/60 pt-8 mt-12 text-center">
          <p className="text-sm font-medium text-muted-foreground mb-4">{t("publicReport.footer.manager")}</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <User className="h-4 w-4" />
              <span>Алексей Петров</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Mail className="h-4 w-4" />
              <span>manager@statpulse.io</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Phone className="h-4 w-4" />
              <span>+7 (999) 123-45-67</span>
            </div>
          </div>
          <p className="mt-6 text-xs text-muted-foreground/60">Powered by StatPulse</p>
        </footer>
      </div>
    </div>
  );
};

export default PublicReport;
