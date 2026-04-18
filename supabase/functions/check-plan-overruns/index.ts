import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Computes 1st and last day of current month in YYYY-MM-DD
function monthBounds(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { start, end, ym: `${y}-${String(m + 1).padStart(2, "0")}` };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { start, end, ym } = monthBounds();

    // Projects with a plan defined
    const { data: projects, error: projErr } = await supabase
      .from("projects")
      .select("id, name, owner_id, planned_hours")
      .gt("planned_hours", 0);
    if (projErr) throw projErr;

    let createdCount = 0;
    const results: Array<{ project: string; usage: number; level: string; skipped?: boolean }> = [];

    for (const p of projects || []) {
      // Sum minutes for this project this month
      const { data: entries, error: entErr } = await supabase
        .from("task_time_entries")
        .select("duration_minutes")
        .eq("project_id", p.id)
        .gte("entry_date", start)
        .lte("entry_date", end);
      if (entErr) continue;

      const actualHours = (entries || []).reduce((s, e: any) => s + (e.duration_minutes || 0), 0) / 60;
      const planned = Number(p.planned_hours) || 0;
      if (planned <= 0) continue;
      const usagePct = (actualHours / planned) * 100;

      let level: "critical" | "warning" | null = null;
      if (usagePct > 110) level = "critical";
      else if (usagePct > 90) level = "warning";
      if (!level) continue;

      // Idempotency: one notification per (project, level, month).
      // Encoded in title to avoid extra columns.
      const title =
        level === "critical"
          ? `🚨 Превышение плана часов (${ym})`
          : `⚠️ План часов почти исчерпан (${ym})`;

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", p.owner_id)
        .eq("project_id", p.id)
        .eq("title", title)
        .limit(1);

      if (existing && existing.length > 0) {
        results.push({ project: p.name, usage: Math.round(usagePct), level, skipped: true });
        continue;
      }

      const body =
        `Проект «${p.name}»: использовано ${actualHours.toFixed(1)} ч из ${planned.toFixed(1)} ч ` +
        `(${Math.round(usagePct)}%).` +
        (level === "critical" ? " Перерасход более 10% — проверьте рентабельность." : " Близко к лимиту.");

      const { error: insErr } = await supabase.from("notifications").insert({
        user_id: p.owner_id,
        project_id: p.id,
        title,
        body,
        is_read: false,
      });

      if (!insErr) {
        createdCount++;
        results.push({ project: p.name, usage: Math.round(usagePct), level });
      }
    }

    return new Response(
      JSON.stringify({ success: true, created: createdCount, month: ym, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
