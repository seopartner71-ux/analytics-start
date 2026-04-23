/**
 * Edge proxy для обхода блокировки Supabase в РФ.
 *
 * Подменяет глобальный fetch: все запросы к *.supabase.co перенаправляются
 * на прокси того же домена.
 *
 * Стратегия по доменам:
 *   - crm.seo-modul.pro      → Nginx reverse proxy: /supabase-proxy/<path>
 *   - другие prod-домены     → PHP fallback: /api/proxy.php?path=<path>
 *   - localhost / lovable.*  → напрямую (без прокси)
 *
 * Перед активацией на crm.seo-modul.pro выполняется health-check:
 * если /supabase-proxy/auth/v1/health не вернул JSON — прокси отключается
 * и запросы идут напрямую (с предупреждением в консоль).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const NGINX_PROXY_HOST = "crm.seo-modul.pro";
const NGINX_PROXY_ORIGIN = `https://${NGINX_PROXY_HOST}`;
const NGINX_PROXY_PREFIX = "/api-proxy";
const PHP_PROXY_PATH = "/api/proxy.php";

const ALLOWED_PREFIXES = [
  "/functions/v1/",
  "/rest/v1/",
  "/auth/v1/",
  "/storage/v1/",
];

let installed = false;
let proxyDisabled = false; // авто-фоллбэк при поломке прокси
let healthCheckPromise: Promise<void> | null = null;

type ProxyMode = "nginx" | "php" | "none";

function getProxyMode(): ProxyMode {
  if (typeof window === "undefined") return "none";
  const host = window.location.hostname;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".lovableproject.com")
  ) {
    return "none";
  }
  if (host === NGINX_PROXY_HOST) return "nginx";
  return "php";
}

function isSupabaseUrl(url: string): boolean {
  return !!SUPABASE_URL && url.startsWith(SUPABASE_URL);
}

function isAllowed(originalUrl: string): boolean {
  const path = originalUrl.slice(SUPABASE_URL.length);
  return ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

function buildProxyUrl(originalUrl: string, mode: ProxyMode): string {
  const upstreamPath = originalUrl.slice(SUPABASE_URL.length);
  if (mode === "nginx") {
    return `${NGINX_PROXY_ORIGIN}${NGINX_PROXY_PREFIX}${upstreamPath}`;
  }
  return `${PHP_PROXY_PATH}?path=${encodeURIComponent(upstreamPath)}`;
}

function getOriginalRequest(input: RequestInfo | URL): Request | null {
  return typeof input !== "string" && !(input instanceof URL) ? input : null;
}

function mergeHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const headers = new Headers(getOriginalRequest(input)?.headers);
  const initHeaders = new Headers(init?.headers);

  initHeaders.forEach((value, key) => {
    headers.set(key, value);
  });

  return headers;
}

/**
 * Гарантирует наличие apikey и Authorization на каждом проксированном запросе.
 * Некоторые запросы supabase-js (например, обновление сессии до логина) уходят
 * без apikey — Nginx/Supabase в этом случае возвращают 401 "Invalid API key".
 */
function ensureAuthHeaders(headers: Headers): void {
  if (!SUPABASE_ANON_KEY) return;
  if (!headers.has("apikey")) {
    headers.set("apikey", SUPABASE_ANON_KEY);
  }
  if (!headers.has("authorization") && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
  }
}

/**
 * Проверяет, что Nginx-прокси действительно форвардит на Supabase
 * и возвращает JSON, а не HTML SPA / 404.
 * Использует нативный fetch (до подмены), чтобы не зациклиться.
 */
async function checkNginxProxyHealth(nativeFetch: typeof fetch): Promise<void> {
  try {
    const url = `${NGINX_PROXY_PREFIX}/auth/v1/health`;
    const headers: Record<string, string> = {};
    if (SUPABASE_ANON_KEY) {
      headers["apikey"] = SUPABASE_ANON_KEY;
    }
    const response = await nativeFetch(url, { method: "GET", headers });
    const ct = response.headers.get("content-type") || "";

    if (response.status === 404 || ct.includes("text/html")) {
      console.warn(
        `[edgeProxy] Nginx-прокси ${NGINX_PROXY_PREFIX} вернул ${response.status} / ${ct}. Фоллбэк на прямые запросы.`
      );
      proxyDisabled = true;
      return;
    }

    if (!ct.includes("application/json")) {
      console.warn(
        `[edgeProxy] Nginx-прокси не вернул JSON (content-type: ${ct}). Фоллбэк на прямые запросы.`
      );
      proxyDisabled = true;
      return;
    }

    console.info("[edgeProxy] Nginx-прокси активен и отвечает JSON.");
  } catch (err) {
    console.warn("[edgeProxy] health-check провалился, фоллбэк на прямые запросы:", err);
    proxyDisabled = true;
  }
}

export async function installEdgeProxy(): Promise<void> {
  if (installed) return;
  const mode = getProxyMode();
  if (mode === "none") return;
  if (!SUPABASE_URL) return;

  installed = true;
  const nativeFetch = window.fetch.bind(window);

  // На crm.seo-modul.pro прогреваем health-check, чтобы первый же
  // ошибочный ответ не сломал авторизацию.
  if (mode === "nginx") {
    healthCheckPromise = checkNginxProxyHealth(nativeFetch);
    await healthCheckPromise;
  }

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

      // Дожидаемся health-check перед первым проксированным запросом
      if (healthCheckPromise && isSupabaseUrl(url)) {
        await healthCheckPromise;
      }

      if (proxyDisabled || !isSupabaseUrl(url) || !isAllowed(url)) {
        return nativeFetch(input as any, init);
      }

      const proxyUrl = buildProxyUrl(url, mode);
      const originalRequest = getOriginalRequest(input);
      const headers = mergeHeaders(input, init);
      ensureAuthHeaders(headers);

      const proxyInit: RequestInit = {
        ...init,
        method:
          init?.method ||
          originalRequest?.method ||
          "GET",
        headers,
        body:
          init?.body ??
          originalRequest?.body,
        credentials:
          init?.credentials ??
          originalRequest?.credentials,
      };

      const response = await nativeFetch(proxyUrl, proxyInit);

      const ct = response.headers.get("content-type") || "";
      if (response.status === 404 || ct.includes("text/html")) {
        console.warn("[edgeProxy] прокси вернул HTML/404 на боевом запросе, фоллбэк");
        proxyDisabled = true;
        return nativeFetch(input as any, init);
      }

      return response;
    } catch (err) {
      console.warn("[edgeProxy] ошибка прокси, фоллбэк:", err);
      proxyDisabled = true;
      return nativeFetch(input as any, init);
    }
  };
}
