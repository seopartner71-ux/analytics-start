import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FinClient {
  id: string;
  name: string;
  client_type: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  website: string | null;
  responsible_id: string | null;
  status: string;
  notes: string | null;
  legal_name: string | null;
  short_name: string | null;
  management_name: string | null;
  org_status: string | null;
  okved: string | null;
  okved_name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  legal_address: string | null;
  actual_address: string | null;
  account_number: string | null;
  bank_name: string | null;
  bik: string | null;
  correspondent_account: string | null;
  other_requisites: string | null;
  report_day: number | null;
  report_enabled: boolean;
  last_report_date: string | null;
}

export interface ReportHistoryRow {
  id: string;
  client_id: string;
  period_year: number;
  period_month: number;
  due_date: string;
  completed_at: string | null;
  completed_by: string | null;
  responsible_id: string | null;
  note: string | null;
}

export interface ReportSettings {
  id: string;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  email_enabled: boolean;
  email_to: string | null;
  email_from: string | null;
  warn_days: number;
}

export function useClients() {
  return useQuery({
    queryKey: ["fin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_clients")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as FinClient[];
    },
  });
}

export function useResponsibles() {
  return useQuery({
    queryKey: ["fin-responsibles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .is("archived_at", null)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useReportHistory(clientId?: string) {
  return useQuery({
    queryKey: ["client-report-history", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("client_report_history").select("*").order("due_date", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ReportHistoryRow[];
    },
  });
}

export function useReportSettings() {
  return useQuery({
    queryKey: ["client-report-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_report_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data || null) as unknown as ReportSettings | null;
    },
  });
}
