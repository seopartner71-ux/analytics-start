import React from "react";

const MENTION_RE = /@([\wа-яА-ЯёЁ.\-]+(?:\s[\wа-яА-ЯёЁ.\-]+)?)/g;

export function renderWithMentions(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE);
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={m.index} className="text-purple-500 dark:text-purple-400 font-medium bg-purple-500/10 px-1 rounded">
        @{m[1]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Из текста извлекает упоминания и сопоставляет с членами команды по имени. */
export function extractMentionedMembers(
  text: string,
  members: { id: string; full_name: string; owner_id: string | null }[]
): { id: string; full_name: string; owner_id: string | null }[] {
  const out: typeof members = [];
  const seen = new Set<string>();
  const lower = text.toLowerCase();
  for (const member of members) {
    if (!member.full_name) continue;
    const fullLower = `@${member.full_name.toLowerCase()}`;
    const firstLower = `@${member.full_name.split(/\s+/)[0].toLowerCase()}`;
    if ((lower.includes(fullLower) || lower.includes(firstLower)) && !seen.has(member.id)) {
      seen.add(member.id);
      out.push(member);
    }
  }
  return out;
}
