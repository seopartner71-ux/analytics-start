import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowRightLeft, PiggyBank, Wallet, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);

type Account = { id: string; name: string; kind: string; balance: number };
type Client = { id: string; name: string; short_name: string | null };
type CashTx = { id: string; amount: number; date: string; description: string | null; client_id: string | null };

export function CashTransferBlock() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [amount, setAmount] = useState("");

  // Пополнение кассы от клиента
  const [depositOpen, setDepositOpen] = useState(false);
  const [depAmount, setDepAmount] = useState("");
  const [depClientId, setDepClientId] = useState<string>("");
  const [depDate, setDepDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [depComment, setDepComment] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["fin-accounts-transfer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("id, name, kind, balance")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as Account[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["fin-clients-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_clients")
        .select("id, name, short_name")
        .order("name");
      if (error) throw error;
      return (data || []) as Client[];
    },
  });

  const cashAccount = accounts.find((a) => a.kind === "cash");

  const { data: cashTopups = [] } = useQuery({
    queryKey: ["fin-cash-topups", cashAccount?.id],
    enabled: !!cashAccount?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions" as any)
        .select("id, amount, date, description, client_id")
        .eq("account_id", cashAccount!.id)
        .eq("type", "income")
        .order("date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as CashTx[];
    },
  });

  const clientName = (id: string | null) => {
    const c = clients.find((x) => x.id === id);
    return c ? (c.short_name || c.name) : null;
  };

  const topupsTotal = useMemo(
    () => cashTopups.reduce((s, t) => s + Number(t.amount), 0),
    [cashTopups],
  );

  const reset = () => {
    setFromId("");
    setToId(cashAccount?.id || "");
    setAmount("");
  };

  const resetDeposit = () => {
    setDepAmount("");
    setDepClientId("");
    setDepDate(format(new Date(), "yyyy-MM-dd"));
    setDepComment("");
  };

  const invalidate = () => {
    ["fin-accounts", "fin-accounts-transfer", "fin-tx-year", "fin-account-cash",
      "fin-account-tochka", "fin-cash-topups", "fin-expenses-all", "fin"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }));
  };

  const transferMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Укажите сумму больше 0");
      if (!fromId || !toId) throw new Error("Выберите оба счёта");
      if (fromId === toId) throw new Error("Счета должны отличаться");
      const from = accounts.find((a) => a.id === fromId);
      if (!from) throw new Error("Счёт-источник не найден");
      if (Number(from.balance) < amt) throw new Error("Недостаточно средств на счёте-источнике");

      const today = format(new Date(), "yyyy-MM-dd");
      const to = accounts.find((a) => a.id === toId);
      const desc = `Перевод: ${from.name} → ${to?.name}`;

      const { error: e1 } = await supabase.from("transactions" as any).insert({
        account_id: fromId,
        type: "expense",
        amount: amt,
        date: today,
        category: "transfer_out",
        description: desc,
      });
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("transactions" as any).insert({
        account_id: toId,
        type: "income",
        amount: amt,
        date: today,
        category: "transfer_in",
        description: desc,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Перевод выполнен");
      invalidate();
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message || "Ошибка перевода"),
  });

  const depositMut = useMutation({
    mutationFn: async () => {
      const amt = Number(depAmount);
      if (!amt || amt <= 0) throw new Error("Укажите сумму больше 0");
      if (!cashAccount) throw new Error("Счёт «Касса» не найден");
      if (!depClientId) throw new Error("Выберите клиента, от которого поступила оплата");
      if (!depDate) throw new Error("Укажите дату оплаты");

      const name = clientName(depClientId);
      const { error } = await supabase.from("transactions" as any).insert({
        account_id: cashAccount.id,
        type: "income",
        amount: amt,
        date: depDate,
        category: "cash_topup",
        client_id: depClientId,
        description: depComment ? `Отчисление в кассу от ${name}: ${depComment}` : `Отчисление в кассу от ${name}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сумма внесена в Кассу");
      invalidate();
      setDepositOpen(false);
      resetDeposit();
    },
    onError: (e: any) => toast.error(e.message || "Ошибка внесения"),
  });

  const deleteTopupMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Поступление удалено");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Не удалось удалить"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" /> Касса и переводы
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Касса пополняется только вручную: отчислением от клиента или переводом со счёта
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={depositOpen} onOpenChange={(v) => { setDepositOpen(v); if (v) resetDeposit(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Внести в кассу</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Отчисление в Кассу</DialogTitle>
                <DialogDescription>Укажите сумму, клиента, от которого получена оплата, и дату.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Сумма, ₽</Label>
                    <Input type="number" min="0" step="1" value={depAmount}
                      onChange={(e) => setDepAmount(e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Дата оплаты</Label>
                    <Input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Клиент</Label>
                  <Select value={depClientId} onValueChange={setDepClientId}>
                    <SelectTrigger><SelectValue placeholder="Выберите клиента" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.short_name || c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {clients.length === 0 && (
                    <p className="text-xs text-muted-foreground">Сначала добавьте клиентов в разделе «Клиенты»</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Комментарий</Label>
                  <Textarea rows={2} value={depComment} onChange={(e) => setDepComment(e.target.value)}
                    placeholder="Например: наличные за август" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDepositOpen(false)}>Отмена</Button>
                <Button onClick={() => depositMut.mutate()} disabled={depositMut.isPending}>
                  {depositMut.isPending ? "Сохранение..." : "Внести"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><ArrowRightLeft className="h-4 w-4 mr-1" /> Сделать перевод</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Перевод между счетами</DialogTitle>
                <DialogDescription>Например, снятие наличных с банка в Кассу.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Откуда</Label>
                  <Select value={fromId} onValueChange={setFromId}>
                    <SelectTrigger><SelectValue placeholder="Выберите счёт" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} · {RUB(Number(a.balance))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Куда</Label>
                  <Select value={toId} onValueChange={setToId}>
                    <SelectTrigger><SelectValue placeholder="Выберите счёт" /></SelectTrigger>
                    <SelectContent>
                      {accounts.filter((a) => a.id !== fromId).map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Сумма, ₽</Label>
                  <Input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
                <Button onClick={() => transferMut.mutate()} disabled={transferMut.isPending}>
                  {transferMut.isPending ? "Перевод..." : "Перевести"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">
              <PiggyBank className="h-3.5 w-3.5" /> В Кассе сейчас
            </div>
            <div className="text-2xl font-bold">{RUB(Number(cashAccount?.balance || 0))}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">
              <Wallet className="h-3.5 w-3.5" /> Внесено в кассу (последние операции)
            </div>
            <div className="text-2xl font-bold">{RUB(topupsTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">Только ручные пополнения и переводы</p>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">История поступлений в Кассу</div>
          {cashTopups.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Поступлений пока нет</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left py-2 font-medium">Дата</th>
                    <th className="text-left py-2 font-medium">Клиент</th>
                    <th className="text-left py-2 font-medium">Комментарий</th>
                    <th className="text-right py-2 font-medium">Сумма</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {cashTopups.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 whitespace-nowrap">{format(new Date(t.date), "dd MMM yyyy", { locale: ru })}</td>
                      <td className="py-2.5">{clientName(t.client_id) || "—"}</td>
                      <td className="py-2.5 text-muted-foreground max-w-[280px] truncate">{t.description || "—"}</td>
                      <td className="py-2.5 text-right font-semibold text-emerald-500">+{RUB(Number(t.amount))}</td>
                      <td className="py-2.5 text-right">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { if (confirm("Удалить поступление? Баланс Кассы уменьшится.")) deleteTopupMut.mutate(t.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
