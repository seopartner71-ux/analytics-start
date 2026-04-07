import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WM_BASE = "https://api.webmaster.yandex.net/v4";
const GSC_BASE = "https://www.googleapis.com/webmasters/v3";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { project_id } = body as { project_id: string };

    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get project info
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();
    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get integrations for this project
    const { data: integrations } = await supabase
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
    if (wmIntegration?.access_token && project.yandex_webmaster_host_id) {
      try {
        const accessToken = wmIntegration.access_token;
        const hostId = project.yandex_webmaster_host_id;
        const wmHeaders = {
          Authorization: `OAuth ${accessToken}`,
          "Content-Type": "application/json",
        };

        // Get user_id
        const userResp = await fetch(`${WM_BASE}/user/`, { headers: wmHeaders });
        const userData = await userResp.json();
        if (!userResp.ok) throw new Error(userData?.error_message || "WM auth failed");
        const wmUserId = userData.user_id;
        const encodedHost = encodeURIComponent(hostId);

        // Fetch summary
        const summaryResp = await fetch(
          `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/summary`,
          { headers: wmHeaders }
        );
        const summary = summaryResp.ok ? await summaryResp.json() : {};

        // Fetch diagnostics for errors
        const diagResp = await fetch(
          `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/diagnostics`,
          { headers: wmHeaders }
        );
        const diag = diagResp.ok ? await diagResp.json() : { problems: [] };

        // Fetch indexing history (last 3 months)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const idxResp = await fetch(
          `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/indexing/history?date_from=${threeMonthsAgo.toISOString().split("T")[0]}&date_to=${new Date().toISOString().split("T")[0]}`,
          { headers: wmHeaders }
        );
        const idxData = idxResp.ok ? await idxResp.json() : {};

        // Calculate indexed pages from indexing history
        let indexedPages = 0;
        if (idxData?.indicators?.SEARCHABLE) {
          const searchable = idxData.indicators.SEARCHABLE;
          if (searchable.length > 0) {
            indexedPages = searchable[searchable.length - 1].value || 0;
          }
        }

        // Save metrics to site_health (upsert pattern)
        const yandexMetrics = [
          { metric_name: "indexed_pages", metric_value: String(indexedPages) },
          { metric_name: "total_pages", metric_value: String(summary?.searchable_count || indexedPages) },
          { metric_name: "sitemap_status", metric_value: summary?.sitemaps_cnt > 0 ? "ok" : "not_configured" },
          { metric_name: "last_crawl", metric_value: summary?.last_access || now },
          { metric_name: "warnings", metric_value: String(diag?.problems?.filter((p: any) => p.state === "PRESENT" && p.severity === "WARNING")?.length || 0) },
        ];

        // Delete old yandex metrics for this project and insert new ones
        await supabase.from("site_health").delete()
          .eq("project_id", project_id)
          .eq("source", "yandex");

        for (const m of yandexMetrics) {
          await supabase.from("site_health").insert({
            project_id,
            source: "yandex",
            metric_name: m.metric_name,
            metric_value: m.metric_value,
            updated_at: now,
          });
        }

        // Save diagnostics as site_errors
        const activeProblems = (diag?.problems || []).filter(
          (p: any) => p.state === "PRESENT"
        );
        if (activeProblems.length > 0) {
          // Clear old yandex errors
          await supabase.from("site_errors").delete()
            .eq("project_id", project_id)
            .eq("source", "yandex");

          for (const problem of activeProblems) {
            await supabase.from("site_errors").insert({
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
        const siteUrl = gscIntegration.counter_id; // We store property URL in counter_id

        // Fetch search analytics (last 28 days)
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

        // Fetch totals (without dimensions)
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

        // Build top queries
        const topQueries = (analyticsData?.rows || []).map((row: any) => ({
          query: row.keys?.[0] || "",
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          position: (row.position || 0).toFixed(1),
        }));

        // Fetch crawl errors via URL Inspection API (or sitemaps as proxy)
        // GSC v3 doesn't have a direct crawl errors endpoint, so we use sitemaps
        const sitemapsResp = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        let sitemapErrors = 0;
        if (sitemapsResp.ok) {
          const sitemapsData = await sitemapsResp.json();
          for (const sm of sitemapsData?.sitemap || []) {
            sitemapErrors += sm.errors || 0;
          }
        }

        // Delete old google metrics and insert new
        await supabase.from("site_health").delete()
          .eq("project_id", project_id)
          .eq("source", "google");

        const googleMetrics = [
          { metric_name: "clicks", metric_value: String(totalClicks) },
          { metric_name: "impressions", metric_value: String(totalImpressions) },
          { metric_name: "ctr", metric_value: avgCtr.toFixed(1) },
          { metric_name: "avg_position", metric_value: avgPosition.toFixed(1) },
          { metric_name: "top_queries", metric_value: JSON.stringify(topQueries) },
          { metric_name: "indexed_pages", metric_value: "0" },
          { metric_name: "warnings", metric_value: String(sitemapErrors) },
        ];

        for (const m of googleMetrics) {
          await supabase.from("site_health").insert({
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

    // Update integrations last_sync
    if (results.yandex === "ok" && wmIntegration) {
      await supabase.from("integrations").update({ last_sync: now }).eq("id", wmIntegration.id);
    }
    if (results.google === "ok" && gscIntegration) {
      await supabase.from("integrations").update({ last_sync: now }).eq("id", gscIntegration.id);
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
