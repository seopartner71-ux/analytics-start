import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "statpulse_notif_sound";

/**
 * Lightweight notification sound generated via WebAudio (no asset needed).
 * Persists user preference (on/off) in localStorage.
 */
export function useNotificationSound() {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  });
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  }, [enabled]);

  const setEnabled = useCallback((v: boolean) => setEnabledState(v), []);
  const toggle = useCallback(() => setEnabledState((v) => !v), []);

  const play = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      if (!ctxRef.current) ctxRef.current = new AudioCtx();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const now = ctx.currentTime;
      // Two short pleasant beeps
      const tones = [
        { freq: 880, start: 0, dur: 0.12 },
        { freq: 1320, start: 0.12, dur: 0.18 },
      ];
      tones.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      });
    } catch {
      // ignore — audio not allowed yet
    }
  }, [enabled]);

  return { enabled, setEnabled, toggle, play };
}
