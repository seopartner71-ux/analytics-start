import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Карта id партнёра → отображаемое имя (из профилей). */
export function usePartnerNames(): Record<string, string> {
  const { data } = useQuery({
    queryKey: ["partner-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data || []) {
        map[p.id] = (p.full_name as string) || (p.email as string) || "Партнёр";
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
  return data ?? {};
}
