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
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      project_id, language, period_a, period_b,
      traffic_sources, mode,
      // Live data from client
      live_metrics,
    } = body;

    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch project info
    const { data: project } = await supabase
      .from("projects")
      .select("name, url")
      .eq("id", project_id)
      .single();

    const lang = language === "en" ? "English" : "Russian";

    // Build data context from live_metrics (preferred) or cached DB
    let dataContext = "";

    if (live_metrics) {
      // Client sent live data from Metrika API
      const m = live_metrics;
      dataContext = `
Yandex Metrika LIVE data for project "${project?.name || "Unknown"}" (${project?.url || ""}):
- Period: ${m.dateFrom || "N/A"} to ${m.dateTo || "N/A"}
- Total visits: ${m.visits ?? "N/A"}
- Total users: ${m.users ?? "N/A"}
- Bounce rate: ${m.bounceRate ?? "N/A"}%
- Page depth: ${m.pageDepth ?? "N/A"}
- Average visit duration: ${m.avgDuration ?? "N/A"} seconds
`;
      if (m.dailyVisits?.length) {
        dataContext += `- Daily visits trend (last 10 days): ${JSON.stringify(m.dailyVisits.slice(-10))}\n`;
      }
      if (m.sourceBreakdown?.length) {
        dataContext += `\nTraffic sources breakdown:\n`;
        for (const src of m.sourceBreakdown) {
          dataContext += `- ${src.name}: ${src.value} visits (${src.pct}%)\n`;
        }
      }
      if (m.topPages?.length) {
        dataContext += `\nTop pages:\n`;
        for (const p of m.topPages.slice(0, 10)) {
          dataContext += `- ${p.path}: ${p.visits} visits\n`;
        }
      }
      if (m.devices?.length) {
        dataContext += `\nDevice breakdown:\n`;
        for (const d of m.devices) {
          dataContext += `- ${d.name}: ${d.value} visits (${d.pct}%)\n`;
        }
      }
    } else {
      // Fallback: read cached stats from DB
      const { data: stats } = await supabase
        .from("metrika_stats")
        .select("*")
        .eq("project_id", project_id)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (stats) {
        const visitsByDay = stats.visits_by_day || [];
        dataContext = `
Yandex Metrika data for project "${project?.name || "Unknown"}" (${project?.url || ""}):
- Period: ${period_a?.from || stats.date_from} to ${period_a?.to || stats.date_to}
- Total visits: ${stats.total_visits}
- Bounce rate: ${stats.bounce_rate}%
- Page depth: ${stats.page_depth}
- Average visit duration: ${stats.avg_duration_seconds} seconds
- Daily visits trend (last 10 days): ${JSON.stringify((visitsByDay as any[]).slice(-10))}
`;
        const sources = traffic_sources || (stats as any).traffic_sources || [];
        if (sources.length > 0) {
          dataContext += `\nTraffic sources breakdown:\n`;
          for (const src of sources) {
            dataContext += `- ${src.source || src.name}: ${src.visits || src.value} visits\n`;
          }
        }
      } else {
        dataContext = `No analytics data available yet for project "${project?.name || "Unknown"}". Provide general SEO recommendations.`;
      }
    }

    if (period_b) {
      dataContext += `
Comparison Period B: ${period_b.from} to ${period_b.to}
Period B metrics:
- Visits: ${period_b.visits ?? "N/A"}
- Bounce rate: ${period_b.bounceRate ?? "N/A"}%
- Traffic change: ${period_b.trafficDelta ?? "N/A"}%
- Conversion change: ${period_b.conversionDelta ?? "N/A"}%
`;
    }

    const isDeep = mode === "deep_analysis";

    const systemPrompt = isDeep
      ? `You are an expert SEO and digital marketing analyst. Analyze the provided website metrics data in depth.

Return ONLY valid JSON with this exact structure:
{
  "general": {
    "happened": "2-3 sentences about overall metrics and trends",
    "why": "2-3 sentences root cause analysis",
    "recommendation": "2-3 sentences actionable advice"
  },
  "channels": {
    "search": { "insight": "1-2 sentences", "trend": "up" or "down" or "stable" },
    "direct": { "insight": "1-2 sentences", "trend": "up" or "down" or "stable" },
    "ad": { "insight": "1-2 sentences", "trend": "up" or "down" or "stable" },
    "social": { "insight": "1-2 sentences", "trend": "up" or "down" or "stable" },
    "referral": { "insight": "1-2 sentences", "trend": "up" or "down" or "stable" }
  },
  "business_insight": "A detailed 4-6 sentence business impact analysis covering ROI, conversion implications, and strategic outlook",
  "recommendations": [
    { "text": "Specific action item", "priority": "high", "category": "SEO" },
    { "text": "Specific action item", "priority": "medium", "category": "Content" },
    { "text": "Specific action item", "priority": "high", "category": "Ads" },
    { "text": "Specific action item", "priority": "low", "category": "Technical" },
    { "text": "Specific action item", "priority": "medium", "category": "UX" }
  ]
}

Rules:
- Answer in ${lang}.
- Provide exactly 5 recommendations with varied priorities (high/medium/low) and categories.
- Base analysis strictly on provided data. Be specific with numbers.
- Look for anomalies: sudden growth or decline.
- If traffic grew but conversion dropped — explicitly flag this.
${period_b ? "- Compare Period A and Period B." : ""}
- No markdown, no code blocks, just raw JSON.`
      : `You are an expert SEO and digital marketing analyst. Analyze the provided website metrics data.

Return ONLY valid JSON with this exact structure:
{
  "general": {
    "happened": "1-2 sentences about overall metrics",
    "why": "1-2 sentences analysis",
    "recommendation": "1-2 sentences actionable advice"
  },
  "channels": {
    "search": { "insight": "1-2 sentences about organic/search traffic performance", "trend": "up" or "down" or "stable" },
    "direct": { "insight": "1-2 sentences about direct traffic", "trend": "up" or "down" or "stable" },
    "ad": { "insight": "1-2 sentences about paid/ad traffic", "trend": "up" or "down" or "stable" },
    "social": { "insight": "1-2 sentences about social media traffic", "trend": "up" or "down" or "stable" },
    "referral": { "insight": "1-2 sentences about referral traffic", "trend": "up" or "down" or "stable" }
  }
}

Rules:
- Answer in ${lang}.
- For each channel, analyze its specific data if available. If no data for a channel, note it has no significant traffic.
- Look for anomalies: sudden growth or decline. Give a specific reason based on data.
- If traffic grew but conversion dropped — explicitly flag this.
${period_b ? "- Compare Period A and Period B for each channel." : ""}
- No markdown, no code blocks, just raw JSON.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: dataContext },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ error: `AI service error: ${aiResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        general: { happened: content, why: "", recommendation: "" },
        channels: {},
      };
    }

    // Normalize
    if (!parsed.general && parsed.happened) {
      parsed = {
        general: { happened: parsed.happened, why: parsed.why || "", recommendation: parsed.recommendation || "" },
        channels: parsed.channels || {},
      };
    }

    const result: Record<string, any> = { summary: { general: parsed.general, channels: parsed.channels || {} } };
    if (isDeep) {
      if (parsed.business_insight) result.business_insight = parsed.business_insight;
      if (parsed.recommendations) result.recommendations = parsed.recommendations;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
