import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STAGE_COLORS, STAGE_PROGRESS, resolveCurrentTeamMemberId } from "@/lib/task-helpers";
import type { SourceTaskRef, TaskSourceType } from "@/hooks/useSourceTasks";

interface Props {
  projectId: string;
  sourceType: TaskSourceType;
  sourceId: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultPriority?: "high" | "medium" | "low";
  existingTask?: SourceTaskRef;
  className?: string;
}

export function CreateTaskFromSourceButton({
  projectId, sourceType, sourceId,
  defaultTitle, defaultDescription, defaultPriority = "medium",
  existingTask, className,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [priority, setPriority] = useState<"high" | "medium" | "low">(defaultPriority);

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизован");
      const creatorTmId = await resolveCurrentTeamMemberId(supabase, user.id, user.email);
      const { data, error } = await supabase.from("crm_tasks").insert({
        title: title.trim() || defaultTitle,
        description,
        priority,
        project_id: projectId,
        owner_id: user.id,
        creator_id: creatorTmId,
        stage: "Новые",
        stage_color: STAGE_COLORS["Новые"],
        stage_progress: STAGE_PROGRESS["Новые"] || 0,
        source_type: sourceType,
        source_id: sourceId,
      } as any).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Задача создана");
      qc.invalidateQueries({ queryKey: ["source-tasks", projectId, sourceType] });
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Не удалось создать задачу"),
  });

  if (existingTask) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={`/tasks?taskId=${existingTask.id}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-2xs font-medium text-emerald-500 hover:bg-emerald-500/20 transition-colors",
                className
              )}
            >
              <ClipboardCheck className="h-3 w-3" />
              #{existingTask.shortId}
            </a>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-sm">
            Задача уже создана: {existingTask.title}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setTitle(defaultTitle);
                setDescription(defaultDescription);
                setPriority(defaultPriority);
                setOpen(true);
              }}
              className={cn("h-7 w-7 shrink-0 text-muted-foreground hover:text-primary", className)}
            >
              <Wrench className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-sm">Создать задачу</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-lg">Создать задачу из ошибки</DialogTitle>
            <DialogDescription className="text-sm">
              Задача будет привязана к проекту и связана с источником.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Название</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Описание</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px] text-base resize-none font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Приоритет</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger className="h-9 text-base w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Высокий</SelectItem>
                  <SelectItem value="medium">Средний</SelectItem>
                  <SelectItem value="low">Низкий</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={create.isPending}>
              Отмена
            </Button>
            <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !title.trim()}>
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Создать задачу
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
