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
      className="group cursor-pointer transition-all duration-150 hover:shadow-sm border-border bg-card"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-3.5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={name}
              className="h-10 w-10 shrink-0 rounded-lg object-cover border border-border"
            />
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-primary-foreground"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">{name}</h3>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{url}</span>
            </div>
          </div>
        </div>
        {description && (
          <p className="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{description}</p>
        )}
        {(seoSpecialist || accountManager) && (
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {seoSpecialist && (
              <span>SEO: <span className="text-foreground font-medium">{seoSpecialist}</span></span>
            )}
            {accountManager && (
              <span>AM: <span className="text-foreground font-medium">{accountManager}</span></span>
            )}
          </div>
        )}
        {reportStatus && (
          <div className="mt-3">
            <Badge
              variant={reportReady ? "default" : "secondary"}
              className={`text-[11px] font-medium ${
                reportReady
                  ? "bg-success text-success-foreground hover:bg-success/90"
                  : ""
              }`}
            >
              {reportStatus}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
