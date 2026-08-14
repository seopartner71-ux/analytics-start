import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useFinancePeriod } from "@/contexts/FinancePeriodContext";
import { PERIOD_LABELS, fmtPeriodLabel, type PeriodKey } from "@/lib/finance";

const KEYS: PeriodKey[] = ["today", "week", "month", "quarter", "half", "year"];

export function PeriodFilter() {
  const { periodKey, period, setPeriodKey, setCustom } = useFinancePeriod();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({ from: period.from, to: period.to });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setPeriodKey(k)}
            className={cn(
              "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
              periodKey === k
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PERIOD_LABELS[k]}
          </button>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-[30px] gap-1.5 text-xs font-normal", periodKey === "custom" && "border-foreground/30")}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {periodKey === "custom" ? fmtPeriodLabel(period) : "Произвольный"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            locale={ru}
            defaultMonth={period.from}
            selected={range as any}
            onSelect={(r: any) => {
              setRange(r || {});
              if (r?.from && r?.to) {
                setCustom({ from: r.from, to: r.to });
                setOpen(false);
              }
            }}
            numberOfMonths={2}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
