import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PeriodFilter } from "@/components/finance/PeriodFilter";
import { PartnersPanel } from "@/components/finance/PartnersPanel";
import { EmptyState, PageTitle, Panel, TableWrap, Td, Th } from "@/components/finance/primitives";
import { useFinancePeriod } from "@/contexts/FinancePeriodContext";
import {
  buildCashSeries, computeMetrics, expenseByCategory, useAccounts, useCategoryLabels,
  useInvoices, useObligations, useTransactions,
} from "@/hooks/useFinanceData";
import { compactMoney, fmtPeriodLabel, money, pct } from "@/lib/finance";

export default function ReportsPage() {
  const { period, prev } = useFinancePeriod();
  const { data: txs = [] } = useTransactions();
  const { data: accounts = [] } = useAccounts();
  const { data: invoices = [] } = useInvoices();
  const { data: obligations = [] } = useObligations();
  const labels = useCategoryLabels();

  const m = useMemo(() => computeMetrics(period, txs, accounts, invoices, obligations), [period, txs, accounts, invoices, obligations]);
  const mPrev = useMemo(() => computeMetrics(prev, txs, accounts, invoices, obligations), [prev, txs, accounts, invoices, obligations]);
  const series = useMemo(() => buildCashSeries(period, txs), [period, txs]);
  const cats = useMemo(() => expenseByCategory(period, txs, prev), [period, txs, prev]);

  const pnl = [
    { label: "Выручка", cur: m.income, before: mPrev.income },
    { label: "Налог 6%", cur: -m.taxReserve, before: -mPrev.taxReserve },
    { label: "Операционные расходы", cur: -m.expenses, before: -mPrev.expenses },
    { label: "Чистая прибыль", cur: m.netProfit, before: mPrev.netProfit, strong: true },
  ];
  const marginality = m.income ? (m.netProfit / m.income) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Отчёты" subtitle={fmtPeriodLabel(period)} />
        <PeriodFilter />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Отчёт о прибылях и убытках" subtitle="Сравнение с предыдущим периодом" padded={false}>
          <TableWrap>
            <thead>
              <tr><Th>Статья</Th><Th align="right">Период</Th><Th align="right">Пред. период</Th><Th align="right">Δ</Th></tr>
            </thead>
            <tbody>
              {pnl.map((r) => (
                <tr key={r.label} className={r.strong ? "bg-muted/30" : "transition-colors hover:bg-muted/40"}>
                  <Td className={r.strong ? "font-medium" : ""}>{r.label}</Td>
                  <Td align="right" className={r.strong ? "font-semibold" : ""}>{money(r.cur)}</Td>
                  <Td align="right" className="text-muted-foreground">{money(r.before)}</Td>
                  <Td align="right" className="text-muted-foreground">
                    {isFinite(pct(r.cur, r.before)) ? `${pct(r.cur, r.before) > 0 ? "+" : ""}${pct(r.cur, r.before).toFixed(0)}%` : "—"}
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="text-muted-foreground">Рентабельность</Td>
                <Td align="right">{marginality.toFixed(1)}%</Td>
                <Td align="right" className="text-muted-foreground">
                  {(mPrev.income ? (mPrev.netProfit / mPrev.income) * 100 : 0).toFixed(1)}%
                </Td>
                <Td />
              </tr>
            </tbody>
          </TableWrap>
        </Panel>

        <Panel title="Прибыль по периодам" padded={false}>
          <div className="p-2 pt-4">
            {series.length === 0 ? <EmptyState text="Нет данных" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={series} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickLine={false} axisLine={false} width={52}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => compactMoney(Number(v))} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => money(Number(v))}
                  />
                  <Bar dataKey="Прибыль" radius={[3, 3, 0, 0]}>
                    {series.map((s, i) => (
                      <Cell key={i} fill={s.Прибыль >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Расходы по категориям" padded={false}>
        {cats.length === 0 ? <EmptyState text="Расходов нет" /> : (
          <TableWrap>
            <thead>
              <tr><Th>Категория</Th><Th align="right">Сумма</Th><Th align="right">Доля</Th><Th align="right">Пред. период</Th></tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.code} className="transition-colors hover:bg-muted/40">
                  <Td>{labels[c.code] || c.code}</Td>
                  <Td align="right">{money(c.amount)}</Td>
                  <Td align="right" className="text-muted-foreground">{c.share.toFixed(0)}%</Td>
                  <Td align="right" className="text-muted-foreground">{money(c.prev)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <PartnersPanel />
    </div>
  );
}
