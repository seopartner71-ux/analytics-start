import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TV_BASE = "https://api.topvisor.com/v2/json";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, api_key, user_id, payload } = body as {
      action: string;
      api_key: string;
      user_id: string;
      payload?: Record<string, unknown>;
    };

    if (!api_key || !user_id) {
      return new Response(JSON.stringify({ error: "api_key and user_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Id": user_id,
      Authorization: `bearer ${api_key}`,
    };

    let url: string;
    let method = "POST";
    let fetchBody: string | undefined;

    switch (action) {
      case "get-projects":
        url = `${TV_BASE}/get/projects_2/projects`;
        fetchBody = JSON.stringify({ show_site_stat: false, show_searchers_and_regions: false });
        break;

      case "get-positions": {
        url = `${TV_BASE}/get/positions_2/history`;
        fetchBody = JSON.stringify(payload || {});
        break;
      }

      case "get-keywords": {
        url = `${TV_BASE}/get/keywords_2/keywords`;
        fetchBody = JSON.stringify(payload || {});
        break;
      }

      case "test-connection":
        url = `${TV_BASE}/get/projects_2/projects`;
        fetchBody = JSON.stringify({ show_site_stat: false, show_searchers_and_regions: false, limit: 1 });
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const resp = await fetch(url, { method, headers, body: fetchBody });
    const data = await resp.json();

    if (!resp.ok || data?.errors?.length) {
      const errMsg = data?.errors?.[0]?.string || data?.message || `Topvisor API error (${resp.status})`;
      return new Response(JSON.stringify({ error: errMsg, raw: data }), {
        status: resp.status >= 400 ? resp.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
