import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ExternalLink, BarChart3, ArrowUpRight, Settings } from "lucide-react";

interface ProjectStats {
  top10: number;
  avgPos: number;
  visibility: number;
  top10Delta: number;
  avgPosDelta: number;
  visibilityDelta: number;
}

interface ProjectCardProps {
  name: string;
  url: string;
  initials: string;
  color: string;
  logoUrl?: string | null;
  description?: string | null;
  seoSpecialist?: string | null;
  accountManager?: string | null;
  reportStatus: string;
  reportReady: boolean;
  stats?: ProjectStats;
  onClick: () => void;
}

const SPARKLINE_DATA = [
  [3, 5, 4, 7, 6, 8, 9, 8, 10, 12, 11, 14],
  [5, 4, 6, 5, 7, 8, 7, 9, 10, 9, 11, 13],
  [2, 4, 3, 5, 6, 5, 7, 8, 9, 11, 10, 12],
  [4, 3, 5, 6, 8, 7, 9, 10, 12, 11, 13, 15],
];

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 24;
  const w = 140;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6" fill="none" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity="0.2" />
          <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        stroke="hsl(var(--success))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#sparkGrad)" />
    </svg>
  );
}

function getDomain(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function DeltaBadge({ value, invert }: { value: number; invert?: boolean }) {
  if (value === 0) return null;
  // For avg position, lower is better so invert the color
  const isPositive = invert ? value < 0 : value > 0;
  const display = invert
    ? (value < 0 ? `${value}` : `+${value}`)
    : (value > 0 ? `+${value}` : `${value}`);
  
  return (
    <Badge
      variant="secondary"
      className={`text-[9px] px-1 py-0 h-3.5 font-medium border-0 ${
        isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
      }`}
    >
      {display}
    </Badge>
  );
}

export function ProjectCard({
  name,
  url,
  initials,
  color,
  logoUrl,
  description,
  seoSpecialist,
  accountManager,
  stats,
  onClick,
}: ProjectCardProps) {
  const [faviconError, setFaviconError] = useState(false);
  const domain = getDomain(url);
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : "";
  const sparkData = SPARKLINE_DATA[name.length % SPARKLINE_DATA.length];

  const top10 = stats?.top10 ?? 0;
  const avgPos = stats?.avgPos ?? 0;
  const visibility = stats?.visibility ?? 0;
  const hasStats = stats !== undefined;

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden border-[hsl(0_0%_100%/0.05)] bg-card/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.15),0_4px_20px_-4px_hsl(var(--primary)/0.1)] hover:border-[hsl(var(--primary)/0.2)]"
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2.5">
        {/* Header: Favicon + Title + Actions */}
        <div className="flex items-start gap-2.5">
          <div className="shrink-0 mt-0.5">
            {faviconUrl && !faviconError ? (
              <img
                src={faviconUrl}
                alt=""
                className="h-8 w-8 rounded-lg object-cover bg-muted/50"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold text-primary-foreground"
                style={{ backgroundColor: color }}
              >
                {initials}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[13px] leading-tight text-foreground truncate group-hover:text-primary transition-colors">
              {name}
            </h3>
            {domain && (
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground/70 hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="truncate">{domain}</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
          </div>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); onClick(); }}>
                    <BarChart3 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px]">Аналитика</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
                    <Settings className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px]">Настройки</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {description && (
          <p className="text-[11px] text-muted-foreground/60 line-clamp-1 leading-relaxed">{description}</p>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-3 py-1.5 px-2 rounded-md bg-muted/20">
          <div className="flex-1 text-center">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">ТОП-10</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{hasStats ? top10 : "—"}</p>
            {hasStats && <DeltaBadge value={stats.top10Delta} />}
          </div>
          <div className="w-px h-6 bg-border/30" />
          <div className="flex-1 text-center">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">Ср. поз.</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{hasStats ? avgPos : "—"}</p>
            {hasStats && <DeltaBadge value={stats.avgPosDelta} invert />}
          </div>
          <div className="w-px h-6 bg-border/30" />
          <div className="flex-1 text-center">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">Видим.</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{hasStats ? `${visibility}%` : "—"}</p>
            {hasStats && <DeltaBadge value={stats.visibilityDelta} />}
          </div>
        </div>

        <Sparkline data={sparkData} />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/50 font-medium tracking-wide">
            {seoSpecialist ? `SEO: ${seoSpecialist}` : accountManager ? `AM: ${accountManager}` : ""}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-1.5 text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            Отчёт
            <ArrowUpRight className="h-2.5 w-2.5 ml-0.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
