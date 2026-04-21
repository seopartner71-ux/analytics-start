import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, subMonths, startOfYear, format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Wallet, TrendingUp, TrendingDown, Landmark, PiggyBank, Receipt, ArrowUpRight, ArrowDownRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExpensesBlock } from "@/components/finance/ExpensesBlock";
import { InvoicesBlock } from "@/components/finance/InvoicesBlock";
import { CashTransferBlock } from "@/components/finance/CashTransferBlock";
import { ReconciliationBlock } from "@/components/finance/ReconciliationBlock";
import { BankImportBlock } from "@/components/finance/BankImportBlock";

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);

const TAX_RATE = 0.07; // 7% налог
const CASH_RATE = 0.07; // 7% в Кассу

type Account = { id: string; name: string; kind: string; balance: number; currency: string };
type Tx = { id: string; account_id: string; type: "income" | "expense" | "transfer"; amount: number; date: string; category: string };

export default function Finance() {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const prevStart = startOfMonth(subMonths(today, 1));
  const prevEnd = endOfMonth(subMonths(today, 1));
  const yearStart = startOfYear(today);

  const { data: accounts = [] } = useQuery({
    queryKey: ["fin-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Account[];
    },
  });

  const { data: txYear = [] } = useQuery({
    queryKey: ["fin-tx-year", yearStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, account_id, type, amount, date, category")
        .gte("date", format(yearStart, "yyyy-MM-dd"))
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Tx[];
    },
  });

  // P&L текущего месяца
  const pnl = useMemo(() => {
    const inMonth = (d: string, s: Date, e: Date) => {
      const x = new Date(d);
      return x >= s && x <= e;
    };
    const calc = (s: Date, e: Date) => {
      const incs = txYear.filter((t) => t.type === "income" && inMonth(t.date, s, e));
      const exps = txYear.filter((t) => t.type === "expense" && inMonth(t.date, s, e));
      const revenue = incs.reduce((sum, t) => sum + Number(t.amount), 0);
      const expenses = exps
        .filter((t) => t.category !== "tax" && t.category !== "cash_reserve")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const tax = revenue * TAX_RATE;
      const cash = revenue * CASH_RATE;
      const net = revenue - tax - cash - expenses;
      return { revenue, tax, cash, expenses, net };
    };
    const cur = calc(monthStart, monthEnd);
    const prev = calc(prevStart, prevEnd);
    const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / Math.abs(b)) * 100);
    return {
      ...cur,
      prev,
      revenueDelta: delta(cur.revenue, prev.revenue),
      netDelta: delta(cur.net, prev.net),
    };
  }, [txYear, monthStart, monthEnd, prevStart, prevEnd]);

  // График по месяцам года
  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today.getFullYear(), i, 1);
      return { date: d, label: format(d, "LLL", { locale: ru }) };
    });
    return months.map(({ date, label }) => {
      const s = startOfMonth(date);
      const e = endOfMonth(date);
      const inRange = (t: Tx) => {
        const x = new Date(t.date);
        return x >= s && x <= e;
      };
      const revenue = txYear.filter((t) => t.type === "income" && inRange(t)).reduce((a, t) => a + Number(t.amount), 0);
      const expenses = txYear
        .filter((t) => t.type === "expense" && inRange(t) && t.category !== "tax" && t.category !== "cash_reserve")
        .reduce((a, t) => a + Number(t.amount), 0);
      const net = revenue - revenue * TAX_RATE - revenue * CASH_RATE - expenses;
      return { month: label, "Выручка": Math.round(revenue), "Чистая прибыль": Math.round(net) };
    });
  }, [txYear, today]);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold">Финансы</h1>
        <p className="text-sm text-muted-foreground">P&amp;L · {format(today, "LLLL yyyy", { locale: ru })}</p>
      </div>

      {/* Блок 1: Балансы счетов */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Балансы счетов
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.length === 0 ? (
            <Card><CardContent className="p-5 text-sm text-muted-foreground">Нет активных счетов</CardContent></Card>
          ) : accounts.map((acc) => (
            <Card key={acc.id} className="overflow-hidden">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    {acc.kind === "cash" ? <PiggyBank className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />}
                    {acc.kind === "cash" ? "Касса" : "Банк"}
                  </div>
                  <Badge variant="outline" className="text-[10px]">{acc.currency}</Badge>
                </div>
                <div className="text-xl font-bold">{acc.name}</div>
                <div className={`text-2xl font-bold ${Number(acc.balance) < 0 ? "text-red-500" : ""}`}>
                  {RUB(Number(acc.balance))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Блок 2: P&L текущего месяца */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Отчёт о прибылях за {format(today, "LLLL", { locale: ru })}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PnlCard
            label="Валовая выручка"
            value={pnl.revenue}
            delta={pnl.revenueDelta}
            icon={<Wallet className="h-4 w-4" />}
            tone="blue"
          />
          <PnlCard
            label="Налоги (резерв 7%)"
            value={pnl.tax}
            icon={<Receipt className="h-4 w-4" />}
            tone="amber"
            hint="Зарезервировано на налог"
          />
          <PnlCard
            label="Касса (резерв 7%)"
            value={pnl.cash}
            icon={<PiggyBank className="h-4 w-4" />}
            tone="violet"
            hint="Отчисления в Кассу"
          />
          <PnlCard
            label="Чистая прибыль"
            value={pnl.net}
            delta={pnl.netDelta}
            icon={<TrendingUp className="h-4 w-4" />}
            tone={pnl.net >= 0 ? "emerald" : "red"}
            highlight
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Чистая прибыль = Выручка − Налог 7% − Касса 7% − Расходы (без налогов и отчислений в Кассу).
          Расходы за месяц: <span className="font-semibold text-foreground">{RUB(pnl.expenses)}</span>
        </p>
      </div>

      {/* Блок 3: График */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Выручка vs Чистая прибыль · {today.getFullYear()}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
              <RTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v) => RUB(Number(v))}
              />
              <Legend />
              <Bar dataKey="Выручка" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={18} />
              <Bar dataKey="Чистая прибыль" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Блок 4: Касса и переводы */}
      <CashTransferBlock />

      {/* Блок 5: Расходы */}
      <ExpensesBlock />

      {/* Блок 6: Документы */}
      <InvoicesBlock />

      {/* Блок 7: Импорт банковской выписки */}
      <BankImportBlock />

      {/* Блок 8: Акт сверки */}
      <ReconciliationBlock />
    </div>
  );
}

function PnlCard({
  label, value, delta, icon, tone, hint, highlight,
}: {
  label: string;
  value: number;
  delta?: number;
  icon: React.ReactNode;
  tone: "blue" | "amber" | "violet" | "emerald" | "red";
  hint?: string;
  highlight?: boolean;
}) {
  const toneMap: Record<string, string> = {
    blue: "from-blue-500/15 to-blue-500/5 border-blue-500/30",
    amber: "from-amber-500/15 to-amber-500/5 border-amber-500/30",
    violet: "from-violet-500/15 to-violet-500/5 border-violet-500/30",
    emerald: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30",
    red: "from-red-500/15 to-red-500/5 border-red-500/30",
  };
  const showDelta = typeof delta === "number" && isFinite(delta);
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className={`bg-gradient-to-br ${toneMap[tone]} ${highlight ? "ring-1 ring-primary/20" : ""}`}>
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-foreground/80 flex items-center gap-1.5">
            {icon} {label}
          </span>
          {showDelta && (
            <Badge variant="outline" className={`text-[10px] gap-0.5 ${positive ? "text-emerald-500 border-emerald-500/30" : "text-red-500 border-red-500/30"}`}>
              {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta!).toFixed(0)}%
            </Badge>
          )}
        </div>
        <div className="text-2xl font-bold">{RUB(value)}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
