import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { CashForecastChart } from "@/components/finance/CashForecastChart";
import {
  EmptyState, PageTitle, Panel, StatusBadge, TableWrap, Td, Th,
} from "@/components/finance/primitives";
import { Button } from "@/components/ui/button";
import { useFinancialEngine } from "@/hooks/useFinancialEngine";
import { money } from "@/lib/finance";
import type { ForecastEvent } from "@/lib/forecast";

const KIND_LABEL: Record<ForecastEvent["kind"], string> = {
  invoice: "Поступление",
  obligation: "Обязательство",
  recurring: "Регулярный",
  tax: "Налог",
  partner: "Партнёры",
};

const HORIZONS = [30, 90, 365] as const;

export default function ForecastPage() {
  const { snapshot, forecast } = useFinancialEngine();
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(90);

  const events = useMemo(() => {
    const limit = new Date();
    limit.setDate(limit.getDate() + horizon);
    return forecast.events.filter((e) => e.date <= limit);
  }, [forecast.events, horizon]);

  const receipts = events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const payments = events.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
  const projected = horizon === 30 ? forecast.projected30 : horizon === 90 ? forecast.projected90 : forecast.projected365;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Прогноз" subtitle="Планируемое движение денег по счетам, обязательствам и регулярным операциям" />
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {HORIZONS.map((h) => (
            <Button
              key={h}
              size="sm"
              variant={horizon === h ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setHorizon(h)}
            >
              {h} дней
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cell label="Денег сейчас" value={snapshot.cashPosition} />
        <Cell label={`Остаток через ${horizon} дней`} value={projected} danger={projected < 0} />
        <Cell label="Ожидаемые поступления" value={receipts} />
        <Cell label="Ожидаемые выплаты" value={payments} danger />
      </div>

      <Panel
        title="Кривая денег на 90 дней"
        subtitle={
          forecast.lowestPoint
            ? `Минимальная точка: ${money(forecast.lowestPoint.value)} — ${format(forecast.lowestPoint.date, "d MMMM", { locale: ru })}`
            : undefined
        }
        actions={
          forecast.lowestPoint && forecast.lowestPoint.value < 0
            ? <StatusBadge label="Кассовый разрыв" tone="danger" />
            : <StatusBadge label="Разрывов нет" tone="success" />
        }
        padded={false}
      >
        <div className="p-3">
          <CashForecastChart series={forecast.series} height={320} />
        </div>
      </Panel>

      <Panel title="План событий" subtitle={`${events.length} операций в горизонте ${horizon} дней`} padded={false}>
        {events.length === 0 ? (
          <EmptyState text="Плановых событий нет" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Дата</Th>
                <Th>Событие</Th>
                <Th>Тип</Th>
                <Th>Уверенность</Th>
                <Th align="right">Сумма</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-muted-foreground">{format(e.date, "d MMM yyyy", { locale: ru })}</Td>
                  <Td>
                    <p className="text-sm">{e.title}</p>
                    {e.subtitle && <p className="text-2xs text-muted-foreground">{e.subtitle}</p>}
                  </Td>
                  <Td><StatusBadge label={KIND_LABEL[e.kind]} /></Td>
                  <Td>
                    <StatusBadge label={e.certain ? "Подтверждено" : "Ожидание"} tone={e.certain ? "success" : "warning"} />
                  </Td>
                  <Td align="right" className={e.amount < 0 ? "text-destructive" : "text-[hsl(var(--success))]"}>
                    {money(e.amount, true)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}

function Cell({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <Panel padded={false}>
      <div className="px-4 py-4">
        <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-semibold tabular-nums ${danger ? "text-destructive" : ""}`}>{money(value)}</p>
      </div>
    </Panel>
  );
}
