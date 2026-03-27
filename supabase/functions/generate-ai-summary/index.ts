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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { project_id, language } = body;

    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch metrika stats
    const { data: stats } = await supabase
      .from("metrika_stats")
      .select("*")
      .eq("project_id", project_id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch project info
    const { data: project } = await supabase
      .from("projects")
      .select("name, url")
      .eq("id", project_id)
      .single();

    const lang = language === "en" ? "English" : "Russian";

    let dataContext = "";
    if (stats) {
      const visitsByDay = stats.visits_by_day || [];
      dataContext = `
Yandex Metrika data for project "${project?.name || "Unknown"}" (${project?.url || ""}):
- Period: ${stats.date_from} to ${stats.date_to}
- Total visits: ${stats.total_visits}
- Bounce rate: ${stats.bounce_rate}%
- Page depth: ${stats.page_depth}
- Average visit duration: ${stats.avg_duration_seconds} seconds
- Daily visits trend: ${JSON.stringify(visitsByDay.slice(-10))}
`;
    } else {
      dataContext = `No analytics data available yet for project "${project?.name || "Unknown"}". Provide general SEO recommendations.`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert SEO analyst. Provide a concise performance summary in ${lang}. Return ONLY valid JSON with exactly 3 fields: "happened" (what happened with the metrics), "why" (analysis of why), "recommendation" (actionable next steps). Each field should be 1-3 sentences. No markdown, no code blocks, just raw JSON.`,
          },
          {
            role: "user",
            content: dataContext,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `AI service error: ${aiResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let summary;
    try {
      summary = JSON.parse(content);
    } catch {
      summary = { happened: content, why: "", recommendation: "" };
    }

    return new Response(JSON.stringify({ summary }), {
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
