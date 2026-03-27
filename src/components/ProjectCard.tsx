import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

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
  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-border/60"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={name}
              className="h-12 w-12 shrink-0 rounded-full object-cover border border-border"
            />
          ) : (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{name}</h3>
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{url}</span>
            </div>
          </div>
        </div>
        {description && (
          <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}
        {(seoSpecialist || accountManager) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {seoSpecialist && (
              <span>SEO: <span className="text-foreground font-medium">{seoSpecialist}</span></span>
            )}
            {accountManager && (
              <span>AM: <span className="text-foreground font-medium">{accountManager}</span></span>
            )}
          </div>
        )}
        {reportStatus && (
          <div className="mt-4">
            <Badge
              variant={reportReady ? "default" : "secondary"}
              className={
                reportReady
                  ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/90"
                  : ""
              }
            >
              {reportStatus}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
