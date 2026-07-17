import { Bold, Link as LinkIcon } from "lucide-react";
import { wrapSelection } from "@/lib/chatFormat";
import { RefObject } from "react";
import { cn } from "@/lib/utils";

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

/** Мини-панель форматирования сообщения: жирный и ссылка (как в Битриксе). */
export function ChatFormatToolbar({ textareaRef, value, onChange, className }: Props) {
  const applyBold = () => {
    const el = textareaRef.current;
    const res = wrapSelection(el, "**", "**", "текст");
    if (!res || !el) return;
    onChange(res.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(res.selStart, res.selEnd);
    });
  };

  const applyLink = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const url = window.prompt("Ссылка (URL):", "https://");
    if (!url) return;
    const label = selected || window.prompt("Текст ссылки:", selected || "ссылка") || url;
    const insert = `[${label}](${url})`;
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);
    const caret = start + insert.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <button
        type="button"
        onClick={applyBold}
        className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        title="Жирный (**текст**)"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={applyLink}
        className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        title="Ссылка [текст](url)"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
