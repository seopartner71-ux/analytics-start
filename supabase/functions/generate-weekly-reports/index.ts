// Cron-вызов: каждый понедельник 09:00 МСК. Создаёт draft недельных отчётов
// для всех активных проектов: planned = задачи текущей ISO-недели,
// done = задачи прошлой недели + work_logs прошлой недели.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ISO-неделя по дате (Europe/Moscow)
function isoWeek(d: Date): { year: number; week: number; start: Date; end: Date } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  // start = понедельник, end = воскресенье
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - (day - 1));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { year: date.getUTCFullYear(), week, start, end };
}

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const onlyProjectId = url.searchParams.get("project_id");

    const now = new Date();
    const cur = isoWeek(now);
    const prevDate = new Date(now);
    prevDate.setUTCDate(prevDate.getUTCDate() - 7);
    const prev = isoWeek(prevDate);

    // Список проектов
    const projQuery = supabase.from("projects").select("id, name, owner_id");
    const { data: projects, error: projErr } = onlyProjectId
      ? await projQuery.eq("id", onlyProjectId)
      : await projQuery;
    if (projErr) throw projErr;

    const created: Array<{ project_id: string; report_id: string; status: string }> = [];

    for (const p of projects || []) {
      // planned — задачи текущей недели
      const { data: planned } = await supabase
        .from("crm_tasks")
        .select("id, title, stage")
        .eq("project_id", p.id)
        .eq("week_year", cur.year)
        .eq("week_number", cur.week);

      // done — задачи прошлой недели
      const { data: prevTasks } = await supabase
        .from("crm_tasks")
        .select("id, title, stage")
        .eq("project_id", p.id)
        .eq("week_year", prev.year)
        .eq("week_number", prev.week);

      // done — work_logs прошлой недели
      const { data: prevLogs } = await supabase
        .from("work_logs")
        .select("id, title, status")
        .eq("project_id", p.id)
        .gte("task_date", fmtDate(prev.start))
        .lte("task_date", fmtDate(prev.end));

      const planned_items = (planned || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        source: "crm_task",
        hidden: false,
      }));

      const done_items = [
        ...(prevTasks || []).map((t: any) => ({
          title: t.title,
          status: ["Завершена", "Принята"].includes(t.stage) ? "done" : "moved",
          source: "crm_task",
        })),
        ...(prevLogs || []).map((l: any) => ({
          title: l.title,
          status: l.status === "completed" ? "done" : "in_progress",
          source: "work_log",
        })),
      ];

      // upsert (project_id, week_year, week_number) — если уже есть draft, не пересоздаём
      const { data: existing } = await supabase
        .from("weekly_reports")
        .select("id, status")
        .eq("project_id", p.id)
        .eq("week_year", cur.year)
        .eq("week_number", cur.week)
        .maybeSingle();

      if (existing) {
        created.push({ project_id: p.id, report_id: existing.id, status: "exists" });
        continue;
      }

      const { data: ins, error: insErr } = await supabase
        .from("weekly_reports")
        .insert({
          project_id: p.id,
          week_number: cur.week,
          week_year: cur.year,
          week_start: fmtDate(cur.start),
          week_end: fmtDate(cur.end),
          status: "draft",
          planned_items,
          done_items,
          metrics: { positions_text: "", traffic_text: "" },
          manager_comment: "",
          created_by: p.owner_id,
        })
        .select("id")
        .single();
      if (insErr) {
        console.error("insert weekly_reports failed", p.id, insErr.message);
        continue;
      }

      // Уведомление владельцу проекта
      await supabase.from("notifications").insert({
        user_id: p.owner_id,
        project_id: p.id,
        title: `📋 Недельный отчёт #${cur.week} готов к проверке`,
        body: `Проект «${p.name}». Проверьте план и выполненное, затем отправьте клиенту.`,
      });

      created.push({ project_id: p.id, report_id: ins.id, status: "created" });
    }

    return new Response(JSON.stringify({ ok: true, week: cur, count: created.length, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
