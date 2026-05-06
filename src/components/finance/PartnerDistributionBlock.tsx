import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ru } from "date-fns/locale";
import { Users, Calculator, Wallet, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);

const TAX_RATE = 0.07;

type Tx = { id: string; type: "income" | "expense" | "transfer"; amount: number; date: string; category: string };
type Profile = { user_id: string; full_name: string | null; email: string };

interface PartnersConfig {
  partner1_id?: string | null;
  partner2_id?: string | null;
  partner1_share?: number;
  partner2_share?: number;
}

export function PartnerDistributionBlock() {
  const qc = useQueryClient();
  const today = new Date();
  const period = format(today, "yyyy-MM");
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const { data: cfgRaw } = useQuery({
    queryKey: ["partners-config"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "partners_config").maybeSingle();
      return data?.value || null;
    },
  });
  const config: PartnersConfig = useMemo(() => {
    try { return cfgRaw ? JSON.parse(cfgRaw) : {}; } catch { return {}; }
  }, [cfgRaw]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["partners-profiles", config.partner1_id, config.partner2_id],
    queryFn: async () => {
      const ids = [config.partner1_id, config.partner2_id].filter(Boolean) as string[];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
      return (data ?? []) as Profile[];
    },
    enabled: !!(config.partner1_id || config.partner2_id),
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["partners-tx", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, type, amount, date, category")
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));
      return (data ?? []) as Tx[];
    },
  });

  const profit = useMemo(() => {
    const revenue = txs.filter(t => t.type === "income" && t.category !== "cash_reserve" && t.category !== "transfer_in")
      .reduce((s, t) => s + Number(t.amount), 0);
    const expenses = txs.filter(t => t.type === "expense" &&
      !["tax", "cash_reserve", "owner_withdrawal", "transfer_out"].includes(t.category))
      .reduce((s, t) => s + Number(t.amount), 0);
    const tax = revenue * TAX_RATE;
    return Math.round(revenue - tax - expenses);
  }, [txs]);

  const { data: dist } = useQuery({
    queryKey: ["partner-dist", period],
    queryFn: async () => {
      const { data } = await supabase.from("partner_distributions").select("*").eq("period", period).maybeSingle();
      return data;
    },
  });

  const share1 = config.partner1_share ?? 50;
  const share2 = config.partner2_share ?? 50;
  const amount1 = dist?.partner1_amount ?? Math.round((profit * share1) / 100);
  const amount2 = dist?.partner2_amount ?? Math.round((profit * share2) / 100);

  const profile1 = profiles.find(p => p.user_id === config.partner1_id);
  const profile2 = profiles.find(p => p.user_id === config.partner2_id);

  const calcMut = useMutation({
    mutationFn: async () => {
      const payload = {
        period,
        total_profit: profit,
        partner1_id: config.partner1_id ?? null,
        partner2_id: config.partner2_id ?? null,
        partner1_share: share1,
        partner2_share: share2,
        partner1_amount: Math.round((profit * share1) / 100),
        partner2_amount: Math.round((profit * share2) / 100),
      };
      const { error } = await supabase.from("partner_distributions").upsert(payload, { onConflict: "period" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Распределение рассчитано");
      qc.invalidateQueries({ queryKey: ["partner-dist", period] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const payMut = useMutation({
    mutationFn: async (which: 1 | 2) => {
      if (!dist) throw new Error("Сначала рассчитайте распределение");
      const profile = which === 1 ? profile1 : profile2;
      const amount = which === 1 ? Number(dist.partner1_amount) : Number(dist.partner2_amount);
      if (!amount || amount <= 0) throw new Error("Нет суммы для выплаты");
      const name = profile?.full_name || profile?.email || `Партнёр ${which}`;

      const { data: acc } = await supabase
        .from("financial_accounts")
        .select("id")
        .eq("kind", "bank")
        .eq("is_active", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      if (!acc?.id) throw new Error("Нет активного банковского счёта");

      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          account_id: acc.id,
          type: "expense",
          amount,
          date: format(new Date(), "yyyy-MM-dd"),
          category: "owner_withdrawal",
          description: `Выплата партнёру: ${name} (${period})`,
        })
        .select("id")
        .single();
      if (txErr) throw txErr;

      const update: any = which === 1
        ? { partner1_paid: true, partner1_paid_at: new Date().toISOString(), partner1_tx_id: tx.id }
        : { partner2_paid: true, partner2_paid_at: new Date().toISOString(), partner2_tx_id: tx.id };
      const { error: upErr } = await supabase.from("partner_distributions").update(update).eq("id", dist.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Выплата проведена");
      qc.invalidateQueries({ queryKey: ["partner-dist", period] });
      qc.invalidateQueries({ queryKey: ["fin-accounts"] });
      qc.invalidateQueries({ queryKey: ["fin-tx-year"] });
      qc.invalidateQueries({ queryKey: ["partners-tx", period] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const noConfig = !config.partner1_id && !config.partner2_id;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Раздел прибыли между партнёрами
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Период: {format(today, "LLLL yyyy", { locale: ru })} · Чистая прибыль: <span className="font-semibold text-foreground">{RUB(profit)}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {noConfig && (
          <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4">
            Партнёры не настроены. Перейдите в Админ-панель → Партнёры, чтобы выбрать участников распределения.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PartnerCard
            index={1}
            profile={profile1}
            share={share1}
            amount={amount1}
            paid={!!dist?.partner1_paid}
            paidAt={dist?.partner1_paid_at}
            disabled={!dist || !config.partner1_id || payMut.isPending}
            onPay={() => payMut.mutate(1)}
          />
          <PartnerCard
            index={2}
            profile={profile2}
            share={share2}
            amount={amount2}
            paid={!!dist?.partner2_paid}
            paidAt={dist?.partner2_paid_at}
            disabled={!dist || !config.partner2_id || payMut.isPending}
            onPay={() => payMut.mutate(2)}
          />
        </div>

        <Button onClick={() => calcMut.mutate()} disabled={calcMut.isPending} variant="outline" size="sm" className="gap-1.5">
          <Calculator className="h-4 w-4" />
          {dist ? "Пересчитать" : "Рассчитать"} за {format(today, "LLLL", { locale: ru })}
        </Button>
      </CardContent>
    </Card>
  );
}

function PartnerCard({
  index, profile, share, amount, paid, paidAt, disabled, onPay,
}: {
  index: number;
  profile?: Profile;
  share: number;
  amount: number;
  paid: boolean;
  paidAt?: string | null;
  disabled: boolean;
  onPay: () => void;
}) {
  const name = profile?.full_name || profile?.email || `Партнёр ${index}`;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Партнёр {index}</div>
        <Badge variant="outline" className="text-[10px]">{share}%</Badge>
      </div>
      <div className="font-semibold">{name}</div>
      <div className="text-2xl font-bold">{RUB(amount)}</div>
      {paid ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-500">
          <Check className="h-3.5 w-3.5" /> Выплачено{paidAt ? ` · ${format(new Date(paidAt), "dd.MM.yyyy")}` : ""}
        </div>
      ) : (
        <Button size="sm" onClick={onPay} disabled={disabled} className="gap-1.5">
          <Wallet className="h-4 w-4" /> Выплатить
        </Button>
      )}
    </div>
  );
}
