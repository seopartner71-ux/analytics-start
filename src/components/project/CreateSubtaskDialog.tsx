import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ListPlus } from "lucide-react";
import { toast } from "sonner";

export type SubtaskFormValues = {
  title: string;
  description: string;
  assignee_id: string | null;
  deadline: string | null; // datetime-local string
  plan_hours: number | null;
};

interface Member { id: string; full_name: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parentTaskTitle: string;
  parentTaskShortId: string;
  members: Member[];
  defaultAssigneeId?: string | null;
  submitting?: boolean;
  onSubmit: (values: SubtaskFormValues) => Promise<void> | void;
}

export function CreateSubtaskDialog({
  open, onOpenChange, parentTaskTitle, parentTaskShortId, members,
  defaultAssigneeId, submitting, onSubmit,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [planHours, setPlanHours] = useState<string>("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setAssigneeId(defaultAssigneeId || "");
      setDeadline("");
      setPlanHours("");
    }
  }, [open, defaultAssigneeId]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Введите название подзадачи");
      return;
    }
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      assignee_id: assigneeId || null,
      deadline: deadline || null,
      plan_hours: planHours ? Number(planHours) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden border-border/70 bg-card shadow-2xl">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 bg-gradient-to-r from-primary/[0.05] to-transparent space-y-1.5">
                <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
                  <span className="h-7 w-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                    <ListPlus className="h-4 w-4" />
                  </span>
                  Создать подзадачу
                </DialogTitle>
                <DialogDescription className="text-[12px] text-muted-foreground">
                  Родительская задача:{" "}
                  <span className="text-foreground/80 font-medium">
                    #{parentTaskShortId} {parentTaskTitle}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-foreground/80">
                    Название задачи <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Например: Подготовить ТЗ для копирайтера"
                    className="h-9 text-[13px]"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-foreground/80">Описание / ТЗ</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Опишите детали, требования, ссылки..."
                    className="min-h-[88px] text-[13px] resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-medium text-foreground/80">Исполнитель</Label>
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue placeholder="Не назначен" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-[13px]">
                            {m.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-medium text-foreground/80">Крайний срок</Label>
                    <Input
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="h-9 text-[13px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-foreground/80">План времени (часов)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={planHours}
                    onChange={(e) => setPlanHours(e.target.value)}
                    placeholder="Например: 2"
                    className="h-9 text-[13px] w-32"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border/60 bg-muted/30 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-[13px]"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  Отмена
                </Button>
                <Button
                  size="sm"
                  className="h-9 text-[13px] bg-amber-500 hover:bg-amber-500/90 text-white gap-1.5"
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim()}
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Создать подзадачу
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
