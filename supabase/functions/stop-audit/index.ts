import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CRAWLER_BASE = "http://155.212.221.64:8000";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secret = Deno.env.get("CRAWLER_SECRET");
    if (!secret) {
      return new Response(JSON.stringify({ error: "CRAWLER_SECRET not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update DB via service role (bypass RLS check is fine — we already authenticated user)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the job belongs to this user
    const { data: job } = await admin
      .from("crawl_jobs")
      .select("id, user_id, status")
      .eq("id", job_id)
      .maybeSingle();

    if (!job || job.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call crawler stop endpoint (best effort)
    let crawlerOk = false;
    let crawlerDetail = "";
    try {
      const url = `${CRAWLER_BASE}/stop/${encodeURIComponent(job_id)}?secret=${encodeURIComponent(secret)}`;
      const res = await fetch(url, { method: "POST" });
      crawlerOk = res.ok;
      if (!res.ok) crawlerDetail = await res.text().catch(() => "");
    } catch (e) {
      crawlerDetail = e instanceof Error ? e.message : String(e);
    }

    // Always mark job as stopped in DB
    await admin
      .from("crawl_jobs")
      .update({
        status: "error",
        error_message: "Остановлено пользователем",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    return new Response(
      JSON.stringify({ ok: true, crawler_ok: crawlerOk, crawler_detail: crawlerDetail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
