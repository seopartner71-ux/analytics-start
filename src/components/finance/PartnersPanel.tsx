import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Panel, Th, Td, TableWrap } from "@/components/finance/primitives";
import { money, TAX_RATE } from "@/lib/finance";
import { useTransactions, isOpex } from "@/hooks/useFinanceData";

type Distribution = {
  id: string; period: string; total_profit: number;
  partner1_amount: number; partner2_amount: number;
  partner1_share: number; partner2_share: number;
  partner1_paid: boolean; partner2_paid: boolean;
  partner1_id: string | null; partner2_id: string | null;
};

export function usePartnerSummary() {
  const { data: txs = [] } = useTransactions();
  const { data: distributions = [] } = useQuery({
    queryKey: ["fin-distributions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partner_distributions").select("*").order("period", { ascending: false });
      if (error) throw error;
      return (data || []) as Distribution[];
    },
  });
  const { data: cfgRaw } = useQuery({
    queryKey: ["partners-config"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "partners_config").maybeSingle();
      return data?.value || null;
    },
  });
  const config = useMemo(() => {
    try { return cfgRaw ? JSON.parse(cfgRaw) : {}; } catch { return {}; }
  }, [cfgRaw]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["partners-profiles", config.partner1_id, config.partner2_id],
    enabled: !!(config.partner1_id || config.partner2_id),
    queryFn: async () => {
      const ids = [config.partner1_id, config.partner2_id].filter(Boolean) as string[];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
      return data || [];
    },
  });

  return useMemo(() => {
    const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const opex = txs.filter(isOpex).reduce((s, t) => s + Number(t.amount), 0);
    const totalNet = income - opex - income * TAX_RATE;

    const distributed = distributions.reduce((s, d) => s + Number(d.partner1_amount) + Number(d.partner2_amount), 0);
    const paid1 = distributions.filter((d) => d.partner1_paid).reduce((s, d) => s + Number(d.partner1_amount), 0);
    const paid2 = distributions.filter((d) => d.partner2_paid).reduce((s, d) => s + Number(d.partner2_amount), 0);
    const alloc1 = distributions.reduce((s, d) => s + Number(d.partner1_amount), 0);
    const alloc2 = distributions.reduce((s, d) => s + Number(d.partner2_amount), 0);

    const nameOf = (id?: string | null, fallback = "Партнёр") => {
      const p = profiles.find((x: any) => x.user_id === id);
      return p?.full_name || p?.email || fallback;
    };

    return {
      totalNet,
      distributed,
      undistributed: totalNet - distributed,
      remainingToPay: distributed - paid1 - paid2,
      distributions,
      partners: [
        { name: nameOf(config.partner1_id, "Партнёр 1"), share: 50, allocated: alloc1, paid: paid1 },
        { name: nameOf(config.partner2_id, "Партнёр 2"), share: 50, allocated: alloc2, paid: paid2 },
      ],
    };
  }, [txs, distributions, profiles, config]);
}

export function PartnersPanel() {
  const s = usePartnerSummary();
  return (
    <Panel
      title="Распределение прибыли"
      subtitle="Чистая прибыль делится между двумя партнёрами 50 / 50"
      padded={false}
    >
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border md:grid-cols-4">
        <Stat label="Чистая прибыль (всего)" value={s.totalNet} />
        <Stat label="Распределено" value={s.distributed} />
        <Stat label="Нераспределённая прибыль" value={s.undistributed} strong />
        <Stat label="Осталось выплатить" value={s.remainingToPay} />
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Партнёр</Th>
            <Th align="right">Доля</Th>
            <Th align="right">К распределению</Th>
            <Th align="right">Выплачено</Th>
            <Th align="right">Остаток</Th>
          </tr>
        </thead>
        <tbody>
          {s.partners.map((p) => (
            <tr key={p.name} className="transition-colors hover:bg-muted/40">
              <Td>{p.name}</Td>
              <Td align="right">{p.share}%</Td>
              <Td align="right">{money(p.allocated)}</Td>
              <Td align="right" className="text-muted-foreground">{money(p.paid)}</Td>
              <Td align="right" className="font-medium">{money(p.allocated - p.paid)}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </Panel>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="px-4 py-3">
      <div className={`tabular-nums tracking-tight ${strong ? "text-xl font-semibold" : "text-lg font-medium"}`}>
        {money(value)}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
