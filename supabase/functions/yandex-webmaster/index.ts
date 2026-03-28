import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WM_BASE = "https://api.webmaster.yandex.net/v3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, project_id, access_token, host_id, url: recrawlUrl } = body as {
      action: string;
      project_id?: string;
      access_token: string;
      host_id?: string;
      url?: string;
    };

    if (!access_token) {
      return new Response(JSON.stringify({ error: "access_token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wmHeaders: Record<string, string> = {
      Authorization: `OAuth ${access_token}`,
      "Content-Type": "application/json",
    };

    // Helper to get user_id from Webmaster API
    async function getWmUserId(): Promise<number> {
      const resp = await fetch(`${WM_BASE}/user/`, { headers: wmHeaders });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error_message || "Failed to get user_id");
      return data.user_id;
    }

    switch (action) {
      case "get-user": {
        const userId = await getWmUserId();
        return new Response(JSON.stringify({ user_id: userId }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-hosts": {
        const userId = await getWmUserId();
        const resp = await fetch(`${WM_BASE}/user/${userId}/hosts`, { headers: wmHeaders });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error_message || "Failed to get hosts");
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-summary": {
        if (!host_id) throw new Error("host_id is required");
        const userId = await getWmUserId();
        const encodedHost = encodeURIComponent(host_id);
        const resp = await fetch(`${WM_BASE}/user/${userId}/hosts/${encodedHost}/summary`, { headers: wmHeaders });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error_message || "Failed to get summary");
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-sqi": {
        if (!host_id) throw new Error("host_id is required");
        const userId = await getWmUserId();
        const encodedHost = encodeURIComponent(host_id);
        const resp = await fetch(`${WM_BASE}/user/${userId}/hosts/${encodedHost}/sqi-history`, { headers: wmHeaders });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error_message || "Failed to get SQI");
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-indexing-history": {
        if (!host_id) throw new Error("host_id is required");
        const userId = await getWmUserId();
        const encodedHost = encodeURIComponent(host_id);
        const resp = await fetch(`${WM_BASE}/user/${userId}/hosts/${encodedHost}/indexing/history`, { headers: wmHeaders });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error_message || "Failed to get indexing history");
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-diagnostics": {
        if (!host_id) throw new Error("host_id is required");
        const userId = await getWmUserId();
        const encodedHost = encodeURIComponent(host_id);
        const resp = await fetch(`${WM_BASE}/user/${userId}/hosts/${encodedHost}/diagnostics`, { headers: wmHeaders });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error_message || "Failed to get diagnostics");
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-backlinks": {
        if (!host_id) throw new Error("host_id is required");
        const userId = await getWmUserId();
        const encodedHost = encodeURIComponent(host_id);
        const resp = await fetch(`${WM_BASE}/user/${userId}/hosts/${encodedHost}/links/external/history`, { headers: wmHeaders });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error_message || "Failed to get backlinks");
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "recrawl": {
        if (!host_id) throw new Error("host_id is required");
        const userId = await getWmUserId();
        const encodedHost = encodeURIComponent(host_id);
        const targetUrl = recrawlUrl || host_id;
        const resp = await fetch(`${WM_BASE}/user/${userId}/hosts/${encodedHost}/recrawl/queue`, {
          method: "POST",
          headers: wmHeaders,
          body: JSON.stringify({ url: targetUrl }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error_message || "Recrawl request failed");
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "save-host": {
        if (!host_id || !project_id) throw new Error("host_id and project_id required");
        const { error } = await supabase
          .from("projects")
          .update({ yandex_webmaster_host_id: host_id } as any)
          .eq("id", project_id);
        if (error) throw new Error(error.message);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("yandex-webmaster error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
