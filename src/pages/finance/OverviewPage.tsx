import { useMemo } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Landmark, PiggyBank } from "lucide-react";

import { PeriodFilter } from "@/components/finance/PeriodFilter";
import { PartnersPanel } from "@/components/finance/PartnersPanel";
import { Metric, Panel, PageTitle, Delta, EmptyState } from "@/components/finance/primitives";
import { useFinancePeriod } from "@/contexts/FinancePeriodContext";
import {
  buildCashSeries, computeMetrics, expenseByCategory, useAccounts, useCategoryLabels,
  useInvoices, useObligations, useTransactions,
} from "@/hooks/useFinanceData";
import { compactMoney, fmtPeriodLabel, money, pct } from "@/lib/finance";

export default function OverviewPage() {
  const { period, prev } = useFinancePeriod();
  const { data: accounts = [] } = useAccounts();
  const { data: txs = [], isLoading } = useTransactions();
  const { data: invoices = [] } = useInvoices();
  const { data: obligations = [] } = useObligations();
  const labels = useCategoryLabels();

  const m = useMemo(() => computeMetrics(period, txs, accounts, invoices, obligations), [period, txs, accounts, invoices, obligations]);
  const mPrev = useMemo(() => computeMetrics(prev, txs, accounts, invoices, obligations), [prev, txs, accounts, invoices, obligations]);
  const series = useMemo(() => buildCashSeries(period, txs), [period, txs]);
  const categories = useMemo(() => expenseByCategory(period, txs, prev), [period, txs, prev]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Обзор" subtitle={fmtPeriodLabel(period)} />
        <PeriodFilter />
      </div>

      {/* Ключевые показатели */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 xl:divide-y-0">
        <Metric label="Денег сейчас" value={m.cashNow} size="lg" className="col-span-2 xl:col-span-1" />
        <Metric label="Доход за период" value={m.income} tone="positive" delta={pct(m.income, mPrev.income)} />
        <Metric label="Расходы за период" value={-m.expenses} tone="negative" delta={pct(m.expenses, mPrev.expenses)} />
        <Metric label="Чистая прибыль" value={m.netProfit} tone={m.netProfit >= 0 ? "positive" : "negative"} hint={`налог 6%: ${money(m.taxReserve)}`} />
        <Metric label="К получению" value={m.receivable} tone="positive" />
        <Metric label="Обязательства" value={-m.payable} tone="negative" />
        <Metric label="Прогнозный остаток" value={m.forecast} hint={`свободные деньги: ${money(m.freeCash)}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Динамика денег */}
        <Panel title="Движение денег" subtitle="Доход · Расход · Прибыль" padded={false}>
          <div className="p-2 pt-4">
            {isLoading || series.length === 0 ? (
              <EmptyState text="Нет данных за выбранный период" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={series} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickLine={false} axisLine={false} width={52}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => compactMoney(Number(v))} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))" }}
                    contentStyle={{
                      background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
                      borderRadius: 8, fontSize: 12, boxShadow: "var(--shadow-md)",
                    }}
                    formatter={(v: any, name) => [money(Number(v)), name]}
                  />
                  <Area type="monotone" dataKey="Доход" stroke="hsl(var(--success))" strokeWidth={1.75} fill="url(#gIncome)" />
                  <Area type="monotone" dataKey="Расход" stroke="hsl(var(--destructive))" strokeWidth={1.5} fill="url(#gExpense)" />
                  <Line type="monotone" dataKey="Прибыль" stroke="hsl(var(--foreground))" strokeWidth={1.75} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        {/* Структура расходов */}
        <Panel title="Куда уходят деньги" subtitle="Расходы по категориям за период">
          {categories.length === 0 ? (
            <EmptyState text="Расходов за период нет" />
          ) : (
            <div className="space-y-3">
              {categories.map((c) => (
                <div key={c.code}>
                  <div className="flex items-baseline justify-between gap-2 text-base">
                    <span className="truncate">{labels[c.code] || c.code}</span>
                    <span className="shrink-0 tabular-nums font-medium">{money(c.amount)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${c.share.toFixed(1)}%` }} />
                    </div>
                    <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-muted-foreground">
                      {c.share.toFixed(0)}%
                    </span>
                    <span className="w-12 shrink-0 text-right">
                      <Delta value={pct(c.amount, c.prev)} invert />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <PartnersPanel />

      {/* Счета */}
      <Panel title="Счета компании" subtitle="Фактические остатки" padded={false}>
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {accounts.length === 0 ? (
            <EmptyState text="Нет активных счетов" />
          ) : accounts.map((a) => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {a.kind === "cash" ? <PiggyBank className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />}
                {a.name}
              </div>
              <div className={`mt-1 text-xl font-semibold tabular-nums tracking-tight ${Number(a.balance) < 0 ? "text-destructive" : ""}`}>
                {money(Number(a.balance))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
