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

  const kpis = [
    { label: "Клики", icon: MousePointerClick, color: "text-blue-400", bg: "bg-blue-500/15" },
    { label: "Показы", icon: Eye, color: "text-purple-400", bg: "bg-purple-500/15" },
    { label: "Средний CTR", icon: Percent, color: "text-emerald-400", bg: "bg-emerald-500/15" },
    { label: "Средняя позиция", icon: ArrowUpDown, color: "text-yellow-400", bg: "bg-yellow-500/15" },
  ];

  return (
    <div className="space-y-5">
      {/* HEADER (тот же стиль, что и в Webmaster/Audit) */}
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
            <Badge className="bg-muted text-muted-foreground">Не подключено</Badge>
            <Button
              size="sm"
              disabled
              className="gap-1.5 text-[12px] bg-gradient-to-r from-purple-600 to-indigo-600 text-foreground border-0 opacity-70 cursor-not-allowed"
            >
              <Plug className="h-3.5 w-3.5" /> Подключить Google Search Console
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI placeholder */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="bg-card border-border p-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${k.bg}`}>
                  <Icon className={`h-5 w-5 ${k.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</div>
                  <div className="text-[20px] font-bold text-foreground tabular-nums">—</div>
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
            <h3 className="text-[14px] font-semibold text-foreground">Топ поисковые запросы</h3>
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
            <h3 className="text-[14px] font-semibold text-foreground">Топ страницы</h3>
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
          <h3 className="text-[14px] font-semibold text-foreground">Динамика трафика из Google</h3>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
          <p className="text-[13px] text-muted-foreground">График кликов и показов появится после подключения GSC</p>
        </div>
      </Card>
    </div>
  );
}

export default GscAnalysisTab;
