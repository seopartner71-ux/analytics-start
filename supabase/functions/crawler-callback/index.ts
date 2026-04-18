import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-crawler-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Crawler callback (public — protected by shared CRAWLER_SECRET).
 *
 * Auth: header `x-crawler-secret: <CRAWLER_SECRET>`
 *
 * POST body (one of):
 *  { action: "update_job", job_id, status?, progress?, started_at?, finished_at?, error_message? }
 *  { action: "add_pages", job_id, pages: [{ url, status_code?, depth?, title?, description?, h1?, canonical?, is_indexed?, load_time_ms?, word_count? }, ...] }
 *  { action: "add_issues", job_id, issues: [{ page_url?, type, code, severity?, message?, details? }, ...] }
 *  { action: "save_stats", job_id, stats: { total_pages, total_issues, critical_count, warning_count, info_count, avg_load_time_ms, score } }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secret = Deno.env.get("CRAWLER_SECRET");
    if (!secret) {
      return json({ error: "Server not configured" }, 500);
    }
    const provided = req.headers.get("x-crawler-secret");
    if (provided !== secret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const action = body?.action as string;
    const job_id = body?.job_id as string;

    if (!action) return json({ error: "action is required" }, 400);

    // claim_job — атомарно берёт следующий pending job
    if (action === "claim_job") {
      const { data, error } = await supabase.rpc("claim_next_crawl_job");
      if (error) throw error;
      const job = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (!job) return json({ ok: true, job: null }); // нет заданий
      return json({ ok: true, job });
    }

    if (!job_id) return json({ error: "job_id is required" }, 400);

    // Verify job exists
    const { data: job, error: jobErr } = await supabase
      .from("crawl_jobs")
      .select("id")
      .eq("id", job_id)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) return json({ error: "Job not found" }, 404);

    if (action === "update_job") {
      const patch: Record<string, unknown> = {};
      for (const k of ["status", "progress", "started_at", "finished_at", "error_message"]) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      const { error } = await supabase.from("crawl_jobs").update(patch).eq("id", job_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "add_pages") {
      const pages = (body.pages || []) as any[];
      if (!Array.isArray(pages) || pages.length === 0) return json({ ok: true, inserted: 0 });
      const rows = pages.map((p) => ({ ...p, job_id }));
      const { data, error } = await supabase.from("crawl_pages").insert(rows).select("id, url");
      if (error) throw error;
      return json({ ok: true, inserted: data?.length ?? 0, pages: data });
    }

    if (action === "add_issues") {
      const issues = (body.issues || []) as any[];
      if (!Array.isArray(issues) || issues.length === 0) return json({ ok: true, inserted: 0 });

      // Resolve page_url -> page_id (if provided)
      const urls = Array.from(new Set(issues.map((i) => i.page_url).filter(Boolean)));
      const urlToId = new Map<string, string>();
      if (urls.length > 0) {
        const { data: pages } = await supabase
          .from("crawl_pages")
          .select("id, url")
          .eq("job_id", job_id)
          .in("url", urls);
        for (const p of pages || []) urlToId.set(p.url, p.id);
      }

      const rows = issues.map((i) => ({
        job_id,
        page_id: i.page_url ? urlToId.get(i.page_url) ?? null : i.page_id ?? null,
        type: i.type,
        code: i.code,
        severity: i.severity ?? "info",
        message: i.message ?? null,
        details: i.details ?? {},
      }));
      const { error } = await supabase.from("crawl_issues").insert(rows);
      if (error) throw error;
      return json({ ok: true, inserted: rows.length });
    }

    if (action === "save_stats") {
      const s = body.stats || {};
      const row = {
        job_id,
        total_pages: s.total_pages ?? 0,
        total_issues: s.total_issues ?? 0,
        critical_count: s.critical_count ?? 0,
        warning_count: s.warning_count ?? 0,
        info_count: s.info_count ?? 0,
        avg_load_time_ms: s.avg_load_time_ms ?? 0,
        score: s.score ?? 0,
      };
      // Upsert by job_id (unique)
      const { error } = await supabase
        .from("crawl_stats")
        .upsert(row, { onConflict: "job_id" });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("crawler-callback error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
