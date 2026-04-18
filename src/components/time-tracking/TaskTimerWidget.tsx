import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Square, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}

function fmtElapsed(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TaskTimerWidget({ taskId, projectId }: { taskId: string; projectId: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [manualMin, setManualMin] = useState("");
  const [manualComment, setManualComment] = useState("");

  const { data: entries = [] } = useQuery({
    queryKey: ["time-entries", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_time_entries")
        .select("*")
        .eq("task_id", taskId)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const running = entries.find((e) => e.user_id === user?.id && !e.ended_at);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const start = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("task_time_entries").insert({
        task_id: taskId,
        user_id: user!.id,
        project_id: projectId,
        started_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time-entries", taskId] });
      toast.success("Таймер запущен");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const stop = useMutation({
    mutationFn: async () => {
      if (!running) return;
      const { error } = await supabase
        .from("task_time_entries")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", running.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time-entries", taskId] });
      toast.success("Таймер остановлен");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addManual = useMutation({
    mutationFn: async () => {
      const min = parseInt(manualMin, 10);
      if (!min || min <= 0) throw new Error("Введите количество минут");
      const startedAt = new Date(Date.now() - min * 60 * 1000).toISOString();
      const endedAt = new Date().toISOString();
      const { error } = await supabase.from("task_time_entries").insert({
        task_id: taskId,
        user_id: user!.id,
        project_id: projectId,
        started_at: startedAt,
        ended_at: endedAt,
        comment: manualComment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setManualMin("");
      setManualComment("");
      qc.invalidateQueries({ queryKey: ["time-entries", taskId] });
      toast.success("Время добавлено");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time-entries", taskId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const totalMin = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const myMin = entries.filter((e) => e.user_id === user?.id).reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const elapsedSec = running ? Math.floor((now - new Date(running.started_at).getTime()) / 1000) : 0;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Учёт времени</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Моё: <span className="font-semibold text-foreground">{fmtDuration(myMin)}</span>
          <span className="mx-1.5">·</span>
          Всего: <span className="font-semibold text-foreground">{fmtDuration(totalMin)}</span>
        </div>
      </div>

      {running ? (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/30 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-sm font-semibold text-primary tabular-nums">{fmtElapsed(elapsedSec)}</span>
          <span className="text-xs text-muted-foreground ml-auto">идёт отсчёт...</span>
          <Button size="sm" variant="destructive" onClick={() => stop.mutate()} disabled={stop.isPending}>
            <Square className="h-3 w-3 mr-1" />
            Стоп
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
            <Play className="h-3 w-3 mr-1" />
            Запустить таймер
          </Button>
          <div className="flex items-center gap-1.5 ml-auto">
            <Input
              type="number"
              min="1"
              placeholder="мин"
              value={manualMin}
              onChange={(e) => setManualMin(e.target.value)}
              className="h-8 w-20 text-xs"
            />
            <Input
              placeholder="комментарий"
              value={manualComment}
              onChange={(e) => setManualComment(e.target.value)}
              className="h-8 w-40 text-xs"
            />
            <Button size="sm" variant="outline" onClick={() => addManual.mutate()} disabled={addManual.isPending}>
              <Plus className="h-3 w-3 mr-1" />
              Добавить
            </Button>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {entries.slice(0, 8).map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-muted/50 group">
              <span className="text-muted-foreground tabular-nums w-24">
                {format(new Date(e.started_at), "d MMM HH:mm", { locale: ru })}
              </span>
              <span className="font-medium tabular-nums w-16">
                {e.ended_at ? fmtDuration(e.duration_minutes) : "идёт..."}
              </span>
              {e.comment && <span className="text-muted-foreground truncate flex-1">{e.comment}</span>}
              {e.user_id === user?.id && (
                <button
                  onClick={() => remove.mutate(e.id)}
                  className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
