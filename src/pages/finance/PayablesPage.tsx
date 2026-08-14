import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

import { EmptyState, Metric, PageTitle, Panel, StatusBadge, TableWrap, Td, Th } from "@/components/finance/primitives";
import { supabase } from "@/integrations/supabase/client";
import { useExpenseCategories, useObligations } from "@/hooks/useFinanceData";
import { fmtDate, money } from "@/lib/finance";

export default function PayablesPage() {
  const qc = useQueryClient();
  const { data: obligations = [] } = useObligations();
  const { data: categories = [] } = useExpenseCategories();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", counterparty: "", category: "services", amount: "",
    due_date: format(new Date(), "yyyy-MM-dd"), comment: "",
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["fin-obligations"] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("financial_obligations").insert({
        title: form.title.trim(),
        counterparty: form.counterparty.trim() || null,
        category: form.category,
        amount: Number(form.amount),
        due_date: form.due_date || null,
        comment: form.comment.trim() || null,
        status: "planned",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Обязательство добавлено");
      setOpen(false);
      setForm({ title: "", counterparty: "", category: "services", amount: "", due_date: format(new Date(), "yyyy-MM-dd"), comment: "" });
      refresh();
    },
    onError: (e: any) => toast.error(e.message || "Не удалось сохранить"),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_obligations")
        .update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Отмечено оплаченным"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_obligations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Удалено"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const open_ = obligations.filter((o) => o.status !== "paid" && o.status !== "cancelled");
  const total = open_.reduce((s, o) => s + Number(o.amount), 0);
  const overdue = open_.filter((o) => o.due_date && new Date(o.due_date) < new Date());
  const catLabel = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => { m[c.code] = c.label; });
    return m;
  }, [categories]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageTitle
        title="К выплате"
        subtitle="Плановые обязательства компании: подрядчики, зарплаты, налоги, сервисы"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" />Добавить</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Новое обязательство</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label className="text-xs">Назначение</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Например: Зарплата за март" /></div>
                <div><Label className="text-xs">Контрагент</Label>
                  <Input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Категория</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Сумма, ₽</Label>
                    <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                </div>
                <div><Label className="text-xs">Срок оплаты</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                <div><Label className="text-xs">Комментарий</Label>
                  <Textarea rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => create.mutate()}
                  disabled={!form.title.trim() || !Number(form.amount) || create.isPending}
                >
                  Сохранить
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-3">
        <Metric label="Всего к выплате" value={-total} tone="negative" />
        <Metric label="Просрочено" value={-overdue.reduce((s, o) => s + Number(o.amount), 0)} tone={overdue.length ? "negative" : "muted"} />
        <Metric label="Открытых обязательств" value={open_.length} tone="muted" />
      </div>

      <Panel title="Обязательства" padded={false}>
        {obligations.length === 0 ? <EmptyState text="Обязательств нет" /> : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Назначение</Th><Th>Контрагент</Th><Th>Категория</Th><Th>Срок</Th>
                <Th>Статус</Th><Th align="right">Сумма</Th><Th align="right"></Th>
              </tr>
            </thead>
            <tbody>
              {obligations.map((o) => {
                const isOverdue = o.status !== "paid" && o.due_date && new Date(o.due_date) < new Date();
                return (
                  <tr key={o.id} className="transition-colors hover:bg-muted/40">
                    <Td className="font-medium">{o.title}</Td>
                    <Td className="text-muted-foreground">{o.counterparty || "—"}</Td>
                    <Td className="text-muted-foreground">{catLabel[o.category || ""] || o.category || "—"}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(o.due_date)}</Td>
                    <Td>
                      <StatusBadge
                        label={o.status === "paid" ? "Оплачено" : isOverdue ? "Просрочено" : "Запланировано"}
                        tone={o.status === "paid" ? "success" : isOverdue ? "danger" : "neutral"}
                      />
                    </Td>
                    <Td align="right" className="font-medium">{money(Number(o.amount))}</Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        {o.status !== "paid" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markPaid.mutate(o.id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => remove.mutate(o.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
