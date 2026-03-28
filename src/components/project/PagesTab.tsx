import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Loader2, Globe, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface PagesTabProps {
  projectId: string;
  projectName: string;
  projectUrl?: string;
}

export function PagesTab({ projectId, projectName, projectUrl }: PagesTabProps) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";

  // This tab previously showed demo data.
  // Real page-level analytics require a dedicated API integration (e.g. Metrika page-level stats).
  // For now, show an informative empty state.

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <FileText className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        {isRu ? "Данные по страницам" : "Page Analytics"}
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {isRu
          ? "Постраничная аналитика будет доступна после подключения расширенной интеграции с Яндекс.Метрикой. Используйте вкладки «Обзор» и «Трафик» для общей статистики."
          : "Page-level analytics will be available after connecting extended Metrika integration. Use the Overview and Traffic tabs for general statistics."}
      </p>
    </div>
  );
}
