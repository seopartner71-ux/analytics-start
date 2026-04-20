// Daily check: notify finance users about payments due in 3 and 7 days, plus overdue
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    const in3 = new Date(today); in3.setDate(in3.getDate() + 3);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Find payments due in 3 or 7 days, or overdue, that aren't fully paid
    const { data: payments } = await supabase
      .from("financial_payments")
      .select("id, client_name, contract_amount, paid_amount, next_payment_date, status")
      .in("status", ["pending", "partial", "overdue"])
      .lte("next_payment_date", fmt(in7))
      .not("next_payment_date", "is", null);

    if (!payments?.length) {
      return new Response(JSON.stringify({ ok: true, count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users with finance access (admin or finance_access=true)
    const { data: financeUsers } = await supabase.rpc("get_finance_users" as any).maybeSingle().then(
      async () => {
        // fallback: query directly
        const [{ data: admins }, { data: profs }] = await Promise.all([
          supabase.from("user_roles").select("user_id").eq("role", "admin"),
          supabase.from("profiles").select("user_id").eq("finance_access", true),
        ]);
        const ids = new Set<string>();
        admins?.forEach((r: any) => ids.add(r.user_id));
        profs?.forEach((r: any) => ids.add(r.user_id));
        return { data: Array.from(ids).map((user_id) => ({ user_id })) };
      },
    );

    const userIds: string[] = (financeUsers as any)?.map((u: any) => u.user_id) || [];
    if (!userIds.length) {
      return new Response(JSON.stringify({ ok: true, count: 0, reason: "no finance users" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RUB = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
    const notifications: any[] = [];

    for (const p of payments) {
      const due = new Date(p.next_payment_date as string);
      const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
      const remaining = Number(p.contract_amount) - Number(p.paid_amount);
      if (remaining <= 0) continue;

      let title = "";
      let body = "";
      if (diffDays < 0) {
        title = `⚠️ Просрочен платёж: ${p.client_name}`;
        body = `Просрочка ${Math.abs(diffDays)} дн. Сумма: ${RUB(remaining)} ₽`;
      } else if (diffDays === 3) {
        title = `🔔 Платёж через 3 дня: ${p.client_name}`;
        body = `Срок: ${p.next_payment_date}. Сумма: ${RUB(remaining)} ₽`;
      } else if (diffDays === 7) {
        title = `📅 Платёж через 7 дней: ${p.client_name}`;
        body = `Срок: ${p.next_payment_date}. Сумма: ${RUB(remaining)} ₽`;
      } else {
        continue;
      }

      // Skip duplicates already created today
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("title", title)
        .gte("created_at", fmt(today))
        .limit(1);
      if (existing?.length) continue;

      for (const uid of userIds) {
        notifications.push({
          user_id: uid,
          title,
          body,
          project_id: "00000000-0000-0000-0000-000000000000",
        });
      }
    }

    if (notifications.length) {
      await supabase.from("notifications").insert(notifications);
    }

    return new Response(JSON.stringify({ ok: true, count: notifications.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[check-payment-reminders]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
