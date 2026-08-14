/**
 * Единая точка доступа к финансовым данным и показателям.
 * Компоненты обязаны использовать её, а не считать формулы самостоятельно.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFinancePeriod } from "@/contexts/FinancePeriodContext";
import { previousPeriod, type Period } from "@/lib/finance";
import {
  computeFinancials, DEFAULT_SETTINGS,
  type Account, type CustomerCredit, type EngineInput, type EngineSettings,
  type FinancialPeriod, type FinancialSnapshot, type Invoice, type InvoicePayment,
  type Obligation, type PartnerLedgerEntry, type RecurringOccurrence, type RecurringOperation,
  type TaxLiability, type Tx,
} from "@/lib/financialEngine";
import { buildForecast, type ForecastResult } from "@/lib/forecast";

const table = <T,>(name: string, query: (q: any) => any = (q) => q) => ({
  queryKey: ["fin", name],
  queryFn: async () => {
    const { data, error } = await query(supabase.from(name as never).select("*"));
    if (error) throw error;
    return (data || []) as T[];
  },
});

export function useFinanceSettings() {
  return useQuery({
    queryKey: ["fin", "settings"],
    queryFn: async (): Promise<EngineSettings> => {
      const { data } = await supabase.from("app_settings").select("key, value");
      const map = new Map((data || []).map((r) => [r.key, r.value]));
      const parse = (k: string, fallback: number) => {
        const v = map.get(k);
        const n = Number(v);
        return v != null && isFinite(n) ? n : fallback;
      };
      let partners: Record<string, unknown> = {};
      try { partners = JSON.parse(map.get("partners_config") || "{}") || {}; } catch { partners = {}; }
      return {
        taxRate: parse("tax_rate", DEFAULT_SETTINGS.taxRate),
        safetyBuffer: parse("safety_buffer", 0),
        partner1Id: (partners.partner1_id as string) || null,
        partner2Id: (partners.partner2_id as string) || null,
        partner1Share: Number(partners.partner1_share) || 50,
        partner2Share: Number(partners.partner2_share) || 50,
      };
    },
  });
}

export function useFinanceRaw() {
  const accounts = useQuery(table<Account>("financial_accounts", (q) => q.eq("is_active", true)));
  const transactions = useQuery(table<Tx>("transactions"));
  const invoices = useQuery(table<Invoice>("invoices"));
  const invoicePayments = useQuery(table<InvoicePayment>("invoice_payments"));
  const obligations = useQuery(table<Obligation>("financial_obligations"));
  const customerCredits = useQuery(table<CustomerCredit>("customer_credit"));
  const taxes = useQuery(table<TaxLiability>("tax_liability"));
  const partnerLedger = useQuery(table<PartnerLedgerEntry>("partner_ledger"));
  const periods = useQuery(table<FinancialPeriod>("financial_periods"));
  const recurring = useQuery(table<RecurringOperation>("recurring_operations"));
  const occurrences = useQuery(table<RecurringOccurrence>("recurring_occurrences"));
  const settings = useFinanceSettings();

  const queries = [accounts, transactions, invoices, invoicePayments, obligations,
    customerCredits, taxes, partnerLedger, periods, recurring, occurrences, settings];

  return {
    accounts: accounts.data ?? [],
    transactions: transactions.data ?? [],
    invoices: invoices.data ?? [],
    invoicePayments: invoicePayments.data ?? [],
    obligations: obligations.data ?? [],
    customerCredits: customerCredits.data ?? [],
    taxes: taxes.data ?? [],
    partnerLedger: partnerLedger.data ?? [],
    periods: periods.data ?? [],
    recurring: recurring.data ?? [],
    occurrences: occurrences.data ?? [],
    settings: settings.data ?? DEFAULT_SETTINGS,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  };
}

export interface EngineResult {
  snapshot: FinancialSnapshot;
  prevSnapshot: FinancialSnapshot;
  forecast: ForecastResult;
  input: EngineInput;
  isLoading: boolean;
  isError: boolean;
}

export function useFinancialEngine(periodOverride?: Period): EngineResult {
  const { period: ctxPeriod } = useFinancePeriod();
  const period = periodOverride ?? ctxPeriod;
  const raw = useFinanceRaw();

  return useMemo(() => {
    const input: EngineInput = { period, ...raw } as EngineInput;
    const snapshot = computeFinancials(input);
    const forecast = buildForecast(input, snapshot);
    snapshot.forecast30 = forecast.projected30;
    snapshot.forecast90 = forecast.projected90;
    snapshot.forecast365 = forecast.projected365;

    const prevInput: EngineInput = { ...input, period: previousPeriod(period) };
    const prevSnapshot = computeFinancials(prevInput);

    return { snapshot, prevSnapshot, forecast, input, isLoading: raw.isLoading, isError: raw.isError };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, raw.accounts, raw.transactions, raw.invoices, raw.invoicePayments, raw.obligations,
      raw.customerCredits, raw.taxes, raw.partnerLedger, raw.periods, raw.recurring,
      raw.occurrences, raw.settings, raw.isLoading, raw.isError]);
}
