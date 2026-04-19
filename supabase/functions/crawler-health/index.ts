const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRAWLER_BASE = "http://155.212.221.64:8000";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  const paths = ["/health", "/", "/docs"];
  let lastErr: unknown = null;
  for (const path of paths) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${CRAWLER_BASE}${path}`, { signal: controller.signal });
      clearTimeout(timeout);
      const latency = Date.now() - started;
      // Любой HTTP-ответ значит, что сервер жив (даже 404/401/405)
      return new Response(
        JSON.stringify({ online: true, status: res.status, path, latency_ms: latency }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      lastErr = e;
    }
  }
  {
    const e = lastErr;
    const latency = Date.now() - started;
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ online: false, error: msg, latency_ms: latency }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
