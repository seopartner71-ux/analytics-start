import { ruError } from "@/lib/error-messages";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfYear } from "date-fns";
import { ru } from "date-fns/locale";
import { FileSpreadsheet, Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);

type Client = { id: string; name: string };
type Invoice = {
  invoice_number: string;
  client_id: string | null;
  client_name: string;
  service: string;
  amount: number;
  status: string;
  date_created: string;
  date_paid: string | null;
};

export function ReconciliationBlock() {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [from, setFrom] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: clients = [] } = useQuery({
    queryKey: ["recon-clients"],
    queryFn: async () => {
      // Берём всех клиентов, у которых есть счета
      const { data, error } = await supabase
        .from("invoices")
        .select("client_id, client_name")
        .order("client_name");
      if (error) throw error;
      const map = new Map<string, Client>();
      (data || []).forEach((r: any) => {
        const key = r.client_id || `name:${r.client_name}`;
        if (!map.has(key)) map.set(key, { id: key, name: r.client_name });
      });
      return Array.from(map.values());
    },
  });

  const generate = async () => {
    if (!clientId) {
      toast.error("Выберите клиента");
      return;
    }
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    const isUuid = !clientId.startsWith("name:");
    let q = supabase.from("invoices").select("*").gte("date_created", from).lte("date_created", to);
    q = isUuid ? q.eq("client_id", clientId) : q.eq("client_name", client.name);
    const { data: invs, error } = await q.order("date_created");
    if (error) {
      toast.error(ruError(error, "Не удалось загрузить данные"));
      return;
    }

    // Сальдо на начало периода: разница начислено vs оплачено до from
    let openingQ = supabase.from("invoices").select("amount, status, date_paid").lt("date_created", from);
    openingQ = isUuid ? openingQ.eq("client_id", clientId) : openingQ.eq("client_name", client.name);
    const { data: prev } = await openingQ;
    const opening = (prev || []).reduce((sum: number, r: any) => {
      const debit = Number(r.amount);
      const credit = r.status === "paid" && r.date_paid && r.date_paid < from ? Number(r.amount) : 0;
      return sum + debit - credit;
    }, 0);

    const html = renderReconciliationHtml({
      client: client.name,
      from, to,
      opening,
      invoices: (invs || []) as Invoice[],
    });
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Разрешите всплывающие окна");
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Акт сверки
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Сверка взаиморасчётов с клиентом за период
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Printer className="h-4 w-4 mr-1" /> Сгенерировать акт сверки
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Акт сверки взаиморасчётов</DialogTitle>
              <DialogDescription>
                Сальдо считается из начислений (счетов) и оплат за выбранный период.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Клиент</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Выберите клиента" /></SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground">Нет клиентов со счетами</div>
                    ) : clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Дата с</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Дата по</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button onClick={generate}>
                <Printer className="h-4 w-4 mr-1" /> Сформировать и распечатать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Откроется готовый акт в новом окне с возможностью печати или сохранения в PDF.
        </p>
      </CardContent>
    </Card>
  );
}

function renderReconciliationHtml(p: {
  client: string;
  from: string;
  to: string;
  opening: number;
  invoices: Invoice[];
}): string {
  const fmt = (d: string) => format(new Date(d), "dd.MM.yyyy", { locale: ru });
  const periodStr = `${fmt(p.from)} — ${fmt(p.to)}`;

  type Row = { date: string; doc: string; debit: number; credit: number };
  const rows: Row[] = [];
  for (const inv of p.invoices) {
    rows.push({
      date: inv.date_created,
      doc: `Счёт № ${inv.invoice_number}`,
      debit: Number(inv.amount),
      credit: 0,
    });
    if (inv.status === "paid" && inv.date_paid && inv.date_paid >= p.from && inv.date_paid <= p.to) {
      rows.push({
        date: inv.date_paid,
        doc: `Оплата счёта № ${inv.invoice_number}`,
        debit: 0,
        credit: Number(inv.amount),
      });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const closing = p.opening + totalDebit - totalCredit;

  const balanceLabel = (n: number) => n >= 0 ? `Долг клиента: ${RUB(n)}` : `Переплата клиента: ${RUB(-n)}`;

  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>Акт сверки · ${escapeHtml(p.client)}</title>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; max-width: 920px; margin: 32px auto; padding: 24px; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #d1d5db; padding: 8px 10px; }
  th { background: #f3f4f6; font-weight: 600; text-align: left; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.total td { font-weight: 700; background: #f9fafb; }
  tr.opening td, tr.closing td { background: #fef3c7; font-weight: 600; }
  .sig { margin-top: 60px; display: flex; justify-content: space-between; gap: 40px; }
  .sig div { flex: 1; border-top: 1px solid #111; padding-top: 6px; font-size: 12px; }
  @media print { body { margin: 0; padding: 16px; } }
</style></head>
<body>
  <h1>Акт сверки взаимных расчётов</h1>
  <div class="meta">Клиент: <b>${escapeHtml(p.client)}</b> · Период: <b>${periodStr}</b></div>

  <table>
    <thead>
      <tr>
        <th style="width:110px">Дата</th>
        <th>Документ</th>
        <th class="num" style="width:140px">Дебет (начислено)</th>
        <th class="num" style="width:140px">Кредит (оплачено)</th>
      </tr>
    </thead>
    <tbody>
      <tr class="opening">
        <td>${fmt(p.from)}</td>
        <td>Сальдо на начало периода</td>
        <td class="num">${p.opening > 0 ? RUB(p.opening) : "—"}</td>
        <td class="num">${p.opening < 0 ? RUB(-p.opening) : "—"}</td>
      </tr>
      ${rows.map((r) => `
        <tr>
          <td>${fmt(r.date)}</td>
          <td>${escapeHtml(r.doc)}</td>
          <td class="num">${r.debit ? RUB(r.debit) : "—"}</td>
          <td class="num">${r.credit ? RUB(r.credit) : "—"}</td>
        </tr>`).join("")}
      <tr class="total">
        <td colspan="2">Обороты за период</td>
        <td class="num">${RUB(totalDebit)}</td>
        <td class="num">${RUB(totalCredit)}</td>
      </tr>
      <tr class="closing">
        <td>${fmt(p.to)}</td>
        <td>Сальдо на конец периода — ${balanceLabel(closing)}</td>
        <td class="num">${closing > 0 ? RUB(closing) : "—"}</td>
        <td class="num">${closing < 0 ? RUB(-closing) : "—"}</td>
      </tr>
    </tbody>
  </table>

  <div class="sig">
    <div>Исполнитель / подпись, печать</div>
    <div>Заказчик / подпись, печать</div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
