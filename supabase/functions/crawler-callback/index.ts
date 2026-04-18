import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-crawler-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Crawler callback (public — protected by shared CRAWLER_SECRET).
 *
 * Auth: header `x-crawler-secret: <CRAWLER_SECRET>`
 *
 * POST body (one of):
 *  { action: "update_job", job_id, status?, progress?, started_at?, finished_at?, error_message? }
 *  { action: "add_pages", job_id, pages: [{ url, status_code?, depth?, title?, description?, h1?, canonical?, is_indexed?, load_time_ms?, word_count? }, ...] }
 *  { action: "add_issues", job_id, issues: [{ page_url?, type, code, severity?, message?, details? }, ...] }
 *  { action: "save_stats", job_id, stats: { total_pages, total_issues, critical_count, warning_count, info_count, avg_load_time_ms, score } }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secret = Deno.env.get("CRAWLER_SECRET");
    if (!secret) {
      return json({ error: "Server not configured" }, 500);
    }
    const provided = req.headers.get("x-crawler-secret");
    if (provided !== secret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const action = body?.action as string;
    const job_id = body?.job_id as string;

    if (!action) return json({ error: "action is required" }, 400);

    // claim_job — атомарно берёт следующий pending job
    if (action === "claim_job") {
      const { data, error } = await supabase.rpc("claim_next_crawl_job");
      if (error) throw error;
      const job = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (!job) return json({ ok: true, job: null }); // нет заданий
      return json({ ok: true, job });
    }

    if (!job_id) return json({ error: "job_id is required" }, 400);

    // Verify job exists
    const { data: job, error: jobErr } = await supabase
      .from("crawl_jobs")
      .select("id")
      .eq("id", job_id)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) return json({ error: "Job not found" }, 404);

    if (action === "update_job") {
      const patch: Record<string, unknown> = {};
      for (const k of ["status", "progress", "started_at", "finished_at", "error_message"]) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      const { error } = await supabase.from("crawl_jobs").update(patch).eq("id", job_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "add_pages") {
      const pages = (body.pages || []) as any[];
      if (!Array.isArray(pages) || pages.length === 0) return json({ ok: true, inserted: 0 });
      const rows = pages.map((p) => ({ ...p, job_id }));
      const { data, error } = await supabase.from("crawl_pages").insert(rows).select("id, url");
      if (error) throw error;
      return json({ ok: true, inserted: data?.length ?? 0, pages: data });
    }

    if (action === "add_issues") {
      const issues = (body.issues || []) as any[];
      if (!Array.isArray(issues) || issues.length === 0) return json({ ok: true, inserted: 0 });

      // Resolve page_url -> page_id (if provided)
      const urls = Array.from(new Set(issues.map((i) => i.page_url).filter(Boolean)));
      const urlToId = new Map<string, string>();
      if (urls.length > 0) {
        const { data: pages } = await supabase
          .from("crawl_pages")
          .select("id, url")
          .eq("job_id", job_id)
          .in("url", urls);
        for (const p of pages || []) urlToId.set(p.url, p.id);
      }

      const rows = issues.map((i) => ({
        job_id,
        page_id: i.page_url ? urlToId.get(i.page_url) ?? null : i.page_id ?? null,
        type: i.type,
        code: i.code,
        severity: i.severity ?? "info",
        message: i.message ?? null,
        details: i.details ?? {},
      }));
      const { error } = await supabase.from("crawl_issues").insert(rows);
      if (error) throw error;
      return json({ ok: true, inserted: rows.length });
    }

    // analyze_page — детектит mixed_content, cyclic_link, ssl_expiring_soon / ssl_error
    // body: { action, job_id, page_url, html?: string, page_id?: string }
    if (action === "analyze_page") {
      const pageUrl = body.page_url as string;
      const html = (body.html as string) || "";
      if (!pageUrl) return json({ error: "page_url is required" }, 400);

      let pageId: string | null = body.page_id ?? null;
      if (!pageId) {
        const { data: pageRow } = await supabase
          .from("crawl_pages")
          .select("id")
          .eq("job_id", job_id)
          .eq("url", pageUrl)
          .maybeSingle();
        pageId = pageRow?.id ?? null;
      }

      const issues = await analyzePage(pageUrl, html);
      if (issues.length === 0) return json({ ok: true, inserted: 0 });

      const rows = issues.map((i) => ({
        job_id,
        page_id: pageId,
        type: i.type,
        code: i.code,
        severity: i.severity,
        message: i.message,
        details: i.details ?? {},
      }));
      const { error } = await supabase.from("crawl_issues").insert(rows);
      if (error) throw error;
      return json({ ok: true, inserted: rows.length, codes: issues.map((i) => i.code) });
    }

    if (action === "save_stats") {
      const s = body.stats || {};
      const row = {
        job_id,
        total_pages: s.total_pages ?? 0,
        total_issues: s.total_issues ?? 0,
        critical_count: s.critical_count ?? 0,
        warning_count: s.warning_count ?? 0,
        info_count: s.info_count ?? 0,
        avg_load_time_ms: s.avg_load_time_ms ?? 0,
        score: s.score ?? 0,
      };
      // Upsert by job_id (unique)
      const { error } = await supabase
        .from("crawl_stats")
        .upsert(row, { onConflict: "job_id" });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("crawler-callback error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============ Детекторы ============
type DetectedIssue = {
  type: string;
  code: string;
  severity: "critical" | "warning" | "info";
  message: string;
  details?: Record<string, unknown>;
};

async function analyzePage(pageUrl: string, html: string): Promise<DetectedIssue[]> {
  const issues: DetectedIssue[] = [];
  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return issues;
  }

  // 1. Mixed content (только для HTTPS страниц)
  if (parsed.protocol === "https:" && html) {
    const mixed = detectMixedContent(html);
    if (mixed.length > 0) {
      issues.push({
        type: "technical",
        code: "mixed_content",
        severity: "warning",
        message: `Найдено ${mixed.length} HTTP-ресурсов на HTTPS странице`,
        details: { resources: mixed.slice(0, 20), count: mixed.length },
      });
    }
  }

  // 2. Cyclic link (страница ссылается сама на себя)
  if (html) {
    const selfLinks = detectCyclicLinks(html, parsed);
    if (selfLinks.length > 0) {
      issues.push({
        type: "technical",
        code: "cyclic_link",
        severity: "warning",
        message: `Страница содержит ${selfLinks.length} ссылок на саму себя`,
        details: { samples: selfLinks.slice(0, 10), count: selfLinks.length },
      });
    }
  }

  // 3. SSL — проверка сертификата для HTTPS
  if (parsed.protocol === "https:") {
    const sslCheck = await checkSSL(parsed.hostname);
    if (sslCheck) {
      if (sslCheck.error) {
        issues.push({
          type: "technical",
          code: "ssl_error",
          severity: "critical",
          message: `Ошибка SSL сертификата: ${sslCheck.error}`,
          details: { hostname: parsed.hostname, error: sslCheck.error },
        });
      } else if (sslCheck.daysLeft !== null && sslCheck.daysLeft <= 30) {
        issues.push({
          type: "technical",
          code: "ssl_expiring_soon",
          severity: "critical",
          message: `SSL сертификат истекает через ${sslCheck.daysLeft} дн.`,
          details: {
            hostname: parsed.hostname,
            valid_to: sslCheck.validTo,
            days_left: sslCheck.daysLeft,
          },
        });
      }
    }
  }

  return issues;
}

function detectMixedContent(html: string): string[] {
  const found: string[] = [];
  // Атрибуты, в которых может быть HTTP-ресурс на HTTPS странице
  const re = /\b(?:src|href|action|data-src|poster)\s*=\s*["'](http:\/\/[^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    // Ссылки в <a href> — это переходы, не ресурсы. Грубо отсечём по тегу anchor:
    const tagStart = html.lastIndexOf("<", m.index);
    const tagSlice = html.slice(tagStart, m.index).toLowerCase();
    if (tagSlice.startsWith("<a ") || tagSlice.startsWith("<a\t") || tagSlice.startsWith("<a\n")) continue;
    if (!found.includes(m[1])) found.push(m[1]);
    if (found.length >= 100) break;
  }
  return found;
}

function detectCyclicLinks(html: string, pageUrl: URL): string[] {
  const samples: string[] = [];
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const pageHrefNoHash = pageUrl.origin + pageUrl.pathname + pageUrl.search;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript:") || raw.startsWith("mailto:") || raw.startsWith("tel:")) continue;
    let resolved: URL;
    try {
      resolved = new URL(raw, pageUrl);
    } catch {
      continue;
    }
    const resolvedNoHash = resolved.origin + resolved.pathname + resolved.search;
    if (resolvedNoHash === pageHrefNoHash) {
      count++;
      if (samples.length < 10) samples.push(raw);
    }
  }
  return count > 0 ? samples : [];
}

async function checkSSL(
  hostname: string
): Promise<{ validTo: string | null; daysLeft: number | null; error: string | null } | null> {
  try {
    // Deno не даёт прямого доступа к peer-сертификату в fetch. Используем публичный API ssl-checker.
    // https://ssl-checker.io/api/v1/check/<hostname>
    const resp = await fetch(`https://ssl-checker.io/api/v1/check/${encodeURIComponent(hostname)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      await resp.text().catch(() => null);
      return null;
    }
    const data = await resp.json();
    const result = data?.result ?? data;
    const validTo: string | null = result?.valid_till ?? result?.cert_valid_to ?? null;
    const daysLeft: number | null =
      typeof result?.days_left === "number"
        ? result.days_left
        : validTo
        ? Math.floor((new Date(validTo).getTime() - Date.now()) / 86400000)
        : null;
    const sslValid = result?.cert_valid ?? result?.valid ?? true;
    if (sslValid === false) {
      return { validTo, daysLeft, error: "Сертификат недействителен" };
    }
    return { validTo, daysLeft, error: null };
  } catch (e) {
    // Не считаем недоступность API ошибкой сертификата
    console.warn("SSL check failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
