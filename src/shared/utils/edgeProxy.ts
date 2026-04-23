/**
 * Edge proxy ОТКЛЮЧЁН.
 *
 * Все запросы идут напрямую на Supabase (https://iigedewmxyqigivsqwqz.supabase.co).
 * Файл оставлен как заглушка, чтобы существующие импорты (AuthContext и др.)
 * продолжали работать без изменений.
 */

export function waitForEdgeProxyReady(): Promise<void> {
  return Promise.resolve();
}

export function isProxyDisabled(): boolean {
  return true;
}

export async function installEdgeProxy(): Promise<void> {
  // no-op: прокси полностью отключён, используем прямое подключение к Supabase
}
