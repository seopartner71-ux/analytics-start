// Прокси к внешнему краулеру link_profile.
// Фронт зовёт через supabase.functions.invoke — секрет краулера не уходит в браузер,
// HTTPS обеспечивает Supabase, mixed-content не возникает.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CRAWLER_BASE = "http://155.212.221.64:8000";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const projectId = String(body.project_id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
      return new Response(JSON.stringify({ error: "project_id (uuid) required" }), {
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

    const url = `${CRAWLER_BASE}/check-links/${projectId}?secret=${encodeURIComponent(secret)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    let upstream: Response;
    try {
      upstream = await fetch(url, { method: "POST", signal: controller.signal });
    } catch (e) {
      clearTimeout(timer);
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : "Crawler unreachable" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    clearTimeout(timer);

    const text = await upstream.text();
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

    return new Response(
      JSON.stringify({ ok: upstream.ok, status: upstream.status, data: payload }),
      { status: upstream.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
