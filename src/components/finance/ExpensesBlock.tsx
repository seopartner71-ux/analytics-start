import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Trash2, Receipt } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);

const CATEGORIES = [
  { value: "salary", label: "ЗП" },
  { value: "services", label: "Сервисы" },
  { value: "tax", label: "Налоги" },
  { value: "office", label: "Офис" },
  { value: "other", label: "Прочее" },
] as const;

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

type Tx = {
  id: string;
  account_id: string;
  type: string;
  amount: number;
  date: string;
  category: string;
  description: string | null;
};

export function ExpensesBlock() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [category, setCategory] = useState<string>("services");
  const [description, setDescription] = useState("");

  const { data: cashAccount } = useQuery({
    queryKey: ["fin-account-cash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("id, name, balance")
        .eq("kind", "cash")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["fin-expenses-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions" as any)
        .select("id, account_id, type, amount, date, category, description")
        .eq("type", "expense")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as unknown as Tx[];
    },
  });

  const reset = () => {
    setAmount("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setCategory("services");
    setDescription("");
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Укажите сумму больше 0");
      if (!cashAccount) throw new Error("Не найден счёт «Касса»");

      const { error } = await supabase.from("transactions" as any).insert({
        account_id: cashAccount.id,
        type: "expense",
        amount: amt,
        date,
        category,
        description: description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Расход добавлен и списан с Кассы");
      qc.invalidateQueries({ queryKey: ["fin-expenses-recent"] });
      qc.invalidateQueries({ queryKey: ["fin-accounts"] });
      qc.invalidateQueries({ queryKey: ["fin-tx-year"] });
      qc.invalidateQueries({ queryKey: ["fin-account-cash"] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message || "Ошибка сохранения"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Расход удалён, баланс восстановлен");
      qc.invalidateQueries({ queryKey: ["fin-expenses-recent"] });
      qc.invalidateQueries({ queryKey: ["fin-accounts"] });
      qc.invalidateQueries({ queryKey: ["fin-tx-year"] });
      qc.invalidateQueries({ queryKey: ["fin-account-cash"] });
    },
    onError: (e: any) => toast.error(e.message || "Не удалось удалить"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Расходы
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Списываются с Кассы · текущий баланс: <span className="font-semibold text-foreground">{RUB(Number(cashAccount?.balance || 0))}</span>
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Добавить расход</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый расход</DialogTitle>
              <DialogDescription>Сумма будет списана со счёта «Касса».</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Сумма, ₽</Label>
                  <Input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Дата</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Категория</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Описание</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Например: оплата хостинга за месяц" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                {createMut.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Расходов пока нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground border-b">
                  <th className="text-left py-2 font-medium">Дата</th>
                  <th className="text-left py-2 font-medium">Категория</th>
                  <th className="text-left py-2 font-medium">Описание</th>
                  <th className="text-right py-2 font-medium">Сумма</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 whitespace-nowrap">{format(new Date(e.date), "dd MMM yyyy", { locale: ru })}</td>
                    <td className="py-2.5">
                      <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[e.category] || e.category}</Badge>
                    </td>
                    <td className="py-2.5 text-muted-foreground max-w-[280px] truncate">{e.description || "—"}</td>
                    <td className="py-2.5 text-right font-semibold text-red-500">−{RUB(Number(e.amount))}</td>
                    <td className="py-2.5 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          if (confirm("Удалить расход? Сумма вернётся на счёт Кассы.")) deleteMut.mutate(e.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
