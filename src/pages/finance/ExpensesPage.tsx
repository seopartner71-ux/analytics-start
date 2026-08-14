import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ExpensesBlock } from "@/components/finance/ExpensesBlock";
import { PeriodFilter } from "@/components/finance/PeriodFilter";
import { Delta, EmptyState, Metric, PageTitle, Panel, TableWrap, Td, Th } from "@/components/finance/primitives";
import { useFinancePeriod } from "@/contexts/FinancePeriodContext";
import { expenseByCategory, useCategoryLabels, useTransactions } from "@/hooks/useFinanceData";
import { fmtPeriodLabel, money, pct } from "@/lib/finance";

const SLICE = [
  "hsl(var(--foreground) / 0.85)", "hsl(var(--foreground) / 0.65)", "hsl(var(--foreground) / 0.5)",
  "hsl(var(--foreground) / 0.38)", "hsl(var(--foreground) / 0.28)", "hsl(var(--foreground) / 0.2)",
  "hsl(var(--foreground) / 0.14)",
];

export default function ExpensesPage() {
  const { period, prev } = useFinancePeriod();
  const { data: txs = [] } = useTransactions();
  const labels = useCategoryLabels();

  const cats = useMemo(() => expenseByCategory(period, txs, prev), [period, txs, prev]);
  const total = cats.reduce((s, c) => s + c.amount, 0);
  const totalPrev = cats.reduce((s, c) => s + c.prev, 0);
  const biggest = cats[0];

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Расходы" subtitle={fmtPeriodLabel(period)} />
        <PeriodFilter />
      </div>

      <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-3">
        <Metric label="Расходы за период" value={-total} tone="negative" delta={pct(total, totalPrev)} />
        <Metric label="Крупнейшая статья" value={biggest?.amount ?? 0}
          hint={biggest ? labels[biggest.code] || biggest.code : "—"} />
        <Metric label="Средний расход в день" value={-Math.round(total / Math.max(1, cats.length ? 1 : 1) / 1)}
          tone="muted" hint="за выбранный период" className="hidden lg:block" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title="Структура расходов">
          {cats.length === 0 ? (
            <EmptyState text="Расходов нет" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={cats} dataKey="amount" nameKey="code" innerRadius={64} outerRadius={100} paddingAngle={2} stroke="none">
                  {cats.map((c, i) => <Cell key={c.code} fill={SLICE[i % SLICE.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, n: any) => [money(Number(v)), labels[n] || n]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="По категориям" subtitle="Сравнение с предыдущим периодом" padded={false}>
          {cats.length === 0 ? <EmptyState text="Нет данных" /> : (
            <TableWrap>
              <thead>
                <tr><Th>Категория</Th><Th align="right">Сумма</Th><Th align="right">Доля</Th><Th align="right">Пред. период</Th><Th align="right">Δ</Th></tr>
              </thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.code} className="transition-colors hover:bg-muted/40">
                    <Td>{labels[c.code] || c.code}</Td>
                    <Td align="right" className="font-medium">{money(c.amount)}</Td>
                    <Td align="right" className="text-muted-foreground">{c.share.toFixed(0)}%</Td>
                    <Td align="right" className="text-muted-foreground">{money(c.prev)}</Td>
                    <Td align="right"><Delta value={pct(c.amount, c.prev)} invert /></Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>
      </div>

      <ExpensesBlock />
    </div>
  );
}
