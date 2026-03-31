import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileText, Search, ExternalLink, TrendingUp, TrendingDown, ArrowUpDown, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface PagesTabProps {
  projectId: string;
  projectName: string;
  projectUrl?: string;
}

interface PageEntry {
  path: string;
  url: string;
  visits: number;
  pageviews: number;
  share: number;
}

type SortKey = "visits" | "pageviews" | "share";

export function PagesTab({ projectId, projectName, projectUrl }: PagesTabProps) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const { appliedRange } = useDateRange();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("visits");
  const [sortAsc, setSortAsc] = useState(false);

  const dateFrom = format(appliedRange.from, "yyyy-MM-dd");
  const dateTo = format(appliedRange.to, "yyyy-MM-dd");

  // Get Metrika integration
  const { data: integration } = useQuery({
    queryKey: ["integration-metrika", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations").select("*")
        .eq("project_id", projectId).eq("service_name", "yandexMetrika").eq("connected", true).maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch top pages from Metrika API
  const { data: pagesData, isLoading } = useQuery({
    queryKey: ["metrika-top-pages", projectId, integration?.counter_id, dateFrom, dateTo],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-stats`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            access_token: integration!.access_token,
            counter_id: integration!.counter_id,
            date1: dateFrom,
            date2: dateTo,
          }),
        }
      );
      if (!r.ok) throw new Error("Failed to fetch pages");
      return r.json();
    },
    enabled: !!integration?.access_token && !!integration?.counter_id,
    staleTime: 5 * 60_000,
  });

  // Parse top pages
  const pages: PageEntry[] = useMemo(() => {
    const raw = pagesData?.topPages?.data;
    if (!raw?.length) return [];
    const totalVisits = raw.reduce((s: number, r: any) => s + (r.metrics?.[0] || 0), 0);
    return raw.map((row: any) => {
      const fullUrl = row.dimensions?.[0]?.name || "";
      const visits = Math.round(row.metrics?.[0] || 0);
      const pageviews = Math.round(row.metrics?.[1] || 0);
      let path = fullUrl;
      try { path = new URL(fullUrl).pathname; } catch { /* keep as-is */ }
      return {
        path,
        url: fullUrl,
        visits,
        pageviews,
        share: totalVisits > 0 ? Math.round((visits / totalVisits) * 1000) / 10 : 0,
      };
    });
  }, [pagesData]);

  // Filter & sort
  const filtered = useMemo(() => {
    let list = pages;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.path.toLowerCase().includes(q) || p.url.toLowerCase().includes(q));
    }
    list.sort((a, b) => sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]);
    return list;
  }, [pages, search, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // No integration connected
  if (!integration) {
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
            ? "Подключите Яндекс.Метрику на вкладке «Интеграции», чтобы увидеть постраничную аналитику."
            : "Connect Yandex.Metrika on the Integrations tab to see page-level analytics."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">
              {isRu ? "Популярные страницы" : "Top Pages"}
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isRu ? "Поиск по URL..." : "Search URL..."}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-4/6" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">{isRu ? "Нет данных за выбранный период" : "No data for selected period"}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">{isRu ? "Страница" : "Page"}</TableHead>
                    <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort("visits")}>
                      <span className="inline-flex items-center gap-1">
                        {isRu ? "Визиты" : "Visits"}
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                    <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort("pageviews")}>
                      <span className="inline-flex items-center gap-1">
                        {isRu ? "Просмотры" : "Views"}
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                    <TableHead className="text-xs text-right cursor-pointer select-none" onClick={() => handleSort("share")}>
                      <span className="inline-flex items-center gap-1">
                        {isRu ? "Доля" : "Share"}
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((page, i) => (
                    <TableRow key={page.url} className="group">
                      <TableCell className="text-xs text-muted-foreground w-8">{i + 1}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate font-medium" title={page.url}>{page.path}</span>
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums">{page.visits.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">{page.pageviews.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">{page.share}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
