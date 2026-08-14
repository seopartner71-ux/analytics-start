import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Metric, PageTitle, Panel, StatusBadge, TableWrap, Td, Th } from "@/components/finance/primitives";
import { ClientCardSheet } from "@/components/finance/ClientCardSheet";
import { ClientFormDialog } from "@/components/finance/ClientFormDialog";
import { invoiceReceivable, useInvoices } from "@/hooks/useFinanceData";
import { useClients, useReportSettings, useResponsibles, type FinClient } from "@/hooks/useClientReports";
import {
  CLIENT_STATUSES, REPORT_STATUS_LABEL, REPORT_STATUS_TONE,
  computeReportState, daysLeftLabel, fmtRuShort,
} from "@/lib/clientReports";
import { money } from "@/lib/finance";

export default function ClientsPage() {
  const { data: clients = [], isLoading } = useClients();
  const { data: responsibles = [] } = useResponsibles();
  const { data: settings } = useReportSettings();
  const { data: invoices = [] } = useInvoices();
  const warnDays = settings?.warn_days ?? 3;

  const [q, setQ] = useState("");
  const [resp, setResp] = useState("all");
  const [status, setStatus] = useState("all");
  const [due, setDue] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [active, setActive] = useState<FinClient | null>(null);

  const rows = useMemo(() => {
    return clients.map((c) => {
      const state = computeReportState(c.report_enabled ? c.report_day : null, c.last_report_date, new Date(), warnDays);
      const mine = invoices.filter((i) => i.client_id === c.id || i.client_name === c.name);
      const paid = mine.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
      const debt = mine.reduce((s, i) => s + invoiceReceivable(i).outstanding, 0);
      return { client: c, state, paid, debt };
    });
  }, [clients, invoices, warnDays]);

  const filtered = useMemo(() => rows.filter((r) => {
    const c = r.client;
    if (q && !`${c.name} ${c.legal_name || ""} ${c.inn || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (resp !== "all" && (c.responsible_id || "none") !== resp) return false;
    if (status !== "all" && c.status !== status) return false;
    if (due !== "all") {
      const d = r.state.daysLeft;
      if (due === "overdue" && !(d !== null && d < 0)) return false;
      if (due === "today" && d !== 0) return false;
      if (due === "soon" && !(d !== null && d >= 0 && d <= warnDays)) return false;
      if (due === "month" && !(d !== null && d >= 0 && d <= 31)) return false;
    }
    return true;
  }).sort((a, b) => {
    const av = a.state.daysLeft ?? 9999, bv = b.state.daysLeft ?? 9999;
    return av - bv;
  }), [rows, q, resp, status, due, warnDays]);

  const overdue = rows.filter((r) => r.state.status === "overdue").length;
  const todayCnt = rows.filter((r) => r.state.status === "today").length;
  const soon = rows.filter((r) => r.state.status === "soon").length;
  const totalDebt = rows.reduce((s, r) => s + r.debt, 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageTitle
        title="Клиенты"
        subtitle="Учёт клиентов и контроль отчётных периодов"
        actions={
          <Button size="sm" className="h-8" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Добавить клиента
          </Button>
        }
      />

      <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-4">
        <Metric label="Просрочено отчётов" value={overdue} tone={overdue ? "negative" : "muted"} />
        <Metric label="Отчётность сегодня" value={todayCnt} tone={todayCnt ? "neutral" : "muted"} />
        <Metric label={`Ближайшие (${warnDays} дн.)`} value={soon} tone="muted" />
        <Metric label="Долг клиентов" value={totalDebt} tone={totalDebt ? "negative" : "muted"} />
      </div>

      <Panel
        title="Клиентская база"
        subtitle={`${filtered.length} из ${clients.length}`}
        padded={false}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="h-8 w-40 pl-7 text-xs" />
            </div>
            <Select value={resp} onValueChange={setResp}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Ответственный" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все ответственные</SelectItem>
                <SelectItem value="none">Без ответственного</SelectItem>
                {responsibles.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {CLIENT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={due} onValueChange={setDue}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Любая отчётность</SelectItem>
                <SelectItem value="overdue">Просрочено</SelectItem>
                <SelectItem value="today">Сегодня</SelectItem>
                <SelectItem value="soon">Ближайшие</SelectItem>
                <SelectItem value="month">В этом месяце</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {isLoading ? <EmptyState text="Загрузка…" /> : filtered.length === 0 ? <EmptyState text="Клиенты не найдены" /> : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Клиент</Th><Th>Ответственный</Th><Th>Отчётный день</Th>
                <Th>Следующая отчётность</Th><Th>До отчётности</Th>
                <Th align="right">Финансы</Th><Th>Статус</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ client: c, state, paid, debt }) => (
                <tr
                  key={c.id}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  onClick={() => setActive(c)}
                >
                  <Td className="max-w-[240px] truncate font-medium">{c.name}</Td>
                  <Td className="text-muted-foreground">
                    {responsibles.find((r) => r.id === c.responsible_id)?.full_name || "—"}
                  </Td>
                  <Td className="text-muted-foreground">{c.report_day ? `${c.report_day} число` : "—"}</Td>
                  <Td className={state.status === "overdue" ? "font-medium text-destructive" : "font-medium"}>
                    {state.dueDate ? fmtRuShort(state.dueDate) : "—"}
                  </Td>
                  <Td className="text-muted-foreground">{daysLeftLabel(state.daysLeft)}</Td>
                  <Td align="right">
                    {money(paid)}
                    {debt > 0 && <span className="ml-2 text-2xs text-destructive">долг {money(debt)}</span>}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge label={REPORT_STATUS_LABEL[state.status]} tone={REPORT_STATUS_TONE[state.status]} />
                      {c.status !== "active" && (
                        <StatusBadge label={CLIENT_STATUSES.find((s) => s.value === c.status)?.label || c.status} />
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <ClientFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ClientCardSheet
        client={active}
        open={!!active}
        onOpenChange={(v) => !v && setActive(null)}
        warnDays={warnDays}
      />
    </div>
  );
}
