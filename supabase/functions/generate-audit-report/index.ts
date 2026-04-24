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

    // 4. Group issues by type+code (instead of listing all URLs — keeps prompt short & response fast)
    const grouped = new Map<string, { severity: string; type: string; code: string; message: string; urls: string[] }>();
    for (const i of (issues || []) as any[]) {
      const key = `${i.type}::${i.code}`;
      const url = i.crawl_pages?.url;
      const g = grouped.get(key);
      if (g) {
        if (url && g.urls.length < 5) g.urls.push(url);
      } else {
        grouped.set(key, {
          severity: i.severity || "info",
          type: i.type,
          code: i.code,
          message: i.message || i.details?.message || "",
          urls: url ? [url] : [],
        });
      }
    }
    const groupedList = Array.from(grouped.values())
      .sort((a, b) => {
        const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
        return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
      })
      .slice(0, 40); // hard cap to keep response fast

    const issueRows = groupedList.map((g) => {
      const examples = g.urls.length
        ? `\n  Примеры URL (${g.urls.length}): ${g.urls.slice(0, 3).join(", ")}`
        : "";
      return `- [${g.severity.toUpperCase()}] ${g.type} (${g.code})${g.message ? " — " + g.message : ""}${examples}`;
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
**Дата завершения:** ${job.finished_at || "—"}

### Сводная статистика:
${statsBlock}

### Найденные проблемы (${groupedList.length} типов, всего ${(issues || []).length} вхождений):
${issueRows}

Сформируй технический отчёт с ТЗ для каждого типа проблемы согласно инструкции.`;

    // 5. Call OpenRouter (Claude Sonnet 4.5) — streaming to avoid 504 gateway timeout
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
        stream: true,
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

    // 6. Parse SSE stream from OpenRouter and emit our own SSE that contains:
    //    - keep-alive comments (`: ping`) every chunk to prevent 504
    //    - final `data: {"report": "..."}` event with full markdown
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const reader = aiResp.body!.getReader();
        let buf = "";
        let assistantText = "";
        // initial keep-alive
        controller.enqueue(encoder.encode(": connected\n\n"));
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            // emit keep-alive on every upstream chunk
            controller.enqueue(encoder.encode(": ping\n\n"));
            let idx;
            while ((idx = buf.indexOf("\n")) !== -1) {
              let line = buf.slice(0, idx);
              buf = buf.slice(idx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const c = parsed.choices?.[0]?.delta?.content;
                if (c) assistantText += c;
              } catch { /* partial */ }
            }
          }
          const payload = JSON.stringify({
            job_id: jobId,
            url: job.url,
            report: assistantText,
            issues_count: (issues || []).length,
            generated_at: new Date().toISOString(),
          });
          controller.enqueue(encoder.encode(`event: result\ndata: ${payload}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } catch (e) {
          console.error("stream error:", e);
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("generate-audit-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
