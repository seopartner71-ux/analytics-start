import { useState } from "react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  onSelect: (emoji: string) => void;
  className?: string;
  size?: "sm" | "md";
  title?: string;
}

/** Универсальная кнопка-выборщик эмодзи для чатов и комментариев. */
export function EmojiPickerButton({ onSelect, className, size = "md", title = "Эмодзи" }: Props) {
  const [open, setOpen] = useState(false);
  let theme: Theme = Theme.AUTO;
  try {
    const t = useTheme();
    theme = (t as { theme?: string })?.theme === "dark" ? Theme.DARK : Theme.LIGHT;
  } catch {
    theme = Theme.AUTO;
  }
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title}
          className={cn(
            dim,
            "inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent shrink-0",
            className,
          )}
        >
          <Smile className={icon} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="p-0 border-0 bg-transparent shadow-none w-auto">
        <EmojiPicker
          theme={theme}
          emojiStyle={EmojiStyle.NATIVE}
          lazyLoadEmojis
          skinTonesDisabled
          searchPlaceholder="Поиск..."
          width={320}
          height={380}
          onEmojiClick={(e) => {
            onSelect(e.emoji);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
