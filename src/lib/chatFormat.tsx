import React from "react";

/**
 * Форматирование сообщений чата (Bitrix-подобное):
 *  - **жирный**
 *  - [текст](url) — ссылка, привязанная к тексту
 *  - @упоминания
 *  - автоссылки http(s):// и www.
 * Сохраняет переносы строк.
 */

const LINK_MD_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const MENTION_RE = /(@[\p{L}0-9_]+)/gu;

type Token =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "link"; text: string; url: string }
  | { kind: "autolink"; url: string }
  | { kind: "mention"; value: string };

function href(u: string) {
  return u.startsWith("http") ? u : `https://${u}`;
}

/** Разбор строки в токены (одна проходка со всеми паттернами). */
function tokenize(line: string): Token[] {
  type Match = { start: number; end: number; token: Token };
  const matches: Match[] = [];

  // Markdown links first (highest priority)
  let m: RegExpExecArray | null;
  LINK_MD_RE.lastIndex = 0;
  while ((m = LINK_MD_RE.exec(line))) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      token: { kind: "link", text: m[1], url: m[2] },
    });
  }
  // Bold
  BOLD_RE.lastIndex = 0;
  while ((m = BOLD_RE.exec(line))) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      token: { kind: "bold", value: m[1] },
    });
  }
  // Auto URLs
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(line))) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      token: { kind: "autolink", url: m[0] },
    });
  }
  // Mentions
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(line))) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      token: { kind: "mention", value: m[0] },
    });
  }

  // Resolve overlaps: sort by start; drop matches that overlap earlier ones.
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const picked: Match[] = [];
  let cursor = 0;
  for (const mm of matches) {
    if (mm.start < cursor) continue;
    picked.push(mm);
    cursor = mm.end;
  }

  const tokens: Token[] = [];
  let idx = 0;
  for (const p of picked) {
    if (p.start > idx) tokens.push({ kind: "text", value: line.slice(idx, p.start) });
    tokens.push(p.token);
    idx = p.end;
  }
  if (idx < line.length) tokens.push({ kind: "text", value: line.slice(idx) });
  return tokens;
}

interface Options {
  isMine?: boolean;
}

function renderToken(t: Token, key: string, opts: Options): React.ReactNode {
  switch (t.kind) {
    case "text":
      return <React.Fragment key={key}>{t.value}</React.Fragment>;
    case "bold":
      return <strong key={key} className="font-semibold">{t.value}</strong>;
    case "link":
      return (
        <a
          key={key}
          href={href(t.url)}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 break-all ${opts.isMine ? "text-primary-foreground" : "text-primary hover:text-primary/80"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {t.text}
        </a>
      );
    case "autolink":
      return (
        <a
          key={key}
          href={href(t.url)}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 break-all ${opts.isMine ? "text-primary-foreground" : "text-primary hover:text-primary/80"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {t.url}
        </a>
      );
    case "mention":
      return (
        <span
          key={key}
          className={`font-medium rounded px-1 ${opts.isMine ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"}`}
        >
          {t.value}
        </span>
      );
  }
}

export function formatChatBody(body: string | null | undefined, opts: Options = {}): React.ReactNode {
  if (!body) return null;
  const lines = body.split("\n");
  return lines.map((line, li) => {
    const tokens = tokenize(line);
    return (
      <React.Fragment key={li}>
        {tokens.map((t, ti) => renderToken(t, `${li}-${ti}`, opts))}
        {li < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

/** Обёртывает выделенный фрагмент textarea маркерами before/after (или вставляет placeholder). */
export function wrapSelection(
  el: HTMLTextAreaElement | null,
  before: string,
  after: string,
  placeholder = "текст",
): { value: string; selStart: number; selEnd: number } | null {
  if (!el) return null;
  const value = el.value;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const selStart = start + before.length;
  const selEnd = selStart + selected.length;
  return { value: next, selStart, selEnd };
}
