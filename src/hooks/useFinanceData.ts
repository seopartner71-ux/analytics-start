import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  INVOICE_TERM_DAYS, NON_OPEX_CATEGORIES, TAX_RATE, buildBuckets, inPeriod, type Period,
} from "@/lib/finance";

export type Account = { id: string; name: string; kind: string; balance: number; currency: string; is_active: boolean };
export type Tx = {
  id: string; account_id: string | null; type: "income" | "expense" | "transfer";
  amount: number; date: string; category: string | null; description: string | null;
  client_id: string | null; invoice_id: string | null;
};
export type Invoice = {
  id: string; invoice_number: string; client_id: string | null; client_name: string;
  service: string | null; amount: number; status: string; date_created: string; date_paid: string | null;
  comment: string | null; paid_to_account_id: string | null;
};
export type Obligation = {
  id: string; title: string; category: string | null; counterparty: string | null;
  amount: number; due_date: string | null; status: string; comment: string | null; paid_at: string | null;
};
export type Category = { id: string; code: string; label: string; sort_order: number; is_active: boolean };

export function useAccounts() {
  return useQuery({
    queryKey: ["fin-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_accounts").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return (data || []) as Account[];
    },
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ["fin-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, account_id, type, amount, date, category, description, client_id, invoice_id")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as Tx[];
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ["fin-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, client_id, client_name, service, amount, status, date_created, date_paid, comment, paid_to_account_id")
        .order("date_created", { ascending: false });
      if (error) throw error;
      return (data || []) as Invoice[];
    },
  });
}

export function useObligations() {
  return useQuery({
    queryKey: ["fin-obligations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_obligations").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return (data || []) as Obligation[];
    },
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ["fin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories").select("*").order("sort_order");
      if (error) throw error;
      return (data || []) as Category[];
    },
  });
}

export function useCategoryLabels() {
  const { data: cats = [] } = useExpenseCategories();
  return useMemo(() => {
    const map: Record<string, string> = { invoice: "Оплата счёта", transfer: "Перевод", cash_reserve: "Резерв в кассу", owner_withdrawal: "Выплата партнёру" };
    cats.forEach((c) => { map[c.code] = c.label; });
    return map;
  }, [cats]);
}

/** Дебиторка по счёту: остаток и просрочка. */
export function invoiceReceivable(inv: Invoice) {
  const dueDate = addDays(new Date(inv.date_created), INVOICE_TERM_DAYS);
  const outstanding = inv.status === "paid" || inv.status === "cancelled" ? 0 : Number(inv.amount);
  const overdueDays = outstanding > 0 ? differenceInCalendarDays(new Date(), dueDate) : 0;
  return { dueDate, outstanding, overdueDays: Math.max(0, overdueDays) };
}

export const isOpex = (t: Tx) => t.type === "expense" && !NON_OPEX_CATEGORIES.includes(t.category || "");

export interface FinanceMetrics {
  cashNow: number;
  income: number;
  expenses: number;
  taxReserve: number;
  netProfit: number;
  receivable: number;
  payable: number;
  freeCash: number;
  forecast: number;
}

export function computeMetrics(
  period: Period,
  txs: Tx[],
  accounts: Account[],
  invoices: Invoice[],
  obligations: Obligation[],
): FinanceMetrics {
  const income = txs.filter((t) => t.type === "income" && inPeriod(t.date, period))
    .reduce((s, t) => s + Number(t.amount), 0);
  const expenses = txs.filter((t) => isOpex(t) && inPeriod(t.date, period))
    .reduce((s, t) => s + Number(t.amount), 0);
  const taxReserve = income * TAX_RATE;
  const netProfit = income - expenses - taxReserve;
  const cashNow = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const receivable = invoices.reduce((s, i) => s + invoiceReceivable(i).outstanding, 0);
  const payable = obligations.filter((o) => o.status !== "paid" && o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.amount), 0);
  const freeCash = cashNow - payable;
  return { cashNow, income, expenses, taxReserve, netProfit, receivable, payable, freeCash, forecast: freeCash + receivable };
}

export function buildCashSeries(period: Period, txs: Tx[]) {
  return buildBuckets(period).map((b) => {
    const bucket: Period = { from: b.from, to: b.to };
    const income = txs.filter((t) => t.type === "income" && inPeriod(t.date, bucket))
      .reduce((s, t) => s + Number(t.amount), 0);
    const expenses = txs.filter((t) => isOpex(t) && inPeriod(t.date, bucket))
      .reduce((s, t) => s + Number(t.amount), 0);
    return {
      label: b.label,
      Доход: Math.round(income),
      Расход: Math.round(expenses),
      Прибыль: Math.round(income - expenses - income * TAX_RATE),
    };
  });
}

export function expenseByCategory(period: Period, txs: Tx[], prev: Period) {
  const sum = (p: Period) => {
    const map: Record<string, number> = {};
    txs.filter((t) => isOpex(t) && inPeriod(t.date, p)).forEach((t) => {
      const key = t.category || "other";
      map[key] = (map[key] || 0) + Number(t.amount);
    });
    return map;
  };
  const cur = sum(period);
  const before = sum(prev);
  const total = Object.values(cur).reduce((s, v) => s + v, 0);
  return Object.entries(cur)
    .map(([code, amount]) => ({
      code, amount,
      share: total ? (amount / total) * 100 : 0,
      prev: before[code] || 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}
