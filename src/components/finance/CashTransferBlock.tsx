import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRightLeft, PiggyBank, AlertCircle } from "lucide-react";

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

const CASH_RATE = 0.07;

type Account = { id: string; name: string; kind: string; balance: number };

export function CashTransferBlock() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [amount, setAmount] = useState("");

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

  // Считаем «долг банков перед Кассой»: 7% от всей выручки минус то, что уже физически в Кассе
  const { data: incomeTotal = 0 } = useQuery({
    queryKey: ["fin-income-total"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions" as any)
        .select("amount")
        .eq("type", "income");
      if (error) throw error;
      return (data || []).reduce((s: number, r: any) => s + Number(r.amount), 0);
    },
  });

  const cashAccount = accounts.find((a) => a.kind === "cash");
  const cashDebt = useMemo(() => {
    const reserved = incomeTotal * CASH_RATE;
    const inCash = Number(cashAccount?.balance || 0);
    return Math.max(0, reserved - inCash);
  }, [incomeTotal, cashAccount]);

  const reset = () => {
    setFromId("");
    setToId(cashAccount?.id || "");
    setAmount("");
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

      // Списание со счёта-источника
      const { error: e1 } = await supabase.from("transactions" as any).insert({
        account_id: fromId,
        type: "expense",
        amount: amt,
        date: today,
        category: "transfer_out",
        description: desc,
      });
      if (e1) throw e1;

      // Зачисление на счёт-получатель
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
      qc.invalidateQueries({ queryKey: ["fin-accounts"] });
      qc.invalidateQueries({ queryKey: ["fin-accounts-transfer"] });
      qc.invalidateQueries({ queryKey: ["fin-tx-year"] });
      qc.invalidateQueries({ queryKey: ["fin-account-cash"] });
      qc.invalidateQueries({ queryKey: ["fin-income-total"] });
      qc.invalidateQueries({ queryKey: ["fin-expenses-recent"] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message || "Ошибка перевода"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" /> Касса и переводы
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Перемещайте деньги между банковскими счетами и Кассой
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><ArrowRightLeft className="h-4 w-4 mr-1" /> Сделать перевод</Button>
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
                {cashDebt > 0 && toId === cashAccount?.id && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setAmount(String(Math.round(cashDebt)))}
                  >
                    Подставить долг банков перед Кассой: {RUB(cashDebt)}
                  </button>
                )}
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
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">
              <PiggyBank className="h-3.5 w-3.5" /> В Кассе сейчас
            </div>
            <div className="text-2xl font-bold">{RUB(Number(cashAccount?.balance || 0))}</div>
          </div>
          <div className={`rounded-lg border p-4 ${cashDebt > 0 ? "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/30" : "bg-muted/30"}`}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">
              <AlertCircle className="h-3.5 w-3.5" /> Долг банков перед Кассой (7%)
            </div>
            <div className="text-2xl font-bold">{RUB(cashDebt)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {cashDebt > 0
                ? "Снимите с банка и переведите в Кассу"
                : "Касса в балансе"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
