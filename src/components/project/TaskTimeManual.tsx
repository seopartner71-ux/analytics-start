import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus } from "lucide-react";
import { toast } from "sonner";

function fmtH(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}ч ${m}м`;
  if (h > 0) return `${h}ч`;
  return `${m}м`;
}

interface Props {
  taskId: string;
  projectId: string | null;
}

export function TaskTimeManual({ taskId, projectId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [hours, setHours] = useState("");
  const [mins, setMins] = useState("0");
  const [comment, setComment] = useState("");

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

  const totalMin = entries.reduce((s, e: any) => s + (e.duration_minutes || 0), 0);
  const myMin = entries.filter((e: any) => e.user_id === user?.id).reduce((s, e: any) => s + (e.duration_minutes || 0), 0);

  const log = useMutation({
    mutationFn: async () => {
      const h = parseInt(hours, 10) || 0;
      const m = parseInt(mins, 10) || 0;
      const total = h * 60 + m;
      if (total <= 0) throw new Error("Укажите время больше 0");
      const endedAt = new Date();
      const startedAt = new Date(endedAt.getTime() - total * 60 * 1000);
      const { error } = await supabase.from("task_time_entries").insert({
        task_id: taskId,
        user_id: user!.id,
        project_id: projectId,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        comment: comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setHours("");
      setMins("0");
      setComment("");
      qc.invalidateQueries({ queryKey: ["time-entries", taskId] });
      toast.success("Время списано");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Учёт времени</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Моё: <span className="font-semibold text-foreground">{fmtH(myMin)}</span>
          <span className="mx-1.5">·</span>
          Всего: <span className="font-semibold text-foreground">{fmtH(totalMin)}</span>
        </div>
      </div>

      <div className="grid grid-cols-[80px_90px_1fr] gap-2">
        <Input
          type="number"
          min="0"
          placeholder="Часы"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="h-8 text-sm"
        />
        <Select value={mins} onValueChange={setMins}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0 мин</SelectItem>
            <SelectItem value="15">15 мин</SelectItem>
            <SelectItem value="30">30 мин</SelectItem>
            <SelectItem value="45">45 мин</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Комментарий"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1.5 w-full"
        onClick={() => log.mutate()}
        disabled={log.isPending}
      >
        <Plus className="h-3.5 w-3.5" /> Списать
      </Button>
    </div>
  );
}
