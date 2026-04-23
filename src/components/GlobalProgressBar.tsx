import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

/**
 * Top progress bar that reflects React Query activity in real time.
 *
 * Behavior:
 * - When new requests start, the bar appears and trickles forward.
 * - When individual requests finish, progress jumps proportionally
 *   (so the user sees concrete completions, not just a vague trickle).
 * - When everything is done, the bar smoothly fills to 100% and fades out.
 */
export function GlobalProgressBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const active = fetching + mutating;

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  // Track total requests seen during this "session" so we can compute
  // a real completion ratio: completed / peak.
  const peakRef = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();
  const trickleRaf = useRef<number>();

  useEffect(() => {
    // Update peak whenever the in-flight count rises
    if (active > peakRef.current) {
      peakRef.current = active;
    }

    if (active > 0) {
      // Cancel any pending fade-out
      if (fadeTimer.current) {
        clearTimeout(fadeTimer.current);
        fadeTimer.current = undefined;
      }
      setVisible(true);

      const peak = peakRef.current;
      const completed = peak - active;
      // Real completion ratio mapped to 10..85% range, leaving headroom
      // for the trickle and the final 100% snap.
      const ratioTarget = peak > 0 ? 10 + (completed / peak) * 75 : 10;

      setProgress((p) => Math.max(p, ratioTarget));

      // Start a slow trickle toward 90 to convey "still working"
      const tick = () => {
        setProgress((p) => (p < 90 ? p + (90 - p) * 0.03 : p));
        trickleRaf.current = requestAnimationFrame(tick);
      };
      if (!trickleRaf.current) {
        trickleRaf.current = requestAnimationFrame(tick);
      }
    } else if (visible) {
      // Stop trickling
      if (trickleRaf.current) {
        cancelAnimationFrame(trickleRaf.current);
        trickleRaf.current = undefined;
      }
      // Snap to 100, then fade out and reset peak
      setProgress(100);
      fadeTimer.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
        peakRef.current = 0;
      }, 350);
    }

    return () => {
      if (trickleRaf.current) {
        cancelAnimationFrame(trickleRaf.current);
        trickleRaf.current = undefined;
      }
    };
  }, [active, visible]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 right-0 z-[100] h-0.5 bg-transparent"
      role="progressbar"
      aria-label="Загрузка"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_hsl(var(--primary))] transition-[width,opacity] duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
