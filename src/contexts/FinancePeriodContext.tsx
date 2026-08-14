import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { periodFor, previousPeriod, type Period, type PeriodKey } from "@/lib/finance";

interface Ctx {
  periodKey: PeriodKey;
  period: Period;
  prev: Period;
  setPeriodKey: (k: PeriodKey) => void;
  setCustom: (p: Period) => void;
}

const FinancePeriodContext = createContext<Ctx | undefined>(undefined);

const STORAGE_KEY = "fin-period-key";

export function FinancePeriodProvider({ children }: { children: ReactNode }) {
  const [periodKey, setKey] = useState<PeriodKey>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return (saved as PeriodKey) || "month";
  });
  const [custom, setCustomState] = useState<Period>(() => periodFor("month"));

  const setPeriodKey = useCallback((k: PeriodKey) => {
    setKey(k);
    localStorage.setItem(STORAGE_KEY, k);
  }, []);

  const setCustom = useCallback((p: Period) => {
    setCustomState(p);
    setKey("custom");
    localStorage.setItem(STORAGE_KEY, "custom");
  }, []);

  const period = useMemo(() => (periodKey === "custom" ? custom : periodFor(periodKey)), [periodKey, custom]);
  const prev = useMemo(() => previousPeriod(period), [period]);

  return (
    <FinancePeriodContext.Provider value={{ periodKey, period, prev, setPeriodKey, setCustom }}>
      {children}
    </FinancePeriodContext.Provider>
  );
}

export function useFinancePeriod() {
  const ctx = useContext(FinancePeriodContext);
  if (!ctx) throw new Error("useFinancePeriod must be used within FinancePeriodProvider");
  return ctx;
}
