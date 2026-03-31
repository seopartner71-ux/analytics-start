import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot, TrendingUp, TrendingDown, CheckCircle2, ExternalLink,
  BarChart3, Clock, MousePointerClick, Eye, Users, ArrowUpRight,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

/* ---------- types ---------- */
export interface ReportModule {
  key: string;
  enabled: boolean;
  comment?: string;
}

export interface ReportData {
  projectName: string;
  projectUrl?: string;
  agencyLogoUrl?: string;
  clientLogoUrl?: string;
  period: { from: Date; to: Date };
  kpis: { label: string; value: string; change: number; suffix?: string; invertPositive?: boolean }[];
  trafficChart: { dateStr: string; search: number; direct: number; social: number; referral: number }[];
  sourcesChart: { name: string; value: number }[];
  seoPositions?: { dateStr: string; avgPosition: number }[];
  seoQueries: { query: string; clicks: number; impressions: number; position: number }[];
  topPages: { url: string; title: string; visits: number; bounceRate: number; avgTime: number; growth: number }[];
  workLogs: { description: string; category: string; status: string; date: string; link?: string }[];
  aiSummary?: string;
}

interface ReportViewProps {
  data: ReportData;
  modules: ReportModule[];
  lightMode?: boolean;
}

const CHART_COLORS = [
  "hsl(217, 91%, 60%)", // blue
  "hsl(142, 71%, 45%)", // green
  "hsl(280, 67%, 60%)", // purple
  "hsl(25, 95%, 53%)",  // orange
];

const SOURCE_COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#f97316"];

const isModuleEnabled = (modules: ReportModule[], key: string) =>
  modules.find((m) => m.key === key)?.enabled ?? false;

const getModuleComment = (modules: ReportModule[], key: string) =>
  modules.find((m) => m.key === key)?.comment;

const CommentBlock = ({ comment }: { comment?: string }) =>
  comment ? (
    <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm italic text-foreground/80 report-light:border-blue-200 report-light:bg-blue-50 report-light:text-gray-600">
      💬 {comment}
    </div>
  ) : null;

const DeltaBadge = ({ change, invert }: { change: number; invert?: boolean }) => {
  const positive = invert ? change < 0 : change > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", positive ? "text-emerald-400" : "text-red-400")}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
};

/* ---------- component ---------- */
export const ReportView = forwardRef<HTMLDivElement, ReportViewProps>(
  ({ data, modules, lightMode = false }, ref) => {
    const { t } = useTranslation();
    const periodStr = `${format(data.period.from, "dd.MM.yyyy")} — ${format(data.period.to, "dd.MM.yyyy")}`;

    const bg = lightMode ? "bg-white text-gray-900" : "bg-[#0f1117] text-gray-100";
    const cardBg = lightMode ? "bg-gray-50 border-gray-200" : "bg-[#1a1d27] border-white/[0.06]";
    const mutedText = lightMode ? "text-gray-500" : "text-gray-400";
    const borderColor = lightMode ? "border-gray-200" : "border-white/[0.06]";
    const chartText = lightMode ? "#6b7280" : "#9ca3af";
    const chartGrid = lightMode ? "#e5e7eb" : "rgba(255,255,255,0.06)";
    const tooltipBg = lightMode ? "#ffffff" : "#1a1d27";
    const tooltipBorder = lightMode ? "#e5e7eb" : "rgba(255,255,255,0.1)";

    const categorizedLogs = data.workLogs.reduce((acc, log) => {
      const cat = log.category || "seo";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(log);
      return acc;
    }, {} as Record<string, typeof data.workLogs>);

    const catLabels: Record<string, string> = { seo: "SEO", content: "Контент", tech: "Технические", links: "Ссылки" };

    return (
      <div ref={ref} className={cn("min-h-screen font-sans", bg)} id="report-content">
        {/* ======= COVER ======= */}
        <div className="relative overflow-hidden" style={{ pageBreakAfter: "always" }}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-8 py-20 flex flex-col items-center justify-center min-h-[60vh]">
            {/* logos row */}
            <div className="flex items-center justify-center gap-8 mb-12">
              {data.agencyLogoUrl && (
                <img src={data.agencyLogoUrl} alt="Agency" className="h-14 w-14 rounded-xl object-cover shadow-lg" />
              )}
              {data.clientLogoUrl && (
                <>
                  <div className={cn("h-px w-12", lightMode ? "bg-gray-300" : "bg-white/20")} />
                  <img src={data.clientLogoUrl} alt="Client" className="h-14 w-14 rounded-xl object-cover shadow-lg" />
                </>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center mb-4">
              Аналитический отчёт
            </h1>
            <p className="text-xl font-medium text-center mb-2">{data.projectName}</p>
            {data.projectUrl && (
              <p className={cn("text-sm mb-8", mutedText)}>{data.projectUrl}</p>
            )}
            <div className={cn("inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border", cardBg)}>
              <Clock className="h-4 w-4" />
              {periodStr}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 sm:px-8 pb-16 space-y-10">
          {/* ======= AI SUMMARY ======= */}
          {isModuleEnabled(modules, "ai") && data.aiSummary && (
            <section style={{ pageBreakInside: "avoid" }}>
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/15 to-blue-600/20 rounded-2xl" />
                <div className={cn("absolute inset-[1px] rounded-2xl", lightMode ? "bg-white" : "bg-[#0f1117]")} />
                <div className="relative p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">AI Executive Summary</h2>
                      <p className={cn("text-xs", mutedText)}>Автоматический анализ на основе данных</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{data.aiSummary}</p>
                  <CommentBlock comment={getModuleComment(modules, "ai")} />
                </div>
              </div>
            </section>
          )}

          {/* ======= KPI GRID ======= */}
          {isModuleEnabled(modules, "kpi") && (
            <section style={{ pageBreakInside: "avoid" }}>
              <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" /> Ключевые метрики
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {data.kpis.map((kpi, i) => (
                  <div key={i} className={cn("rounded-xl border p-4", cardBg)}>
                    <p className={cn("text-xs mb-1", mutedText)}>{kpi.label}</p>
                    <p className="text-2xl font-bold">{kpi.value}{kpi.suffix}</p>
                    <DeltaBadge change={kpi.change} invert={kpi.invertPositive} />
                  </div>
                ))}
              </div>
              <CommentBlock comment={getModuleComment(modules, "kpi")} />
            </section>
          )}

          {/* ======= TRAFFIC CHART ======= */}
          {isModuleEnabled(modules, "traffic") && data.trafficChart.length > 0 && (
            <section style={{ pageBreakInside: "avoid" }}>
              <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" /> Динамика трафика
              </h2>
              <div className={cn("rounded-xl border p-5", cardBg)}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.trafficChart}>
                    <defs>
                      {["search", "direct", "social", "referral"].map((k, i) => (
                        <linearGradient key={k} id={`rg-${k}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS[i]} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={CHART_COLORS[i]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="dateStr" stroke={chartText} fontSize={11} />
                    <YAxis stroke={chartText} fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 10, fontSize: 12 }} />
                    {["search", "direct", "social", "referral"].map((k, i) => (
                      <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={CHART_COLORS[i]} strokeWidth={2} fill={`url(#rg-${k})`} />
                    ))}
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <CommentBlock comment={getModuleComment(modules, "traffic")} />
            </section>
          )}

          {/* ======= SOURCES DONUT ======= */}
          {isModuleEnabled(modules, "sources") && data.sourcesChart.length > 0 && (
            <section style={{ pageBreakInside: "avoid" }}>
              <h2 className="text-xl font-bold mb-5">Источники трафика</h2>
              <div className={cn("rounded-xl border p-5", cardBg)}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={data.sourcesChart} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {data.sourcesChart.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 10, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <CommentBlock comment={getModuleComment(modules, "sources")} />
            </section>
          )}

          {/* ======= SEO POSITIONS CHART ======= */}
          {isModuleEnabled(modules, "positions") && data.seoPositions && data.seoPositions.length > 0 && (
            <section style={{ pageBreakInside: "avoid" }}>
              <h2 className="text-xl font-bold mb-5">Динамика позиций</h2>
              <div className={cn("rounded-xl border p-5", cardBg)}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.seoPositions}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="dateStr" stroke={chartText} fontSize={11} />
                    <YAxis reversed stroke={chartText} fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 10, fontSize: 12 }} />
                    <Line type="monotone" dataKey="avgPosition" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <CommentBlock comment={getModuleComment(modules, "positions")} />
            </section>
          )}

          {/* ======= SEO QUERIES TABLE ======= */}
          {isModuleEnabled(modules, "seo") && data.seoQueries.length > 0 && (
            <section style={{ pageBreakInside: "avoid" }}>
              <h2 className="text-xl font-bold mb-5">Поисковые запросы</h2>
              <div className={cn("rounded-xl border overflow-hidden", cardBg)}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn("border-b", borderColor, lightMode ? "bg-gray-100" : "bg-white/[0.03]")}>
                      <th className="text-left p-3 font-medium">Запрос</th>
                      <th className="text-right p-3 font-medium">Клики</th>
                      <th className="text-right p-3 font-medium">Показы</th>
                      <th className="text-right p-3 font-medium">Позиция</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.seoQueries.slice(0, 10).map((q, i) => (
                      <tr key={i} className={cn("border-b", borderColor)}>
                        <td className="p-3 font-medium">{q.query}</td>
                        <td className="p-3 text-right">{q.clicks}</td>
                        <td className={cn("p-3 text-right", mutedText)}>{q.impressions}</td>
                        <td className={cn("p-3 text-right", mutedText)}>{q.position.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CommentBlock comment={getModuleComment(modules, "seo")} />
            </section>
          )}

          {/* ======= TOP PAGES TABLE ======= */}
          {isModuleEnabled(modules, "pages") && data.topPages.length > 0 && (
            <section style={{ pageBreakInside: "avoid" }}>
              <h2 className="text-xl font-bold mb-5">Топ страниц</h2>
              <div className={cn("rounded-xl border overflow-hidden", cardBg)}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn("border-b", borderColor, lightMode ? "bg-gray-100" : "bg-white/[0.03]")}>
                      <th className="text-left p-3 font-medium">Страница</th>
                      <th className="text-right p-3 font-medium">Визиты</th>
                      <th className="text-right p-3 font-medium">Отказы</th>
                      <th className="text-right p-3 font-medium">Рост</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topPages.slice(0, 10).map((p, i) => (
                      <tr key={i} className={cn("border-b", borderColor)}>
                        <td className="p-3">
                          <p className="font-medium truncate max-w-[240px]">{p.title || p.url}</p>
                          <p className={cn("text-xs truncate", mutedText)}>{p.url}</p>
                        </td>
                        <td className="p-3 text-right">{p.visits}</td>
                        <td className={cn("p-3 text-right", mutedText)}>{p.bounceRate.toFixed(1)}%</td>
                        <td className="p-3 text-right">
                          <DeltaBadge change={p.growth} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CommentBlock comment={getModuleComment(modules, "pages")} />
            </section>
          )}

          {/* ======= WORK LOG ======= */}
          {isModuleEnabled(modules, "worklog") && data.workLogs.length > 0 && (
            <section style={{ pageBreakInside: "avoid" }}>
              <h2 className="text-xl font-bold mb-5">Журнал работ</h2>
              <div className="space-y-4">
                {Object.entries(categorizedLogs).map(([cat, logs]) => (
                  <div key={cat}>
                    <h3 className={cn("text-sm font-semibold uppercase tracking-wider mb-2", mutedText)}>
                      {catLabels[cat] || cat}
                    </h3>
                    <div className="space-y-1.5">
                      {logs.map((log, i) => (
                        <div key={i} className={cn("flex items-center gap-3 rounded-lg border px-4 py-2.5", cardBg)}>
                          <CheckCircle2 className={cn("h-4 w-4 shrink-0", log.status === "done" ? "text-emerald-400" : mutedText)} />
                          <span className="flex-1 text-sm">{log.description}</span>
                          <span className={cn("text-xs shrink-0", mutedText)}>{log.date}</span>
                          {log.link && (
                            <a href={log.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <CommentBlock comment={getModuleComment(modules, "worklog")} />
            </section>
          )}

          {/* ======= FOOTER ======= */}
          <footer className={cn("border-t pt-6 mt-12 flex items-center justify-between text-xs", borderColor, mutedText)}>
            <span>Сгенерировано {format(new Date(), "dd.MM.yyyy HH:mm")}</span>
            <span>Powered by StatPulse</span>
          </footer>
        </div>
      </div>
    );
  }
);

ReportView.displayName = "ReportView";
