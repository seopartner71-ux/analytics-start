import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Auth check
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("YANDEX_METRIKA_CLIENT_ID");
    const clientSecret = Deno.env.get("YANDEX_METRIKA_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Yandex Metrika credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: get OAuth URL
    if (action === "auth-url") {
      const redirectUri = url.searchParams.get("redirect_uri") || "";
      const authUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: exchange code for token
    if (action === "exchange-token") {
      const body = await req.json();
      const code = body.code;
      if (!code) {
        return new Response(JSON.stringify({ error: "Code is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenResp = await fetch("https://oauth.yandex.ru/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      const tokenData = await tokenResp.json();
      if (!tokenResp.ok) {
        return new Response(
          JSON.stringify({ error: tokenData.error_description || "Token exchange failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ access_token: tokenData.access_token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: list counters
    if (action === "list-counters") {
      const body = await req.json();
      const accessToken = body.access_token;
      if (!accessToken) {
        return new Response(JSON.stringify({ error: "access_token is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const countersResp = await fetch(
        "https://api-metrika.yandex.net/management/v1/counters?per_page=100",
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );

      const countersData = await countersResp.json();
      if (!countersResp.ok) {
        return new Response(
          JSON.stringify({ error: countersData.message || "Failed to fetch counters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const counters = (countersData.counters || []).map((c: any) => ({
        id: String(c.id),
        name: c.name,
        site: c.site,
      }));

      return new Response(JSON.stringify({ counters }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: fetch stats
    if (action === "fetch-stats") {
      const body = await req.json();
      const { access_token: accessToken, counter_id: counterId, date1, date2 } = body;
      if (!accessToken || !counterId) {
        return new Response(
          JSON.stringify({ error: "access_token and counter_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const startDate = date1 || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const endDate = date2 || new Date().toISOString().split("T")[0];

      // Fetch visits by day
      const visitsResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data/bytime?id=${counterId}&metrics=ym:s:visits,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds&group=day&date1=${startDate}&date2=${endDate}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );

      const visitsData = await visitsResp.json();
      if (!visitsResp.ok) {
        return new Response(
          JSON.stringify({ error: visitsData.message || "Failed to fetch stats" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch totals
      const totalsResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=ym:s:visits,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds&date1=${startDate}&date2=${endDate}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );

      const totalsData = await totalsResp.json();

      // Fetch traffic sources
      const sourcesResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=ym:s:visits&dimensions=ym:s:lastTrafficSource&date1=${startDate}&date2=${endDate}&limit=20`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const sourcesData = await sourcesResp.json();

      return new Response(
        JSON.stringify({
          timeSeries: visitsData,
          totals: totalsData,
          trafficSources: sourcesData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: fetch goals
    if (action === "fetch-goals") {
      const body = await req.json();
      const { access_token: accessToken, counter_id: counterId, date1, date2 } = body;
      if (!accessToken || !counterId) {
        return new Response(
          JSON.stringify({ error: "access_token and counter_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const startDate = date1 || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const endDate = date2 || new Date().toISOString().split("T")[0];

      // 1. Fetch list of goals
      const goalsResp = await fetch(
        `https://api-metrika.yandex.net/management/v1/counter/${counterId}/goals`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );

      if (!goalsResp.ok) {
        const errData = await goalsResp.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: errData.message || "Failed to fetch goals", goals: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const goalsData = await goalsResp.json();
      const goals = goalsData.goals || [];

      if (goals.length === 0) {
        return new Response(
          JSON.stringify({ goals: [], stats: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Fetch stats for each goal (batch up to 10 goals in one request)
      const goalIds = goals.slice(0, 20).map((g: any) => g.id);
      const metricsArr = goalIds.flatMap((gid: number) => [
        `ym:s:goal${gid}reaches`,
        `ym:s:goal${gid}conversionRate`,
      ]);

      // Fetch totals for current period
      const statsResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=${metricsArr.join(",")}&date1=${startDate}&date2=${endDate}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const statsData = await statsResp.json();

      // Fetch daily reaches for sparklines (top 5 goals only)
      const top5Ids = goalIds.slice(0, 5);
      const dailyMetrics = top5Ids.map((gid: number) => `ym:s:goal${gid}reaches`).join(",");
      const dailyResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data/bytime?id=${counterId}&metrics=${dailyMetrics}&group=day&date1=${startDate}&date2=${endDate}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const dailyData = await dailyResp.json();

      // Also fetch previous period for change calculation
      const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
      const prevEnd = new Date(new Date(startDate).getTime() - 86400000).toISOString().split("T")[0];
      const prevStart = new Date(new Date(startDate).getTime() - (daysDiff + 1) * 86400000).toISOString().split("T")[0];

      const prevResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=${metricsArr.join(",")}&date1=${prevStart}&date2=${prevEnd}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const prevData = await prevResp.json();

      // Build results
      const totals = statsData?.data?.[0]?.metrics || [];
      const prevTotals = prevData?.data?.[0]?.metrics || [];

      const goalStats = goalIds.map((gid: number, idx: number) => {
        const goal = goals.find((g: any) => g.id === gid);
        const reaches = totals[idx * 2] || 0;
        const convRate = totals[idx * 2 + 1] || 0;
        const prevReaches = prevTotals[idx * 2] || 0;
        const change = prevReaches > 0 ? ((reaches - prevReaches) / prevReaches) * 100 : 0;

        // Daily sparkline data
        let daily: number[] = [];
        const top5Index = top5Ids.indexOf(gid);
        if (top5Index >= 0 && dailyData?.data?.[0]?.metrics?.[top5Index]) {
          daily = dailyData.data[0].metrics[top5Index];
        }

        return {
          id: gid,
          name: goal?.name || `Goal ${gid}`,
          type: goal?.type || "unknown",
          reaches: Math.round(reaches),
          conversionRate: Math.round(convRate * 100) / 100,
          change: Math.round(change * 10) / 10,
          daily,
        };
      });

      // Sort by reaches descending
      goalStats.sort((a: any, b: any) => b.reaches - a.reaches);

      return new Response(
        JSON.stringify({ goals: goalStats }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
