import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Repeat, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodFilter } from "@/components/finance/PeriodFilter";
import { EmptyState, PageTitle, Panel, TableWrap, Td, Th } from "@/components/finance/primitives";
import { useFinancePeriod } from "@/contexts/FinancePeriodContext";
import { useAccounts, useCategoryLabels, useTransactions } from "@/hooks/useFinanceData";
import { fmtDate, fmtPeriodLabel, inPeriod, money } from "@/lib/finance";

const TYPE_META: Record<string, { label: string; icon: any; cls: string }> = {
  income: { label: "Доход", icon: ArrowDownLeft, cls: "text-[hsl(var(--success))]" },
  expense: { label: "Расход", icon: ArrowUpRight, cls: "text-destructive" },
  transfer: { label: "Перевод", icon: Repeat, cls: "text-muted-foreground" },
};

export default function OperationsPage() {
  const { period } = useFinancePeriod();
  const { data: txs = [], isLoading } = useTransactions();
  const { data: accounts = [] } = useAccounts();
  const labels = useCategoryLabels();
  const [type, setType] = useState("all");
  const [account, setAccount] = useState("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => txs.filter((t) => {
    if (!inPeriod(t.date, period)) return false;
    if (type !== "all" && t.type !== type) return false;
    if (account !== "all" && t.account_id !== account) return false;
    if (q && !`${t.description || ""} ${labels[t.category || ""] || t.category || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [txs, period, type, account, q, labels]);

  const totals = useMemo(() => ({
    income: rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0),
    expense: rows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0),
  }), [rows]);

  const accName = (id: string | null) => accounts.find((a) => a.id === id)?.name || "—";

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Операции" subtitle={fmtPeriodLabel(period)} />
        <PeriodFilter />
      </div>

      <Panel
        title={`${rows.length} операц.`}
        subtitle={`Поступления ${money(totals.income)} · Списания ${money(totals.expense)}`}
        padded={false}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск"
                className="h-8 w-40 pl-7 text-xs" />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="income">Доходы</SelectItem>
                <SelectItem value="expense">Расходы</SelectItem>
                <SelectItem value="transfer">Переводы</SelectItem>
              </SelectContent>
            </Select>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все счета</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {isLoading ? (
          <EmptyState text="Загрузка…" />
        ) : rows.length === 0 ? (
          <EmptyState text="Операций за период нет" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Дата</Th>
                <Th>Тип</Th>
                <Th>Назначение</Th>
                <Th>Категория</Th>
                <Th>Счёт</Th>
                <Th align="right">Сумма</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const meta = TYPE_META[t.type] || TYPE_META.transfer;
                const Icon = meta.icon;
                return (
                  <tr key={t.id} className="transition-colors hover:bg-muted/40">
                    <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(t.date)}</Td>
                    <Td>
                      <span className={`inline-flex items-center gap-1 text-xs ${meta.cls}`}>
                        <Icon className="h-3.5 w-3.5" />{meta.label}
                      </span>
                    </Td>
                    <Td className="max-w-[380px] truncate">{t.description || "—"}</Td>
                    <Td className="text-muted-foreground">{labels[t.category || ""] || t.category || "—"}</Td>
                    <Td className="text-muted-foreground">{accName(t.account_id)}</Td>
                    <Td align="right" className={`font-medium ${meta.cls}`}>
                      {t.type === "income" ? money(Number(t.amount), true) : t.type === "expense" ? money(-Number(t.amount), true) : money(Number(t.amount))}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
