import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REPORT_BASE = "http://155.212.221.64:8000";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const jobId = url.searchParams.get("job_id");
    if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
      return new Response(JSON.stringify({ error: "Invalid job_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user has access to this job (RLS)
    const { data: job, error: jobErr } = await supabase
      .from("crawl_jobs")
      .select("id, status")
      .eq("id", jobId)
      .maybeSingle();
    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secret = Deno.env.get("CRAWLER_SECRET");
    if (!secret) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let upstream: Response;
    try {
      upstream = await fetch(`${REPORT_BASE}/report/${jobId}?secret=${encodeURIComponent(secret)}`);
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: "Сервер генерации PDF недоступен. Попробуйте позже или обратитесь к администратору.",
          detail: e instanceof Error ? e.message : String(e),
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Ошибка генерации PDF (${upstream.status})`, detail: text.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pdfBuffer = await upstream.arrayBuffer();
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="seo-report-${jobId}.pdf"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
