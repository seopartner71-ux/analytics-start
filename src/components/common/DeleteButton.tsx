import { useState, ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DeleteButtonProps {
  /** Имя удаляемого объекта (для текста подтверждения) */
  entityName: string;
  /** Тип объекта (для заголовка): "задачу", "проект", "сотрудника"… */
  entityLabel: string;
  /** Двойное подтверждение — пользователь должен ввести имя объекта */
  doubleConfirm?: boolean;
  /** Доп. описание удаляемых данных (каскад) */
  cascadeInfo?: ReactNode;
  /** Видимость кнопки (если false — не рендерим) */
  visible?: boolean;
  /** Вариант: иконка в таблице или большая кнопка на странице */
  variant?: "icon" | "outlined";
  /** Размер */
  size?: "sm" | "default";
  /** Опционально — подпись для outlined */
  label?: string;
  /** Действие удаления */
  onConfirm: () => Promise<void> | void;
  className?: string;
}

export function DeleteButton({
  entityName,
  entityLabel,
  doubleConfirm = false,
  cascadeInfo,
  visible = true,
  variant = "icon",
  size = "sm",
  label = "Удалить",
  onConfirm,
  className,
}: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const canConfirm = !doubleConfirm || confirmText.trim() === entityName.trim();

  const handle = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm();
      toast.success(`${capitalize(entityLabel)} удалён${needsA(entityLabel) ? "а" : ""}`);
      setOpen(false);
      setConfirmText("");
    } catch (e: any) {
      toast.error(e?.message || "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(
            "h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            className
          )}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label={`Удалить ${entityLabel}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size={size}
          className={cn(
            "border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground",
            className
          )}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          {label}
        </Button>
      )}

      <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Удалить {entityLabel}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="font-medium text-foreground">«{entityName}»</div>
                {cascadeInfo ? (
                  <div className="text-sm text-muted-foreground">{cascadeInfo}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Это действие нельзя отменить.
                  </div>
                )}
                {doubleConfirm && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      Введите название для подтверждения:
                    </label>
                    <Input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={entityName}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm || busy}
              onClick={(e) => {
                e.preventDefault();
                handle();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Удаление…" : doubleConfirm ? "Удалить навсегда" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function needsA(label: string) {
  // грубо: "задачу" → "удалена", "проект" → "удалён", "сотрудника" → "удалён"
  return /задач/i.test(label);
}
