// generate-audit-report — generates a technical SEO audit report (Markdown)
// using OpenRouter (Claude Sonnet 4.5). Mirrors the auth/key pattern from ai-junior-assistant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

const SYSTEM_PROMPT = `Ты — опытный Senior SEO-специалист. Сформируй технический отчёт по аудиту сайта.

Для каждой найденной ошибки напиши ТЗ для исправления в формате:

Исполнитель: [программист/SEO-специалист/контент-менеджер]

Задача: [конкретное техническое задание]

Приоритет: [высокий/средний/низкий]

Отвечай на русском языке в формате Markdown. Структурируй отчёт по разделам: краткое резюме, ключевые метрики, список найденных проблем с ТЗ для каждой, итоговые рекомендации.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validate body
    const body = await req.json().catch(() => null) as { job_id?: string } | null;
    const jobId = body?.job_id;
    if (!jobId || typeof jobId !== "string") {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 3. Load audit data
    const [{ data: job, error: jobErr }, { data: stats }, { data: issues }] = await Promise.all([
      admin.from("crawl_jobs").select("id, url, project_id, status, started_at, finished_at, progress").eq("id", jobId).maybeSingle(),
      admin.from("crawl_stats").select("*").eq("job_id", jobId).maybeSingle(),
      admin.from("crawl_issues")
        .select("severity, type, code, message, details, page_id, crawl_pages(url)")
        .eq("job_id", jobId)
        .order("severity", { ascending: true })
        .limit(300),
    ]);

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Audit job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Build error list for the prompt
    const issueRows = (issues || []).map((i: any) => {
      const url = i.crawl_pages?.url || "(сайт в целом)";
      const msg = i.message || i.details?.message || "";
      return `- [${i.severity?.toUpperCase() || "INFO"}] ${i.type} (${i.code}) — ${url}${msg ? " — " + msg : ""}`;
    }).join("\n") || "(ошибок не найдено)";

    const statsBlock = stats ? `
- Всего страниц: ${stats.total_pages}
- Всего проблем: ${stats.total_issues}
- Критических: ${stats.critical_count}
- Предупреждений: ${stats.warning_count}
- Информационных: ${stats.info_count}
- Средняя скорость загрузки: ${stats.avg_load_time_ms} мс
- Итоговая оценка: ${stats.score}/100
` : "(статистика недоступна)";

    const userPrompt = `## Данные аудита

**Сайт:** ${job.url}
**Дата запуска:** ${job.started_at || "—"}
**Дата завершения:** ${job.finished_at || "—"}

### Сводная статистика:
${statsBlock}

### Найденные ошибки (${(issues || []).length}):
${issueRows}

Сформируй технический отчёт с ТЗ для каждой проблемы согласно инструкции.`;

    // 5. Call OpenRouter (Claude Sonnet 4.5)
    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://statpulse.app",
        "X-Title": "StatPulse Audit Report",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов, попробуйте позже." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Закончились кредиты, пополните баланс." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("OpenRouter error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const report: string = aiJson.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({
      job_id: jobId,
      url: job.url,
      report,
      issues_count: (issues || []).length,
      generated_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-audit-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
