import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import {
  Search,
  Download,
  Link2,
  FileText,
  Image,
  Zap,
  Smartphone,
  RefreshCw,
  Map,
  Type,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TechnicalAuditTabProps {
  projectId: string;
}

// Demo data
const HEALTH_SCORE = 74;
const SUB_SCORES = [
  { label: "Технические ошибки", score: 68, color: "text-red-400" },
  { label: "Контент", score: 81, color: "text-emerald-400" },
  { label: "Производительность", score: 73, color: "text-amber-400" },
];

const ERROR_SUMMARY = [
  { label: "Критические", count: 12, subtitle: "требуют срочного исправления", border: "#F44336", emoji: "🔴" },
  { label: "Важные", count: 28, subtitle: "влияют на ранжирование", border: "#FF9800", emoji: "🟠" },
  { label: "Предупреждения", count: 47, subtitle: "рекомендуется исправить", border: "#FFC107", emoji: "🟡" },
  { label: "Проверок пройдено", count: 143, subtitle: "из 230 факторов", border: "#4CAF50", emoji: "✅" },
];

const CATEGORIES = [
  {
    icon: Link2, label: "Внутренние ссылки", score: 85, errors: 3,
    details: [
      { url: "/catalog/spare-parts", problem: "Битая внутренняя ссылка", priority: "Важно" },
      { url: "/news/old-post", problem: "Ссылка ведёт на 404", priority: "Критично" },
      { url: "/about", problem: "Слишком длинная цепочка ссылок", priority: "Предупреждение" },
    ],
  },
  {
    icon: FileText, label: "Мета-теги (title, description)", score: 62, errors: 18,
    details: [
      { url: "/catalog", problem: "Дубль title", priority: "Критично" },
      { url: "/services", problem: "Отсутствует meta description", priority: "Критично" },
      { url: "/blog/post-1", problem: "Title длиннее 70 символов", priority: "Предупреждение" },
    ],
  },
  {
    icon: Image, label: "Изображения (alt, размер)", score: 71, errors: 11,
    details: [
      { url: "/images/main-banner.jpg", problem: "Файл недоступен (битое изображение)", priority: "Критично" },
      { url: "/catalog/product-1", problem: "Отсутствует alt у 3 изображений", priority: "Важно" },
      { url: "/gallery", problem: "Изображение > 2MB без сжатия", priority: "Предупреждение" },
    ],
  },
  {
    icon: Zap, label: "Скорость загрузки", score: 68, errors: 8,
    details: [
      { url: "/catalog", problem: "Время загрузки 4.2 сек", priority: "Критично" },
      { url: "/", problem: "Неоптимизированный CSS (блокирующий рендер)", priority: "Важно" },
      { url: "/contacts", problem: "Большой размер JS-бандла", priority: "Предупреждение" },
    ],
  },
  {
    icon: Smartphone, label: "Мобильная версия", score: 90, errors: 2,
    details: [
      { url: "/catalog/filters", problem: "Элементы наезжают друг на друга", priority: "Важно" },
      { url: "/contacts", problem: "Кнопка слишком маленькая для тапа", priority: "Предупреждение" },
    ],
  },
  {
    icon: RefreshCw, label: "Редиректы и коды ответа", score: 55, errors: 12,
    details: [
      { url: "/catalog/traktory", problem: "404 Not Found", priority: "Критично" },
      { url: "/old-page", problem: "Цепочка 301 → 301 → 200", priority: "Важно" },
      { url: "/api/test", problem: "500 Internal Server Error", priority: "Критично" },
    ],
  },
  {
    icon: Map, label: "Sitemap и robots.txt", score: 80, errors: 4,
    details: [
      { url: "/sitemap.xml", problem: "Содержит URL с 404", priority: "Важно" },
      { url: "/robots.txt", problem: "Заблокирован /catalog/", priority: "Критично" },
    ],
  },
  {
    icon: Type, label: "Контент (дубли, thin content)", score: 73, errors: 9,
    details: [
      { url: "/about", problem: "Дубль title совпадает с /home", priority: "Критично" },
      { url: "/blog/post-5", problem: "Thin content (менее 300 слов)", priority: "Важно" },
      { url: "/services/item-2", problem: "Дублированный контент с /services/item-1", priority: "Важно" },
    ],
  },
];

const CRITICAL_ERRORS = [
  { url: "/catalog/traktory", type: "404 Not Found", desc: "Страница не найдена", priority: "Критично", status: "Новая" },
  { url: "/images/main-banner.jpg", type: "Битое изображение", desc: "Файл недоступен", priority: "Критично", status: "Новая" },
  { url: "/about", type: "Дубль title", desc: "Title совпадает с /home", priority: "Критично", status: "Просмотрена" },
  { url: "/contacts", type: "Нет H1", desc: "Отсутствует заголовок H1", priority: "Важно", status: "Новая" },
  { url: "/catalog", type: "Медленная загрузка", desc: "4.2 сек (норма до 2 сек)", priority: "Важно", status: "Новая" },
  { url: "/services", type: "Нет meta description", desc: "Отсутствует описание страницы", priority: "Критично", status: "Новая" },
  { url: "/blog/post-3", type: "Thin content", desc: "Менее 200 слов на странице", priority: "Предупреждение", status: "Исправлена" },
  { url: "/old-page", type: "Цепочка редиректов", desc: "301 → 301 → 200", priority: "Важно", status: "Просмотрена" },
];

const CHART_DATA = [
  { date: "01.02", score: 58, critical: 24 },
  { date: "15.02", score: 62, critical: 20 },
  { date: "01.03", score: 65, critical: 17 },
  { date: "15.03", score: 69, critical: 15 },
  { date: "01.04", score: 71, critical: 14 },
  { date: "08.04", score: 74, critical: 12 },
];

const RECOMMENDATIONS = [
  { title: "Исправить 12 страниц с ошибкой 404", desc: "Битые ссылки снижают краулинговый бюджет", impact: "Высокий" },
  { title: "Добавить meta description на 18 страниц", desc: "Влияет на CTR в поисковой выдаче", impact: "Высокий" },
  { title: "Оптимизировать скорость загрузки", desc: "Текущая скорость 4.2 сек, цель до 2 сек", impact: "Высокий" },
  { title: "Исправить дубли title на 7 страницах", desc: "Дубли мешают индексации", impact: "Средний" },
  { title: "Добавить alt-тексты к 11 изображениям", desc: "Улучшает доступность и SEO", impact: "Средний" },
];

const chartConfig = {
  score: { label: "Общий счёт", color: "hsl(var(--primary))" },
  critical: { label: "Критические ошибки", color: "#F44336" },
};

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function getScoreStroke(score: number) {
  if (score >= 80) return "#4ade80";
  if (score >= 60) return "#fbbf24";
  return "#f87171";
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Хорошо";
  if (score >= 60) return "Требует внимания";
  return "Критическое состояние";
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === "Критично"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : priority === "Важно"
        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
        : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return <Badge variant="outline" className={cn("text-[11px] font-medium", cls)}>{priority}</Badge>;
}

function StatusSelect({ value }: { value: string }) {
  const [status, setStatus] = useState(value);
  return (
    <Select value={status} onValueChange={setStatus}>
      <SelectTrigger className="h-7 w-[130px] text-[11px] bg-muted/30 border-border">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="Новая">Новая</SelectItem>
        <SelectItem value="Просмотрена">Просмотрена</SelectItem>
        <SelectItem value="Исправлена">Исправлена</SelectItem>
      </SelectContent>
    </Select>
  );
}

// Circular gauge
function CircularGauge({ score }: { score: number }) {
  const r = 70;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = getScoreStroke(score);

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle
          cx="90" cy="90" r={r} fill="none"
          stroke={strokeColor} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 90 90)"
          className="transition-all duration-1000"
        />
        <text x="90" y="82" textAnchor="middle" className="fill-foreground text-3xl font-bold" fontSize="36">
          {score}
        </text>
        <text x="90" y="105" textAnchor="middle" className="fill-muted-foreground" fontSize="14">
          / 100
        </text>
      </svg>
      <span className={cn("text-sm font-medium mt-1", getScoreColor(score))}>
        {getScoreLabel(score)}
      </span>
    </div>
  );
}

export function TechnicalAuditTab({ projectId }: TechnicalAuditTabProps) {
  const [auditStatus] = useState<"ready" | "scanning" | "error">("ready");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [completedRecs, setCompletedRecs] = useState<Set<number>>(new Set());

  const filteredErrors = CRITICAL_ERRORS.filter((err) => {
    const matchSearch = !searchQuery || err.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "critical" && err.priority === "Критично") ||
      (filter === "important" && err.priority === "Важно") ||
      (filter === "fixed" && err.status === "Исправлена");
    return matchSearch && matchFilter;
  });

  const toggleRec = (idx: number) => {
    setCompletedRecs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Технический аудит</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Последний аудит: 08.04.2026 в 09:00</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] font-medium",
              auditStatus === "ready" && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
              auditStatus === "scanning" && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse",
              auditStatus === "error" && "bg-red-500/20 text-red-400 border-red-500/30",
            )}
          >
            {auditStatus === "ready" ? "Готов" : auditStatus === "scanning" ? "Сканирование..." : "Ошибка"}
          </Badge>
          <Button size="sm" className="h-8 text-[12px] gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0">
            <Search className="h-3.5 w-3.5" /> Запустить аудит
          </Button>
        </div>
      </div>

      {/* BLOCK 1 — Health Score */}
      <Card className="bg-card border-border">
        <CardContent className="py-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <CircularGauge score={HEALTH_SCORE} />
            <div className="grid grid-cols-3 gap-6">
              {SUB_SCORES.map((s) => (
                <div key={s.label} className="text-center">
                  <div className={cn("text-2xl font-bold", s.color)}>{s.score}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 max-w-[90px]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCK 2 — Error Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ERROR_SUMMARY.map((item) => (
          <Card
            key={item.label}
            className="bg-card border-border overflow-hidden"
            style={{ borderLeftWidth: 3, borderLeftColor: item.border }}
          >
            <CardContent className="py-4 px-4">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span>{item.emoji}</span> {item.label}
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{item.count}</div>
              <div className="text-[11px] text-muted-foreground">{item.subtitle}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* BLOCK 3 — Categories Accordion */}
      <Card className="bg-card border-border">
        <CardContent className="py-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Детализация по категориям</h3>
          <Accordion type="multiple" className="space-y-1">
            {CATEGORIES.map((cat, idx) => {
              const Icon = cat.icon;
              const barColor =
                cat.score >= 80 ? "bg-emerald-500" : cat.score >= 60 ? "bg-amber-500" : "bg-red-500";
              return (
                <AccordionItem key={idx} value={`cat-${idx}`} className="border-border/50">
                  <AccordionTrigger className="hover:no-underline py-3 px-2">
                    <div className="flex items-center gap-3 flex-1">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-[13px] font-medium text-foreground flex-1 text-left">{cat.label}</span>
                      <div className="flex items-center gap-3 mr-2">
                        <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${cat.score}%` }} />
                        </div>
                        <span className={cn("text-[12px] font-semibold w-10 text-right", getScoreColor(cat.score))}>
                          {cat.score}/100
                        </span>
                        <Badge variant="outline" className="text-[10px] h-5 bg-muted/30 border-border text-muted-foreground">
                          {cat.errors} ошиб.
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 pb-3">
                    <div className="rounded-md border border-border overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border">
                            <th className="text-left px-3 py-2 text-muted-foreground font-medium">URL</th>
                            <th className="text-left px-3 py-2 text-muted-foreground font-medium">Проблема</th>
                            <th className="text-left px-3 py-2 text-muted-foreground font-medium">Приоритет</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.details.map((d, di) => (
                            <tr key={di} className="border-b border-border/50 last:border-0">
                              <td className="px-3 py-2 text-foreground/80 font-mono text-[11px]">{d.url}</td>
                              <td className="px-3 py-2 text-foreground/70">{d.problem}</td>
                              <td className="px-3 py-2"><PriorityBadge priority={d.priority} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* BLOCK 4 — Critical Errors Table */}
      <Card className="bg-card border-border">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Критические ошибки</h3>
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[11px]" variant="outline">12</Badge>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5">
              <Download className="h-3 w-3" /> Скачать отчёт PDF
            </Button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Поиск по URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-[12px] bg-muted/30 border-border"
              />
            </div>
            <div className="flex gap-1">
              {[
                { key: "all", label: "Все" },
                { key: "critical", label: "Критичные" },
                { key: "important", label: "Важные" },
                { key: "fixed", label: "Исправленные" },
              ].map((f) => (
                <Button
                  key={f.key}
                  variant={filter === f.key ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">URL</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Тип ошибки</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Описание</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Приоритет</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {filteredErrors.map((err, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 text-foreground/80 font-mono text-[11px] max-w-[200px] truncate" title={err.url}>
                      {err.url}
                    </td>
                    <td className="px-3 py-2 text-foreground/70">{err.type}</td>
                    <td className="px-3 py-2 text-muted-foreground">{err.desc}</td>
                    <td className="px-3 py-2"><PriorityBadge priority={err.priority} /></td>
                    <td className="px-3 py-2"><StatusSelect value={err.status} /></td>
                  </tr>
                ))}
                {filteredErrors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted-foreground text-[12px]">
                      Ничего не найдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* BLOCK 5 — Health Dynamics Chart */}
      <Card className="bg-card border-border">
        <CardContent className="py-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Динамика здоровья сайта</h3>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <LineChart data={CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="score" name="Общий счёт" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="critical" name="Критические ошибки" stroke="#F44336" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* BLOCK 6 — Recommendations */}
      <Card className="bg-card border-border">
        <CardContent className="py-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              Приоритетные рекомендации
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Топ-5 действий для улучшения позиций</p>
          </div>
          <div className="space-y-3">
            {RECOMMENDATIONS.map((rec, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border border-border/50 transition-colors",
                  completedRecs.has(idx) && "opacity-60 bg-muted/20",
                )}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[11px] font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[13px] font-medium text-foreground", completedRecs.has(idx) && "line-through")}>
                      {rec.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] h-5",
                        rec.impact === "Высокий"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-blue-500/20 text-blue-400 border-blue-500/30",
                      )}
                    >
                      {rec.impact === "Высокий" ? "Высокий импакт" : "Средний импакт"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{rec.desc}</p>
                </div>
                <Checkbox
                  checked={completedRecs.has(idx)}
                  onCheckedChange={() => toggleRec(idx)}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
