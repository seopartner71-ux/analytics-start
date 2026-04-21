import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const IDLE_MS = 2 * 60 * 1000; // 2 минуты бездействия = пауза
const FLUSH_MS = 60 * 1000;    // раз в минуту шлём в БД
const TICK_MS = 1000;

/**
 * Тихий трекер активного времени. Считает секунды, пока:
 *  - вкладка видима (document.visibilityState === 'visible')
 *  - была активность (mouse/keyboard/scroll/touch) за последние 2 минуты
 * Раз в минуту вызывает RPC increment_time(p_seconds) и обнуляет буфер.
 * Не возвращает UI и ничего не показывает пользователю.
 */
export function useSilentTimeTracker() {
  const { user } = useAuth();
  const bufferRef = useRef(0);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!user) return;

    const bumpActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "wheel",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) => window.addEventListener(e, bumpActivity, { passive: true }));

    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivityRef.current > IDLE_MS) return;
      bufferRef.current += 1;
    }, TICK_MS);

    const flush = async () => {
      const seconds = bufferRef.current;
      if (seconds <= 0) return;
      bufferRef.current = 0;
      try {
        const { error } = await (supabase as any).rpc("increment_time", { p_seconds: seconds });
        if (error) {
          // вернём секунды в буфер, чтобы не потерять
          bufferRef.current += seconds;
          // eslint-disable-next-line no-console
          console.warn("[time-tracker] flush failed", error.message);
        }
      } catch (e) {
        bufferRef.current += seconds;
      }
    };

    const flushTimer = window.setInterval(flush, FLUSH_MS);

    const onHide = () => {
      if (document.visibilityState === "hidden") {
        void flush();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bumpActivity));
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onHide);
      window.clearInterval(tick);
      window.clearInterval(flushTimer);
      void flush();
    };
  }, [user]);
}
