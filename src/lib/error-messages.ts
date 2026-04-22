/**
 * Русификация технических сообщений об ошибках, прилетающих из Supabase,
 * fetch, edge-функций и сторонних API. Используется во всех toast.error.
 */

const PATTERNS: Array<[RegExp, string]> = [
  // Auth / RLS
  [/not\s*authenticated/i, "Вы не авторизованы. Войдите в систему."],
  [/jwt\s*(expired|invalid)/i, "Сессия истекла. Войдите заново."],
  [/invalid\s*(login|credentials|password)/i, "Неверный логин или пароль."],
  [/email\s*not\s*confirmed/i, "Email не подтверждён."],
  [/user\s*already\s*registered/i, "Пользователь уже зарегистрирован."],
  [/permission\s*denied/i, "Недостаточно прав для этого действия."],
  [/row[- ]level\s*security/i, "Действие запрещено политикой доступа."],
  [/forbidden/i, "Доступ запрещён."],
  [/unauthorized/i, "Не авторизовано."],

  // Network
  [/failed\s*to\s*fetch/i, "Не удалось связаться с сервером. Проверьте интернет."],
  [/network\s*error/i, "Ошибка сети. Проверьте подключение."],
  [/timeout/i, "Превышено время ожидания ответа."],
  [/aborted/i, "Запрос отменён."],

  // HTTP
  [/^HTTP\s*4\d\d/i, "Ошибка запроса к серверу."],
  [/^HTTP\s*5\d\d/i, "Сервер временно недоступен."],
  [/internal\s*server\s*error/i, "Внутренняя ошибка сервера."],
  [/bad\s*gateway/i, "Сервер недоступен."],
  [/service\s*unavailable/i, "Сервис временно недоступен."],

  // Database
  [/duplicate\s*key/i, "Запись с такими данными уже существует."],
  [/violates\s*foreign\s*key/i, "Нельзя выполнить: есть связанные записи."],
  [/violates\s*not[- ]null/i, "Не заполнены обязательные поля."],
  [/violates\s*unique/i, "Такая запись уже существует."],
  [/value\s*too\s*long/i, "Слишком длинное значение."],

  // Generic fetch failures
  [/^failed\s*to\s*fetch\s+/i, "Не удалось загрузить данные."],
  [/^failed\s*to\s+/i, "Не удалось выполнить операцию."],
  [/^cannot\s+/i, "Не удалось выполнить действие."],

  // AI
  [/rate\s*limit/i, "Слишком много запросов. Подождите немного."],
  [/quota/i, "Закончились кредиты. Пополните в настройках."],
  [/AI generation failed/i, "Не удалось сгенерировать ответ AI."],
];

/**
 * Превращает любую ошибку (Error, строку, ответ API) в человеко-понятное
 * сообщение на русском.
 */
export function ruError(err: unknown, fallback = "Произошла ошибка. Попробуйте ещё раз."): string {
  const raw = extractMessage(err);
  if (!raw) return fallback;

  // Уже на русском — возвращаем как есть
  if (/[А-Яа-яЁё]/.test(raw)) return raw;

  for (const [pattern, ru] of PATTERNS) {
    if (pattern.test(raw)) return ru;
  }
  return fallback;
}

function extractMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || "";
  if (typeof err === "object") {
    const anyErr = err as Record<string, unknown>;
    return (
      (anyErr.message as string) ||
      (anyErr.error_description as string) ||
      (anyErr.error as string) ||
      ""
    );
  }
  return String(err);
}
