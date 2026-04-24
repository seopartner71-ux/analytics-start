import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Send, Copy, RefreshCw, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { formatWeekRange } from "@/lib/iso-week";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { DeleteButton } from "@/components/common/DeleteButton";
import { logDeletion } from "@/lib/deletion-log";

interface PlannedItem { id?: string; title: string; source: "crm_task" | "manual" | "period"; hidden: boolean; }
interface DoneItem { title: string; status: "done" | "moved" | "in_progress"; source: string; }
interface Metrics { positions_text?: string; traffic_text?: string; }

interface WeeklyReport {
  id: string;
  project_id: string;
  week_number: number;
  week_year: number;
  week_start: string;
  week_end: string;
  status: "draft" | "sent";
  planned_items: PlannedItem[];
  done_items: DoneItem[];
  metrics: Metrics;
  manager_comment: string;
  share_token: string;
  sent_at: string | null;
  created_at: string;
}

export function WeeklyReportsTab({ projectId }: { projectId: string }) {
  const { isAdmin, role } = useAuth();
  const canDelete = isAdmin || role === "director";
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("weekly_reports")
      .select("*")
      .eq("project_id", projectId)
      .order("week_year", { ascending: false })
      .order("week_number", { ascending: false });
    if (error) toast.error(error.message);
    setReports((data || []) as any);
    setLoading(false);
    if (!activeId && data && data.length > 0) setActiveId(data[0].id);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  const active = useMemo(() => reports.find((r) => r.id === activeId) || null, [reports, activeId]);

  // Авто-подтягивание задач из активного периода в «Планируем на этой неделе».
  // Срабатывает один раз для draft-отчёта, у которого ещё нет планируемых задач из периода.
  useEffect(() => {
    if (!active || active.status !== "draft") return;
    const hasPeriodItems = active.planned_items.some((it) => it.source === "period" || it.source === "crm_task");
    if (hasPeriodItems) return;

    let cancelled = false;
    (async () => {
      // Сначала пробуем найти задачи прямо привязанные к этой неделе…
      let { data: weekTasks } = await supabase
        .from("period_tasks")
        .select("id, title, period_id, week_start, week_end, deadline, project_periods!inner(project_id)")
        .eq("project_periods.project_id", projectId)
        .eq("week_start", active.week_start)
        .eq("week_end", active.week_end);

      // …либо по дедлайну, попадающему в неделю
      if (!weekTasks || weekTasks.length === 0) {
        const { data: byDeadline } = await supabase
          .from("period_tasks")
          .select("id, title, period_id, deadline, project_periods!inner(project_id)")
          .eq("project_periods.project_id", projectId)
          .gte("deadline", active.week_start)
          .lte("deadline", active.week_end);
        weekTasks = byDeadline || [];
      }

      if (cancelled || !weekTasks || weekTasks.length === 0) return;

      const periodItems: PlannedItem[] = weekTasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        source: "period",
        hidden: false,
      }));
      const merged = [...periodItems, ...active.planned_items.filter((it) => it.source === "manual")];

      setReports((cur) => cur.map((r) => (r.id === active.id ? { ...r, planned_items: merged } : r)));
      await supabase.from("weekly_reports").update({ planned_items: merged as any }).eq("id", active.id);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.status, active?.week_start, active?.week_end, projectId]);

  const generateNow = async () => {
    setGenerating(true);
    try {
      const fnUrl = `https://iigedewmxyqigivsqwqz.supabase.co/functions/v1/generate-weekly-reports?project_id=${projectId}`;
      const sess = await supabase.auth.getSession();
      const r = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.data.session?.access_token || ""}`,
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpZ2VkZXdteHlxaWdpdnNxd3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDU4MTMsImV4cCI6MjA5MDE4MTgxM30.11sID9y098DL29ocSLP109NuUyjF1I-hxY_1Rb3kKao",
        },
        body: "{}",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Не удалось сгенерировать");
      toast.success(j.count > 0 && j.created?.[0]?.status === "created" ? "Отчёт создан" : "Отчёт уже существует");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const updateActive = async (patch: Partial<WeeklyReport>) => {
    if (!active) return;
    const prev = reports;
    setReports((cur) => cur.map((r) => (r.id === active.id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("weekly_reports").update(patch as any).eq("id", active.id);
    if (error) {
      setReports(prev);
      toast.error(error.message);
    }
  };

  const togglePlannedHidden = (idx: number) => {
    if (!active) return;
    const items = active.planned_items.map((it, i) => (i === idx ? { ...it, hidden: !it.hidden } : it));
    updateActive({ planned_items: items });
  };

  const updatePlannedTitle = (idx: number, title: string) => {
    if (!active) return;
    const items = active.planned_items.map((it, i) => (i === idx ? { ...it, title } : it));
    setReports((cur) => cur.map((r) => (r.id === active.id ? { ...r, planned_items: items } : r)));
  };

  const savePlanned = () => active && updateActive({ planned_items: active.planned_items });

  const addManualPlanned = () => {
    if (!active) return;
    updateActive({
      planned_items: [...active.planned_items, { title: "Новая задача", source: "manual", hidden: false }],
    });
  };

  const removePlanned = (idx: number) => {
    if (!active) return;
    updateActive({ planned_items: active.planned_items.filter((_, i) => i !== idx) });
  };

  const sendToClient = async () => {
    if (!active) return;
    await updateActive({ status: "sent", sent_at: new Date().toISOString() } as any);
    const url = `${window.location.origin}/weekly/${active.share_token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Отчёт отправлен. Ссылка скопирована.");
    load();
  };

  const copyLink = async () => {
    if (!active) return;
    const url = `${window.location.origin}/weekly/${active.share_token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Ссылка скопирована");
  };

  const deleteReport = async () => {
    if (!active) return;
    const { error } = await supabase.from("weekly_reports").delete().eq("id", active.id);
    if (error) { toast.error(error.message); throw error; }
    await logDeletion({
      entityType: "report",
      entityId: active.id,
      entityName: `Неделя ${active.week_number}, ${active.week_year}`,
      action: "hard_delete",
      context: { project_id: active.project_id },
    });
    setActiveId(null);
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Список */}
      <Card className="p-3 lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto">
        <Button size="sm" className="w-full gap-1.5" onClick={generateNow} disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Создать на текущую неделю
        </Button>
        {reports.length === 0 && (
          <p className="text-[12px] text-muted-foreground text-center py-4">Отчётов пока нет</p>
        )}
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveId(r.id)}
            className={cn(
              "w-full text-left p-2 rounded-md border transition-colors",
              activeId === r.id ? "bg-primary/10 border-primary/40" : "border-transparent hover:bg-muted",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium">Неделя {r.week_number}</span>
              <Badge variant={r.status === "sent" ? "default" : "secondary"} className="text-[10px] h-5">
                {r.status === "sent" ? "Отправлен" : "Черновик"}
              </Badge>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{formatWeekRange(r.week_start, r.week_end)}</div>
          </button>
        ))}
      </Card>

      {/* Редактор */}
      <div className="lg:col-span-3 space-y-4">
        {!active ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Выберите отчёт слева или создайте новый</Card>
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[16px] font-semibold">📋 План работ на неделю {active.week_number}</div>
                  <div className="text-[12px] text-muted-foreground">{formatWeekRange(active.week_start, active.week_end)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {active.status === "sent" && (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={copyLink}>
                      <Copy className="h-3.5 w-3.5" /> Ссылка
                    </Button>
                  )}
                  <Button size="sm" className="h-8 gap-1.5" onClick={sendToClient} disabled={active.status === "sent"}>
                    <Send className="h-3.5 w-3.5" /> {active.status === "sent" ? "Отправлен" : "Отправить клиенту"}
                  </Button>
                  <DeleteButton
                    visible={canDelete}
                    variant="icon"
                    entityLabel="отчёт"
                    entityName={`Неделя ${active.week_number}`}
                    onConfirm={deleteReport}
                  />
                </div>
              </div>
            </Card>

            {/* Блок 1 — планируем */}
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold">Планируем на этой неделе</div>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={addManualPlanned}>
                  <Plus className="h-3 w-3" /> Добавить
                </Button>
              </div>
              {active.planned_items.length === 0 && (
                <p className="text-[12px] text-muted-foreground">Нет задач с дедлайном на эту неделю</p>
              )}
              {active.planned_items.map((it, idx) => (
                <div key={idx} className={cn("flex items-center gap-2 p-2 rounded-md border", it.hidden && "opacity-50 bg-muted/40")}>
                  <span className="text-[14px]">🔄</span>
                  <Input
                    value={it.title}
                    onChange={(e) => updatePlannedTitle(idx, e.target.value)}
                    onBlur={savePlanned}
                    className="h-7 text-[12px] border-0 bg-transparent focus-visible:bg-background flex-1"
                  />
                  <Badge
                    variant={it.source === "period" ? "secondary" : "outline"}
                    className={cn("text-[10px] h-5", it.source === "manual" && "text-muted-foreground")}
                  >
                    {it.source === "manual" ? "Вручную" : it.source === "period" ? "Из периода" : "Из задач"}
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => togglePlannedHidden(idx)} title={it.hidden ? "Показать клиенту" : "Скрыть от клиента"}>
                    {it.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removePlanned(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </Card>

            {/* Блок 2 — выполнено */}
            <Card className="p-4 space-y-2">
              <div className="text-[13px] font-semibold">Выполнено на прошлой неделе</div>
              {active.done_items.length === 0 && (
                <p className="text-[12px] text-muted-foreground">Нет данных за прошлую неделю</p>
              )}
              {active.done_items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[13px]">
                  <span>{it.status === "done" ? "✅" : it.status === "moved" ? "⚠️" : "🔄"}</span>
                  <span className="flex-1">{it.title}</span>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {it.status === "done" ? "Выполнено" : it.status === "moved" ? "Перенесено" : "В работе"}
                  </Badge>
                </div>
              ))}
            </Card>

            {/* Блок 3 — показатели */}
            <Card className="p-4 space-y-2">
              <div className="text-[13px] font-semibold">Показатели</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">📈 Позиции</label>
                  <Input
                    value={active.metrics.positions_text || ""}
                    onChange={(e) => setReports((cur) => cur.map((r) => r.id === active.id ? { ...r, metrics: { ...r.metrics, positions_text: e.target.value } } : r))}
                    onBlur={() => updateActive({ metrics: active.metrics })}
                    placeholder="+12 запросов в топ-10"
                    className="h-8 text-[12px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">📊 Трафик</label>
                  <Input
                    value={active.metrics.traffic_text || ""}
                    onChange={(e) => setReports((cur) => cur.map((r) => r.id === active.id ? { ...r, metrics: { ...r.metrics, traffic_text: e.target.value } } : r))}
                    onBlur={() => updateActive({ metrics: active.metrics })}
                    placeholder="1 245 визитов"
                    className="h-8 text-[12px]"
                  />
                </div>
              </div>
            </Card>

            {/* Блок 4 — комментарий */}
            <Card className="p-4 space-y-2">
              <div className="text-[13px] font-semibold">Комментарий менеджера</div>
              <Textarea
                value={active.manager_comment}
                onChange={(e) => setReports((cur) => cur.map((r) => r.id === active.id ? { ...r, manager_comment: e.target.value } : r))}
                onBlur={() => updateActive({ manager_comment: active.manager_comment })}
                placeholder="Свободный текст для клиента…"
                className="min-h-[100px] text-[13px]"
              />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
