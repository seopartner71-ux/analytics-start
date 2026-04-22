import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PresenceMap {
  [userId: string]: { is_online: boolean; last_seen_at: string };
}

/**
 * Tracks online presence for the current user (heartbeat) and exposes a map of all users' presence.
 */
export function usePresence() {
  const { user } = useAuth();
  const [presence, setPresence] = useState<PresenceMap>({});

  // Heartbeat: mark current user online every 30s
  useEffect(() => {
    if (!user?.id) return;
    const beat = () => {
      supabase.rpc("touch_user_presence").then(() => {});
    };
    beat();
    const i = setInterval(beat, 30_000);

    // Mark offline on unload (best-effort)
    const handleUnload = () => {
      try {
        supabase.from("user_presence").update({ is_online: false }).eq("user_id", user.id);
      } catch {}
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearInterval(i);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [user?.id]);

  // Subscribe to all presence updates
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("user_presence")
      .select("user_id,is_online,last_seen_at")
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: PresenceMap = {};
        for (const row of data) {
          map[row.user_id] = { is_online: row.is_online, last_seen_at: row.last_seen_at };
        }
        setPresence(map);
      });

    const channel = supabase
      .channel(`presence-feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | { user_id: string; is_online: boolean; last_seen_at: string }
            | undefined;
          if (!row) return;
          setPresence((prev) => ({
            ...prev,
            [row.user_id]: { is_online: row.is_online, last_seen_at: row.last_seen_at },
          }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Treat as online if heartbeat within 90s
  const isOnline = (userId: string) => {
    const p = presence[userId];
    if (!p) return false;
    if (!p.is_online) return false;
    return Date.now() - new Date(p.last_seen_at).getTime() < 90_000;
  };

  return { presence, isOnline };
}
