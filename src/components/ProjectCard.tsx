import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ExternalLink, BarChart3, Eye, Settings, ArrowUpRight, TrendingUp } from "lucide-react";

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
  onClick: () => void;
}

const SPARKLINE_DATA = [
  [3, 5, 4, 7, 6, 8, 9, 8, 10, 12, 11, 14],
  [5, 4, 6, 5, 7, 8, 7, 9, 10, 9, 11, 13],
  [2, 4, 3, 5, 6, 5, 7, 8, 9, 11, 10, 12],
  [4, 3, 5, 6, 8, 7, 9, 10, 12, 11, 13, 15],
];

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 32;
  const w = 120;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} fill="none" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        stroke="hsl(var(--success))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill="url(#sparkGrad)"
      />
    </svg>
  );
}

function getDomain(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
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
  reportStatus,
  reportReady,
  onClick,
}: ProjectCardProps) {
  const [imgError, setImgError] = useState(false);
  const domain = getDomain(url);
  const screenshotUrl = domain
    ? `https://image.thum.io/get/width/600/crop/340/https://${domain}`
    : "";
  const sparkData = SPARKLINE_DATA[name.length % SPARKLINE_DATA.length];

  // Mock stats
  const top10 = 12 + (name.length % 20);
  const avgPos = (8 + (name.length % 15)).toFixed(1);
  const visibility = (35 + (name.length % 40)).toFixed(0);

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.15)] hover:border-primary/30"
      onClick={onClick}
    >
      {/* Screenshot Preview */}
      <div className="relative overflow-hidden">
        <AspectRatio ratio={16 / 9}>
          {domain && !imgError ? (
            <img
              src={screenshotUrl}
              alt={`${name} preview`}
              className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${color}44, ${color}22, hsl(var(--card)))`,
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={name} className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <span
                  className="text-2xl font-bold text-primary-foreground/80 rounded-xl px-4 py-2"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </span>
              )}
            </div>
          )}
        </AspectRatio>

        {/* Hover Actions Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-3 gap-1.5">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-card/90 backdrop-blur-sm border border-border/50 hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={(e) => { e.stopPropagation(); onClick(); }}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Аналитика</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-card/90 backdrop-blur-sm border border-border/50 hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (domain) window.open(`https://${domain}`, "_blank");
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Открыть сайт</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-card/90 backdrop-blur-sm border border-border/50 hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={(e) => { e.stopPropagation(); }}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Настройки</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title & Domain */}
        <div>
          <h3 className="font-semibold text-[15px] text-foreground truncate group-hover:text-primary transition-colors">
            {name}
          </h3>
          {domain && (
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{domain}</span>
            </a>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{description}</p>
        )}

        {/* Key Stats */}
        <div className="grid grid-cols-3 gap-2 py-2 px-1 rounded-lg bg-muted/30">
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground font-medium">ТОП-10</p>
            <p className="text-sm font-bold text-foreground">{top10}</p>
            <p className="text-[10px] text-success font-medium">+3</p>
          </div>
          <div className="text-center border-x border-border/50">
            <p className="text-[11px] text-muted-foreground font-medium">Ср. поз.</p>
            <p className="text-sm font-bold text-foreground">{avgPos}</p>
            <p className="text-[10px] text-success font-medium">−1.2</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground font-medium">Видимость</p>
            <p className="text-sm font-bold text-foreground">{visibility}%</p>
            <p className="text-[10px] text-success font-medium">+4.5%</p>
          </div>
        </div>

        {/* Sparkline */}
        <Sparkline data={sparkData} className="w-full h-8" />

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center gap-3">
            {seoSpecialist && (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                    {seoSpecialist.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                  SEO: {seoSpecialist}
                </Badge>
              </div>
            )}
            {accountManager && !seoSpecialist && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                AM: {accountManager}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            Отчёт
            <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
