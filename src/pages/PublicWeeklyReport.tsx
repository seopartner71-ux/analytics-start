import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Printer } from "lucide-react";
import { formatWeekRange } from "@/lib/iso-week";

interface Report {
  id: string;
  project_id: string;
  project_name: string;
  week_number: number;
  week_year: number;
  week_start: string;
  week_end: string;
  status: string;
  planned_items: Array<{ title: string; hidden?: boolean }>;
  done_items: Array<{ title: string; status: string }>;
  metrics: { positions_text?: string; traffic_text?: string };
  manager_comment: string;
  sent_at: string | null;
}

export default function PublicWeeklyReport() {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabase.rpc("get_weekly_report_by_token", { p_token: token });
      if (error) setError(error.message);
      else if (!data || data.length === 0) setError("Отчёт не найден или ещё не отправлен");
      else setReport(data[0] as any);
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error || !report) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">{error || "Не найдено"}</div>;

  const visiblePlanned = report.planned_items.filter((i) => !i.hidden);

  return (
    <div className="min-h-screen bg-background py-8 px-4 print:py-0">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Badge variant="outline">{report.project_name}</Badge>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Печать / PDF
          </Button>
        </div>

        <Card className="p-6 space-y-1">
          <div className="text-[20px] font-semibold">📋 План работ на неделю {report.week_number}</div>
          <div className="text-[13px] text-muted-foreground">{formatWeekRange(report.week_start, report.week_end)}</div>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="text-[14px] font-semibold">Планируем на этой неделе</div>
          {visiblePlanned.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Задачи уточняются</p>
          ) : (
            <ul className="space-y-1.5">
              {visiblePlanned.map((it, i) => (
                <li key={i} className="text-[14px] flex gap-2"><span>🔄</span><span>{it.title}</span></li>
              ))}
            </ul>
          )}
        </Card>

        {report.done_items.length > 0 && (
          <Card className="p-6 space-y-3">
            <div className="text-[14px] font-semibold">Выполнено на прошлой неделе</div>
            <ul className="space-y-1.5">
              {report.done_items.map((it, i) => (
                <li key={i} className="text-[14px] flex gap-2">
                  <span>{it.status === "done" ? "✅" : it.status === "moved" ? "⚠️" : "🔄"}</span>
                  <span>
                    {it.title}
                    {it.status === "moved" && <span className="text-muted-foreground"> — перенесено на эту неделю</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {(report.metrics?.positions_text || report.metrics?.traffic_text) && (
          <Card className="p-6 space-y-2">
            <div className="text-[14px] font-semibold">Показатели</div>
            {report.metrics.positions_text && <div className="text-[14px]">📈 Позиции: {report.metrics.positions_text}</div>}
            {report.metrics.traffic_text && <div className="text-[14px]">📊 Трафик: {report.metrics.traffic_text}</div>}
          </Card>
        )}

        {report.manager_comment && (
          <Card className="p-6 space-y-2">
            <div className="text-[14px] font-semibold">Комментарий менеджера</div>
            <p className="text-[14px] whitespace-pre-wrap">{report.manager_comment}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
