// Cron-friendly edge function: проверяет статус ссылок ссылочного профиля
// Запрашивает донорскую страницу и ищет acceptor_url или anchor в HTML.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FETCH_TIMEOUT_MS = 15000;
const MAX_PER_RUN = 200;

async function fetchWithTimeout(url: string): Promise<{ ok: boolean; status: number; html: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "StatPulse-LinkChecker/1.0 (+https://statpulse.app)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    const html = res.ok ? await res.text() : "";
    return { ok: res.ok, status: res.status, html };
  } catch (e) {
    return { ok: false, status: 0, html: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    return (url.host + url.pathname).replace(/\/$/, "").toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

function checkLinkInHtml(html: string, acceptorUrl: string, anchor: string): boolean {
  if (!html) return false;
  const lower = html.toLowerCase();
  const acceptorNorm = normalizeUrl(acceptorUrl);
  // Простой поиск: href содержит акцептор (без схемы/слеша)
  if (lower.includes(acceptorNorm)) return true;
  if (acceptorUrl && lower.includes(acceptorUrl.toLowerCase())) return true;
  // Резервно: длинный анкор в HTML
  if (anchor && anchor.length >= 5 && lower.includes(anchor.toLowerCase())) {
    // дополнительно проверим, что рядом есть href
    const idx = lower.indexOf(anchor.toLowerCase());
    const window = lower.slice(Math.max(0, idx - 200), idx + 200);
    if (window.includes("href")) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let projectId: string | null = null;
    let linkIds: string[] | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      projectId = body.project_id ?? null;
      linkIds = Array.isArray(body.link_ids) ? body.link_ids : null;
    }

    let q = supabase
      .from("link_profile")
      .select("id, donor_url, acceptor_url, anchor, status")
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(MAX_PER_RUN);
    if (projectId) q = q.eq("project_id", projectId);
    if (linkIds && linkIds.length > 0) q = q.in("id", linkIds);

    const { data: links, error } = await q;
    if (error) throw error;

    const results: Array<{ id: string; status: string; status_code: number }> = [];

    for (const link of links ?? []) {
      const r = await fetchWithTimeout(link.donor_url);
      let newStatus: "active" | "lost" | "pending" = "pending";
      let errorMsg: string | null = r.error ?? null;

      if (!r.ok) {
        newStatus = "lost";
        if (!errorMsg) errorMsg = `HTTP ${r.status}`;
      } else if (checkLinkInHtml(r.html, link.acceptor_url, link.anchor)) {
        newStatus = "active";
        errorMsg = null;
      } else {
        newStatus = "lost";
        errorMsg = "Ссылка не найдена на странице донора";
      }

      await supabase.from("link_profile").update({
        status: newStatus,
        last_checked_at: new Date().toISOString(),
        last_status_code: r.status,
        last_error: errorMsg,
      }).eq("id", link.id);

      results.push({ id: link.id, status: newStatus, status_code: r.status });
    }

    return new Response(
      JSON.stringify({ ok: true, checked: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
