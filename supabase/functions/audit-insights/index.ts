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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { job_id, project_id } = body;

    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
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

    // Project info
    let projectInfo: any = null;
    if (project_id) {
      const { data } = await supabase.from("projects").select("name, url").eq("id", project_id).maybeSingle();
      projectInfo = data;
    }

    // Stats
    const { data: stats } = await supabase
      .from("crawl_stats")
      .select("*")
      .eq("job_id", job_id)
      .maybeSingle();

    // Issues — group by code+severity
    const { data: issues } = await supabase
      .from("crawl_issues")
      .select("code, severity, type")
      .eq("job_id", job_id);

    const groups = new Map<string, { code: string; severity: string; type: string; count: number }>();
    for (const i of (issues ?? [])) {
      const k = `${i.severity}|${i.code}`;
      const g = groups.get(k);
      if (g) g.count += 1;
      else groups.set(k, { code: i.code, severity: i.severity, type: i.type, count: 1 });
    }
    const grouped = Array.from(groups.values()).sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      const sa = sevOrder[a.severity] ?? 3;
      const sb = sevOrder[b.severity] ?? 3;
      if (sa !== sb) return sa - sb;
      return b.count - a.count;
    });

    const top = grouped.slice(0, 30);

    const summary = {
      site: projectInfo?.url || "—",
      project: projectInfo?.name || "—",
      total_pages: stats?.total_pages ?? 0,
      score: stats?.score ?? 0,
      critical: stats?.critical_count ?? 0,
      warnings: stats?.warning_count ?? 0,
      info: stats?.info_count ?? 0,
      avg_ttfb_ms: stats?.avg_load_time_ms ?? 0,
      top_issues: top.map((g) => `[${g.severity}] ${g.code} (${g.type}) — ${g.count} стр.`).join("\n"),
    };

    const prompt = `Ты — старший SEO-специалист. Проанализируй результаты технического аудита сайта и дай краткие выводы и рекомендации на русском языке.

Сайт: ${summary.site}
Проект: ${summary.project}
Всего страниц: ${summary.total_pages}
Оценка сайта: ${summary.score}/100
Критических ошибок: ${summary.critical}
Предупреждений: ${summary.warnings}
Информационных: ${summary.info}
Средний TTFB: ${summary.avg_ttfb_ms} мс

Топ проблем (код / тип / кол-во страниц):
${summary.top_issues || "Проблем не обнаружено"}

Верни СТРОГО валидный JSON по схеме:
{
  "verdict": "1-2 предложения общего вердикта о состоянии сайта",
  "key_findings": ["3-5 ключевых выводов на основе данных"],
  "recommendations": [
    { "priority": "high" | "medium" | "low", "action": "конкретное действие", "reason": "зачем это нужно" }
  ]
}

Дай 4-6 рекомендаций. Сначала самые критичные. Будь конкретен и опирайся на цифры из аудита.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Ты эксперт по техническому SEO. Отвечай только валидным JSON без обёрток ```json." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI failed", detail: t }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    let content = aiJson?.choices?.[0]?.message?.content ?? "";
    content = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: "AI returned non-JSON", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ insights: parsed, generated_at: new Date().toISOString() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
