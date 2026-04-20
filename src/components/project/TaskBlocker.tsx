import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Snowflake, Lock, Unlock, AlertOctagon, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PROBLEM_TYPES = [
  "Нет доступов",
  "Жду контент",
  "На согласовании у клиента",
  "Техническая ошибка",
] as const;

type ProblemType = (typeof PROBLEM_TYPES)[number];

/** Frozen-deadline badge — render in the "Крайний срок" row when blocked. */
export function FrozenDeadlineBadge() {
  return (
    <Badge
      className="text-[10px] h-5 gap-1 border-0 bg-purple-500/15 text-purple-300 hover:bg-purple-500/15"
    >
      <Snowflake className="h-3 w-3" /> Дедлайн заморожен
    </Badge>
  );
}

interface TaskBlockerProps {
  isBlocked: boolean;
  blockReason: string;
  problemType?: ProblemType | "";
  onBlock: (data: { reason: string; problemType: ProblemType }) => void;
  onUnblock: () => void;
}

/** Action button + alert banner + modal. Place under the task title. */
export function TaskBlockerSection({
  isBlocked,
  blockReason,
  problemType,
  onBlock,
  onUnblock,
}: TaskBlockerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnimatePresence initial={false} mode="wait">
        {isBlocked ? (
          <motion.div
            key="banner"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/15 to-purple-500/5 p-4 shadow-[0_0_0_1px_hsl(280_80%_60%/0.15)]">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                  <AlertOctagon className="h-5 w-5 text-purple-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-purple-100">Задача заблокирована</h4>
                    {problemType && (
                      <Badge className="text-[10px] h-5 border-0 bg-purple-500/20 text-purple-200 hover:bg-purple-500/20">
                        {problemType}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-purple-200/80 leading-relaxed">
                    <span className="text-purple-300/70">Причина: </span>
                    {blockReason || "—"}
                  </p>
                  <Button
                    size="sm"
                    onClick={onUnblock}
                    className="mt-3 h-8 text-xs bg-purple-500 hover:bg-purple-600 text-white gap-1.5"
                  >
                    <Unlock className="h-3.5 w-3.5" /> Разблокировать и возобновить
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="action"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              className="h-8 text-xs gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 hover:border-purple-500/60"
            >
              <Lock className="h-3.5 w-3.5" /> Заблокировать (Жду клиента/коллегу)
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <BlockTaskModal
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(data) => {
          onBlock(data);
          setOpen(false);
        }}
      />
    </>
  );
}

function BlockTaskModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: string; problemType: ProblemType }) => void;
}) {
  const [type, setType] = useState<ProblemType | "">("");
  const [details, setDetails] = useState("");

  const reset = () => {
    setType("");
    setDetails("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!type) {
      toast.error("Выберите тип проблемы");
      return;
    }
    if (!details.trim()) {
      toast.error("Опишите подробности");
      return;
    }
    onSubmit({ reason: details.trim(), problemType: type });
    reset();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className={cn(
              "relative w-full max-w-md rounded-2xl border border-purple-500/20",
              "bg-slate-900 shadow-2xl p-6"
            )}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <Snowflake className="h-5 w-5 text-purple-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">Блокировка задачи</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-5 ml-[52px]">
              Укажите причину. Дедлайн будет заморожен, а руководитель получит уведомление.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Тип проблемы</label>
                <Select value={type} onValueChange={(v) => setType(v as ProblemType)}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700 text-slate-100 h-10">
                    <SelectValue placeholder="Выберите тип..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PROBLEM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Подробности <span className="text-purple-400">*</span>
                </label>
                <Textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Опишите, что именно блокирует задачу..."
                  className="bg-slate-800/60 border-slate-700 text-slate-100 min-h-[96px] resize-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="ghost"
                onClick={handleClose}
                className="h-9 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              >
                Отмена
              </Button>
              <Button
                onClick={handleSubmit}
                className="h-9 text-sm bg-purple-500 hover:bg-purple-600 text-white gap-1.5"
              >
                <Snowflake className="h-3.5 w-3.5" /> Заморозить задачу
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Convenience hook to manage blocker state + toasts. */
export function useTaskBlocker() {
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [problemType, setProblemType] = useState<ProblemType | "">("");

  const block = ({ reason, problemType: pt }: { reason: string; problemType: ProblemType }) => {
    setIsBlocked(true);
    setBlockReason(reason);
    setProblemType(pt);
    toast.success("Задача заморожена. PM уведомлен");
  };

  const unblock = () => {
    setIsBlocked(false);
    setBlockReason("");
    setProblemType("");
    toast.success("Задача снова в работе. Таймер дедлайна запущен");
  };

  return { isBlocked, blockReason, problemType, block, unblock };
}
