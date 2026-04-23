/**
 * Edge proxy для обхода блокировки Supabase в РФ.
 *
 * Подменяет глобальный fetch: все запросы к *.supabase.co перенаправляются
 * на /api/proxy.php?path=... того же домена (Beget). PHP-скрипт форвардит
 * запрос в Supabase и возвращает ответ.
 *
 * Активируется только на production-доменах. В Lovable preview / localhost
 * работает напрямую. При недоступности прокси (HTML/404) — авто-фоллбэк
 * на прямые запросы.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const PROXY_PATH = "/api/proxy.php";

const ALLOWED_PREFIXES = [
  "/functions/v1/",
  "/rest/v1/",
  "/auth/v1/",
  "/storage/v1/",
];

let installed = false;
let proxyDisabled = false; // авто-фоллбэк при поломке прокси

function shouldUseProxy(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  // Не использовать прокси на dev / lovable preview
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".lovableproject.com")
  ) {
    return false;
  }
  return true;
}

function isSupabaseUrl(url: string): boolean {
  return !!SUPABASE_URL && url.startsWith(SUPABASE_URL);
}

function buildProxyUrl(originalUrl: string): string {
  const upstreamPath = originalUrl.slice(SUPABASE_URL.length); // напр. /auth/v1/token?grant_type=password
  return `${PROXY_PATH}?path=${encodeURIComponent(upstreamPath)}`;
}

function isAllowed(originalUrl: string): boolean {
  const path = originalUrl.slice(SUPABASE_URL.length);
  return ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

export function installEdgeProxy(): void {
  if (installed) return;
  if (!shouldUseProxy()) return;
  if (!SUPABASE_URL) return;

  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

      if (proxyDisabled || !isSupabaseUrl(url) || !isAllowed(url)) {
        return nativeFetch(input as any, init);
      }

      const proxyUrl = buildProxyUrl(url);

      // Гарантируем apikey, если клиент его не выставил
      const headers = new Headers(init?.headers || (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined));
      if (!headers.has("apikey") && SUPABASE_ANON_KEY) {
        headers.set("apikey", SUPABASE_ANON_KEY);
      }

      const proxyInit: RequestInit = {
        ...init,
        method: init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET"),
        headers,
        body:
          init?.body ??
          (typeof input !== "string" && !(input instanceof URL) ? (input as Request).body : undefined),
        credentials: "omit",
      };

      const response = await nativeFetch(proxyUrl, proxyInit);

      // Авто-фоллбэк: если прокси вернул HTML или 404 — отключаем и идём напрямую
      const ct = response.headers.get("content-type") || "";
      if (response.status === 404 || ct.includes("text/html")) {
        // eslint-disable-next-line no-console
        console.warn("[edgeProxy] прокси недоступен, фоллбэк на прямые запросы");
        proxyDisabled = true;
        return nativeFetch(input as any, init);
      }

      return response;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[edgeProxy] ошибка прокси, фоллбэк:", err);
      proxyDisabled = true;
      return nativeFetch(input as any, init);
    }
  };
}
