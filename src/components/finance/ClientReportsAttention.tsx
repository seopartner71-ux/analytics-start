import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Panel, StatusBadge } from "@/components/finance/primitives";
import { ClientCardSheet } from "@/components/finance/ClientCardSheet";
import { useClients, useReportSettings } from "@/hooks/useClientReports";
import type { FinClient } from "@/hooks/useClientReports";
import {
  REPORT_STATUS_LABEL, REPORT_STATUS_TONE, computeReportState, daysLeftLabel, fmtRuShort,
} from "@/lib/clientReports";

/** Блок «Требует внимания» — отчётность клиентов на главном дашборде. */
export function ClientReportsAttention() {
  const { data: clients = [] } = useClients();
  const { data: settings } = useReportSettings();
  const warnDays = settings?.warn_days ?? 3;
  const [active, setActive] = useState<FinClient | null>(null);

  const items = useMemo(() => clients
    .filter((c) => c.report_enabled && c.report_day && c.status === "active")
    .map((c) => ({ c, s: computeReportState(c.report_day, c.last_report_date, new Date(), warnDays) }))
    .filter(({ s }) => s.status === "overdue" || s.status === "today" || s.status === "soon")
    .sort((a, b) => (a.s.daysLeft ?? 0) - (b.s.daysLeft ?? 0)),
  [clients, warnDays]);

  const overdue = items.filter((i) => i.s.status === "overdue").length;
  const today = items.filter((i) => i.s.status === "today").length;
  const soon = items.filter((i) => i.s.status === "soon").length;

  return (
    <>
      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <AlertTriangle className={items.length ? "h-4 w-4 text-destructive" : "h-4 w-4 text-muted-foreground"} />
            Отчётность клиентов
          </span>
        }
        subtitle={items.length ? `Требует внимания: ${items.length}` : "Всё под контролем"}
        padded={false}
        className={overdue ? "border-destructive/40" : undefined}
      >
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
          <div className="py-2.5">
            <p className="text-lg font-semibold tabular-nums text-destructive">{overdue}</p>
            <p className="text-2xs text-muted-foreground">просрочено</p>
          </div>
          <div className="py-2.5">
            <p className="text-lg font-semibold tabular-nums">{today}</p>
            <p className="text-2xs text-muted-foreground">сегодня</p>
          </div>
          <div className="py-2.5">
            <p className="text-lg font-semibold tabular-nums text-muted-foreground">{soon}</p>
            <p className="text-2xs text-muted-foreground">ближайшие</p>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">Нет ближайших отчётов</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.slice(0, 6).map(({ c, s }) => (
              <li key={c.id}>
                <button
                  onClick={() => setActive(c)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-2xs text-muted-foreground">
                      {fmtRuShort(s.dueDate)} · {daysLeftLabel(s.daysLeft)}
                    </p>
                  </div>
                  <StatusBadge label={REPORT_STATUS_LABEL[s.status]} tone={REPORT_STATUS_TONE[s.status]} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ClientCardSheet
        client={active}
        open={!!active}
        onOpenChange={(v) => !v && setActive(null)}
        warnDays={warnDays}
      />
    </>
  );
}
