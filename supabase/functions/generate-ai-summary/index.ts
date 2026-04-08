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
    const {
      project_id, language, period_a, period_b,
      traffic_sources, mode,
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

    // Build data context from live_metrics (preferred) or cached DB
    let dataContext = "";

    if (live_metrics) {
      const m = live_metrics;
      dataContext = `
Данные Яндекс.Метрики для проекта "${project?.name || "Неизвестный"}" (${project?.url || ""}):
- Период: ${m.dateFrom || "Н/Д"} — ${m.dateTo || "Н/Д"}
- Всего визитов: ${m.visits ?? "Н/Д"}
- Всего пользователей: ${m.users ?? "Н/Д"}
- Показатель отказов: ${m.bounceRate ?? "Н/Д"}%
- Глубина просмотра: ${m.pageDepth ?? "Н/Д"}
- Средняя длительность визита: ${m.avgDuration ?? "Н/Д"} сек.
`;
      if (m.dailyVisits?.length) {
        dataContext += `- Динамика визитов (последние 10 дней): ${JSON.stringify(m.dailyVisits.slice(-10))}\n`;
      }
      if (m.sourceBreakdown?.length) {
        dataContext += `\nИсточники трафика:\n`;
        for (const src of m.sourceBreakdown) {
          dataContext += `- ${src.name}: ${src.value} визитов (${src.pct}%)\n`;
        }
      }
      if (m.topPages?.length) {
        dataContext += `\nТоп страницы:\n`;
        for (const p of m.topPages.slice(0, 10)) {
          dataContext += `- ${p.path}: ${p.visits} визитов\n`;
        }
      }
      if (m.devices?.length) {
        dataContext += `\nУстройства:\n`;
        for (const d of m.devices) {
          dataContext += `- ${d.name}: ${d.value} визитов (${d.pct}%)\n`;
        }
      }
      if (m.keywordsContext) {
        const kw = m.keywordsContext;
        dataContext += `\nПозиции ключевых слов (Topvisor):\n`;
        dataContext += `- Всего отслеживаемых запросов: ${kw.total}\n`;
        dataContext += `- Топ-3: ${kw.top3}, Топ-10: ${kw.top10}, Топ-30: ${kw.top30}\n`;
        dataContext += `- Средняя позиция: ${kw.avgPosition}\n`;
        dataContext += `- Выросли: ${kw.improved}, Упали: ${kw.declined}\n`;
        if (kw.topKeywords?.length) {
          dataContext += `- Топ запросы: ${kw.topKeywords.join("; ")}\n`;
        }
      }
      if (m.selectedChannels?.length) {
        dataContext += `\nВЫБРАННЫЕ КАНАЛЫ для анализа: ${m.selectedChannels.join(", ")}\n`;
        dataContext += `ВАЖНО: Приоритетно анализируй именно эти каналы, особенно "search" (поисковый/органический трафик).\n`;
      }
      if (m.goalsContext) {
        const gc = m.goalsContext;
        dataContext += `\nЦели и конверсии:\n`;
        dataContext += `- Настроено целей: ${gc.total}\n`;
        dataContext += `- Всего достижений целей: ${gc.totalReaches}\n`;
        dataContext += `- Средний CR: ${gc.avgConversionRate}%\n`;
        if (gc.goals?.length) {
          dataContext += `- Детали по целям:\n`;
          for (const g of gc.goals) {
            dataContext += `  • "${g.name}": ${g.reaches} достижений, CR ${g.cr}%, изменение ${g.change > 0 ? "+" : ""}${g.change}%\n`;
          }
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
Данные Яндекс.Метрики для проекта "${project?.name || "Неизвестный"}" (${project?.url || ""}):
- Период: ${period_a?.from || stats.date_from} — ${period_a?.to || stats.date_to}
- Всего визитов: ${stats.total_visits}
- Показатель отказов: ${stats.bounce_rate}%
- Глубина просмотра: ${stats.page_depth}
- Средняя длительность визита: ${stats.avg_duration_seconds} сек.
- Динамика визитов (последние 10 дней): ${JSON.stringify((visitsByDay as any[]).slice(-10))}
`;
        const sources = traffic_sources || (stats as any).traffic_sources || [];
        if (sources.length > 0) {
          dataContext += `\nИсточники трафика:\n`;
          for (const src of sources) {
            dataContext += `- ${src.source || src.name}: ${src.visits || src.value} визитов\n`;
          }
        }
      } else {
        dataContext = `Нет данных аналитики для проекта "${project?.name || "Неизвестный"}". Дай общие SEO-рекомендации.`;
      }
    }

    if (period_b) {
      dataContext += `
Период сравнения B: ${period_b.from} — ${period_b.to}
Метрики периода B:
- Визиты: ${period_b.visits ?? "Н/Д"}
- Показатель отказов: ${period_b.bounceRate ?? "Н/Д"}%
- Изменение трафика: ${period_b.trafficDelta ?? "Н/Д"}%
- Изменение конверсий: ${period_b.conversionDelta ?? "Н/Д"}%
`;
    }

    const isDeep = mode === "deep_analysis";

    const systemPrompt = isDeep
      ? `Ты — эксперт SEO-аналитик и маркетолог уровня Senior. Проведи глубокий анализ предоставленных метрик сайта.
ВАЖНО: Приоритетно анализируй поисковый (органический) трафик, если он среди выбранных каналов.
КРИТИЧНО: ВСЕ тексты в ответе ДОЛЖНЫ быть СТРОГО на русском языке. Никакого английского текста.

Верни ТОЛЬКО валидный JSON следующей структуры:
{
  "general": {
    "happened": "2-3 предложения об общих метриках и трендах, с акцентом на поисковый трафик",
    "why": "2-3 предложения с анализом причин",
    "recommendation": "2-3 предложения с конкретными рекомендациями"
  },
  "channels": {
    "search": { "insight": "1-2 предложения на русском", "trend": "up" или "down" или "stable" },
    "direct": { "insight": "1-2 предложения на русском", "trend": "up" или "down" или "stable" },
    "ad": { "insight": "1-2 предложения на русском", "trend": "up" или "down" или "stable" },
    "social": { "insight": "1-2 предложения на русском", "trend": "up" или "down" или "stable" },
    "referral": { "insight": "1-2 предложения на русском", "trend": "up" или "down" или "stable" }
  },
  "goals_insight": "2-4 предложения на русском с анализом целей, конверсий и их связи с каналами трафика. Если данных о целях нет — пропусти это поле.",
  "business_insight": "Детальный бизнес-анализ на 4-6 предложений на русском: ROI, конверсии и стратегические выводы",
  "recommendations": [
    { "text": "Конкретное действие на русском", "priority": "high", "category": "SEO" },
    { "text": "Конкретное действие на русском", "priority": "medium", "category": "Контент" },
    { "text": "Конкретное действие на русском", "priority": "high", "category": "Конверсии" },
    { "text": "Конкретное действие на русском", "priority": "low", "category": "Техничка" },
    { "text": "Конкретное действие на русском", "priority": "medium", "category": "UX" }
  ]
}

Правила:
- ВЕСЬ ответ ТОЛЬКО на русском языке. Без исключений. Каждое предложение на русском.
- Ровно 5 рекомендаций с разными приоритетами (high/medium/low) и категориями (SEO, Контент, Конверсии, Техничка, UX, Реклама).
- Если есть данные о целях/конверсиях — обязательно анализируй их в "goals_insight". Если конверсия упала при росте трафика — явно укажи это.
- Опирайся строго на предоставленные данные. Используй конкретные цифры.
- Включай только те каналы, которые пользователь выбрал в ВЫБРАННЫЕ КАНАЛЫ. Пропускай невыбранные.
- Ищи аномалии: резкий рост или падение.
${period_b ? "- Сравни Период A и Период B." : ""}
- Никакого markdown, только чистый JSON.`
      : `Ты — эксперт SEO-аналитик и маркетолог. Проанализируй предоставленные метрики сайта.
КРИТИЧНО: ВСЕ тексты в ответе ДОЛЖНЫ быть СТРОГО на русском языке. Никакого английского текста.

Верни ТОЛЬКО валидный JSON следующей структуры:
{
  "general": {
    "happened": "1-2 предложения об общих метриках на русском",
    "why": "1-2 предложения с анализом на русском",
    "recommendation": "1-2 предложения с рекомендациями на русском"
  },
  "channels": {
    "search": { "insight": "1-2 предложения о поисковом трафике на русском", "trend": "up" или "down" или "stable" },
    "direct": { "insight": "1-2 предложения о прямом трафике на русском", "trend": "up" или "down" или "stable" },
    "ad": { "insight": "1-2 предложения о рекламном трафике на русском", "trend": "up" или "down" или "stable" },
    "social": { "insight": "1-2 предложения о трафике из соцсетей на русском", "trend": "up" или "down" или "stable" },
    "referral": { "insight": "1-2 предложения о реферальном трафике на русском", "trend": "up" или "down" или "stable" }
  }
}

Правила:
- ВЕСЬ ответ ТОЛЬКО на русском языке. Без исключений.
- Для каждого канала анализируй его данные. Если данных нет — укажи что трафик незначительный.
- Ищи аномалии: резкий рост или падение. Укажи конкретную причину на основе данных.
- Если трафик вырос, а конверсия упала — явно укажи это.
${period_b ? "- Сравни Период A и Период B для каждого канала." : ""}
- Никакого markdown, только чистый JSON.`;

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
      if (parsed.goals_insight) result.goals_insight = parsed.goals_insight;
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
