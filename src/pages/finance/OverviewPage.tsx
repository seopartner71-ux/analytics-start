import { useMemo } from "react";
import { addDays, format, isAfter, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ArrowDownLeft, ArrowUpRight, CalendarClock, Landmark, PiggyBank, Wallet,
} from "lucide-react";

import { PeriodFilter } from "@/components/finance/PeriodFilter";
import { ClientReportsAttention } from "@/components/finance/ClientReportsAttention";
import { CashForecastChart } from "@/components/finance/CashForecastChart";
import { Delta, EmptyState, Panel, PageTitle, StatusBadge } from "@/components/finance/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancePeriod } from "@/contexts/FinancePeriodContext";
import { useFinancialEngine } from "@/hooks/useFinancialEngine";
import { usePartnerNames } from "@/hooks/usePartnerNames";
import { fmtPeriodLabel, money, pct } from "@/lib/finance";
import type { ForecastEvent } from "@/lib/forecast";

const KIND_LABEL: Record<ForecastEvent["kind"], string> = {
  invoice: "Поступление",
  obligation: "Обязательство",
  recurring: "Регулярный",
  tax: "Налог",
  partner: "Партнёры",
};

export default function OverviewPage() {
  const { period } = useFinancePeriod();
  const { snapshot: s, prevSnapshot: p, forecast, input, isLoading } = useFinancialEngine();
  const names = usePartnerNames();

  const next14 = useMemo(() => {
    const limit = addDays(startOfDay(new Date()), 14);
    return forecast.events.filter((e) => !isAfter(e.date, limit)).slice(0, 12);
  }, [forecast.events]);

  const partnerRows = useMemo(() => {
    const share = s.distributableProfit / 2;
    const ids = [input.settings.partner1Id, input.settings.partner2Id].filter(Boolean) as string[];
    const list = ids.length ? ids : s.partners.map((x) => x.partnerId);
    return list.map((id, i) => {
      const st = s.partners.find((x) => x.partnerId === id);
      return {
        id,
        name: names[id] || `Партнёр ${i + 1}`,
        toDistribute: share,
        accrued: st?.accrued ?? 0,
        paid: st?.paid ?? 0,
        unpaid: st?.unpaid ?? 0,
      };
    });
  }, [s, names, input.settings]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Финансовый обзор" subtitle="Cash Position не зависит от фильтра периода" />
        <PeriodFilter />
      </div>

      {/* ── CASH POSITION ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Panel padded={false} className="overflow-hidden">
          <div className="px-5 pb-4 pt-5">
            <p className="text-2xs uppercase tracking-[0.14em] text-muted-foreground">Денег сейчас</p>
            <p className="mt-1.5 text-[2.4rem] font-semibold leading-none tracking-tighter tabular-nums">
              {money(s.cashPosition)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              За период {fmtPeriodLabel(period)}:{" "}
              <span className="text-[hsl(var(--success))] tabular-nums">{money(s.cashIn, true)}</span>{" "}
              <span className="text-destructive tabular-nums">{money(-s.cashOut, true)}</span>{" "}
              <span className={`tabular-nums font-medium ${s.cashFlow < 0 ? "text-destructive" : "text-foreground"}`}>
                = {money(s.cashFlow, true)}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-border border-y border-border">
            <div className="px-5 py-3">
              <p className="text-2xs text-muted-foreground">Через 30 дней</p>
              <p className={`mt-0.5 text-lg font-semibold tabular-nums ${forecast.projected30 < 0 ? "text-destructive" : ""}`}>
                {money(forecast.projected30)}
              </p>
            </div>
            <div className="px-5 py-3">
              <p className="text-2xs text-muted-foreground">Через 90 дней</p>
              <p className={`mt-0.5 text-lg font-semibold tabular-nums ${forecast.projected90 < 0 ? "text-destructive" : ""}`}>
                {money(forecast.projected90)}
              </p>
            </div>
          </div>
          <ul className="divide-y divide-border/60">
            {input.accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-2.5">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {a.kind === "cash" ? <PiggyBank className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />}
                  {a.name}
                </span>
                <span className={`text-sm font-medium tabular-nums ${Number(a.balance) < 0 ? "text-destructive" : ""}`}>
                  {money(Number(a.balance))}
                </span>
              </li>
            ))}
            {input.accounts.length === 0 && <EmptyState text="Нет активных счетов" />}
          </ul>
        </Panel>

        <Panel
          title="Прогноз денег"
          subtitle={`Ожидается получить ${money(forecast.expectedReceipts30)} · выплатить ${money(forecast.expectedPayments30)} за 30 дней`}
          padded={false}
          actions={
            forecast.lowestPoint && forecast.lowestPoint.value < 0 ? (
              <StatusBadge label={`Минимум ${money(forecast.lowestPoint.value)}`} tone="danger" />
            ) : undefined
          }
        >
          <div className="p-2 pt-3">
            <CashForecastChart series={forecast.series} height={300} />
          </div>
        </Panel>
      </div>

      {/* ── PERFORMANCE ── */}
      <Panel title="Результат за период" subtitle={fmtPeriodLabel(period)} padded={false}>
        <div className="grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-4 md:divide-y-0">
          <PerfCell label="Выставлено (Revenue)" value={s.revenue} prev={p.revenue} hint="начисленный доход по счетам" />
          <PerfCell label="Получено (Received)" value={s.received} prev={p.received} hint="фактические деньги от клиентов" />
          <PerfCell label="Расходы" value={s.expenses} prev={p.expenses} invert hint="операционные расходы" />
          <PerfCell
            label="Прибыль"
            value={s.profit}
            prev={p.profit}
            hint={`денежная прибыль: ${money(s.cashProfit)} · налог ${money(s.periodTax)}`}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* ── DISTRIBUTABLE ── */}
        <Panel
          title="Доступно к распределению"
          subtitle={
            s.distributableLimitedBy === "cash"
              ? "Ограничено деньгами на счетах, а не прибылью"
              : "Ограничено накопленной прибылью"
          }
          padded={false}
        >
          <div className="px-5 pb-4 pt-5">
            <p className="text-[2rem] font-semibold leading-none tracking-tighter tabular-nums">
              {money(s.distributableProfit)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Накопленная нераспределённая прибыль: {money(s.retainedProfit)}
            </p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-border border-y border-border">
            {partnerRows.map((r) => (
              <div key={r.id} className="px-5 py-3">
                <p className="truncate text-2xs text-muted-foreground">{r.name} · 50%</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{money(r.toDistribute)}</p>
                <p className="mt-0.5 text-2xs text-muted-foreground">
                  начислено {money(r.accrued)} · к выплате {money(r.unpaid)}
                </p>
              </div>
            ))}
            {partnerRows.length === 0 && (
              <div className="col-span-2 px-5 py-4">
                <EmptyState text="Партнёры не настроены" />
              </div>
            )}
          </div>

          <ul className="divide-y divide-border/60 text-sm">
            {s.distributableBreakdown.map((b) => (
              <li key={b.label} className="flex items-center justify-between px-5 py-2">
                <span className="text-muted-foreground">{b.label}</span>
                <span className={`tabular-nums ${b.amount < 0 ? "text-destructive" : ""}`}>{money(b.amount)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Panel padded={false}>
              <div className="px-4 py-4">
                <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <ArrowDownLeft className="h-3.5 w-3.5 text-[hsl(var(--success))]" /> К получению
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{money(s.receivable)}</p>
                <p className="mt-0.5 text-2xs text-muted-foreground">
                  просрочено: {money(s.receivableOverdue)}
                </p>
              </div>
            </Panel>
            <Panel padded={false}>
              <div className="px-4 py-4">
                <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <ArrowUpRight className="h-3.5 w-3.5 text-destructive" /> К выплате
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{money(s.payable)}</p>
                <p className="mt-0.5 text-2xs text-muted-foreground">
                  30 дней: {money(s.payableDue30)}
                </p>
              </div>
            </Panel>
            <Panel padded={false}>
              <div className="px-4 py-4">
                <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" /> Налоговый резерв
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{money(s.taxReserve)}</p>
                <p className="mt-0.5 text-2xs text-muted-foreground">начислено {money(s.taxAccrued)}</p>
              </div>
            </Panel>
            <Panel padded={false}>
              <div className="px-4 py-4">
                <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" /> Долг клиентам
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{money(s.customerCredit)}</p>
                <p className="mt-0.5 text-2xs text-muted-foreground">авансы и переплаты</p>
              </div>
            </Panel>
          </div>

          <ClientReportsAttention />
        </div>
      </div>

      {/* ── NEXT 14 DAYS ── */}
      <Panel
        title={<span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" /> Ближайшие 14 дней</span>}
        subtitle="Финансовый календарь: поступления, выплаты, налоги, партнёры"
        padded={false}
      >
        {next14.length === 0 ? (
          <EmptyState text="Событий в ближайшие две недели нет" />
        ) : (
          <ul className="divide-y divide-border/60">
            {next14.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-16 shrink-0 text-2xs tabular-nums text-muted-foreground">
                    {format(e.date, "d MMM", { locale: ru })}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{e.title}</p>
                    {e.subtitle && <p className="truncate text-2xs text-muted-foreground">{e.subtitle}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge label={KIND_LABEL[e.kind]} tone={e.certain ? "neutral" : "warning"} />
                  <span className={`w-28 text-right text-sm font-medium tabular-nums ${e.amount < 0 ? "text-destructive" : "text-[hsl(var(--success))]"}`}>
                    {money(e.amount, true)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function PerfCell({
  label, value, prev, hint, invert,
}: { label: string; value: number; prev: number; hint?: string; invert?: boolean }) {
  return (
    <div className="px-4 py-4">
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums tracking-tight">{money(value)}</span>
        <Delta value={pct(value, prev)} invert={invert} />
      </div>
      {hint && <p className="mt-0.5 text-2xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}
