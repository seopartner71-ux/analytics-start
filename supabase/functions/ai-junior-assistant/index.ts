// AI Junior Assistant — streaming chat for SEO juniors
// Uses Lovable AI Gateway (openai/gpt-5-mini)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface ChatMsg { role: "user" | "assistant" | "system"; content: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const { messages, projectId } = await req.json() as {
      messages: ChatMsg[]; projectId?: string | null;
    };
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1.5 RAG: get last user question and search PDF knowledge base
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    let ragChunks: Array<{ content: string; source: string; page_number: number; similarity: number }> = [];
    if (lastUserMsg && Deno.env.get("OPENAI_API_KEY")) {
      try {
        const er = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: lastUserMsg.content.slice(0, 8000) }),
        });
        if (er.ok) {
          const ej = await er.json();
          const { data: matches } = await admin.rpc("match_chunks", {
            query_embedding: ej.data[0].embedding as any,
            match_threshold: 0.35,
            match_count: 5,
          });
          ragChunks = matches || [];
        }
      } catch (e) {
        console.warn("RAG search skipped:", e);
      }
    }

    // 2. Build context (system prompt, standards, KB titles, user tasks, project)
    const [
      { data: settingRow },
      { data: standards },
      { data: kbTitles },
      { data: tasks },
      { data: onbTasks },
      projectRow,
    ] = await Promise.all([
      admin.from("app_settings").select("value").eq("key", "ai_assistant_system_prompt").maybeSingle(),
      admin.from("knowledge_articles").select("title, content").eq("category", "standards").limit(20),
      admin.from("knowledge_articles").select("id, title, category, tags").order("updated_at", { ascending: false }).limit(80),
      admin.from("crm_tasks").select("title, stage, deadline, project_id").eq("assignee_id", user.id).neq("stage", "Завершена").neq("stage", "Принята").limit(20),
      admin.from("onboarding_tasks").select("title, status, week, period, due_date, project_id").eq("assignee_id", user.id).neq("status", "done").limit(20),
      projectId ? admin.from("projects").select("name, url").eq("id", projectId).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const systemPrompt = settingRow?.value || "Ты внутренний SEO-ассистент компании. Помогаешь junior SEO-специалистам.";

    const standardsBlock = (standards || [])
      .map((s: any) => `### ${s.title}\n${(s.content || "").slice(0, 1500)}`)
      .join("\n\n") || "(стандарты пока не заполнены)";

    const kbList = (kbTitles || [])
      .map((a: any) => `- [${a.category}] ${a.title}${a.tags?.length ? " (теги: " + a.tags.join(", ") + ")" : ""}`)
      .join("\n") || "(база знаний пуста)";

    const tasksList = [
      ...(tasks || []).map((t: any) => `- [CRM] ${t.title} — ${t.stage}${t.deadline ? ", дедлайн " + t.deadline.slice(0,10) : ""}`),
      ...(onbTasks || []).map((t: any) => `- [Онбординг П${t.period}/Н${t.week}] ${t.title} — ${t.status}${t.due_date ? ", до " + t.due_date : ""}`),
    ].join("\n") || "(активных задач нет)";

    const proj = (projectRow as any)?.data;
    const projectBlock = proj ? `\n\nТекущий открытый проект: ${proj.name}${proj.url ? " (" + proj.url + ")" : ""}` : "";

    const fullSystem = `${systemPrompt}

---
## Стандарты компании (из базы знаний):
${standardsBlock}

---
## Доступные статьи базы знаний (если релевантно — посоветуй прочитать):
${kbList}

---
## Текущие задачи пользователя:
${tasksList}${projectBlock}`;

    // 3. Save user message (last one)
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      await admin.from("ai_assistant_messages").insert({
        user_id: user.id, role: "user", content: lastUser.content,
      });
    }

    // 4. Call Lovable AI Gateway with streaming
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [{ role: "system", content: fullSystem }, ...messages],
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
        return new Response(JSON.stringify({ error: "Закончились кредиты Lovable AI. Пополните в настройках workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Tee stream to capture full assistant reply for DB while streaming to client
    const [a, b] = aiResp.body!.tee();

    (async () => {
      try {
        const reader = b.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let assistantText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
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
        if (assistantText.trim()) {
          await admin.from("ai_assistant_messages").insert({
            user_id: user.id, role: "assistant", content: assistantText,
          });
        }
      } catch (e) {
        console.error("save assistant error:", e);
      }
    })();

    return new Response(a, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-junior-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
