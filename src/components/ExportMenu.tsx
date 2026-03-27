import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, FileText, Table, FileEdit, Loader2 } from "lucide-react";

interface ExportMenuProps {
  onExportPdf: () => Promise<void>;
  onExportExcel: () => Promise<void>;
  onExportWord: () => Promise<void>;
}

export function ExportMenu({ onExportPdf, onExportExcel, onExportWord }: ExportMenuProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<string | null>(null);

  const handle = async (type: string, fn: () => Promise<void>) => {
    setLoading(type);
    try {
      await fn();
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" data-export-ignore>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          {t("export.title", "Экспорт")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-export-ignore>
        <DropdownMenuItem
          onClick={() => handle("pdf", onExportPdf)}
          disabled={loading === "pdf"}
          className="gap-2 text-xs"
        >
          <FileText className="h-3.5 w-3.5" />
          PDF (.pdf)
          {loading === "pdf" && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handle("xlsx", onExportExcel)}
          disabled={loading === "xlsx"}
          className="gap-2 text-xs"
        >
          <Table className="h-3.5 w-3.5" />
          Excel (.xlsx)
          {loading === "xlsx" && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handle("docx", onExportWord)}
          disabled={loading === "docx"}
          className="gap-2 text-xs"
        >
          <FileEdit className="h-3.5 w-3.5" />
          Word (.docx)
          {loading === "docx" && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
