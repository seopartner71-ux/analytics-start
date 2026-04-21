import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot, TrendingUp, TrendingDown, CheckCircle2, ExternalLink,
  BarChart3, Clock, Search, Megaphone, Target, DollarSign,
  MousePointerClick, Eye as EyeIcon,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, PieChart, Pie, Cell, Legend, LineChart, Line,
  BarChart, Bar,
} from "recharts";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

/* ---------- types ---------- */
export type ReportType = "seo" | "ads" | "combined";

export interface ReportModule {
  key: string;
  enabled: boolean;
  comment?: string;
}

export interface AdsKpi {
  label: string;
  value: string;
  change: number;
  suffix?: string;
  invertPositive?: boolean;
}

export interface AdsCampaign {
  name: string;
  visits: number;
  bounceRate: number;
  conversions: number;
  cost?: number;
}

export interface ReportData {
  projectName: string;
  projectUrl?: string;
  agencyLogoUrl?: string;
  clientLogoUrl?: string;
  period: { from: Date; to: Date };
  reportType: ReportType;
  // General
  kpis: { label: string; value: string; change: number; suffix?: string; invertPositive?: boolean }[];
  trafficChart: { dateStr: string; search: number; direct: number; social: number; referral: number; ads?: number }[];
  sourcesChart: { name: string; value: number }[];
  topPages: { url: string; title: string; visits: number; bounceRate: number; avgTime: number; growth: number }[];
  workLogs: { description: string; category: string; status: string; date: string; link?: string }[];
  aiSummary?: string;
  // SEO-specific
  seoPositions?: { dateStr: string; avgPosition: number }[];
  seoQueries: { query: string; clicks: number; impressions: number; position: number }[];
  seoVisibility?: { avgPosition: number; top10Pct: number; top3Pct: number; totalKeywords: number };
  brandedVsNonBranded?: { branded: number; nonBranded: number };
  // Ads-specific
  adsKpis?: AdsKpi[];
  adsCampaigns?: AdsCampaign[];
  adsTrafficChart?: { dateStr: string; ads: number }[];
  // Cross-channel
  channelGoals?: { name: string; value: number; color: string }[];
}

interface ReportViewProps {
  data: ReportData;
  modules: ReportModule[];
  lightMode?: boolean;
}

const SEO_COLORS = {
  primary: "#3b82f6",
  secondary: "#60a5fa",
  accent: "#2563eb",
};
const ADS_COLORS = {
  primary: "#8b5cf6",
  secondary: "#a78bfa",
  accent: "#7c3aed",
};
const CHART_COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#f97316", "#8b5cf6"];
const SOURCE_COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#f97316", "#8b5cf6"];
const CHANNEL_GOAL_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f97316", "#ef4444"];

const isModuleEnabled = (modules: ReportModule[], key: string) =>
  modules.find((m) => m.key === key)?.enabled ?? false;

const getModuleComment = (modules: ReportModule[], key: string) =>
  modules.find((m) => m.key === key)?.comment;

const CommentBlock = ({ comment }: { comment?: string }) =>
  comment ? (
    <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm italic opacity-80">
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

const SectionHeader = ({ icon: Icon, title, color, lightMode }: { icon: React.ElementType; title: string; color: string; lightMode: boolean }) => (
  <div className="flex items-center gap-3 mb-6 mt-2">
    <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
      <Icon className="h-5 w-5 text-foreground" />
    </div>
    <h2 className="text-2xl font-bold">{title}</h2>
  </div>
);

/* ---------- component ---------- */
export const ReportView = forwardRef<HTMLDivElement, ReportViewProps>(
  ({ data, modules, lightMode = false }, ref) => {
    const { t } = useTranslation();
    const periodStr = `${format(data.period.from, "dd.MM.yyyy")} — ${format(data.period.to, "dd.MM.yyyy")}`;
    const isSeo = data.reportType === "seo" || data.reportType === "combined";
    const isAds = data.reportType === "ads" || data.reportType === "combined";

    const bg = lightMode ? "bg-white text-gray-900" : "bg-[#0f1117] text-gray-100";
    const cardBg = lightMode ? "bg-gray-50 border-gray-200" : "bg-[#1a1d27] border-white/[0.06]";
    const mutedText = lightMode ? "text-gray-500" : "text-gray-400";
    const borderColor = lightMode ? "border-gray-200" : "border-white/[0.06]";
    const chartText = lightMode ? "#6b7280" : "#9ca3af";
    const chartGrid = lightMode ? "#e5e7eb" : "rgba(255,255,255,0.06)";
    const tooltipBg = lightMode ? "#ffffff" : "#1a1d27";
    const tooltipBorder = lightMode ? "#e5e7eb" : "rgba(255,255,255,0.1)";
    const tooltipStyle = { backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 10, fontSize: 12 };

    const categorizedLogs = data.workLogs.reduce((acc, log) => {
      const cat = log.category || "seo";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(log);
      return acc;
    }, {} as Record<string, typeof data.workLogs>);
    const catLabels: Record<string, string> = { seo: "SEO", content: "Контент", tech: "Технические", links: "Ссылки" };

    const reportTypeLabel = data.reportType === "seo" ? "SEO-отчёт" : data.reportType === "ads" ? "Отчёт по рекламе" : "Комбинированный отчёт";

    return (
      <div ref={ref} className={cn("min-h-screen font-sans", bg)} id="report-content">
        {/* ======= COVER ======= */}
        <div className="relative overflow-hidden" style={{ pageBreakAfter: "always" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{
              background: data.reportType === "ads"
                ? "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.1), transparent)"
                : "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.1), transparent)"
            }} />
          <div className="relative max-w-4xl mx-auto px-8 py-20 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="flex items-center justify-center gap-8 mb-12">
              {data.agencyLogoUrl && <img src={data.agencyLogoUrl} alt="Agency" className="h-14 w-14 rounded-xl object-cover shadow-lg" />}
              {data.clientLogoUrl && (
                <>
                  <div className={cn("h-px w-12", lightMode ? "bg-gray-300" : "bg-white/20")} />
                  <img src={data.clientLogoUrl} alt="Client" className="h-14 w-14 rounded-xl object-cover shadow-lg" />
                </>
              )}
            </div>
            <div className={cn("inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-6 border",
              data.reportType === "ads" ? "border-purple-500/30 text-purple-400" : data.reportType === "seo" ? "border-blue-500/30 text-blue-400" : "border-primary/30 text-primary"
            )}>
              {data.reportType === "seo" && <Search className="h-3.5 w-3.5" />}
              {data.reportType === "ads" && <Megaphone className="h-3.5 w-3.5" />}
              {data.reportType === "combined" && <BarChart3 className="h-3.5 w-3.5" />}
              {reportTypeLabel}
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center mb-4">Аналитический отчёт</h1>
            <p className="text-xl font-medium text-center mb-2">{data.projectName}</p>
            {data.projectUrl && <p className={cn("text-sm mb-8", mutedText)}>{data.projectUrl}</p>}
            <div className={cn("inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border", cardBg)}>
              <Clock className="h-4 w-4" />{periodStr}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 sm:px-8 pb-16 space-y-10">
          {/* ======= AI SUMMARY ======= */}
          {isModuleEnabled(modules, "ai") && data.aiSummary && (
            <section style={{ pageBreakInside: "avoid" }}>
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 rounded-2xl" style={{
                  background: data.reportType === "ads"
                    ? "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.15), rgba(139,92,246,0.2))"
                    : "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.15), rgba(59,130,246,0.2))"
                }} />
                <div className={cn("absolute inset-[1px] rounded-2xl", lightMode ? "bg-white" : "bg-[#0f1117]")} />
                <div className="relative p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Bot className="h-5 w-5 text-foreground" />
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
                <BarChart3 className="h-5 w-5" style={{ color: SEO_COLORS.primary }} /> Ключевые метрики
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

          {/* ============================================================ */}
          {/* =================== SEO SECTION ============================ */}
          {/* ============================================================ */}
          {isSeo && (
            <>
              {data.reportType === "combined" && (
                <div className={cn("border-t pt-8", borderColor)}>
                  <SectionHeader icon={Search} title="Раздел 1: Поисковое продвижение (SEO)" color={SEO_COLORS.primary} lightMode={lightMode} />
                </div>
              )}

              {/* SEO Visibility Block */}
              {isModuleEnabled(modules, "seo_visibility") && data.seoVisibility && (
                <section style={{ pageBreakInside: "avoid" }}>
                  <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                    <EyeIcon className="h-5 w-5" style={{ color: SEO_COLORS.primary }} /> Поисковая видимость
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: "Средняя позиция", value: data.seoVisibility.avgPosition.toFixed(1), change: -2.3, invert: true },
                      { label: "В ТОП-3", value: `${data.seoVisibility.top3Pct.toFixed(0)}%`, change: 4.2 },
                      { label: "В ТОП-10", value: `${data.seoVisibility.top10Pct.toFixed(0)}%`, change: 6.8 },
                      { label: "Отслеживается", value: String(data.seoVisibility.totalKeywords), change: 0 },
                    ].map((item, i) => (
                      <div key={i} className={cn("rounded-xl border p-4", cardBg)} style={{ borderLeftWidth: 3, borderLeftColor: SEO_COLORS.primary }}>
                        <p className={cn("text-xs mb-1", mutedText)}>{item.label}</p>
                        <p className="text-2xl font-bold">{item.value}</p>
                        {item.change !== 0 && <DeltaBadge change={item.change} invert={item.invert} />}
                      </div>
                    ))}
                  </div>
                  <CommentBlock comment={getModuleComment(modules, "seo_visibility")} />
                </section>
              )}

              {/* SEO Traffic Chart */}
              {isModuleEnabled(modules, "traffic") && data.trafficChart.length > 0 && (
                <section style={{ pageBreakInside: "avoid" }}>
                  <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" style={{ color: SEO_COLORS.primary }} /> Динамика органического трафика
                  </h2>
                  <div className={cn("rounded-xl border p-5", cardBg)}>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={data.trafficChart}>
                        <defs>
                          <linearGradient id="rg-search" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={SEO_COLORS.primary} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={SEO_COLORS.primary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                        <XAxis dataKey="dateStr" stroke={chartText} fontSize={11} />
                        <YAxis stroke={chartText} fontSize={11} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="search" name="Поисковые" stroke={SEO_COLORS.primary} strokeWidth={2} fill="url(#rg-search)" />
                        {data.reportType !== "seo" && (
                          <>
                            <Area type="monotone" dataKey="direct" name="Прямые" stroke="#22c55e" strokeWidth={1.5} fill="transparent" />
                            <Area type="monotone" dataKey="social" name="Соцсети" stroke="#f97316" strokeWidth={1.5} fill="transparent" />
                            <Area type="monotone" dataKey="referral" name="Рефералы" stroke="#a855f7" strokeWidth={1.5} fill="transparent" />
                          </>
                        )}
                        <Legend />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <CommentBlock comment={getModuleComment(modules, "traffic")} />
                </section>
              )}

              {/* SEO Positions Chart */}
              {isModuleEnabled(modules, "positions") && data.seoPositions && data.seoPositions.length > 0 && (
                <section style={{ pageBreakInside: "avoid" }}>
                  <h2 className="text-xl font-bold mb-5">Динамика позиций</h2>
                  <div className={cn("rounded-xl border p-5", cardBg)}>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={data.seoPositions}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                        <XAxis dataKey="dateStr" stroke={chartText} fontSize={11} />
                        <YAxis reversed stroke={chartText} fontSize={11} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Line type="monotone" dataKey="avgPosition" stroke={SEO_COLORS.primary} strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <CommentBlock comment={getModuleComment(modules, "positions")} />
                </section>
              )}

              {/* Branded vs Non-Branded */}
              {isModuleEnabled(modules, "seo_branded") && data.brandedVsNonBranded && (
                <section style={{ pageBreakInside: "avoid" }}>
                  <h2 className="text-xl font-bold mb-5">Брендовый vs Небрендовый трафик</h2>
                  <div className={cn("rounded-xl border p-5", cardBg)}>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Брендовый", value: data.brandedVsNonBranded.branded },
                            { name: "Небрендовый", value: data.brandedVsNonBranded.nonBranded },
                          ]}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={4} dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill={SEO_COLORS.primary} />
                          <Cell fill="#22c55e" />
                        </Pie>
                        <Legend />
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <CommentBlock comment={getModuleComment(modules, "seo_branded")} />
                </section>
              )}

              {/* SEO Queries Table */}
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
            </>
          )}

          {/* ============================================================ */}
          {/* =================== ADS SECTION ============================ */}
          {/* ============================================================ */}
          {isAds && (
            <>
              {data.reportType === "combined" && (
                <div className={cn("border-t pt-8", borderColor)}>
                  <SectionHeader icon={Megaphone} title="Раздел 2: Платная реклама (PPC)" color={ADS_COLORS.primary} lightMode={lightMode} />
                </div>
              )}

              {/* Ads KPIs */}
              {isModuleEnabled(modules, "ads_kpi") && data.adsKpis && data.adsKpis.length > 0 && (
                <section style={{ pageBreakInside: "avoid" }}>
                  <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                    <Target className="h-5 w-5" style={{ color: ADS_COLORS.primary }} /> Эффективность рекламы
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {data.adsKpis.map((kpi, i) => (
                      <div key={i} className={cn("rounded-xl border p-4", cardBg)} style={{ borderLeftWidth: 3, borderLeftColor: ADS_COLORS.primary }}>
                        <p className={cn("text-xs mb-1", mutedText)}>{kpi.label}</p>
                        <p className="text-xl font-bold">{kpi.value}{kpi.suffix}</p>
                        <DeltaBadge change={kpi.change} invert={kpi.invertPositive} />
                      </div>
                    ))}
                  </div>
                  <CommentBlock comment={getModuleComment(modules, "ads_kpi")} />
                </section>
              )}

              {/* Ads Traffic Chart */}
              {isModuleEnabled(modules, "ads_traffic") && data.adsTrafficChart && data.adsTrafficChart.length > 0 && (
                <section style={{ pageBreakInside: "avoid" }}>
                  <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" style={{ color: ADS_COLORS.primary }} /> Динамика рекламного трафика
                  </h2>
                  <div className={cn("rounded-xl border p-5", cardBg)}>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={data.adsTrafficChart}>
                        <defs>
                          <linearGradient id="rg-ads" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={ADS_COLORS.primary} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={ADS_COLORS.primary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                        <XAxis dataKey="dateStr" stroke={chartText} fontSize={11} />
                        <YAxis stroke={chartText} fontSize={11} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="ads" name="Рекламный трафик" stroke={ADS_COLORS.primary} strokeWidth={2.5} fill="url(#rg-ads)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <CommentBlock comment={getModuleComment(modules, "ads_traffic")} />
                </section>
              )}

              {/* Ads Campaigns Table */}
              {isModuleEnabled(modules, "ads_campaigns") && data.adsCampaigns && data.adsCampaigns.length > 0 && (
                <section style={{ pageBreakInside: "avoid" }}>
                  <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" style={{ color: ADS_COLORS.primary }} /> Топ рекламных кампаний
                  </h2>
                  <div className={cn("rounded-xl border overflow-hidden", cardBg)}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={cn("border-b", borderColor, lightMode ? "bg-gray-100" : "bg-white/[0.03]")}>
                          <th className="text-left p-3 font-medium">Кампания</th>
                          <th className="text-right p-3 font-medium">Визиты</th>
                          <th className="text-right p-3 font-medium">Отказы</th>
                          <th className="text-right p-3 font-medium">Конверсии</th>
                          <th className="text-right p-3 font-medium">Расход</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.adsCampaigns.map((c, i) => (
                          <tr key={i} className={cn("border-b", borderColor)}>
                            <td className="p-3 font-medium">{c.name}</td>
                            <td className="p-3 text-right">{c.visits}</td>
                            <td className={cn("p-3 text-right", mutedText)}>{c.bounceRate.toFixed(1)}%</td>
                            <td className="p-3 text-right">{c.conversions}</td>
                            <td className={cn("p-3 text-right", mutedText)}>{c.cost ? `${c.cost.toLocaleString()} ₽` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <CommentBlock comment={getModuleComment(modules, "ads_campaigns")} />
                </section>
              )}
            </>
          )}

          {/* ============================================================ */}
          {/* =================== COMMON SECTIONS ======================== */}
          {/* ============================================================ */}

          {/* Sources */}
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
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <CommentBlock comment={getModuleComment(modules, "sources")} />
            </section>
          )}

          {/* Cross-Channel Goals */}
          {isModuleEnabled(modules, "channel_goals") && data.channelGoals && data.channelGoals.length > 0 && (
            <section style={{ pageBreakInside: "avoid" }}>
              <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-500" /> Доля каналов в конверсиях
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={cn("rounded-xl border p-5", cardBg)}>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={data.channelGoals} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {data.channelGoals.map((g, i) => <Cell key={i} fill={g.color || CHANNEL_GOAL_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className={cn("rounded-xl border p-5", cardBg)}>
                  <h3 className="text-sm font-semibold mb-3">Стоимость конверсии по каналам</h3>
                  <div className="space-y-3">
                    {data.channelGoals.map((g, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: g.color || CHANNEL_GOAL_COLORS[i] }} />
                        <span className="flex-1 text-sm">{g.name}</span>
                        <span className="text-sm font-semibold">{g.value} конв.</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <CommentBlock comment={getModuleComment(modules, "channel_goals")} />
            </section>
          )}

          {/* Top Pages */}
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
                        <td className="p-3 text-right"><DeltaBadge change={p.growth} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CommentBlock comment={getModuleComment(modules, "pages")} />
            </section>
          )}

          {/* Work Log */}
          {isModuleEnabled(modules, "worklog") && data.workLogs.length > 0 && (
            <section style={{ pageBreakInside: "avoid" }}>
              <h2 className="text-xl font-bold mb-5">Журнал работ</h2>
              <div className="space-y-4">
                {Object.entries(categorizedLogs).map(([cat, logs]) => (
                  <div key={cat}>
                    <h3 className={cn("text-sm font-semibold uppercase tracking-wider mb-2", mutedText)}>{catLabels[cat] || cat}</h3>
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

          {/* Footer */}
          <footer className={cn("border-t pt-6 mt-12 flex items-center justify-between text-xs", borderColor, mutedText)}>
            <span>Сгенерировано {format(new Date(), "dd.MM.yyyy HH:mm")}</span>
            <span>Powered by СЕО - Модуль 2</span>
          </footer>
        </div>
      </div>
    );
  }
);

ReportView.displayName = "ReportView";
