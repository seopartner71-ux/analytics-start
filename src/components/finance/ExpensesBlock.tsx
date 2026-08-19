import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePartnerNames } from "@/hooks/usePartnerNames";
import { useFinanceSettings } from "@/hooks/useFinancialEngine";
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

// Человекочитаемые подписи для всех категорий, включая системные (триггеры/импорт)
const CATEGORY_LABEL: Record<string, string> = {
  ...Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])),
  cash_reserve: "Резерв 7% в Кассу",
  bank_expense: "Расход с банка",
  owner_withdrawal: "Вывод прибыли (на карту)",
  transfer_in: "Перевод (вход)",
  transfer_out: "Перевод (выход)",
  invoice: "Оплата по счёту",
};

// Цветовая схема badge по категории
const CATEGORY_TONE: Record<string, string> = {
  cash_reserve: "border-violet-500/40 text-violet-500 bg-violet-500/10",
  bank_expense: "border-red-500/40 text-red-500 bg-red-500/10",
  owner_withdrawal: "border-fuchsia-500/40 text-fuchsia-500 bg-fuchsia-500/10",
  transfer_in: "border-emerald-500/40 text-emerald-500 bg-emerald-500/10",
  transfer_out: "border-amber-500/40 text-amber-500 bg-amber-500/10",
  invoice: "border-emerald-500/40 text-emerald-500 bg-emerald-500/10",
  tax: "border-amber-500/40 text-amber-500 bg-amber-500/10",
  salary: "border-blue-500/40 text-blue-500 bg-blue-500/10",
  services: "border-sky-500/40 text-sky-500 bg-sky-500/10",
  office: "border-teal-500/40 text-teal-500 bg-teal-500/10",
  other: "border-muted-foreground/40 text-muted-foreground bg-muted/30",
};

type Tx = {
  id: string;
  account_id: string;
  type: string;
  amount: number;
  date: string;
  category: string;
  description: string | null;
  partner_id: string | null;
  service_name: string | null;
  paid_personally: boolean | null;
  reimbursed_at: string | null;
};

export function ExpensesBlock() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [category, setCategory] = useState<string>("services");
  const [source, setSource] = useState<"auto" | "cash" | "bank">("auto");
  const [partnerId, setPartnerId] = useState<string>("none");
  const [serviceName, setServiceName] = useState("");
  const [paidPersonally, setPaidPersonally] = useState(false);

  const [description, setDescription] = useState("");


  const { data: settings } = useFinanceSettings();
  const partnerNames = usePartnerNames();
  const partners = useMemo(
    () => [settings?.partner1Id, settings?.partner2Id].filter(Boolean) as string[],
    [settings?.partner1Id, settings?.partner2Id]
  );


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

  const { data: tochkaAccount } = useQuery({
    queryKey: ["fin-account-tochka"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("id, name, balance")
        .eq("kind", "bank")
        .ilike("name", "%Точка%")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(format(today, "yyyy-MM"));

  // Все расходы за последние 12 месяцев — для группировки и таблицы по выбранному месяцу
  const yearAgo = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 11, 1));
  const { data: allExpenses = [] } = useQuery({
    queryKey: ["fin-expenses-all", format(yearAgo, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions" as any)
        .select("id, account_id, type, amount, date, category, description, partner_id, service_name, paid_personally, reimbursed_at")
        .eq("type", "expense")
        .gte("date", format(yearAgo, "yyyy-MM-dd"))
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Tx[];
    },
  });

  // Итоги по месяцам
  const monthlyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      map.set(format(d, "yyyy-MM"), 0);
    }
    allExpenses.forEach((t) => {
      const key = t.date.slice(0, 7);
      if (map.has(key)) map.set(key, (map.get(key) || 0) + Number(t.amount));
    });
    return Array.from(map.entries())
      .map(([key, total]) => ({
        key,
        total,
        label: format(new Date(key + "-01"), "LLLL yyyy", { locale: ru }),
      }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [allExpenses, today]);

  // Операции выбранного месяца
  const expenses = useMemo(
    () => allExpenses.filter((t) => t.date.startsWith(selectedMonth)),
    [allExpenses, selectedMonth]
  );

  const monthTotal = useMemo(
    () => expenses.reduce((sum, t) => sum + Number(t.amount), 0),
    [expenses]
  );

  const selectedMonthLabel = useMemo(
    () => format(new Date(selectedMonth + "-01"), "LLLL yyyy", { locale: ru }),
    [selectedMonth]
  );


  // Разбивка расходов месяца по партнёрам и категориям
  const partnerBreakdown = useMemo(() => {
    const groups = new Map<string, { total: number; owed: number; reimbursed: number; byCategory: Map<string, number> }>();
    expenses.forEach((t) => {
      const key = t.partner_id || "none";
      if (!groups.has(key)) groups.set(key, { total: 0, owed: 0, reimbursed: 0, byCategory: new Map() });
      const g = groups.get(key)!;
      const amt = Number(t.amount);
      g.total += amt;
      if (t.paid_personally) {
        if (t.reimbursed_at) g.reimbursed += amt;
        else g.owed += amt;
      }
      g.byCategory.set(t.category, (g.byCategory.get(t.category) || 0) + amt);
    });
    return Array.from(groups.entries())
      .map(([id, g]) => ({
        id,
        name: id === "none" ? "Общие (без партнёра)" : partnerNames[id] || "Партнёр",
        total: g.total,
        owed: g.owed,
        reimbursed: g.reimbursed,
        share: monthTotal ? (g.total / monthTotal) * 100 : 0,
        categories: Array.from(g.byCategory.entries())
          .map(([code, amount]) => ({ code, amount }))
          .sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, monthTotal, partnerNames]);


  // Разбивка расходов месяца по сервисам
  const serviceBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((t) => {
      const key = (t.service_name || "").trim() || "Без сервиса";
      map.set(key, (map.get(key) || 0) + Number(t.amount));
    });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total, share: monthTotal ? (total / monthTotal) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, monthTotal]);

  // Подсказки по ранее введённым сервисам
  const serviceOptions = useMemo(
    () => Array.from(new Set(allExpenses.map((t) => (t.service_name || "").trim()).filter(Boolean))).sort(),
    [allExpenses]
  );

  const reset = () => {
    setAmount("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setCategory("services");
    setDescription("");
    setSource("auto");
    setPartnerId("none");
    setServiceName("");
    setPaidPersonally(false);
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Укажите сумму больше 0");
      if (!cashAccount && !tochkaAccount) throw new Error("Не найдены счета (Касса/Точка)");

      const kassaBalance = Number(cashAccount?.balance || 0);
      let useKassa: boolean;
      if (source === "cash") {
        if (!cashAccount) throw new Error("Счёт «Касса» не найден");
        if (kassaBalance < amt) throw new Error(`В Кассе только ${RUB(kassaBalance)} — списание невозможно`);
        useKassa = true;
      } else if (source === "bank") {
        useKassa = false;
      } else {
        useKassa = !!cashAccount && kassaBalance >= amt;
      }

      const targetAccountId = useKassa ? cashAccount!.id : tochkaAccount?.id;
      if (!targetAccountId) throw new Error("Не найден банк «Точка» для списания");

      const { error } = await supabase.from("transactions" as any).insert({
        account_id: targetAccountId,
        type: "expense",
        amount: amt,
        date,
        category,
        description: description || null,
        partner_id: partnerId === "none" ? null : partnerId,
        service_name: serviceName.trim() || null,
        paid_personally: partnerId !== "none" && paidPersonally,
      });
      if (error) throw error;
      return { useKassa };
    },

    onSuccess: ({ useKassa }) => {
      toast.success(useKassa ? "Расход списан с Кассы" : "Расход списан с банка «Точка»");

      qc.invalidateQueries({ queryKey: ["fin-expenses-all"] });
      qc.invalidateQueries({ queryKey: ["fin-expenses-all"] });
      qc.invalidateQueries({ queryKey: ["fin-accounts"] });
      qc.invalidateQueries({ queryKey: ["fin-tx-year"] });
      qc.invalidateQueries({ queryKey: ["fin-account-cash"] });
      qc.invalidateQueries({ queryKey: ["fin-account-tochka"] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message || "Ошибка сохранения"),
  });

  // Пометка «партнёру возмещено» / снять пометку
  const reimburseMut = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("transactions" as any)
        .update({ reimbursed_at: value ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.value ? "Отмечено: партнёру возмещено" : "Пометка снята — компания должна партнёру");
      qc.invalidateQueries({ queryKey: ["fin-expenses-all"] });
    },
    onError: (e: any) => toast.error(e.message || "Не удалось обновить"),
  });

  // Переключить «оплачено партнёром лично» у существующего расхода
  const personalMut = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("transactions" as any)
        .update({ paid_personally: value, reimbursed_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-expenses-all"] }),
    onError: (e: any) => toast.error(e.message || "Не удалось обновить"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Расход удалён, баланс восстановлен");
      qc.invalidateQueries({ queryKey: ["fin-expenses-all"] });
      qc.invalidateQueries({ queryKey: ["fin-expenses-all"] });
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
            Сначала с Кассы (<span className="font-semibold text-foreground">{RUB(Number(cashAccount?.balance || 0))}</span>), если не хватает — с банка «Точка» (<span className="font-semibold text-foreground">{RUB(Number(tochkaAccount?.balance || 0))}</span>)
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthlyTotals.map((m) => (
                  <SelectItem key={m.key} value={m.key} className="text-xs">
                    <span className="capitalize">{m.label}</span> — {RUB(m.total)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs">
              Итого за <span className="capitalize">{selectedMonthLabel}</span>:{" "}
              <span className="font-semibold text-red-500">{RUB(monthTotal)}</span>
            </span>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Добавить расход</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый расход</DialogTitle>
              <DialogDescription>Если в Кассе достаточно средств — спишется с неё, иначе с банка «Точка». Касса не уходит в минус.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <Label>Списать с</Label>
                <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Автоматически (сначала Касса)</SelectItem>
                    <SelectItem value="cash">Касса · {RUB(Number(cashAccount?.balance || 0))}</SelectItem>
                    <SelectItem value="bank">Банк «Точка» · {RUB(Number(tochkaAccount?.balance || 0))}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Партнёр</Label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Общий расход компании</SelectItem>
                    {partners.map((p) => (
                      <SelectItem key={p} value={p}>{partnerNames[p] || "Партнёр"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-2xs text-muted-foreground">Кто из партнёров инициировал расход — попадёт во вкладку «По партнёрам».</p>
              </div>

              {partnerId !== "none" && (
                <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-primary"
                    checked={paidPersonally}
                    onChange={(e) => setPaidPersonally(e.target.checked)}
                  />
                  <span>
                    <span className="text-sm font-medium">Оплачено партнёром лично</span>
                    <span className="block text-2xs text-muted-foreground">
                      Компания должна вернуть партнёру. Когда вернёте из кассы — отметьте «Возмещено» в списке.
                    </span>
                  </span>
                </label>
              )}




              <div className="space-y-1.5">
                <Label>Наименование сервиса</Label>
                <Input
                  list="expense-services"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Например: Topvisor, Ahrefs, Хостинг"
                />
                <datalist id="expense-services">
                  {serviceOptions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <p className="text-2xs text-muted-foreground">Нужно, чтобы видеть самые затратные сервисы во вкладке «По сервисам».</p>
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
        <Tabs defaultValue="list">
          <TabsList className="mb-3">
            <TabsTrigger value="list">Операции</TabsTrigger>
            <TabsTrigger value="partners">По партнёрам</TabsTrigger>
            <TabsTrigger value="services">По сервисам</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
        {expenses.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Расходов пока нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground border-b">
                  <th className="text-left py-2 font-medium">Дата</th>
                  <th className="text-left py-2 font-medium">Категория</th>
                  <th className="text-left py-2 font-medium">Сервис</th>
                  <th className="text-left py-2 font-medium">Партнёр</th>
                  <th className="text-left py-2 font-medium">Описание</th>
                  <th className="text-left py-2 font-medium">Возврат партнёру</th>
                  <th className="text-right py-2 font-medium">Сумма</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 whitespace-nowrap">{format(new Date(e.date), "dd MMM yyyy", { locale: ru })}</td>
                    <td className="py-2.5">
                      <Badge
                        variant="outline"
                        className={`text-2xs ${CATEGORY_TONE[e.category] || ""}`}
                      >
                        {CATEGORY_LABEL[e.category] || e.category}
                      </Badge>
                    </td>
                    <td className="py-2.5 whitespace-nowrap">{e.service_name || "—"}</td>
                    <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                      {e.partner_id ? (partnerNames[e.partner_id] || "Партнёр") : "Общий"}
                    </td>
                    <td className="py-2.5 text-muted-foreground max-w-[280px] truncate">{e.description || "—"}</td>
                    <td className="py-2.5 whitespace-nowrap">
                      {!e.partner_id ? (
                        <span className="text-2xs text-muted-foreground">—</span>
                      ) : !e.paid_personally ? (
                        <button
                          className="text-2xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                          onClick={() => personalMut.mutate({ id: e.id, value: true })}
                        >
                          Оплатил партнёр лично
                        </button>
                      ) : e.reimbursed_at ? (
                        <button
                          className="inline-flex items-center gap-1"
                          title="Снять пометку"
                          onClick={() => reimburseMut.mutate({ id: e.id, value: false })}
                        >
                          <Badge variant="outline" className="text-2xs border-emerald-500/40 text-emerald-500 bg-emerald-500/10">
                            Возмещено · {format(new Date(e.reimbursed_at), "dd.MM.yyyy")}
                          </Badge>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Badge variant="outline" className="text-2xs border-amber-500/40 text-amber-500 bg-amber-500/10">
                            Должны партнёру
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-2xs"
                            onClick={() => reimburseMut.mutate({ id: e.id, value: true })}
                          >
                            Возместил
                          </Button>
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 text-right font-semibold text-red-500">−{RUB(Number(e.amount))}</td>
                    <td className="py-2.5 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          if (confirm("Удалить расход? Сумма вернётся на счёт.")) deleteMut.mutate(e.id);
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
          </TabsContent>

          <TabsContent value="partners">
            {partnerBreakdown.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Расходов за месяц нет</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {partnerBreakdown.map((p) => (
                  <div key={p.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-right">
                        <div className="font-semibold text-red-500">{RUB(p.total)}</div>
                        <div className="text-2xs text-muted-foreground">{p.share.toFixed(0)}% расходов</div>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-red-500/70" style={{ width: `${Math.min(100, p.share)}%` }} />
                    </div>
                    <div className="space-y-1.5">
                      {p.categories.map((c) => (
                        <div key={c.code} className="flex items-center justify-between text-sm">
                          <Badge variant="outline" className={`text-2xs ${CATEGORY_TONE[c.code] || ""}`}>
                            {CATEGORY_LABEL[c.code] || c.code}
                          </Badge>
                          <span className="tabular-nums">{RUB(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="services">
            {serviceBreakdown.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Расходов за месяц нет</div>
            ) : (
              <div className="space-y-2.5">
                {serviceBreakdown.map((s) => (
                  <div key={s.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className={s.name === "Без сервиса" ? "text-muted-foreground" : "font-medium"}>{s.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-2xs text-muted-foreground">{s.share.toFixed(0)}%</span>
                        <span className="font-semibold text-red-500 tabular-nums">{RUB(s.total)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-red-500/70" style={{ width: `${Math.min(100, s.share)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

    </Card>
  );
}
