import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck, UserRound, Send, ThumbsUp, ThumbsDown, History,
  AlertCircle, ArrowRight, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SimRole = "seo" | "account";

export interface ReviewHistoryItem {
  id: string;
  body: string;
  is_system: boolean;
  created_at: string;
}

interface Props {
  stage: string;
  onSubmitForReview: (resultLink: string) => Promise<void> | void;
  onAccept: () => Promise<void> | void;
  onReject: (reason: string) => Promise<void> | void;
  history: ReviewHistoryItem[];
  disabled?: boolean;
}

// Маппинг на существующие стадии:
// "В работе" / "Возвращена" → SEO видит "Отправить на проверку"
// "На проверке" → Аккаунт видит "Принять" / "Вернуть на доработку"
// "Принята" / "Завершена" → workflow закрыт

const STAGE_BADGE: Record<string, { label: string; cls: string }> = {
  "Новые": { label: "Новая", cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  "В работе": { label: "В работе", cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  "На проверке": { label: "На проверке", cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  "Возвращена": { label: "На доработке", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  "Принята": { label: "Выполнено", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  "Завершена": { label: "Выполнено", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
};

export function TaskReviewWorkflow({ stage, onSubmitForReview, onAccept, onReject, history, disabled }: Props) {
  const [simRole, setSimRole] = useState<SimRole>("seo");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [resultLink, setResultLink] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const badge = STAGE_BADGE[stage] || STAGE_BADGE["В работе"];
  const isInProgress = stage === "В работе" || stage === "Новые" || stage === "Возвращена";
  const isOnReview = stage === "На проверке";
  const isClosed = stage === "Принята" || stage === "Завершена";

  const reviewLog = useMemo(
    () =>
      history
        .filter((h) =>
          h.is_system &&
          /проверк|возврат|принял|отправлен|возвращена/i.test(h.body)
        )
        .slice(-6),
    [history]
  );

  const handleSubmit = async () => {
    if (!resultLink.trim()) return;
    setBusy(true);
    try {
      await onSubmitForReview(resultLink.trim());
      setSubmitOpen(false);
      setResultLink("");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setBusy(true);
    try {
      await onReject(rejectReason.trim());
      setRejectOpen(false);
      setRejectReason("");
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    setBusy(true);
    try {
      await onAccept();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Role switcher */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/60">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-2">
          Режим тестирования
        </span>
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setSimRole("seo")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              simRole === "seo"
                ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            <UserRound className="h-3.5 w-3.5" /> Я — SEO
          </button>
          <button
            type="button"
            onClick={() => setSimRole("account")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              simRole === "account"
                ? "bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Я — Аккаунт
          </button>
        </div>
      </div>

      {/* Status banner */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium",
            badge.cls
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Статус задачи: {badge.label}</span>
        </motion.div>
      </AnimatePresence>

      {/* Dynamic actions based on role + stage */}
      {!isClosed && (
        <div className="flex flex-wrap items-center gap-2">
          {isInProgress && simRole === "seo" && (
            <Button
              size="sm"
              disabled={disabled || busy}
              onClick={() => setSubmitOpen(true)}
              className="gap-1.5 bg-blue-600 hover:bg-blue-600/90 text-white"
            >
              <Send className="h-3.5 w-3.5" /> Отправить на проверку
            </Button>
          )}
          {isInProgress && simRole === "account" && (
            <div className="text-xs text-muted-foreground italic px-2">
              Ждём, пока SEO-специалист завершит работу и передаст на проверку.
            </div>
          )}
          {isOnReview && simRole === "account" && (
            <>
              <Button
                size="sm"
                disabled={disabled || busy}
                onClick={() => setRejectOpen(true)}
                variant="outline"
                className="gap-1.5 border-rose-500/40 text-rose-500 hover:bg-rose-500/10 hover:text-rose-400"
              >
                <ThumbsDown className="h-3.5 w-3.5" /> Вернуть на доработку
              </Button>
              <Button
                size="sm"
                disabled={disabled || busy}
                onClick={handleAccept}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-600/90 text-white"
              >
                <ThumbsUp className="h-3.5 w-3.5" /> Принять и закрыть
              </Button>
            </>
          )}
          {isOnReview && simRole === "seo" && (
            <div className="flex items-center gap-2 text-xs text-purple-400 italic px-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Задача у аккаунт-менеджера на проверке.
            </div>
          )}
        </div>
      )}

      {/* History log */}
      {reviewLog.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">История статусов</span>
          </div>
          <ul className="space-y-1.5">
            {reviewLog.map((h) => (
              <li key={h.id} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/60" />
                <span className="flex-1">{h.body}</span>
                <span className="tabular-nums shrink-0 text-muted-foreground/60">
                  {new Date(h.created_at).toLocaleString("ru-RU", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit for review modal */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" />
              Передать аккаунту на проверку
            </DialogTitle>
            <DialogDescription>
              Укажите ссылку на результат работы. Задача будет передана аккаунт-менеджеру.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="result-link" className="text-xs">
              Результат работы (ссылка) <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="result-link"
              autoFocus
              placeholder="https://..."
              value={resultLink}
              onChange={(e) => setResultLink(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubmitOpen(false)} disabled={busy}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!resultLink.trim() || busy}
              className="bg-blue-600 hover:bg-blue-600/90 text-white gap-1.5"
            >
              <Send className="h-4 w-4" /> Передать аккаунту
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-rose-500" />
              Вернуть задачу на доработку
            </DialogTitle>
            <DialogDescription>
              Опишите, что нужно исправить. Исполнитель получит уведомление.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason" className="text-xs">
              Что нужно исправить? <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="reject-reason"
              autoFocus
              rows={4}
              placeholder="Например: поправьте Title на главной — сейчас 75 символов, нужно сократить."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={busy}>
              Отмена
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectReason.trim() || busy}
              className="bg-rose-600 hover:bg-rose-600/90 text-white gap-1.5"
            >
              <ThumbsDown className="h-4 w-4" /> Вернуть на доработку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
