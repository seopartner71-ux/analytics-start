import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, StatusBadge, TableWrap, Td, Th } from "@/components/finance/primitives";
import { supabase } from "@/integrations/supabase/client";
import { invoiceReceivable, useInvoices, useTransactions } from "@/hooks/useFinanceData";
import { useReportHistory, useResponsibles, type FinClient } from "@/hooks/useClientReports";
import {
  CLIENT_STATUSES, CLIENT_TYPES, REPORT_STATUS_LABEL, REPORT_STATUS_TONE,
  computeReportState, daysLeftLabel, fmtRu, fmtRuShort, reportPeriodOf,
} from "@/lib/clientReports";
import { TAX_RATE, money } from "@/lib/finance";
import { ClientFormDialog } from "@/components/finance/ClientFormDialog";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function ClientCardSheet({
  client, open, onOpenChange, warnDays = 3,
}: {
  client: FinClient | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  warnDays?: number;
}) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const { data: history = [] } = useReportHistory(client?.id);
  const { data: responsibles = [] } = useResponsibles();
  const { data: invoices = [] } = useInvoices();
  const { data: txs = [] } = useTransactions();

  const state = useMemo(
    () => computeReportState(client?.report_day, client?.last_report_date, new Date(), warnDays),
    [client?.report_day, client?.last_report_date, warnDays],
  );

  const fin = useMemo(() => {
    if (!client) return { billed: 0, paid: 0, debt: 0, expenses: 0, profit: 0, margin: 0 };
    const mine = invoices.filter((i) => i.client_id === client.id || i.client_name === client.name);
    const billed = mine.reduce((s, i) => s + Number(i.amount), 0);
    const paid = mine.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    const debt = mine.reduce((s, i) => s + invoiceReceivable(i).outstanding, 0);
    const expenses = txs
      .filter((t) => t.type === "expense" && t.client_id === client.id)
      .reduce((s, t) => s + Number(t.amount), 0);
    const profit = paid - paid * TAX_RATE - expenses;
    return { billed, paid, debt, expenses, profit, margin: paid ? (profit / paid) * 100 : 0 };
  }, [client, invoices, txs]);

  const responsibleName = responsibles.find((r) => r.id === client?.responsible_id)?.full_name || "Не назначен";

  const markDone = useMutation({
    mutationFn: async () => {
      if (!client || !state.dueDate) throw new Error("Дата отчётности не задана");
      const p = reportPeriodOf(state.dueDate);
      const { data: auth } = await supabase.auth.getUser();
      const due = fmtRuShort(state.dueDate).split(".").reverse().join("-");
      const { error } = await supabase.from("client_report_history").upsert({
        client_id: client.id,
        period_year: p.year,
        period_month: p.month,
        due_date: due,
        completed_at: new Date().toISOString(),
        completed_by: auth.user?.id ?? null,
        responsible_id: client.responsible_id,
      }, { onConflict: "client_id,period_year,period_month" });
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("financial_clients").update({ last_report_date: due }).eq("id", client.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-clients"] });
      qc.invalidateQueries({ queryKey: ["client-report-history"] });
      toast.success("Отчёт отмечен выполненным");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!client) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="pr-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="text-lg">{client.name}</SheetTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {CLIENT_TYPES.find((t) => t.value === client.client_type)?.label || "—"} ·{" "}
                  {CLIENT_STATUSES.find((s) => s.value === client.status)?.label || client.status} · {responsibleName}
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Изменить
              </Button>
            </div>
          </SheetHeader>

          {/* Отчётность */}
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarCheck className="h-3.5 w-3.5" /> Отчётность
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight">
                  {state.dueDate ? fmtRu(state.dueDate) : "Не настроена"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{daysLeftLabel(state.daysLeft)}</p>
              </div>
              <StatusBadge label={REPORT_STATUS_LABEL[state.status]} tone={REPORT_STATUS_TONE[state.status]} />
            </div>
            {state.dueDate && (
              <Button
                className="mt-3 w-full"
                size="sm"
                onClick={() => markDone.mutate()}
                disabled={markDone.isPending}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Отметить отчёт выполненным
              </Button>
            )}
          </div>

          <Tabs defaultValue="info" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Информация</TabsTrigger>
              <TabsTrigger value="fin">Финансы</TabsTrigger>
              <TabsTrigger value="hist">История</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-3">
              <Row label="Телефон" value={client.phone} />
              <Row label="Email" value={client.email} />
              <Row label="Telegram" value={client.telegram} />
              <Row label="Юр. название" value={client.legal_name} />
              <Row label="ИНН" value={client.inn} />
              <Row label="КПП" value={client.kpp} />
              <Row label="ОГРН / ОГРНИП" value={client.ogrn} />
              <Row label="Юр. адрес" value={client.legal_address} />
              <Row label="Факт. адрес" value={client.actual_address} />
              <Row label="Расчётный счёт" value={client.account_number} />
              <Row label="Банк" value={client.bank_name} />
              <Row label="БИК" value={client.bik} />
              <Row label="Корр. счёт" value={client.correspondent_account} />
              <Row label="Прочее" value={client.other_requisites} />
              <Row label="Заметки" value={client.notes} />
            </TabsContent>

            <TabsContent value="fin" className="mt-3">
              <Row label="Выставлено" value={money(fin.billed)} />
              <Row label="Оплачено" value={money(fin.paid)} />
              <Row label="Задолженность" value={money(fin.debt)} />
              <Row label="Прямые расходы" value={money(fin.expenses)} />
              <Row label="Прибыль" value={money(fin.profit)} />
              <Row label="Маржинальность" value={`${fin.margin.toFixed(0)}%`} />
            </TabsContent>

            <TabsContent value="hist" className="mt-3">
              {history.length === 0 ? <EmptyState text="Отчётов пока нет" /> : (
                <TableWrap>
                  <thead>
                    <tr><Th>Период</Th><Th>Дата отчёта</Th><Th>Выполнен</Th><Th>Ответственный</Th></tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <Td>{new Date(h.period_year, h.period_month - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</Td>
                        <Td>{fmtRuShort(h.completed_at || h.due_date)}</Td>
                        <Td>{h.completed_at ? <span className="text-[hsl(var(--success))]">✓</span> : "—"}</Td>
                        <Td className="text-muted-foreground">
                          {responsibles.find((r) => r.id === h.responsible_id)?.full_name || "—"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client} />
    </>
  );
}
