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

      // Collect all recipient team_member ids (assignee + co-assignees)
      const teamIds: string[] = [];
      if (r.assignee_id) teamIds.push(r.assignee_id);
      for (const id of (r.co_assignee_ids || [])) if (!teamIds.includes(id)) teamIds.push(id);

      type Recipient = { userId: string | null; email: string | null };
      const recipients: Recipient[] = [];

      if (teamIds.length) {
        const { data: tms } = await supabase
          .from("team_members")
          .select("id, email")
          .in("id", teamIds);
        const emails = (tms || []).map((t: any) => t.email).filter(Boolean);
        const emailToUser = new Map<string, string>();
        if (emails.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, email")
            .in("email", emails);
          (profs || []).forEach((p: any) => { if (p.email) emailToUser.set(p.email, p.user_id); });
        }
        for (const t of (tms || []) as any[]) {
          recipients.push({ userId: t.email ? emailToUser.get(t.email) || null : null, email: t.email || null });
        }
      }

      // Fallback to owner if nobody resolved
      if (recipients.length === 0) recipients.push({ userId: r.owner_id, email: null });

      const seenUsers = new Set<string>();
      const seenEmails = new Set<string>();
      for (const rec of recipients) {
        // In-app notification
        if (rec.userId && !seenUsers.has(rec.userId)) {
          seenUsers.add(rec.userId);
          await supabase.from("notifications").insert({
            user_id: rec.userId,
            title,
            body,
            project_id: r.project_id,
            kind: "report",
          });
          notifCount++;
        }
        // Email
        let email = rec.email;
        if (!email && rec.userId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("email")
            .eq("user_id", rec.userId)
            .maybeSingle();
          email = prof?.email || null;
        }
        if (email && !seenEmails.has(email)) {
          seenEmails.add(email);
          try {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "report-reminder",
                recipientEmail: email,
                idempotencyKey: `report-${r.id}-${isTwo ? "2d" : "1d"}-${email}`,
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
