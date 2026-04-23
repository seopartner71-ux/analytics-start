import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Per-token concurrency limiter + quota-aware retry ---
// Yandex Metrika rejects parallel requests from the same user with:
// "Quota exceeded for quantity of parallel user requests".
// We serialize fetches per access_token and retry transient quota errors.
const tokenQueues = new Map<string, Promise<unknown>>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function yandexFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const key = token || "anon";
  const prev = tokenQueues.get(key) ?? Promise.resolve();
  const run = prev.then(async () => {
    const headers = { ...(init.headers || {}), Authorization: `OAuth ${token}` };
    let lastResp: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const resp = await fetch(url, { ...init, headers });
      if (resp.status !== 429 && resp.status !== 503) {
        // Inspect body for "Quota exceeded" even on non-429 (Yandex sometimes returns 400/200)
        const cloned = resp.clone();
        const text = await cloned.text();
        if (/Quota exceeded/i.test(text) && attempt < 3) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        // Re-create response since we consumed clone (original body still intact)
        return resp;
      }
      lastResp = resp;
      await sleep(500 * (attempt + 1));
    }
    return lastResp as Response;
  });
  tokenQueues.set(key, run.catch(() => {}));
  try {
    return (await run) as Response;
  } finally {
    if (tokenQueues.get(key) === run.catch(() => {})) tokenQueues.delete(key);
  }
}

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
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
      const authUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&force_confirm=yes`;
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

      // Common params for data accuracy: exclude robots, full accuracy, cross-device attribution
      const accuracyParams = "robot_less=1&accuracy=full&attribution=lastsign";

      // Fetch visits by day
      const visitsResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data/bytime?id=${counterId}&metrics=ym:s:visits,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds&group=day&date1=${startDate}&date2=${endDate}&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );

      const visitsData = await visitsResp.json();
      if (!visitsResp.ok) {
        return new Response(
          JSON.stringify({ error: visitsData.message || "Failed to fetch stats" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch totals (including ym:s:users for Visitors count)
      const totalsResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds&date1=${startDate}&date2=${endDate}&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );

      const totalsData = await totalsResp.json();

      // Fetch traffic sources
      const sourcesResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=ym:s:visits&dimensions=ym:s:lastSignTrafficSource&date1=${startDate}&date2=${endDate}&limit=20&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const sourcesData = await sourcesResp.json();

      // Fetch top pages
      const pagesResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=ym:s:visits,ym:s:pageviews&dimensions=ym:s:startURL&date1=${startDate}&date2=${endDate}&limit=10&sort=-ym:s:visits&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const pagesData = await pagesResp.json();

      // Fetch device category distribution
      const devicesResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=ym:s:visits&dimensions=ym:s:deviceCategory&date1=${startDate}&date2=${endDate}&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const devicesData = await devicesResp.json();

      return new Response(
        JSON.stringify({
          timeSeries: visitsData,
          totals: totalsData,
          trafficSources: sourcesData,
          topPages: pagesData,
          devices: devicesData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: fetch stats filtered by traffic channel
    if (action === "fetch-channel-stats") {
      const body = await req.json();
      const { access_token: accessToken, counter_id: counterId, date1, date2, channel } = body;
      if (!accessToken || !counterId || !channel) {
        return new Response(
          JSON.stringify({ error: "access_token, counter_id and channel are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const startDate = date1 || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const endDate = date2 || new Date().toISOString().split("T")[0];
      const accuracyParams = "robot_less=1&accuracy=full&attribution=lastsign";

      // Map channel to Metrika traffic source filter
      const channelFilterMap: Record<string, string> = {
        organic: "organic",
        direct: "direct",
        ad: "ad",
        social: "social",
        referral: "referral",
      };
      const sourceFilter = channelFilterMap[channel];
      if (!sourceFilter) {
        return new Response(
          JSON.stringify({ error: `Unknown channel: ${channel}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const filterParam = `&filters=ym:s:lastSignTrafficSource=='${sourceFilter}'`;

      // Fetch totals for the channel
      const totalsResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds&date1=${startDate}&date2=${endDate}&${accuracyParams}${filterParam}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );

      const totalsData = await totalsResp.json();

      // Fetch daily visits for the channel
      const dailyResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data/bytime?id=${counterId}&metrics=ym:s:visits&group=day&date1=${startDate}&date2=${endDate}&${accuracyParams}${filterParam}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );

      const dailyData = await dailyResp.json();

      return new Response(
        JSON.stringify({
          totals: totalsData,
          timeSeries: dailyData,
          channel,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    if (action === "fetch-goals") {
      const body = await req.json();
      const { access_token: accessToken, counter_id: counterId, date1, date2, traffic_source } = body;
      if (!accessToken || !counterId) {
        return new Response(
          JSON.stringify({ error: "access_token and counter_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const startDate = date1 || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const endDate = date2 || new Date().toISOString().split("T")[0];
      let accuracyParams = "robot_less=1&accuracy=full&attribution=lastsign";
      
      // Add traffic source filter if specified
      if (traffic_source === "organic") {
        accuracyParams += "&filters=ym:s:lastSignTrafficSource=='organic'";
      } else if (traffic_source === "direct") {
        accuracyParams += "&filters=ym:s:lastSignTrafficSource=='direct'";
      } else if (traffic_source === "referral") {
        accuracyParams += "&filters=ym:s:lastSignTrafficSource=='referral'";
      } else if (traffic_source === "social") {
        accuracyParams += "&filters=ym:s:lastSignTrafficSource=='social'";
      } else if (traffic_source === "ad") {
        accuracyParams += "&filters=ym:s:lastSignTrafficSource=='ad'";
      }

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
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=${metricsArr.join(",")}&date1=${startDate}&date2=${endDate}&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const statsData = await statsResp.json();

      // Fetch daily reaches for sparklines (all goals)
      const top5Ids = goalIds;
      const dailyMetrics = top5Ids.map((gid: number) => `ym:s:goal${gid}reaches`).join(",");
      const dailyResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data/bytime?id=${counterId}&metrics=${dailyMetrics}&group=day&date1=${startDate}&date2=${endDate}&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const dailyData = await dailyResp.json();

      // Also fetch previous period for change calculation
      const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
      const prevEnd = new Date(new Date(startDate).getTime() - 86400000).toISOString().split("T")[0];
      const prevStart = new Date(new Date(startDate).getTime() - (daysDiff + 1) * 86400000).toISOString().split("T")[0];

      const prevResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=${metricsArr.join(",")}&date1=${prevStart}&date2=${prevEnd}&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const prevData = await prevResp.json();

      // Build results
      const totals = statsData?.data?.[0]?.metrics || [];
      const prevTotals = prevData?.data?.[0]?.metrics || [];

      const goalStats = goalIds.map((gid: number, idx: number) => {
        const goal = goals.find((g: any) => g.id === gid);
        let reaches = totals[idx * 2] || 0;
        const convRate = totals[idx * 2 + 1] || 0;
        const prevReaches = prevTotals[idx * 2] || 0;

        // Daily sparkline data
        let daily: number[] = [];
        const top5Index = top5Ids.indexOf(gid);
        if (top5Index >= 0 && dailyData?.data?.[0]?.metrics?.[top5Index]) {
          daily = dailyData.data[0].metrics[top5Index];
        }

        // Fallback: if API totals returned 0 but daily has data, sum daily
        if (reaches === 0 && daily.length > 0) {
          reaches = daily.reduce((sum: number, v: number) => sum + v, 0);
        }

        // Calculate change from previous period (also try summing daily for prev if needed)
        let prevReachesCalc = prevReaches;
        const change = prevReachesCalc > 0 ? ((reaches - prevReachesCalc) / prevReachesCalc) * 100 : 0;

        // Calculate conversion rate from reaches/visits if API returned 0
        let conversionRate = Math.round(convRate * 100) / 100;

        return {
          id: gid,
          name: goal?.name || `Goal ${gid}`,
          type: goal?.type || "unknown",
          reaches: Math.round(reaches),
          conversionRate,
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

    // Action: fetch search phrases (search engines breakdown)
    if (action === "fetch-search-phrases") {
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
      const accuracyParams = "robot_less=1&accuracy=full&attribution=lastsign";

      // Fetch search phrases with engine breakdown using lastSign* dimensions
      // (required for lastsign attribution to match Metrika UI defaults)
      const phrasesResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds&dimensions=ym:s:lastSignSearchEngineRoot,ym:s:lastSignSearchPhrase&date1=${startDate}&date2=${endDate}&limit=10000&sort=-ym:s:visits&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );

      if (!phrasesResp.ok) {
        const errData = await phrasesResp.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: errData.message || "Failed to fetch search phrases" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const phrasesData = await phrasesResp.json();

      // Also fetch engine-level totals
      const enginesResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?id=${counterId}&metrics=ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds&dimensions=ym:s:lastSignSearchEngineRoot&date1=${startDate}&date2=${endDate}&limit=50&sort=-ym:s:visits&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const enginesData = await enginesResp.json();

      // Fetch daily trend by search engine (limit=50 for all engines)
      const trendResp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data/bytime?id=${counterId}&metrics=ym:s:visits&dimensions=ym:s:lastSignSearchEngineRoot&group=day&date1=${startDate}&date2=${endDate}&limit=50&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );
      const trendData = await trendResp.json();

      return new Response(
        JSON.stringify({
          phrases: phrasesData,
          engines: enginesData,
          trend: trendData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: fetch traffic sources by day (for dynamics chart)
    if (action === "fetch-traffic-by-source-daily") {
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
      const accuracyParams = "robot_less=1&accuracy=full&attribution=lastsign";

      // Fetch visits by day broken down by traffic source
      const resp = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data/bytime?id=${counterId}&metrics=ym:s:visits&dimensions=ym:s:lastSignTrafficSource&group=day&date1=${startDate}&date2=${endDate}&limit=50&${accuracyParams}`,
        { headers: { Authorization: `OAuth ${accessToken}` } }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: errData.message || "Failed to fetch traffic by source" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rawData = await resp.json();
      return new Response(
        JSON.stringify(rawData),
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
