import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";

/**
 * Thin top progress bar that appears whenever React Query has any
 * in-flight fetches or mutations. Provides instant feedback during
 * background refreshes without blocking the UI.
 */
export function GlobalProgressBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const active = fetching + mutating > 0;

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf: number | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (active) {
      setVisible(true);
      setProgress(8);
      // Trickle progress while requests are inflight (never reaches 100 until done)
      const tick = () => {
        setProgress((p) => (p < 90 ? p + (90 - p) * 0.04 : p));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else if (visible) {
      setProgress(100);
      timeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 350);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (timeout) clearTimeout(timeout);
    };
  }, [active, visible]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 right-0 z-[100] h-0.5 bg-transparent"
      role="progressbar"
      aria-label="Загрузка"
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_hsl(var(--primary))] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
