import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { result: string; minutes: number }) => Promise<void> | void;
  saving?: boolean;
}

export function CompleteTaskDialog({ open, onOpenChange, onConfirm, saving }: Props) {
  const [result, setResult] = useState("");
  const [hours, setHours] = useState("");
  const [mins, setMins] = useState("0");

  useEffect(() => {
    if (open) {
      setResult("");
      setHours("");
      setMins("0");
    }
  }, [open]);

  const totalMin = (parseInt(hours, 10) || 0) * 60 + (parseInt(mins, 10) || 0);
  const canSave = result.trim().length > 0 && totalMin > 0 && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Завершение задачи
          </DialogTitle>
          <DialogDescription>
            Пожалуйста, зафиксируйте результат и потраченное время.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Результат работы <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="Результат работы (ссылка, комментарий или отчёт)..."
              className="min-h-[100px] text-sm resize-none"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Потраченное время <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min="0"
                placeholder="Часы"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="h-9 text-sm"
              />
              <Select value={mins} onValueChange={setMins}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 минут</SelectItem>
                  <SelectItem value="15">15 минут</SelectItem>
                  <SelectItem value="30">30 минут</SelectItem>
                  <SelectItem value="45">45 минут</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => onConfirm({ result: result.trim(), minutes: totalMin })}
            className="bg-primary hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Сохраняем...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Сохранить и закрыть
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
