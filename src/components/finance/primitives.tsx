import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { money, pct } from "@/lib/finance";

/** Плотная премиальная панель — тонкая граница, минимальная тень. */
export function Panel({
  title, subtitle, actions, children, className, padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-md font-medium tracking-tight text-foreground">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "positive" | "negative" | "muted";

const toneClass: Record<Tone, string> = {
  neutral: "text-foreground",
  positive: "text-[hsl(var(--success))]",
  negative: "text-destructive",
  muted: "text-muted-foreground",
};

/** Крупная финансовая цифра + мелкая подпись. */
export function Metric({
  label, value, tone = "neutral", hint, delta, size = "md", className,
}: {
  label: string;
  value: number;
  tone?: Tone;
  hint?: ReactNode;
  delta?: number;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 px-4 py-4", className)}>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-semibold tabular-nums tracking-tighter truncate",
            size === "lg" ? "text-3xl" : "text-2xl",
            toneClass[tone],
          )}
        >
          {money(value, tone === "positive" || tone === "negative")}
        </span>
        {typeof delta === "number" && isFinite(delta) && <Delta value={delta} />}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-2xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  if (!isFinite(value) || Math.abs(value) < 0.5) {
    return <span className="text-2xs text-muted-foreground">—</span>;
  }
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-2xs font-medium tabular-nums",
        good ? "text-[hsl(var(--success))]" : "text-destructive",
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

export function DeltaVs({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  return <Delta value={pct(current, previous)} invert={invert} />;
}

const badgeTone: Record<string, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-[hsl(var(--success))]/25 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
  warning: "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: keyof typeof badgeTone }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap", badgeTone[tone])}>
      {label}
    </span>
  );
}

/** Обёртка для плотных таблиц со скроллом на мобильных. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-base">{children}</table>
    </div>
  );
}

export function Th({ children, align = "left", className }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-border px-3 py-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = "left", className }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td
      className={cn(
        "border-b border-border/60 px-3 py-2 align-middle",
        align === "right" ? "text-right tabular-nums" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>;
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
