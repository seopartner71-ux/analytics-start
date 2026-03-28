import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { subDays, subYears, differenceInDays } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
}

export type TrafficChannel = "all" | "organic" | "direct" | "referral" | "social" | "ad";

interface DateRangeContextType {
  range: DateRange;
  appliedRange: DateRange;
  showComparison: boolean;
  compRange: DateRange;
  appliedCompRange: DateRange;
  applyVersion: number;
  channel: TrafficChannel;
  setRange: (r: DateRange) => void;
  setCompRange: (r: DateRange) => void;
  setShowComparison: (v: boolean) => void;
  setChannel: (c: TrafficChannel) => void;
  apply: () => void;
  applyCompPreset: (type: "previous" | "lastYear") => void;
  resetToDefault: () => void;
}

const today = new Date();
const defaultRange: DateRange = { from: subDays(today, 30), to: today };
const defaultCompRange: DateRange = { from: subDays(today, 61), to: subDays(today, 31) };

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [appliedRange, setAppliedRange] = useState<DateRange>(defaultRange);
  const [showComparison, setShowComparison] = useState(false);
  const [compRange, setCompRange] = useState<DateRange>(defaultCompRange);
  const [appliedCompRange, setAppliedCompRange] = useState<DateRange>(defaultCompRange);
  const [applyVersion, setApplyVersion] = useState(0);
  const [channel, setChannel] = useState<TrafficChannel>("all");

  const apply = useCallback(() => {
    setAppliedRange({ ...range });
    if (showComparison) setAppliedCompRange({ ...compRange });
    setApplyVersion(v => v + 1);
  }, [range, compRange, showComparison]);

  const applyCompPreset = useCallback((type: "previous" | "lastYear") => {
    const days = differenceInDays(appliedRange.to, appliedRange.from);
    let nr: DateRange;
    if (type === "previous") {
      nr = { from: subDays(appliedRange.from, days + 1), to: subDays(appliedRange.from, 1) };
    } else {
      nr = { from: subYears(appliedRange.from, 1), to: subYears(appliedRange.to, 1) };
    }
    setCompRange(nr);
    setAppliedCompRange(nr);
  }, [appliedRange]);

  const resetToDefault = useCallback(() => {
    const now = new Date();
    const def: DateRange = { from: subDays(now, 30), to: now };
    setRange(def);
    setAppliedRange(def);
    setShowComparison(false);
    const defComp: DateRange = { from: subDays(now, 61), to: subDays(now, 31) };
    setCompRange(defComp);
    setAppliedCompRange(defComp);
    setChannel("all");
  }, []);

  return (
    <DateRangeContext.Provider value={{
      range, appliedRange, showComparison, compRange, appliedCompRange, applyVersion,
      channel, setChannel,
      setRange, setCompRange, setShowComparison,
      apply, applyCompPreset, resetToDefault,
    }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider");
  return ctx;
}
