import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, FileText, MoreHorizontal, Download, CheckCircle2, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);

type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string | null;
  client_name: string;
  service: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "cancelled";
  date_created: string;
  date_paid: string | null;
  paid_to_account_id: string | null;
};

type Client = { id: string; name: string };
type Account = { id: string; name: string; kind: string };

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  sent: "Ожидает оплаты",
  paid: "Оплачен",
  cancelled: "Отменён",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  paid: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function InvoicesBlock() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<Invoice | null>(null);
  const [payAccount, setPayAccount] = useState<string>("");

  // Форма
  const [clientId, setClientId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [service, setService] = useState(`SEO-продвижение за ${format(new Date(), "LLLL yyyy", { locale: ru })}`);
  const [amount, setAmount] = useState("");

  const { data: invoices = [] } = useQuery({
    queryKey: ["fin-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("date_created", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["fin-clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data || []) as Client[];
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["fin-bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("id, name, kind")
        .eq("is_active", true)
        .eq("kind", "bank")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as Account[];
    },
  });

  const reset = () => {
    setClientId("");
    setClientName("");
    setService(`SEO-продвижение за ${format(new Date(), "LLLL yyyy", { locale: ru })}`);
    setAmount("");
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Укажите сумму");
      if (!clientName.trim()) throw new Error("Укажите клиента");
      const number = `СЧ-${format(new Date(), "yyyyMMdd-HHmmss")}`;
      const { error } = await supabase.from("invoices").insert({
        invoice_number: number,
        client_id: clientId || null,
        client_name: clientName,
        service,
        amount: amt,
        status: "sent",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Счёт создан");
      qc.invalidateQueries({ queryKey: ["fin-invoices"] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message || "Ошибка"),
  });

  const markPaidMut = useMutation({
    mutationFn: async () => {
      if (!payOpen) return;
      if (!payAccount) throw new Error("Выберите счёт зачисления");
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_to_account_id: payAccount, date_paid: format(new Date(), "yyyy-MM-dd") })
        .eq("id", payOpen.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Счёт оплачен, транзакция создана");
      qc.invalidateQueries({ queryKey: ["fin-invoices"] });
      qc.invalidateQueries({ queryKey: ["fin-accounts"] });
      qc.invalidateQueries({ queryKey: ["fin-tx-year"] });
      setPayOpen(null);
      setPayAccount("");
    },
    onError: (e: any) => toast.error(e.message || "Ошибка"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Счёт удалён");
      qc.invalidateQueries({ queryKey: ["fin-invoices"] });
    },
    onError: (e: any) => toast.error(e.message || "Ошибка"),
  });

  const downloadDoc = (inv: Invoice, kind: "invoice" | "act") => {
    const html = renderDocumentHtml(inv, kind);
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Разрешите всплывающие окна");
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Счета клиентам
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              При оплате автоматически создаётся приходная транзакция
            </p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Создать счёт</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый счёт</DialogTitle>
                <DialogDescription>Будет создан со статусом «Ожидает оплаты».</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Клиент</Label>
                  {clients.length > 0 ? (
                    <Select
                      value={clientId}
                      onValueChange={(v) => {
                        setClientId(v);
                        const c = clients.find((x) => x.id === v);
                        if (c) setClientName(c.name);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Выберите клиента" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Input
                    placeholder="Или введите название вручную"
                    value={clientName}
                    onChange={(e) => { setClientName(e.target.value); setClientId(""); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Услуга</Label>
                  <Input value={service} onChange={(e) => setService(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Сумма по договору, ₽</Label>
                  <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                  {createMut.isPending ? "Создание..." : "Создать"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Счетов пока нет</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left py-2 font-medium">№</th>
                    <th className="text-left py-2 font-medium">Дата</th>
                    <th className="text-left py-2 font-medium">Клиент</th>
                    <th className="text-left py-2 font-medium">Услуга</th>
                    <th className="text-right py-2 font-medium">Сумма</th>
                    <th className="text-left py-2 font-medium pl-3">Статус</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="py-2.5 whitespace-nowrap">{format(new Date(inv.date_created), "dd MMM yyyy", { locale: ru })}</td>
                      <td className="py-2.5">{inv.client_name}</td>
                      <td className="py-2.5 text-muted-foreground max-w-[260px] truncate">{inv.service}</td>
                      <td className="py-2.5 text-right font-semibold">{RUB(Number(inv.amount))}</td>
                      <td className="py-2.5 pl-3">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[inv.status]}`}>
                          {STATUS_LABEL[inv.status]}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => downloadDoc(inv, "invoice")}>
                              <Download className="h-3.5 w-3.5 mr-2" /> Скачать счёт (PDF)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadDoc(inv, "act")}>
                              <Download className="h-3.5 w-3.5 mr-2" /> Скачать акт (PDF)
                            </DropdownMenuItem>
                            {inv.status !== "paid" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setPayOpen(inv); setPayAccount(bankAccounts[0]?.id || ""); }}>
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Отметить как оплачен
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-500 focus:text-red-500"
                              onClick={() => { if (confirm("Удалить счёт?")) deleteMut.mutate(inv.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог: оплата */}
      <Dialog open={!!payOpen} onOpenChange={(v) => { if (!v) { setPayOpen(null); setPayAccount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отметить счёт как оплаченный</DialogTitle>
            <DialogDescription>
              {payOpen && <>Счёт <b>{payOpen.invoice_number}</b> на сумму <b>{RUB(Number(payOpen.amount))}</b></>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Счёт зачисления</Label>
            <Select value={payAccount} onValueChange={setPayAccount}>
              <SelectTrigger><SelectValue placeholder="Выберите банк" /></SelectTrigger>
              <SelectContent>
                {bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Сумма будет автоматически зачислена на выбранный счёт.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(null)}>Отмена</Button>
            <Button onClick={() => markPaidMut.mutate()} disabled={markPaidMut.isPending || !payAccount}>
              {markPaidMut.isPending ? "Сохранение..." : "Подтвердить оплату"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function renderDocumentHtml(inv: Invoice, kind: "invoice" | "act"): string {
  const title = kind === "invoice"
    ? `Счёт на оплату № ${inv.invoice_number}`
    : `Акт выполненных работ № ${inv.invoice_number}`;
  const dateStr = format(new Date(inv.date_created), "d MMMM yyyy 'г.'", { locale: ru });
  const amountStr = RUB(Number(inv.amount));
  const intro = kind === "invoice"
    ? "Внимание! Оплата данного счёта означает согласие с условиями договора."
    : "Указанные ниже работы выполнены полностью и в срок. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.";

  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; max-width: 760px; margin: 32px auto; padding: 24px; font-size: 14px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  .right { text-align: right; }
  .total { font-size: 16px; font-weight: 700; margin-top: 16px; }
  .meta { color: #6b7280; font-size: 13px; }
  .sig { margin-top: 60px; display: flex; justify-content: space-between; gap: 40px; }
  .sig div { flex: 1; border-top: 1px solid #111; padding-top: 6px; font-size: 12px; }
  @media print { body { margin: 0; padding: 16px; } }
</style></head>
<body>
  <h1>${title}</h1>
  <div class="meta">от ${dateStr}</div>

  <h2>Заказчик</h2>
  <div>${escapeHtml(inv.client_name)}</div>

  <h2>${kind === "invoice" ? "К оплате" : "Выполненные работы"}</h2>
  <table>
    <thead><tr><th>№</th><th>Наименование</th><th class="right">Сумма, ₽</th></tr></thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>${escapeHtml(inv.service)}</td>
        <td class="right">${amountStr}</td>
      </tr>
    </tbody>
  </table>

  <p class="total right">Итого: ${amountStr}</p>
  <p class="meta">${intro}</p>

  <div class="sig">
    <div>Исполнитель / подпись</div>
    <div>Заказчик / подпись</div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
