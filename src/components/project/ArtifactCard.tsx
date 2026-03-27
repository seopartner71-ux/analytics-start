import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Eye, X, FileText, Figma, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ArtifactCardProps {
  url: string;
  title?: string;
}

function detectService(url: string): { name: string; icon: React.ReactNode; color: string; embeddable: boolean } {
  if (url.includes("figma.com")) return { name: "Figma", icon: <Figma className="h-4 w-4" />, color: "text-purple-500", embeddable: true };
  if (url.includes("notion.")) return { name: "Notion", icon: <StickyNote className="h-4 w-4" />, color: "text-foreground", embeddable: true };
  if (url.includes("docs.google.com")) return { name: "Google Docs", icon: <FileText className="h-4 w-4" />, color: "text-blue-500", embeddable: true };
  if (url.includes("drive.google.com")) return { name: "Google Drive", icon: <FileText className="h-4 w-4" />, color: "text-green-500", embeddable: true };
  if (url.includes("sheets.google.com") || url.includes("spreadsheets")) return { name: "Google Sheets", icon: <FileText className="h-4 w-4" />, color: "text-emerald-500", embeddable: true };
  return { name: "Link", icon: <ExternalLink className="h-4 w-4" />, color: "text-muted-foreground", embeddable: false };
}

function extractTitle(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1]?.replace(/-/g, " ").replace(/_/g, " ").slice(0, 40) || u.hostname;
  } catch {
    return url.slice(0, 40);
  }
}

export function ArtifactCard({ url, title }: ArtifactCardProps) {
  const { t } = useTranslation();
  const [previewOpen, setPreviewOpen] = useState(false);
  const service = detectService(url);
  const displayTitle = title || extractTitle(url);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:border-primary/30 transition-colors group"
      >
        <span className={service.color}>{service.icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate max-w-[160px]">{displayTitle}</p>
          <p className="text-[10px] text-muted-foreground">{service.name}</p>
        </div>
        <div className="flex items-center gap-0.5 ml-1">
          {service.embeddable && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-3 w-3" />
            </Button>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        </div>
      </motion.div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-border flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={service.color}>{service.icon}</span>
              <DialogTitle className="text-sm font-medium">{displayTitle}</DialogTitle>
            </div>
            <div className="flex items-center gap-1">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                  <ExternalLink className="h-3 w-3" />
                  {t("artifacts.openExternal")}
                </Button>
              </a>
            </div>
          </DialogHeader>
          <div className="flex-1 h-full">
            <iframe
              src={url}
              className="w-full h-full border-0"
              title={displayTitle}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
