import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WM_BASE = "https://api.webmaster.yandex.net/v4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for RLS-scoped reads
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for writes (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { project_id } = body as { project_id: string };

    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user has access to this project via RLS
    const { data: project, error: projErr } = await userClient
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();
    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found or no access" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get integrations for this project (via user client for RLS)
    const { data: integrations } = await userClient
      .from("integrations")
      .select("*")
      .eq("project_id", project_id)
      .eq("connected", true);

    const results: { yandex?: string; google?: string } = {};
    const now = new Date().toISOString();

    // --- YANDEX WEBMASTER ---
    const wmIntegration = integrations?.find(
      (i: any) => i.service_name === "yandexWebmaster"
    );
    // Fallback: if webmaster integration has no token, try using the metrika token (same Yandex OAuth)
    const metrikaIntegration = integrations?.find(
      (i: any) => i.service_name === "yandexMetrika"
    );
    const wmToken = wmIntegration?.access_token || metrikaIntegration?.access_token;
    if (wmToken && project.yandex_webmaster_host_id) {
      try {
        const accessToken = wmIntegration.access_token;
        const hostId = project.yandex_webmaster_host_id;
        const wmHeaders = {
          Authorization: `OAuth ${accessToken}`,
          "Content-Type": "application/json",
        };

        const userResp = await fetch(`${WM_BASE}/user/`, { headers: wmHeaders });
        const userData = await userResp.json();
        if (!userResp.ok) throw new Error(userData?.error_message || "WM auth failed");
        const wmUserId = userData.user_id;
        const encodedHost = encodeURIComponent(hostId);

        const summaryResp = await fetch(
          `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/summary`,
          { headers: wmHeaders }
        );
        const summary = summaryResp.ok ? await summaryResp.json() : {};

        const diagResp = await fetch(
          `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/diagnostics`,
          { headers: wmHeaders }
        );
        const diag = diagResp.ok ? await diagResp.json() : { problems: [] };

        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const idxResp = await fetch(
          `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/indexing/history?date_from=${threeMonthsAgo.toISOString().split("T")[0]}&date_to=${new Date().toISOString().split("T")[0]}`,
          { headers: wmHeaders }
        );
        const idxData = idxResp.ok ? await idxResp.json() : {};

        let indexedPages = 0;
        if (idxData?.indicators?.SEARCHABLE) {
          const searchable = idxData.indicators.SEARCHABLE;
          if (searchable.length > 0) {
            indexedPages = searchable[searchable.length - 1].value || 0;
          }
        }

        const yandexMetrics = [
          { metric_name: "indexed_pages", metric_value: String(indexedPages) },
          { metric_name: "total_pages", metric_value: String(summary?.searchable_count || indexedPages) },
          { metric_name: "sitemap_status", metric_value: summary?.sitemaps_cnt > 0 ? "ok" : "not_configured" },
          { metric_name: "last_crawl", metric_value: summary?.last_access || now },
          { metric_name: "warnings", metric_value: String(diag?.problems?.filter((p: any) => p.state === "PRESENT" && p.severity === "WARNING")?.length || 0) },
        ];

        await adminClient.from("site_health").delete()
          .eq("project_id", project_id)
          .eq("source", "yandex");

        for (const m of yandexMetrics) {
          await adminClient.from("site_health").insert({
            project_id,
            source: "yandex",
            metric_name: m.metric_name,
            metric_value: m.metric_value,
            updated_at: now,
          });
        }

        const activeProblems = (diag?.problems || []).filter(
          (p: any) => p.state === "PRESENT"
        );
        if (activeProblems.length > 0) {
          await adminClient.from("site_errors").delete()
            .eq("project_id", project_id)
            .eq("source", "yandex");

          for (const problem of activeProblems) {
            await adminClient.from("site_errors").insert({
              project_id,
              source: "yandex",
              error_type: problem.problem_id || problem.title || "Unknown",
              url: problem.affected_url || hostId,
              status: "Новая",
              detected_at: now,
            });
          }
        }

        results.yandex = "ok";
      } catch (e) {
        results.yandex = `error: ${e instanceof Error ? e.message : "Unknown"}`;
        console.error("Yandex Webmaster fetch error:", e);
      }
    }

    // --- GOOGLE SEARCH CONSOLE ---
    const gscIntegration = integrations?.find(
      (i: any) => i.service_name === "googleSearchConsole"
    );
    if (gscIntegration?.access_token && gscIntegration?.counter_id) {
      try {
        const accessToken = gscIntegration.access_token;
        const siteUrl = gscIntegration.counter_id;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 28);

        const analyticsResp = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              startDate: startDate.toISOString().split("T")[0],
              endDate: endDate.toISOString().split("T")[0],
              dimensions: ["query"],
              rowLimit: 5,
            }),
          }
        );

        if (!analyticsResp.ok) {
          const errData = await analyticsResp.json();
          throw new Error(errData?.error?.message || `GSC API error: ${analyticsResp.status}`);
        }

        const analyticsData = await analyticsResp.json();

        const totalsResp = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              startDate: startDate.toISOString().split("T")[0],
              endDate: endDate.toISOString().split("T")[0],
            }),
          }
        );

        let totalClicks = 0, totalImpressions = 0, avgCtr = 0, avgPosition = 0;
        if (totalsResp.ok) {
          const totalsData = await totalsResp.json();
          if (totalsData?.rows?.[0]) {
            totalClicks = totalsData.rows[0].clicks || 0;
            totalImpressions = totalsData.rows[0].impressions || 0;
            avgCtr = (totalsData.rows[0].ctr || 0) * 100;
            avgPosition = totalsData.rows[0].position || 0;
          }
        }

        const topQueries = (analyticsData?.rows || []).map((row: any) => ({
          query: row.keys?.[0] || "",
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          position: (row.position || 0).toFixed(1),
        }));

        await adminClient.from("site_health").delete()
          .eq("project_id", project_id)
          .eq("source", "google");

        const googleMetrics = [
          { metric_name: "clicks", metric_value: String(totalClicks) },
          { metric_name: "impressions", metric_value: String(totalImpressions) },
          { metric_name: "ctr", metric_value: avgCtr.toFixed(1) },
          { metric_name: "avg_position", metric_value: avgPosition.toFixed(1) },
          { metric_name: "top_queries", metric_value: JSON.stringify(topQueries) },
          { metric_name: "indexed_pages", metric_value: "0" },
          { metric_name: "warnings", metric_value: "0" },
        ];

        for (const m of googleMetrics) {
          await adminClient.from("site_health").insert({
            project_id,
            source: "google",
            metric_name: m.metric_name,
            metric_value: m.metric_value,
            updated_at: now,
          });
        }

        results.google = "ok";
      } catch (e) {
        results.google = `error: ${e instanceof Error ? e.message : "Unknown"}`;
        console.error("GSC fetch error:", e);
      }
    }

    // Update integrations last_sync via admin client
    if (results.yandex === "ok" && wmIntegration) {
      await adminClient.from("integrations").update({ last_sync: now }).eq("id", wmIntegration.id);
    }
    if (results.google === "ok" && gscIntegration) {
      await adminClient.from("integrations").update({ last_sync: now }).eq("id", gscIntegration.id);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("fetch-site-health error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
