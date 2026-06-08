// Daily check: notify assignees about project reports due in 2 and 1 days
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
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const in1 = new Date(today); in1.setDate(in1.getDate() + 1);
    const in2 = new Date(today); in2.setDate(in2.getDate() + 2);

    const { data: reports } = await supabase
      .from("project_reports")
      .select("id, title, client_name, due_date, status, owner_id, assignee_id, assignee_user_id, co_assignee_ids, reminder_1d_sent, reminder_2d_sent, project_id, projects(name)")
      .in("status", ["planned", "in_progress"])
      .in("due_date", [fmt(in1), fmt(in2)]);

    if (!reports?.length) {
      return new Response(JSON.stringify({ ok: true, count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notifCount = 0;
    let emailCount = 0;

    for (const r of reports as any[]) {
      const due = new Date(r.due_date);
      const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
      const isTwo = diff === 2 && !r.reminder_2d_sent;
      const isOne = diff <= 1 && !r.reminder_1d_sent;
      if (!isTwo && !isOne) continue;

      const projectName = r.projects?.name || "";
      const label = isTwo ? "через 2 дня" : "завтра";
      const title = `📝 Отчёт ${label}: ${r.client_name || projectName}`;
      const body = `${r.title || "Отчёт"} — срок ${r.due_date}${projectName ? ` · ${projectName}` : ""}`;

      // Resolve recipient user_id
      let recipientUserId: string | null = r.assignee_user_id || null;
      let recipientEmail: string | null = null;
      if (r.assignee_id) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("email")
          .eq("id", r.assignee_id)
          .maybeSingle();
        recipientEmail = tm?.email || null;
        if (!recipientUserId && tm?.email) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("email", tm.email)
            .maybeSingle();
          recipientUserId = prof?.user_id || null;
        }
      }
      if (!recipientUserId) recipientUserId = r.owner_id;

      // In-app notification
      if (recipientUserId) {
        await supabase.from("notifications").insert({
          user_id: recipientUserId,
          title,
          body,
          project_id: r.project_id,
          kind: "report",
        });
        notifCount++;
      }

      // Email (best-effort)
      if (!recipientEmail && recipientUserId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", recipientUserId)
          .maybeSingle();
        recipientEmail = prof?.email || null;
      }
      if (recipientEmail) {
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "report-reminder",
              recipientEmail,
              idempotencyKey: `report-${r.id}-${isTwo ? "2d" : "1d"}`,
              templateData: {
                title: r.title || "Отчёт",
                clientName: r.client_name || "",
                projectName,
                dueDate: r.due_date,
                daysLeft: diff,
              },
            },
          });
          emailCount++;
        } catch (e) {
          console.warn("email send failed", e);
        }
      }

      // Mark flag
      const patch: Record<string, any> = {};
      if (isTwo) patch.reminder_2d_sent = true;
      if (isOne) patch.reminder_1d_sent = true;
      await supabase.from("project_reports").update(patch).eq("id", r.id);
    }

    return new Response(JSON.stringify({ ok: true, notifications: notifCount, emails: emailCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-report-reminders]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
