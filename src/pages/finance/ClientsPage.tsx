import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { PeriodFilter } from "@/components/finance/PeriodFilter";
import { EmptyState, Metric, PageTitle, Panel, StatusBadge, TableWrap, Td, Th } from "@/components/finance/primitives";
import { useFinancePeriod } from "@/contexts/FinancePeriodContext";
import { invoiceReceivable, useInvoices, useTransactions } from "@/hooks/useFinanceData";
import { TAX_RATE, fmtDate, fmtPeriodLabel, inPeriod, money } from "@/lib/finance";

interface ClientRow {
  name: string;
  revenue: number;
  revenueAll: number;
  directCost: number;
  profit: number;
  margin: number;
  debt: number;
  overdue: number;
  lastPayment: string | null;
  invoices: number;
}

export default function ClientsPage() {
  const { period } = useFinancePeriod();
  const { data: invoices = [] } = useInvoices();
  const { data: txs = [] } = useTransactions();
  const [q, setQ] = useState("");

  const rows = useMemo<ClientRow[]>(() => {
    const map = new Map<string, ClientRow & { clientIds: Set<string> }>();
    const get = (name: string) => {
      if (!map.has(name)) {
        map.set(name, {
          name, revenue: 0, revenueAll: 0, directCost: 0, profit: 0, margin: 0,
          debt: 0, overdue: 0, lastPayment: null, invoices: 0, clientIds: new Set(),
        });
      }
      return map.get(name)!;
    };

    invoices.forEach((i) => {
      const r = get(i.client_name || "Без клиента");
      r.invoices += 1;
      if (i.client_id) r.clientIds.add(i.client_id);
      const rec = invoiceReceivable(i);
      r.debt += rec.outstanding;
      if (rec.overdueDays > 0) r.overdue += rec.outstanding;
      if (i.status === "paid") {
        const paidAt = i.date_paid || i.date_created;
        r.revenueAll += Number(i.amount);
        if (inPeriod(paidAt, period)) r.revenue += Number(i.amount);
        if (!r.lastPayment || new Date(paidAt) > new Date(r.lastPayment)) r.lastPayment = paidAt;
      }
    });

    map.forEach((r) => {
      r.directCost = txs
        .filter((t) => t.type === "expense" && t.client_id && r.clientIds.has(t.client_id) && inPeriod(t.date, period))
        .reduce((s, t) => s + Number(t.amount), 0);
      r.profit = r.revenue - r.revenue * TAX_RATE - r.directCost;
      r.margin = r.revenue ? (r.profit / r.revenue) * 100 : 0;
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue || b.revenueAll - a.revenueAll);
  }, [invoices, txs, period]);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalDebt = rows.reduce((s, r) => s + r.debt, 0);
  const paying = rows.filter((r) => r.revenue > 0).length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Клиенты" subtitle={fmtPeriodLabel(period)} />
        <PeriodFilter />
      </div>

      <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-4">
        <Metric label="Выручка за период" value={totalRevenue} tone="positive" />
        <Metric label="Платящих клиентов" value={paying} tone="muted" hint={`всего в базе: ${rows.length}`} />
        <Metric label="Долг клиентов" value={totalDebt} tone={totalDebt ? "negative" : "muted"} />
        <Metric label="Средний чек" value={paying ? totalRevenue / paying : 0} />
      </div>

      <Panel
        title="Клиентская база"
        subtitle="Выручка, маржинальность и задолженность"
        padded={false}
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск клиента" className="h-8 w-48 pl-7 text-xs" />
          </div>
        }
      >
        {filtered.length === 0 ? <EmptyState text="Клиенты не найдены" /> : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Клиент</Th><Th align="right">Выручка</Th><Th align="right">Прямые расходы</Th>
                <Th align="right">Прибыль</Th><Th align="right">Маржа</Th><Th align="right">Долг</Th>
                <Th>Последняя оплата</Th><Th align="right">Счетов</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.name} className="transition-colors hover:bg-muted/40">
                  <Td className="max-w-[260px] truncate font-medium">{r.name}</Td>
                  <Td align="right">{money(r.revenue)}</Td>
                  <Td align="right" className="text-muted-foreground">{money(r.directCost)}</Td>
                  <Td align="right" className={r.profit < 0 ? "text-destructive" : ""}>{money(r.profit)}</Td>
                  <Td align="right">
                    {r.revenue ? (
                      <StatusBadge
                        label={`${r.margin.toFixed(0)}%`}
                        tone={r.margin >= 40 ? "success" : r.margin >= 15 ? "warning" : "danger"}
                      />
                    ) : <span className="text-muted-foreground">—</span>}
                  </Td>
                  <Td align="right" className={r.overdue > 0 ? "text-destructive font-medium" : ""}>{money(r.debt)}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(r.lastPayment)}</Td>
                  <Td align="right" className="text-muted-foreground">{r.invoices}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
