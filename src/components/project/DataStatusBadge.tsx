import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, AlertCircle, Loader2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

type StatusKind = "loading" | "ok" | "empty" | "unknown" | "error";

interface Props {
  /** Project id used for the count query */
  projectId: string;
  /**
   * Source label shown in the badge (e.g. "Вебмастер", "Позиции").
   */
  label: string;
  /**
   * Supabase table to count rows in. Must allow SELECT for the current user.
   */
  table: "site_health" | "site_errors" | "gsc_daily_stats" | "metrika_stats";
  /** Optional extra filter for `source` column (e.g. "yandex"). */
  sourceFilter?: string;
  /**
   * If provided, used to display a "last updated" timestamp instead of querying.
   */
  lastUpdatedAt?: Date | null;
  /**
   * If integrations are not connected at all, force "unknown" state.
   */
  hasIntegration?: boolean;
}

/**
 * Compact indicator that shows whether data for a given project/source exists in the database.
 * Helps users understand WHY a tab looks empty: integration missing, never synced, or RLS hides it.
 */
export function DataStatusBadge({
  projectId,
  label,
  table,
  sourceFilter,
  lastUpdatedAt,
  hasIntegration = true,
}: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["data-status", table, projectId, sourceFilter ?? ""],
    queryFn: async () => {
      let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("project_id", projectId);
      if (sourceFilter) q = q.eq("source", sourceFilter);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  let kind: StatusKind = "unknown";
  if (!hasIntegration) kind = "unknown";
  else if (isLoading) kind = "loading";
  else if (isError) kind = "error";
  else if ((data ?? 0) > 0) kind = "ok";
  else kind = "empty";

  const meta = getMeta(kind);

  const tooltip = buildTooltip({ kind, label, count: data ?? 0, lastUpdatedAt, hasIntegration });

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 text-[10.5px] font-medium px-2 py-0.5 h-6 cursor-help",
              meta.cls
            )}
          >
            {meta.icon}
            <span>{label}: {meta.short}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px] text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getMeta(kind: StatusKind) {
  switch (kind) {
    case "loading":
      return {
        cls: "border-muted-foreground/30 text-muted-foreground bg-muted/30",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        short: "проверка…",
      };
    case "ok":
      return {
        cls: "border-emerald-500/40 text-emerald-500 bg-emerald-500/10",
        icon: <CheckCircle2 className="h-3 w-3" />,
        short: "есть данные",
      };
    case "empty":
      return {
        cls: "border-amber-500/40 text-amber-500 bg-amber-500/10",
        icon: <AlertCircle className="h-3 w-3" />,
        short: "пусто",
      };
    case "error":
      return {
        cls: "border-destructive/40 text-destructive bg-destructive/10",
        icon: <AlertCircle className="h-3 w-3" />,
        short: "ошибка доступа",
      };
    case "unknown":
    default:
      return {
        cls: "border-muted-foreground/30 text-muted-foreground bg-muted/30",
        icon: <HelpCircle className="h-3 w-3" />,
        short: "неизвестно",
      };
  }
}

function buildTooltip({
  kind,
  label,
  count,
  lastUpdatedAt,
  hasIntegration,
}: {
  kind: StatusKind;
  label: string;
  count: number;
  lastUpdatedAt?: Date | null;
  hasIntegration: boolean;
}) {
  if (!hasIntegration) {
    return `${label}: интеграция не подключена. Подключите её в разделе «Интеграции».`;
  }
  if (kind === "loading") return `${label}: проверяем данные в базе…`;
  if (kind === "error") {
    return `${label}: не удалось прочитать данные. Возможно, недостаточно прав — обратитесь к администратору.`;
  }
  if (kind === "ok") {
    const ago = lastUpdatedAt
      ? `Последнее обновление: ${formatDistanceToNow(lastUpdatedAt, { locale: ru, addSuffix: true })}.`
      : "";
    return `${label}: найдено записей в базе — ${count}. ${ago}`.trim();
  }
  if (kind === "empty") {
    return `${label}: данных в базе нет. Нажмите «Обновить данные», чтобы загрузить их из источника.`;
  }
  return label;
}

export default DataStatusBadge;
