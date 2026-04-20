import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, addMonths, isWithinInterval, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend, BarChart,
} from "recharts";
import { TrendingUp, Target, Users, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Invoice = { id: string; client_name: string; amount: number; issued_at: string; status: string };
type Payment = { id: string; client_name: string; paid_amount: number; next_payment_date: string | null; status: string };
type Expense = { id: string; amount: number; expense_date: string };

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);

interface Props {
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  /** План выручки на месяц (₽). Если нет — возьмётся среднее за последние 3 месяца. */
  monthlyPlan?: number;
}

export default function DirectorDashboard({ invoices, payments, expenses, monthlyPlan }: Props) {
  const today = new Date();

  /* выручка по 12 месяцам */
  const months12 = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonths(startOfMonth(today), -11 + i)),
    [today],
  );

  const monthlyRevenue = useMemo(() => months12.map((m) => {
    const ms = startOfMonth(m), me = endOfMonth(m);
    const inv = invoices
      .filter((i) => i.status === "paid" && isWithinInterval(parseISO(i.issued_at), { start: ms, end: me }))
      .reduce((s, i) => s + Number(i.amount), 0);
    const pay = payments
      .filter((p) => p.next_payment_date && isWithinInterval(parseISO(p.next_payment_date), { start: ms, end: me }))
      .reduce((s, p) => s + Number(p.paid_amount || 0), 0);
    const exp = expenses
      .filter((e) => isWithinInterval(parseISO(e.expense_date), { start: ms, end: me }))
      .reduce((s, e) => s + Number(e.amount), 0);
    const revenue = inv + pay;
    return {
      month: format(m, "LLL", { locale: ru }),
      Выручка: revenue,
      Прибыль: revenue - exp,
    };
  }), [months12, invoices, payments, expenses]);

  /* план vs факт за текущий месяц */
  const planVsFact = useMemo(() => {
    const ms = startOfMonth(today), me = endOfMonth(today);
    const fact = invoices
      .filter((i) => i.status === "paid" && isWithinInterval(parseISO(i.issued_at), { start: ms, end: me }))
      .reduce((s, i) => s + Number(i.amount), 0)
    + payments
      .filter((p) => p.next_payment_date && isWithinInterval(parseISO(p.next_payment_date), { start: ms, end: me }))
      .reduce((s, p) => s + Number(p.paid_amount || 0), 0);

    const last3 = monthlyRevenue.slice(-4, -1).map((r) => r.Выручка);
    const avg3 = last3.length ? Math.round(last3.reduce((s, v) => s + v, 0) / last3.length) : 0;
    const plan = monthlyPlan && monthlyPlan > 0 ? monthlyPlan : avg3;
    const pct = plan > 0 ? Math.min(100, Math.round((fact / plan) * 100)) : 0;
    return { plan, fact, pct };
  }, [today, invoices, payments, monthlyRevenue, monthlyPlan]);

  /* прогноз следующего месяца — линейный тренд по последним 3 мес */
  const forecast = useMemo(() => {
    const last3 = monthlyRevenue.slice(-3).map((r) => r.Выручка);
    if (last3.length < 2) return last3[0] || 0;
    // простой тренд: avg(last3) + delta(last - first) / (n-1)
    const avg = last3.reduce((s, v) => s + v, 0) / last3.length;
    const delta = (last3[last3.length - 1] - last3[0]) / (last3.length - 1);
    return Math.max(0, Math.round(avg + delta));
  }, [monthlyRevenue]);

  /* топ клиентов по выручке (за последние 12 мес) */
  const topClients = useMemo(() => {
    const cutoff = addMonths(today, -12);
    const map: Record<string, number> = {};
    invoices.forEach((i) => {
      if (i.status !== "paid") return;
      if (parseISO(i.issued_at) < cutoff) return;
      map[i.client_name] = (map[i.client_name] || 0) + Number(i.amount);
    });
    payments.forEach((p) => {
      if (!p.next_payment_date) return;
      if (parseISO(p.next_payment_date) < cutoff) return;
      map[p.client_name] = (map[p.client_name] || 0) + Number(p.paid_amount || 0);
    });
    return Object.entries(map)
      .map(([client, sum]) => ({ client, Сумма: sum }))
      .sort((a, b) => b.Сумма - a.Сумма)
      .slice(0, 5);
  }, [invoices, payments, today]);

  return (
    <div className="space-y-4">
      {/* Top tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/30">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-foreground/80 flex items-center gap-1">
                <Target className="h-3.5 w-3.5" /> План vs Факт
              </span>
              <span className="text-xs font-medium text-emerald-400">{planVsFact.pct}%</span>
            </div>
            <div className="text-2xl font-bold">{RUB(planVsFact.fact)}</div>
            <Progress value={planVsFact.pct} className="h-2" />
            <p className="text-xs text-muted-foreground">План: {RUB(planVsFact.plan)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/15 to-blue-500/5 border-blue-500/30">
          <CardContent className="p-5 space-y-2">
            <span className="text-xs uppercase tracking-wide text-foreground/80 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Прогноз след. месяц
            </span>
            <div className="text-2xl font-bold">{RUB(forecast)}</div>
            <p className="text-xs text-muted-foreground">На основе последних 3 месяцев</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-amber-500/30">
          <CardContent className="p-5 space-y-2">
            <span className="text-xs uppercase tracking-wide text-foreground/80 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Топ клиент
            </span>
            <div className="text-lg font-bold truncate">{topClients[0]?.client || "—"}</div>
            <p className="text-xs text-muted-foreground">{topClients[0] ? RUB(topClients[0].Сумма) : "Нет данных"} · 12 мес</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Динамика прибыли · 12 месяцев</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v) => RUB(Number(v))}
                />
                <Legend />
                <Bar dataKey="Выручка" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={22} />
                <Line type="monotone" dataKey="Прибыль" stroke="#FFB800" strokeWidth={2.5} dot={{ r: 3, fill: "#FFB800" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Топ-5 клиентов по выручке
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Нет данных по клиентам</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topClients} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                  <YAxis dataKey="client" type="category" stroke="hsl(var(--muted-foreground))" width={120} />
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v) => RUB(Number(v))}
                  />
                  <Bar dataKey="Сумма" fill="#10b981" radius={[0, 4, 4, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
