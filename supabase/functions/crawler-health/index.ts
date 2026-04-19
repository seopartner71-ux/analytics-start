const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRAWLER_BASE = "http://155.212.221.64:8000";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${CRAWLER_BASE}/`, { signal: controller.signal }).catch((e) => {
      throw e;
    });
    clearTimeout(timeout);
    const latency = Date.now() - started;
    return new Response(
      JSON.stringify({ online: res.ok, status: res.status, latency_ms: latency }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const latency = Date.now() - started;
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ online: false, error: msg, latency_ms: latency }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
