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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { project_id } = body as { project_id: string };

    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { data: integrations } = await userClient
      .from("integrations")
      .select("*")
      .eq("project_id", project_id)
      .eq("connected", true);

    const results: { yandex?: string; google?: string } = {};
    const now = new Date().toISOString();
    const today = new Date().toISOString().split("T")[0];

    // --- YANDEX WEBMASTER ---
    const wmIntegration = integrations?.find((i: any) => i.service_name === "yandexWebmaster");
    const metrikaIntegration = integrations?.find((i: any) => i.service_name === "yandexMetrika");
    const wmToken = wmIntegration?.access_token || metrikaIntegration?.access_token;

    if (wmToken && project.yandex_webmaster_host_id) {
      try {
        const accessToken = wmToken;
        const hostId = project.yandex_webmaster_host_id;
        const wmHeaders = {
          Authorization: `OAuth ${accessToken}`,
          "Content-Type": "application/json",
        };

        // 1. Get user ID
        const userResp = await fetch(`${WM_BASE}/user/`, { headers: wmHeaders });
        const userData = await userResp.json();
        if (!userResp.ok) throw new Error(userData?.error_message || "WM auth failed");
        const wmUserId = userData.user_id;
        const encodedHost = encodeURIComponent(hostId);

        // 2. Summary
        const summaryResp = await fetch(
          `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/summary`,
          { headers: wmHeaders }
        );
        const summary = summaryResp.ok ? await summaryResp.json() : {};

        // 3. Diagnostics
        const diagResp = await fetch(
          `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/diagnostics`,
          { headers: wmHeaders }
        );
        const diag = diagResp.ok ? await diagResp.json() : {};
        const diagProblems = diag?.problems && typeof diag.problems === "object"
          ? Object.entries(diag.problems).map(([problemId, problem]) => ({
              problem_id: problemId,
              ...(problem as Record<string, unknown>),
            }))
          : Array.isArray(diag?.problems)
            ? diag.problems
            : Array.isArray(diag)
              ? diag
              : [];

        // 4. Indexing history
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const idxResp = await fetch(
          `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/indexing/history?date_from=${threeMonthsAgo.toISOString().split("T")[0]}&date_to=${today}`,
          { headers: wmHeaders }
        );
        const idxData = idxResp.ok ? await idxResp.json() : {};

        let indexedPages = 0;
        let excludedPages = 0;
        const searchableSeries = idxData?.indicators?.SEARCHABLE || idxData?.indicators?.HTTP_2XX || [];
        if (Array.isArray(searchableSeries) && searchableSeries.length > 0) {
          indexedPages = searchableSeries[searchableSeries.length - 1]?.value || 0;
        }
        const excludedSeries = idxData?.indicators?.EXCLUDED || idxData?.indicators?.HTTP_4XX || [];
        if (Array.isArray(excludedSeries) && excludedSeries.length > 0) {
          excludedPages = excludedSeries[excludedSeries.length - 1]?.value || 0;
        }

        const totalPages = Number(summary?.searchable_pages_count ?? summary?.searchable_count ?? indexedPages ?? 0);
        const warningsCount = diagProblems.filter((p: any) => p.state === "PRESENT").length;

        // 5. Search queries (last 30 days)
        let totalQueries = 0;
        let avgPosition = 0;
        let avgCtr = 0;
        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const sqResp = await fetch(
            `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/search-queries/all/history?query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&query_indicator=AVG_SHOW_POSITION&query_indicator=AVG_CLICK_POSITION&date_from=${thirtyDaysAgo.toISOString().split("T")[0]}&date_to=${today}`,
            { headers: wmHeaders }
          );
          if (sqResp.ok) {
            const sqData = await sqResp.json();
            const shows = sqData?.indicators?.TOTAL_SHOWS || [];
            const clicks = sqData?.indicators?.TOTAL_CLICKS || [];
            const positions = sqData?.indicators?.AVG_SHOW_POSITION || [];

            if (Array.isArray(shows) && shows.length > 0) {
              totalQueries = shows.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
            }
            if (Array.isArray(positions) && positions.length > 0) {
              const validPos = positions.filter((p: any) => p.value > 0);
              avgPosition = validPos.length > 0
                ? validPos.reduce((s: number, p: any) => s + p.value, 0) / validPos.length
                : 0;
            }
            if (totalQueries > 0 && Array.isArray(clicks) && clicks.length > 0) {
              const totalClicks = clicks.reduce((s: number, p: any) => s + (p.value || 0), 0);
              avgCtr = totalQueries > 0 ? (totalClicks / totalQueries) * 100 : 0;
            }
          }
        } catch (e) {
          console.error("Search queries fetch error:", e);
        }

        // 6. External links
        let externalLinks = 0;
        let referringDomains = 0;
        try {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          const blResp = await fetch(
            `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/links/external/history?date_from=${sixMonthsAgo.toISOString().split("T")[0]}&date_to=${today}`,
            { headers: wmHeaders }
          );
          if (blResp.ok) {
            const blData = await blResp.json();
            const linksSeries = blData?.indicators?.LINKS_TOTAL_COUNT || [];
            if (Array.isArray(linksSeries) && linksSeries.length > 0) {
              externalLinks = linksSeries[linksSeries.length - 1]?.value || 0;
            }
          }
          // Referring domains - separate endpoint
          const smpResp = await fetch(
            `${WM_BASE}/user/${wmUserId}/hosts/${encodedHost}/links/external/samples?offset=0&limit=1`,
            { headers: wmHeaders }
          );
          if (smpResp.ok) {
            const smpData = await smpResp.json();
            referringDomains = smpData?.count || 0;
          }
        } catch (e) {
          console.error("External links fetch error:", e);
        }

        // --- Save site_health metrics ---
        const yandexMetrics = [
          { metric_name: "indexed_pages", metric_value: String(indexedPages) },
          { metric_name: "total_pages", metric_value: String(totalPages) },
          { metric_name: "excluded_pages", metric_value: String(excludedPages) },
          { metric_name: "sitemap_status", metric_value: summary?.sitemaps_cnt > 0 ? "ok" : "not_configured" },
          { metric_name: "last_crawl", metric_value: summary?.last_access || now },
          { metric_name: "warnings", metric_value: String(warningsCount) },
          { metric_name: "total_queries", metric_value: String(totalQueries) },
          { metric_name: "avg_position", metric_value: avgPosition.toFixed(1) },
          { metric_name: "avg_ctr", metric_value: avgCtr.toFixed(2) },
          { metric_name: "external_links", metric_value: String(externalLinks) },
          { metric_name: "referring_domains", metric_value: String(referringDomains) },
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

        // --- Save site_errors from diagnostics ---
        const activeProblems = diagProblems.filter((p: any) => p.state === "PRESENT");

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

        // --- Save snapshot to yandex_webmaster_snapshots ---
        // Upsert for today
        await adminClient.from("yandex_webmaster_snapshots").delete()
          .eq("project_id", project_id)
          .eq("snapshot_date", today);

        await adminClient.from("yandex_webmaster_snapshots").insert({
          project_id,
          snapshot_date: today,
          indexed_pages: indexedPages,
          excluded_pages: excludedPages,
          total_queries: totalQueries,
          avg_position: avgPosition,
          avg_ctr: avgCtr,
          external_links: externalLinks,
          referring_domains: referringDomains,
        });

        results.yandex = "ok";
      } catch (e) {
        results.yandex = `error: ${e instanceof Error ? e.message : "Unknown"}`;
        console.error("Yandex Webmaster fetch error:", e);
      }
    }

    // --- GOOGLE SEARCH CONSOLE ---
    const gscIntegration = integrations?.find((i: any) => i.service_name === "googleSearchConsole");
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

        let totalClicks = 0, totalImpressions = 0, gscAvgCtr = 0, gscAvgPosition = 0;
        if (totalsResp.ok) {
          const totalsData = await totalsResp.json();
          if (totalsData?.rows?.[0]) {
            totalClicks = totalsData.rows[0].clicks || 0;
            totalImpressions = totalsData.rows[0].impressions || 0;
            gscAvgCtr = (totalsData.rows[0].ctr || 0) * 100;
            gscAvgPosition = totalsData.rows[0].position || 0;
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
          { metric_name: "ctr", metric_value: gscAvgCtr.toFixed(1) },
          { metric_name: "avg_position", metric_value: gscAvgPosition.toFixed(1) },
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

    // Update integrations last_sync
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
