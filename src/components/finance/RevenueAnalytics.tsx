import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import * as XLSX from "xlsx";
import { TrendingUp, TrendingDown, Minus, Download, AlertTriangle, Wallet, Receipt, BarChart3, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);
const NUM = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n || 0);
const MONTHS_SHORT = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const MONTHS_FULL = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

type PaymentRow = { client_name: string; paid_amount: number; updated_at: string; created_at: string };
type ExpenseRow = { category: string; amount: number; expense_date: string };

const CHART_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function Delta({ value, inverse = false }: { value: number; inverse?: boolean }) {
  if (!isFinite(value) || value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }
  const positive = inverse ? value < 0 : value > 0;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", positive ? "text-emerald-400" : "text-red-400")}>
      <Icon className="h-3 w-3" />
      {value > 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

export default function RevenueAnalytics() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [compareYear, setCompareYear] = useState(now.getFullYear() - 1);
  const [chartMode, setChartMode] = useState<"current" | "previous" | "compare">("current");
  const [yearPlan, setYearPlan] = useState(1500000);

  const { data: payments = [] } = useQuery({
    queryKey: ["analytics_payments"],
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data } = await supabase
        .from("financial_payments")
        .select("client_name, paid_amount, updated_at, created_at")
        .gt("paid_amount", 0);
      return (data as any) || [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["analytics_payment_history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_payment_history")
        .select("amount, paid_at, payment_id");
      return (data as any[]) || [];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["analytics_expenses"],
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data } = await supabase
        .from("financial_expenses")
        .select("category, amount, expense_date");
      return (data as any) || [];
    },
  });

  const { data: paymentClientMap = {} } = useQuery({
    queryKey: ["analytics_payment_client_map"],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.from("financial_payments").select("id, client_name");
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.client_name; });
      return map;
    },
  });

  /* ───── Aggregate by year-month ───── */
  type MonthBucket = { revenue: number; clients: Set<string>; byClient: Record<string, number>; revenueBySrc: Record<string, number> };
  const revenueByMonth = useMemo(() => {
    const map: Record<string, MonthBucket> = {};
    const ensure = (key: string) => (map[key] ||= { revenue: 0, clients: new Set(), byClient: {}, revenueBySrc: {} });

    history.forEach((h: any) => {
      const d = new Date(h.paid_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = ensure(key);
      const amt = Number(h.amount) || 0;
      b.revenue += amt;
      const cn = paymentClientMap[h.payment_id] || "—";
      b.clients.add(cn);
      b.byClient[cn] = (b.byClient[cn] || 0) + amt;
      b.revenueBySrc["SEO продвижение"] = (b.revenueBySrc["SEO продвижение"] || 0) + amt;
    });

    // Fallback: if no history, derive from payments updated_at
    if (history.length === 0) {
      payments.forEach((p) => {
        const d = new Date(p.updated_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const b = ensure(key);
        const amt = Number(p.paid_amount) || 0;
        b.revenue += amt;
        b.clients.add(p.client_name);
        b.byClient[p.client_name] = (b.byClient[p.client_name] || 0) + amt;
        b.revenueBySrc["SEO продвижение"] = (b.revenueBySrc["SEO продвижение"] || 0) + amt;
      });
    }
    return map;
  }, [history, payments, paymentClientMap]);

  const expensesByMonth = useMemo(() => {
    const map: Record<string, { total: number; byCat: Record<string, number> }> = {};
    expenses.forEach((e) => {
      const d = new Date(e.expense_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = (map[key] ||= { total: 0, byCat: {} });
      const amt = Number(e.amount) || 0;
      b.total += amt;
      b.byCat[e.category] = (b.byCat[e.category] || 0) + amt;
    });
    return map;
  }, [expenses]);

  const get = (y: number, m: number) => {
    const r = revenueByMonth[`${y}-${m}`];
    const ex = expensesByMonth[`${y}-${m}`];
    return {
      revenue: r?.revenue || 0,
      expenses: ex?.total || 0,
      profit: (r?.revenue || 0) - (ex?.total || 0),
      clients: r?.clients.size || 0,
      avgCheck: r?.clients.size ? (r.revenue / r.clients.size) : 0,
    };
  };

  /* ───── Block 1: KPI cards (current month vs previous) ───── */
  const cur = get(year, month);
  const prev = month === 0 ? get(year - 1, 11) : get(year, month - 1);
  const prevLabel = MONTHS_FULL[month === 0 ? 11 : month - 1].toLowerCase();

  const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / Math.abs(b)) * 100);
  const margin = cur.revenue > 0 ? (cur.profit / cur.revenue) * 100 : 0;
  const prevMargin = prev.revenue > 0 ? (prev.profit / prev.revenue) * 100 : 0;

  /* ───── Block 2: monthly chart (revenue/expenses/profit) ───── */
  const monthlyChart = useMemo(() => {
    return MONTHS_SHORT.map((label, i) => {
      const c = get(year, i);
      const p = get(year - 1, i);
      return {
        month: label,
        revenue: c.revenue,
        expenses: c.expenses,
        profit: c.profit,
        prevRevenue: p.revenue,
        prevExpenses: p.expenses,
        prevProfit: p.profit,
      };
    });
  }, [year, revenueByMonth, expensesByMonth]);

  /* ───── Block 3: YoY comparison ───── */
  const yoyChart = useMemo(() => {
    return MONTHS_SHORT.map((label, i) => ({
      month: label,
      [String(compareYear)]: get(compareYear, i).revenue,
      [String(year)]: get(year, i).revenue,
    }));
  }, [year, compareYear, revenueByMonth]);
  const totalCompare = MONTHS_SHORT.reduce((s, _, i) => s + get(compareYear, i).revenue, 0);
  const totalCurrent = MONTHS_SHORT.reduce((s, _, i) => s + get(year, i).revenue, 0);
  const yoyGrowth = pct(totalCurrent, totalCompare);

  /* ───── Block 4: client analytics ───── */
  const clientAnalytics = useMemo(() => {
    const totals: Record<string, { revenue: number; months: number[] }> = {};
    Object.entries(revenueByMonth).forEach(([key, v]) => {
      const [y, m] = key.split("-").map(Number);
      if (y !== year) return;
      Object.entries(v.byClient).forEach(([c, amt]) => {
        const t = (totals[c] ||= { revenue: 0, months: Array(12).fill(0) });
        t.revenue += amt;
        t.months[m] += amt;
      });
    });
    const totalExpensesYear = MONTHS_SHORT.reduce((s, _, i) => s + (expensesByMonth[`${year}-${i}`]?.total || 0), 0);
    const totalRevYear = Object.values(totals).reduce((s, t) => s + t.revenue, 0);
    return Object.entries(totals)
      .map(([client, t]) => {
        // распределяем расходы пропорционально доле клиента
        const share = totalRevYear > 0 ? t.revenue / totalRevYear : 0;
        const clientExpenses = totalExpensesYear * share;
        const profit = t.revenue - clientExpenses;
        const marginPct = t.revenue > 0 ? (profit / t.revenue) * 100 : 0;
        // тренд: последние 3 vs предыдущие 3 месяца
        const last3 = t.months.slice(Math.max(0, month - 2), month + 1).reduce((a, b) => a + b, 0);
        const prev3 = t.months.slice(Math.max(0, month - 5), Math.max(0, month - 2)).reduce((a, b) => a + b, 0);
        const trend = last3 > prev3 ? "up" : last3 < prev3 ? "down" : "flat";
        return { client, revenue: t.revenue, expenses: clientExpenses, profit, margin: marginPct, trend };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [revenueByMonth, expensesByMonth, year, month]);

  const pieData = clientAnalytics.slice(0, 8).map((c, i) => ({ name: c.client, value: c.revenue, fill: CHART_COLORS[i % CHART_COLORS.length] }));

  /* ───── Block 5: quarterly ───── */
  const quarterly = useMemo(() => {
    const qs = [0, 1, 2, 3].map((q) => {
      const months = [q * 3, q * 3 + 1, q * 3 + 2];
      const fact = months.reduce((s, m) => s + get(year, m).revenue, 0);
      const isCurrentQ = Math.floor(month / 3) === q;
      const isFutureQ = q * 3 > month;
      return { q: q + 1, fact, isCurrent: isCurrentQ, isFuture: isFutureQ, months };
    });
    // Прогноз = средний рост за последние 3 месяца, экстраполированный
    const last3 = [Math.max(0, month - 2), Math.max(0, month - 1), month].map((m) => get(year, m).revenue);
    const avg3 = last3.reduce((s, v) => s + v, 0) / 3;
    qs.forEach((q) => {
      if (q.isFuture) q.fact = Math.round(avg3 * 3);
    });
    const totalFact = qs.filter((q) => !q.isFuture).reduce((s, q) => s + q.fact, 0);
    const forecast = qs.reduce((s, q) => s + q.fact, 0);
    return { qs, totalFact, forecast };
  }, [year, month, revenueByMonth]);

  /* ───── Block 6: average check ───── */
  const avgCheckChart = useMemo(
    () => MONTHS_SHORT.map((label, i) => ({ month: label, avg: get(year, i).avgCheck })),
    [year, revenueByMonth]
  );

  /* ───── Block 7: P&L ───── */
  const pnl = useMemo(() => {
    const showMonths = Array.from({ length: month + 1 }, (_, i) => i);
    // соберём категории доходов (по умолчанию только "SEO продвижение")
    const incomeCats = new Set<string>();
    Object.values(revenueByMonth).forEach((b) => Object.keys(b.revenueBySrc).forEach((k) => incomeCats.add(k)));
    if (incomeCats.size === 0) incomeCats.add("SEO продвижение");

    const expenseCats = new Set<string>();
    Object.values(expensesByMonth).forEach((b) => Object.keys(b.byCat).forEach((k) => expenseCats.add(k)));

    const incomeRows = Array.from(incomeCats).map((cat) => ({
      label: cat,
      values: showMonths.map((m) => revenueByMonth[`${year}-${m}`]?.revenueBySrc?.[cat] || 0),
    }));
    const expenseRows = Array.from(expenseCats).map((cat) => ({
      label: cat,
      values: showMonths.map((m) => expensesByMonth[`${year}-${m}`]?.byCat?.[cat] || 0),
    }));
    const totalIncome = showMonths.map((m) => get(year, m).revenue);
    const totalExpense = showMonths.map((m) => get(year, m).expenses);
    const profit = showMonths.map((_, i) => totalIncome[i] - totalExpense[i]);
    const marg = profit.map((p, i) => (totalIncome[i] > 0 ? (p / totalIncome[i]) * 100 : 0));
    return { showMonths, incomeRows, expenseRows, totalIncome, totalExpense, profit, marg };
  }, [revenueByMonth, expensesByMonth, year, month]);

  /* ───── Export Excel ───── */
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const orange = { fgColor: { rgb: "F97316" } };

    // По месяцам
    const wsM = XLSX.utils.aoa_to_sheet([
      ["Месяц", "Выручка", "Расходы", "Прибыль", "Маржа %"],
      ...MONTHS_FULL.map((m, i) => {
        const c = get(year, i);
        return [m, c.revenue, c.expenses, c.profit, c.revenue > 0 ? +(c.profit / c.revenue * 100).toFixed(1) : 0];
      }),
    ]);
    XLSX.utils.book_append_sheet(wb, wsM, "По месяцам");

    // По клиентам
    const wsC = XLSX.utils.aoa_to_sheet([
      ["Клиент", "Доход", "Расходы", "Прибыль", "Маржа %"],
      ...clientAnalytics.map((c) => [c.client, c.revenue, c.expenses, c.profit, +c.margin.toFixed(1)]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsC, "По клиентам");

    // Кварталы
    const wsQ = XLSX.utils.aoa_to_sheet([
      ["Квартал", "Сумма", "Статус"],
      ...quarterly.qs.map((q) => [`Q${q.q} ${year}`, q.fact, q.isFuture ? "прогноз" : q.isCurrent ? "в работе" : "факт"]),
      [],
      ["Итого факт", quarterly.totalFact],
      ["Прогноз год", quarterly.forecast],
      ["План год", yearPlan],
    ]);
    XLSX.utils.book_append_sheet(wb, wsQ, "Кварталы");

    // P&L
    const header = ["Категория", ...pnl.showMonths.map((m) => MONTHS_SHORT[m])];
    const rows: any[][] = [header, ["ДОХОДЫ"]];
    pnl.incomeRows.forEach((r) => rows.push([r.label, ...r.values]));
    rows.push(["Итого доходы", ...pnl.totalIncome]);
    rows.push([]);
    rows.push(["РАСХОДЫ"]);
    pnl.expenseRows.forEach((r) => rows.push([r.label, ...r.values]));
    rows.push(["Итого расходы", ...pnl.totalExpense]);
    rows.push([]);
    rows.push(["ПРИБЫЛЬ", ...pnl.profit]);
    rows.push(["Маржа %", ...pnl.marg.map((m) => +m.toFixed(1))]);
    const wsP = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, wsP, "P&L");

    // оранжевые заголовки
    [wsM, wsC, wsQ, wsP].forEach((ws) => {
      const range = XLSX.utils.decode_range(ws["!ref"]!);
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[addr]) ws[addr].s = { fill: orange, font: { bold: true, color: { rgb: "FFFFFF" } } };
      }
    });

    XLSX.writeFile(wb, `Аналитика_доходов_${year}.xlsx`);
  };

  const exportPdf = async () => {
    const html2pdf = (await import("html2pdf.js")).default;
    const el = document.getElementById("revenue-analytics-root");
    if (!el) return;
    await html2pdf()
      .from(el)
      .set({
        margin: 10,
        filename: `Аналитика_доходов_${year}.pdf`,
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#0a0a0a" },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      })
      .save();
  };

  const years = Array.from(new Set([
    ...Object.keys(revenueByMonth).map((k) => Number(k.split("-")[0])),
    now.getFullYear(),
    now.getFullYear() - 1,
  ])).sort((a, b) => b - a);

  const planProgress = Math.min(100, Math.round((quarterly.totalFact / yearPlan) * 100));

  return (
    <div id="revenue-analytics-root" className="space-y-4">
      {/* ───── Filters ───── */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Месяц</div>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS_FULL.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Год</div>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Сравнить с</div>
            <Select value={String(compareYear)} onValueChange={(v) => setCompareYear(Number(v))}>
              <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ───── Block 1: KPI cards ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Выручка", val: cur.revenue, prev: prev.revenue, icon: Wallet, color: "text-emerald-400" },
          { label: "Расходы", val: cur.expenses, prev: prev.expenses, icon: Receipt, color: "text-red-400", inverse: true },
          { label: "Прибыль", val: cur.profit, prev: prev.profit, icon: BarChart3, color: "text-blue-400" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</span>
                <k.icon className={cn("h-4 w-4", k.color)} />
              </div>
              <div className="text-2xl font-semibold">{RUB(k.val)}</div>
              <div className="mt-1"><Delta value={pct(k.val, k.prev)} inverse={k.inverse} /> <span className="text-xs text-muted-foreground">vs {prevLabel}</span></div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Маржа</span>
              <Percent className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-semibold">{margin.toFixed(1)}%</div>
            <div className="mt-1"><Delta value={margin - prevMargin} /> <span className="text-xs text-muted-foreground">vs {prevLabel}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* ───── Block 2: Monthly chart ───── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Выручка по месяцам — {year}</CardTitle>
          <Tabs value={chartMode} onValueChange={(v) => setChartMode(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="current" className="text-xs h-6">Этот год</TabsTrigger>
              <TabsTrigger value="previous" className="text-xs h-6">Прошлый</TabsTrigger>
              <TabsTrigger value="compare" className="text-xs h-6">Сравнение</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}к` : String(v)} />
              <RTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => RUB(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(chartMode === "current" || chartMode === "compare") && (
                <>
                  <Line type="monotone" dataKey="revenue" name="Выручка" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="expenses" name="Расходы" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="profit" name="Прибыль" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </>
              )}
              {(chartMode === "previous" || chartMode === "compare") && (
                <>
                  <Line type="monotone" dataKey="prevRevenue" name={`Выручка ${year - 1}`} stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="prevExpenses" name={`Расходы ${year - 1}`} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="prevProfit" name={`Прибыль ${year - 1}`} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ───── Block 3: YoY ───── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Сравнение год к году: {compareYear} vs {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yoyChart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}к` : String(v)} />
              <RTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => RUB(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey={String(compareYear)} fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar dataKey={String(year)} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div>Итого {compareYear}: <span className="font-semibold">{RUB(totalCompare)}</span></div>
            <div>Итого {year}: <span className="font-semibold">{RUB(totalCurrent)}</span></div>
            <div>Рост: <Delta value={yoyGrowth} /></div>
          </div>
        </CardContent>
      </Card>

      {/* ───── Block 4: Client analytics ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Прибыльность клиентов — {year}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Клиент</TableHead>
                  <TableHead className="text-right">Доход</TableHead>
                  <TableHead className="text-right">Расходы</TableHead>
                  <TableHead className="text-right">Прибыль</TableHead>
                  <TableHead className="text-right">Маржа</TableHead>
                  <TableHead className="text-center">Тренд</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientAnalytics.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">Нет данных</TableCell></TableRow>
                ) : clientAnalytics.map((c) => (
                  <TableRow key={c.client}>
                    <TableCell className="font-medium">{c.client}</TableCell>
                    <TableCell className="text-right">{RUB(c.revenue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{RUB(c.expenses)}</TableCell>
                    <TableCell className={cn("text-right font-medium", c.profit >= 0 ? "text-emerald-400" : "text-red-400")}>{RUB(c.profit)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={cn(
                        "font-medium",
                        c.margin >= 50 && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                        c.margin >= 20 && c.margin < 50 && "bg-amber-500/15 text-amber-400 border-amber-500/30",
                        c.margin < 20 && "bg-red-500/15 text-red-400 border-red-500/30"
                      )}>
                        {c.margin.toFixed(0)}%
                        {c.margin < 20 && <AlertTriangle className="h-3 w-3 ml-1 inline" />}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {c.trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-400 inline" />}
                      {c.trend === "down" && <TrendingDown className="h-4 w-4 text-red-400 inline" />}
                      {c.trend === "flat" && <Minus className="h-4 w-4 text-muted-foreground inline" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Доля клиентов</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">Нет данных</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => RUB(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 space-y-1 max-h-40 overflow-auto">
              {pieData.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="text-muted-foreground">{RUB(p.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* топ клиентов горизонтальный бар */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Топ-10 клиентов по выручке</CardTitle></CardHeader>
        <CardContent>
          {clientAnalytics.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, clientAnalytics.slice(0, 10).length * 32 + 40)}>
              <BarChart data={clientAnalytics.slice(0, 10).map((c) => ({ name: c.client, revenue: c.revenue }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}к` : String(v)} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={140} />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => RUB(Number(v))}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ───── Block 5: Quarterly ───── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Квартальный отчёт {year}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {quarterly.qs.map((q) => (
              <div key={q.q} className={cn(
                "p-3 rounded-lg border",
                q.isCurrent ? "border-primary bg-primary/5" : q.isFuture ? "border-dashed border-border/60 bg-muted/20" : "border-border bg-card"
              )}>
                <div className="text-xs text-muted-foreground">Q{q.q} {year}</div>
                <div className="text-lg font-semibold mt-1">{RUB(q.fact)}</div>
                <div className="text-xs mt-1">
                  {q.isFuture ? <span className="text-muted-foreground">прогноз</span>
                    : q.isCurrent ? <span className="text-amber-400">в работе</span>
                    : <span className="text-emerald-400">факт ✓</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-3 border-t border-border">
            <div className="flex justify-between text-sm">
              <span>Итого факт:</span><span className="font-semibold">{RUB(quarterly.totalFact)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Прогноз год:</span><span className="font-semibold">{RUB(quarterly.forecast)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>План год:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={yearPlan}
                  onChange={(e) => setYearPlan(Number(e.target.value) || 0)}
                  className="w-32 h-7 px-2 text-right text-sm bg-background border border-border rounded"
                />
                <span className="text-muted-foreground text-xs w-10">₽</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={planProgress} className="flex-1 h-2" />
              <span className="text-xs font-medium w-12 text-right">{planProgress}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ───── Block 6: Avg check ───── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Динамика среднего чека — {year}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={avgCheckChart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}к` : String(v)} />
              <RTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => RUB(Number(v))}
              />
              <Line type="monotone" dataKey="avg" name="Средний чек" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">Средний чек = Выручка ÷ Количество клиентов в месяце</p>
        </CardContent>
      </Card>

      {/* ───── Block 7: P&L ───── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">P&L — Доходы и расходы</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Категория</TableHead>
                {pnl.showMonths.map((m) => <TableHead key={m} className="text-right">{MONTHS_SHORT[m]}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell colSpan={pnl.showMonths.length + 1} className="text-emerald-400 text-xs uppercase">Доходы</TableCell>
              </TableRow>
              {pnl.incomeRows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="pl-6">{r.label}</TableCell>
                  {r.values.map((v, i) => <TableCell key={i} className="text-right text-sm">{NUM(v)}</TableCell>)}
                </TableRow>
              ))}
              <TableRow className="font-semibold border-t">
                <TableCell className="pl-6">Итого доходы</TableCell>
                {pnl.totalIncome.map((v, i) => <TableCell key={i} className="text-right">{NUM(v)}</TableCell>)}
              </TableRow>

              <TableRow className="bg-muted/30 font-semibold">
                <TableCell colSpan={pnl.showMonths.length + 1} className="text-red-400 text-xs uppercase pt-4">Расходы</TableCell>
              </TableRow>
              {pnl.expenseRows.length === 0 ? (
                <TableRow><TableCell colSpan={pnl.showMonths.length + 1} className="text-center text-xs text-muted-foreground">Нет расходов</TableCell></TableRow>
              ) : pnl.expenseRows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="pl-6">{r.label}</TableCell>
                  {r.values.map((v, i) => <TableCell key={i} className="text-right text-sm">{NUM(v)}</TableCell>)}
                </TableRow>
              ))}
              <TableRow className="font-semibold border-t">
                <TableCell className="pl-6">Итого расходы</TableCell>
                {pnl.totalExpense.map((v, i) => <TableCell key={i} className="text-right">{NUM(v)}</TableCell>)}
              </TableRow>

              <TableRow className="font-bold bg-primary/5 border-t-2 border-primary/30">
                <TableCell>Прибыль</TableCell>
                {pnl.profit.map((v, i) => {
                  const prevV = i > 0 ? pnl.profit[i - 1] : v;
                  const grew = v >= prevV;
                  return <TableCell key={i} className={cn("text-right", grew ? "text-emerald-400" : "text-red-400")}>{NUM(v)}</TableCell>;
                })}
              </TableRow>
              <TableRow className="font-medium">
                <TableCell>Маржа</TableCell>
                {pnl.marg.map((v, i) => <TableCell key={i} className="text-right text-sm">{v.toFixed(1)}%</TableCell>)}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
