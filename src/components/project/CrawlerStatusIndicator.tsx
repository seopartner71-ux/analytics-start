import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

type Status = "checking" | "online" | "offline";

export function CrawlerStatusIndicator() {
  const [status, setStatus] = useState<Status>("checking");
  const [latency, setLatency] = useState<number | null>(null);

  const check = async () => {
    setStatus("checking");
    try {
      const { data, error } = await supabase.functions.invoke("crawler-health");
      if (error) throw error;
      setStatus(data?.online ? "online" : "offline");
      setLatency(typeof data?.latency_ms === "number" ? data.latency_ms : null);
    } catch {
      setStatus("offline");
      setLatency(null);
    }
  };

  useEffect(() => {
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  const label =
    status === "checking" ? "Проверка краулера..." :
    status === "online" ? `Краулер онлайн${latency !== null ? ` (${latency} мс)` : ""}` :
    "Краулер недоступен";

  const dotClass =
    status === "online" ? "bg-emerald-500 shadow-[0_0_8px_hsl(var(--primary))]" :
    status === "offline" ? "bg-destructive" :
    "bg-muted-foreground";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={check}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground transition hover:bg-card"
        >
          {status === "checking" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span className={cn("h-2 w-2 rounded-full", dotClass)} />
          )}
          <span>{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>Нажмите, чтобы проверить снова</TooltipContent>
    </Tooltip>
  );
}
