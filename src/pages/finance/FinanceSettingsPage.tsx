import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState, PageTitle, Panel, TableWrap, Td, Th } from "@/components/finance/primitives";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useExpenseCategories } from "@/hooks/useFinanceData";
import { money } from "@/lib/finance";

const slug = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-zа-я0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 40) || `cat_${Date.now()}`;

export default function FinanceSettingsPage() {
  const qc = useQueryClient();
  const { data: categories = [] } = useExpenseCategories();
  const { data: accounts = [] } = useAccounts();
  const [label, setLabel] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["fin-categories"] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expense_categories").insert({
        code: slug(label), label: label.trim(), sort_order: categories.length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Категория добавлена"); setLabel(""); refresh(); },
    onError: (e: any) => toast.error(e.message || "Не удалось добавить"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("expense_categories").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Удалено"); refresh(); },
    onError: (e: any) => toast.error("Категория используется в операциях"),
  });

  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <PageTitle title="Настройки финансов" subtitle="Категории расходов и счета компании" />

      <Panel
        title="Категории расходов"
        subtitle="Используются при добавлении расхода и в аналитике"
        padded={false}
        actions={
          <div className="flex items-center gap-2">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Новая категория"
              className="h-8 w-48 text-xs" />
            <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={!label.trim() || add.isPending}
              onClick={() => add.mutate()}>
              <Plus className="h-3.5 w-3.5" />Добавить
            </Button>
          </div>
        }
      >
        {categories.length === 0 ? <EmptyState text="Категорий нет" /> : (
          <TableWrap>
            <thead>
              <tr><Th>Название</Th><Th>Код</Th><Th align="right">Активна</Th><Th align="right"></Th></tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-muted/40">
                  <Td className="font-medium">{c.label}</Td>
                  <Td className="font-mono text-xs text-muted-foreground">{c.code}</Td>
                  <Td align="right">
                    <Switch checked={c.is_active} onCheckedChange={(v) => toggle.mutate({ id: c.id, is_active: v })} />
                  </Td>
                  <Td align="right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Счета" subtitle="Остатки обновляются автоматически по операциям" padded={false}>
        <TableWrap>
          <thead><tr><Th>Счёт</Th><Th>Тип</Th><Th align="right">Остаток</Th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-muted/40">
                <Td className="font-medium">{a.name}</Td>
                <Td className="text-muted-foreground">{a.kind === "cash" ? "Касса" : "Банк"}</Td>
                <Td align="right" className="font-medium">{money(Number(a.balance))}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Panel>
    </div>
  );
}
