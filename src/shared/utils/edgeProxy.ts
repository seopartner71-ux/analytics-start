/**
 * Edge proxy для обхода блокировки *.supabase.co.
 *
 * На домене crm.seo-modul.pro перехватывает все fetch-запросы к
 * https://iigedewmxyqigivsqwqz.supabase.co и перенаправляет их через
 * https://crm.seo-modul.pro/sb-proxy/... (nginx reverse proxy).
 *
 * На preview/localhost/любом другом домене — no-op, используется прямое
 * подключение к Supabase.
 */

const SUPABASE_ORIGIN = "https://iigedewmxyqigivsqwqz.supabase.co";
const PROXY_HOST = "crm.seo-modul.pro";
const PROXY_BASE = "https://crm.seo-modul.pro/sb-proxy";
const PROXY_HEALTH_URL = `${PROXY_BASE}/auth/v1/health`;
const SUPABASE_ANON_KEY = "sb_publishable_H_WXKp-tSppfXI0D7w0c6w_jrjghQxO";

let proxyEnabled = false;
let proxyReady: Promise<void> | null = null;
let installed = false;

function shouldUseProxy(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === PROXY_HOST;
}

export function isProxyDisabled(): boolean {
  return !proxyEnabled;
}

export function waitForEdgeProxyReady(): Promise<void> {
  return proxyReady ?? Promise.resolve();
}

async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(PROXY_HEALTH_URL, {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    // Supabase health endpoint возвращает 200 или 401 (без JWT) — оба значат "жив"
    return res.status === 200 || res.status === 401;
  } catch (err) {
    console.warn("[edgeProxy] health-check провалился:", err);
    return false;
  }
}

export async function installEdgeProxy(): Promise<void> {
  if (installed) return;
  installed = true;

  if (!shouldUseProxy()) {
    console.info("[edgeProxy] домен не crm.seo-modul.pro — прокси отключён, прямое подключение к Supabase");
    return;
  }

  const originalFetch = window.fetch.bind(window);

  proxyReady = (async () => {
    const ok = await healthCheck();
    if (!ok) {
      console.warn("[edgeProxy] прокси недоступен, fallback на прямое подключение");
      return;
    }
    proxyEnabled = true;
    console.info(`[edgeProxy] прокси активен: ${SUPABASE_ORIGIN} → ${PROXY_BASE}`);
  })();

  // Перехват fetch — независимо от результата health-check, чтобы при
  // включении proxyEnabled все последующие запросы пошли через прокси.
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!proxyEnabled) return originalFetch(input, init);

    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.toString();
    else url = input.url;

    if (!url.startsWith(SUPABASE_ORIGIN)) {
      return originalFetch(input, init);
    }

    const proxiedUrl = PROXY_BASE + url.slice(SUPABASE_ORIGIN.length);

    // Собираем заголовки и гарантируем наличие apikey
    const headers = new Headers(
      init?.headers ??
        (input instanceof Request ? input.headers : undefined),
    );
    if (!headers.has("apikey")) headers.set("apikey", SUPABASE_ANON_KEY);

    // Если входящий input — Request, нужно сохранить body/method
    if (input instanceof Request && !init) {
      const cloned = input.clone();
      const body = ["GET", "HEAD"].includes(cloned.method)
        ? undefined
        : await cloned.arrayBuffer();
      return originalFetch(proxiedUrl, {
        method: cloned.method,
        headers,
        body,
        credentials: cloned.credentials,
        mode: cloned.mode,
        redirect: cloned.redirect,
      });
    }

    return originalFetch(proxiedUrl, { ...init, headers });
  };

  await proxyReady;
}
