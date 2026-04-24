import React from "react";

const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

/**
 * Превращает URL-ы внутри текста в кликабельные ссылки.
 * Сохраняет переносы строк.
 */
export function linkify(text: string | null | undefined): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    URL_RE.lastIndex = 0;
    while ((match = URL_RE.exec(line)) !== null) {
      const url = match[0];
      const start = match.index;
      if (start > lastIndex) parts.push(line.slice(lastIndex, start));
      const href = url.startsWith("http") ? url : `https://${url}`;
      parts.push(
        <a
          key={`${lineIdx}-${start}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
      lastIndex = start + url.length;
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex));
    return (
      <React.Fragment key={lineIdx}>
        {parts}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}
