import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, PageTitle, Panel, StatusBadge, TableWrap, Td, Th } from "@/components/finance/primitives";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialEngine } from "@/hooks/useFinancialEngine";
import { usePartnerNames } from "@/hooks/usePartnerNames";
import { money } from "@/lib/finance";

export default function PartnersPage() {
  const qc = useQueryClient();
  const { snapshot: s, input } = useFinancialEngine();
  const names = usePartnerNames();
  const [payout, setPayout] = useState<{ partnerId: string; name: string; max: number } | null>(null);
  const [form, setForm] = useState({ amount: "", accountId: "" });
  const [distOpen, setDistOpen] = useState(false);
  const [dist, setDist] = useState({ base: "", reserve: true, pct: "6", fromId: "" });

  const cashAccount = input.accounts.find((a) => (a as { kind?: string }).kind === "cash");
  const bankAccounts = input.accounts.filter((a) => a.id !== cashAccount?.id);

  const partnerIds = useMemo(() => {
    const ids = [input.settings.partner1Id, input.settings.partner2Id].filter(Boolean) as string[];
    return ids.length ? ids : s.partners.map((p) => p.partnerId);
  }, [input.settings, s.partners]);

  const openDistribute = () => {
    setDist({
      base: String(Math.round(s.distributableProfit)),
      reserve: true,
      pct: "6",
      fromId: bankAccounts[0]?.id ?? input.accounts[0]?.id ?? "",
    });
    setDistOpen(true);
  };

  const distBase = Number(dist.base) || 0;
  const distReserve = dist.reserve ? Math.round(distBase * ((Number(dist.pct) || 0) / 100)) : 0;
  const distToPartners = Math.max(0, distBase - distReserve);

  const rows = partnerIds.map((id, i) => {
    const st = s.partners.find((p) => p.partnerId === id);
    return {
      id,
      name: names[id] || `Партнёр ${i + 1}`,
      accrued: st?.accrued ?? 0,
      paid: st?.paid ?? 0,
      unpaid: st?.unpaid ?? 0,
      share: s.distributableProfit / 2,
    };
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["fin"] });
  };

  const distribute = useMutation({
    mutationFn: async () => {
      if (partnerIds.length !== 2) throw new Error("Партнёры не настроены");
      if (distBase <= 0) throw new Error("Укажите сумму к распределению");
      if (distBase > s.distributableProfit + 0.01) throw new Error("Сумма больше доступной к распределению");
      const today = format(new Date(), "yyyy-MM-dd");
      const period = format(new Date(), "yyyy-MM");

      if (distReserve > 0) {
        if (!cashAccount) throw new Error("Счёт «Касса» не найден");
        if (!dist.fromId) throw new Error("Выберите счёт списания для резерва");
        const from = input.accounts.find((a) => a.id === dist.fromId);
        if (!from) throw new Error("Счёт списания не найден");
        if (Number(from.balance) < distReserve) throw new Error("Недостаточно средств на счёте списания");
        const desc = `Резерв в кассу ${dist.pct}% при распределении прибыли`;
        const { error: e1 } = await supabase.from("transactions").insert({
          account_id: dist.fromId, type: "expense", amount: distReserve,
          date: today, category: "transfer_out", description: desc,
        });
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("transactions").insert({
          account_id: cashAccount.id, type: "income", amount: distReserve,
          date: today, category: "transfer_in", description: desc,
        });
        if (e2) throw e2;
      }

      const each = Math.round((distToPartners / 2) * 100) / 100;
      if (each <= 0) throw new Error("Нечего распределять партнёрам");
      const { error } = await supabase.from("partner_ledger").insert(
        partnerIds.map((pid) => ({
          partner_id: pid,
          entry_type: "accrual" as const,
          amount: each,
          period,
          entry_date: today,

        })),
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Прибыль начислена партнёрам 50/50"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (!payout) return;
      const amount = Number(form.amount);
      if (!amount || amount <= 0) throw new Error("Укажите сумму");
      if (amount > payout.max + 0.01) throw new Error("Сумма больше начисленного остатка");
      if (!form.accountId) throw new Error("Выберите счёт");
      const date = format(new Date(), "yyyy-MM-dd");
      const { error: txErr } = await supabase.from("transactions").insert({
        type: "expense",
        amount,
        date,
        account_id: form.accountId,
        category: "partner_payout",
        description: `Выплата партнёру: ${payout.name}`,
      });
      if (txErr) throw txErr;
      const { error } = await supabase.from("partner_ledger").insert({
        partner_id: payout.partnerId,
        entry_type: "payout" as const,
        amount,
        period: format(new Date(), "yyyy-MM"),
        entry_date: date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Выплата проведена");
      setPayout(null);
      setForm({ amount: "", accountId: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const history = [...input.partnerLedger]
    .filter((e) => !e.reversed_at)
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
    .slice(0, 50);

  const firstDate = useMemo(() => {
    const dates = input.transactions.map((t) => t.date).filter(Boolean).sort();
    return dates[0] ? format(new Date(dates[0]), "d MMM yyyy", { locale: ru }) : null;
  }, [input.transactions]);

  const cashLimit = s.distributableBreakdown.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Партнёры" subtitle="Распределение чистой прибыли 50/50, начисления и выплаты" />
        <Button size="sm" disabled={s.distributableProfit <= 0 || distribute.isPending} onClick={() => distribute.mutate()}>
          Начислить {money(s.distributableProfit)}
        </Button>
      </div>

      <Panel
        title="Доступно к распределению"
        subtitle={`Нарастающим итогом за всё время${firstDate ? ` — с ${firstDate}` : ""} по сегодня. Фильтр периода здесь не применяется`}
        padded={false}
      >
        <div className="px-5 pb-4 pt-5">
          <p className="text-[2rem] font-semibold leading-none tracking-tighter tabular-nums">{money(s.distributableProfit)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Минимум из двух границ:{" "}
            <span className={s.distributableLimitedBy === "profit" ? "font-medium text-foreground" : ""}>
              прибыль {money(s.retainedProfit)}
            </span>{" "}
            и{" "}
            <span className={s.distributableLimitedBy === "cash" ? "font-medium text-foreground" : ""}>
              свободные деньги {money(cashLimit)}
            </span>
            . По {money(s.distributableProfit / 2)} каждому партнёру.
          </p>
        </div>
        <ul className="divide-y divide-border/60 border-t border-border text-sm">
          <li className="flex items-center justify-between px-5 py-2">
            <span className="text-muted-foreground">Накопленная прибыль за всё время</span>
            <span className="tabular-nums">{money(s.retainedProfit + s.partnerAccrued)}</span>
          </li>
          <li className="flex items-center justify-between px-5 py-2">
            <span className="text-muted-foreground">Уже начислено партнёрам за всё время</span>
            <span className={`tabular-nums ${s.partnerAccrued ? "text-destructive" : ""}`}>{money(-s.partnerAccrued)}</span>
          </li>
          <li className="flex items-center justify-between border-b border-border px-5 py-2 font-medium">
            <span>Нераспределённая прибыль</span>
            <span className="tabular-nums">{money(s.retainedProfit)}</span>
          </li>
          {s.distributableBreakdown.map((b) => (
            <li key={b.label} className="flex items-center justify-between px-5 py-2">
              <span className="text-muted-foreground">{b.label}</span>
              <span className={`tabular-nums ${b.amount < 0 ? "text-destructive" : ""}`}>{money(b.amount)}</span>
            </li>
          ))}
          <li className="flex items-center justify-between border-t border-border px-5 py-2 font-medium">
            <span>Свободные деньги</span>
            <span className="tabular-nums">{money(cashLimit)}</span>
          </li>
        </ul>
      </Panel>


      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <Panel key={r.id} padded={false}>
            <div className="flex items-start justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-2xs text-muted-foreground">Доля 50%</p>
              </div>
              <StatusBadge label={r.unpaid > 0 ? "Есть невыплаченное" : "Выплачено"} tone={r.unpaid > 0 ? "warning" : "success"} />
            </div>
            <div className="grid grid-cols-3 divide-x divide-border border-y border-border text-center">
              <Stat label="начислено" value={r.accrued} />
              <Stat label="выплачено" value={r.paid} />
              <Stat label="к выплате" value={r.unpaid} />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="text-2xs text-muted-foreground">Доступно сейчас: {money(r.share)}</span>
              <Button
                size="sm" variant="outline" disabled={r.unpaid <= 0}
                onClick={() => { setPayout({ partnerId: r.id, name: r.name, max: r.unpaid }); setForm({ amount: String(r.unpaid), accountId: input.accounts[0]?.id ?? "" }); }}
              >
                Выплатить
              </Button>
            </div>
          </Panel>
        ))}
        {rows.length === 0 && (
          <Panel className="md:col-span-2"><EmptyState text="Партнёры не настроены в разделе «Настройки финансов»" /></Panel>
        )}
      </div>

      <Panel title="История начислений и выплат" padded={false}>
        {history.length === 0 ? (
          <EmptyState text="Операций пока нет" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Дата</Th><Th>Партнёр</Th><Th>Тип</Th><Th>Период</Th><Th align="right">Сумма</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(e.entry_date), "d MMM yyyy", { locale: ru })}
                  </Td>
                  <Td>{names[e.partner_id] || "Партнёр"}</Td>
                  <Td>
                    <StatusBadge
                      label={e.entry_type === "accrual" ? "Начисление" : "Выплата"}
                      tone={e.entry_type === "accrual" ? "neutral" : "success"}
                    />
                  </Td>
                  <Td className="text-muted-foreground">{e.period || "—"}</Td>
                  <Td align="right">{money(Number(e.amount))}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Dialog open={!!payout} onOpenChange={(v) => !v && setPayout(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Выплата: {payout?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Сумма (максимум {money(payout?.max ?? 0)})</Label>
              <Input
                type="number" value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Счёт списания</Label>
              <Select value={form.accountId} onValueChange={(v) => setForm((f) => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Выберите счёт" /></SelectTrigger>
                <SelectContent>
                  {input.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} — {money(Number(a.balance))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayout(null)}>Отмена</Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending}>Провести</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="py-2.5">
      <p className="text-sm font-semibold tabular-nums">{money(value)}</p>
      <p className="text-2xs text-muted-foreground">{label}</p>
    </div>
  );
}
