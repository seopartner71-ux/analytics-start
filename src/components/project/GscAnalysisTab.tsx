import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Search, Link2, BarChart3, MousePointerClick, Eye, Percent, ArrowUpDown, Plug } from "lucide-react";

interface Props { projectId: string; }

export function GscAnalysisTab({ projectId }: Props) {
  const { data: project } = useQuery({
    queryKey: ["project-detail-gsc", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      return data;
    },
  });

  const { data: specialist } = useQuery({
    queryKey: ["specialist-gsc", project?.seo_specialist_id],
    enabled: !!project?.seo_specialist_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("full_name")
        .eq("id", project!.seo_specialist_id!)
        .single();
      return data;
    },
  });

  const domain = (() => {
    if (!project?.url) return "—";
    try {
      return new URL(project.url.startsWith("http") ? project.url : `https://${project.url}`).hostname;
    } catch {
      return project.url;
    }
  })();

  // KPI плитки в едином стиле «Аналитики» — семантические токены, без hex
  const kpis = [
    { label: "Клики", icon: MousePointerClick, tone: "primary" },
    { label: "Показы", icon: Eye, tone: "chart-2" },
    { label: "Средний CTR", icon: Percent, tone: "chart-3" },
    { label: "Средняя позиция", icon: ArrowUpDown, tone: "chart-4" },
  ] as const;

  return (
    <div className="space-y-5">
      {/* HEADER — единый стиль с другими вкладками */}
      <Card className="bg-card border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">Анализ GSC</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
              <span>Сайт: <span className="text-foreground font-medium">{domain}</span></span>
              <span>Дата анализа: <span className="text-foreground">{format(new Date(), "dd.MM.yyyy")}</span></span>
              <span>Подготовил: <span className="text-foreground">{specialist?.full_name || project?.seo_specialist || "—"}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[11px]">Не подключено</Badge>
            <Button size="sm" disabled className="gap-1.5 text-[12px]">
              <Plug className="h-3.5 w-3.5" /> Подключить Google Search Console
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI — формат Аналитики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const isPrimary = k.tone === "primary";
          const bgCls = isPrimary ? "bg-primary/10" : `bg-[hsl(var(--${k.tone}))]/10`;
          const textCls = isPrimary ? "text-primary" : `text-[hsl(var(--${k.tone}))]`;
          return (
            <Card key={k.label} className="bg-card rounded-lg shadow-sm border border-border p-4">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg ${bgCls} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${textCls}`} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">—</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Two-column placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Топ поисковые запросы</h3>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <p className="text-[13px] text-muted-foreground">
              Подключите Google Search Console, чтобы увидеть запросы, по которым показывается сайт
            </p>
          </div>
        </Card>

        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Топ страницы</h3>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <p className="text-[13px] text-muted-foreground">
              Здесь будут страницы с наибольшим количеством кликов и показов из Google
            </p>
          </div>
        </Card>
      </div>

      {/* Performance chart placeholder */}
      <Card className="bg-card border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Динамика трафика из Google</h3>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
          <p className="text-[13px] text-muted-foreground">График кликов и показов появится после подключения GSC</p>
        </div>
      </Card>
    </div>
  );
}

export default GscAnalysisTab;
