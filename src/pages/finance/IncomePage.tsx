import { useMemo } from "react";
import { InvoicesBlock } from "@/components/finance/InvoicesBlock";
import { PeriodFilter } from "@/components/finance/PeriodFilter";
import { EmptyState, Metric, PageTitle, Panel, StatusBadge, TableWrap, Td, Th } from "@/components/finance/primitives";
import { useFinancePeriod } from "@/contexts/FinancePeriodContext";
import { invoiceReceivable, useInvoices, useTransactions } from "@/hooks/useFinanceData";
import { INVOICE_STATUS, fmtDate, fmtPeriodLabel, inPeriod, money } from "@/lib/finance";

export default function IncomePage() {
  const { period } = useFinancePeriod();
  const { data: invoices = [] } = useInvoices();
  const { data: txs = [] } = useTransactions();

  const periodInvoices = useMemo(
    () => invoices.filter((i) => inPeriod(i.date_created, period)),
    [invoices, period],
  );

  const billed = periodInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const received = txs.filter((t) => t.type === "income" && inPeriod(t.date, period))
    .reduce((s, t) => s + Number(t.amount), 0);
  const outstanding = invoices.reduce((s, i) => s + invoiceReceivable(i).outstanding, 0);
  const overdue = invoices.reduce((s, i) => {
    const r = invoiceReceivable(i);
    return s + (r.overdueDays > 0 ? r.outstanding : 0);
  }, 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Доходы" subtitle={fmtPeriodLabel(period)} />
        <PeriodFilter />
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-4 lg:divide-y-0">
        <Metric label="Выставлено за период" value={billed} />
        <Metric label="Получено за период" value={received} tone="positive" />
        <Metric label="К получению" value={outstanding} />
        <Metric label="Просрочено" value={overdue} tone={overdue > 0 ? "negative" : "muted"} />
      </div>

      <Panel title="Дебиторка" subtitle="Неоплаченные счета — все периоды" padded={false}>
        {invoices.filter((i) => invoiceReceivable(i).outstanding > 0).length === 0 ? (
          <EmptyState text="Все счета оплачены" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Счёт</Th><Th>Клиент</Th><Th>Услуга</Th><Th>Выставлен</Th>
                <Th>Оплатить до</Th><Th>Статус</Th><Th align="right">Сумма</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.filter((i) => invoiceReceivable(i).outstanding > 0).map((i) => {
                const r = invoiceReceivable(i);
                const st = INVOICE_STATUS[i.status] || { label: i.status, tone: "neutral" as const };
                return (
                  <tr key={i.id} className="transition-colors hover:bg-muted/40">
                    <Td className="font-medium">{i.invoice_number}</Td>
                    <Td>{i.client_name}</Td>
                    <Td className="max-w-[240px] truncate text-muted-foreground">{i.service || "—"}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(i.date_created)}</Td>
                    <Td className="whitespace-nowrap">
                      {fmtDate(r.dueDate)}
                      {r.overdueDays > 0 && <span className="ml-1 text-2xs text-destructive">+{r.overdueDays} дн.</span>}
                    </Td>
                    <Td><StatusBadge label={r.overdueDays > 0 ? "Просрочено" : st.label} tone={r.overdueDays > 0 ? "danger" : st.tone} /></Td>
                    <Td align="right" className="font-medium">{money(r.outstanding)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <InvoicesBlock />
    </div>
  );
}
