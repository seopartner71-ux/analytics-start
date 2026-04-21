import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, AlertCircle, Check, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useNotificationSound } from "@/hooks/useNotificationSound";

interface Notification {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  body: string;
  error_id: string | null;
  is_read: boolean;
  created_at: string;
  project?: { name: string } | null;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const sound = useNotificationSound();
  const seenNotifIds = useRef<Set<string>>(new Set());
  const initialNotifLoad = useRef(true);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*, project:projects(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  // Track seen notification IDs and beep on truly new ones
  useEffect(() => {
    if (!notifications.length) return;
    if (initialNotifLoad.current) {
      notifications.forEach((n) => seenNotifIds.current.add(n.id));
      initialNotifLoad.current = false;
      return;
    }
    let hasNew = false;
    notifications.forEach((n) => {
      if (!seenNotifIds.current.has(n.id)) {
        seenNotifIds.current.add(n.id);
        hasNew = true;
      }
    });
    if (hasNew) sound.play();
  }, [notifications, sound]);

  // Realtime subscription for notifications
  useEffect(() => {
    if (!user?.id) return;
    const channelName = `notifications-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  // Realtime: chat_messages — beep when not on /chat page and message is from another user
  useEffect(() => {
    if (!user?.id) return;
    const channelName = `chat-sound-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as { user_id?: string };
          if (!row || row.user_id === user.id) return;
          if (location.pathname.startsWith("/chat")) return;
          sound.play();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, location.pathname, sound]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markRead = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notifId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const handleClick = (notif: Notification) => {
    if (!notif.is_read) {
      markRead.mutate(notif.id);
    }
    setOpen(false);
    navigate(`/crm-projects/${notif.project_id}?tab=health`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(360px,calc(100vw-1rem))] p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border gap-2">
          <h4 className="text-sm font-semibold text-foreground">Уведомления</h4>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => {
                sound.toggle();
                if (!sound.enabled) {
                  // Will become enabled — play a sample beep so user hears it
                  setTimeout(() => sound.play(), 0);
                }
              }}
              title={sound.enabled ? "Выключить звук уведомлений" : "Включить звук уведомлений"}
            >
              {sound.enabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
                onClick={() => markAllRead.mutate()}
              >
                <Check className="h-3 w-3" /> Прочитать все
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
              <p className="text-[13px] text-muted-foreground">Нет уведомлений</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    "w-full text-left px-3 py-3 hover:bg-muted/40 transition-colors flex gap-2.5",
                    !notif.is_read && "bg-destructive/5"
                  )}
                >
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    !notif.is_read ? "bg-destructive/10" : "bg-muted"
                  )}>
                    <AlertCircle className={cn(
                      "h-3.5 w-3.5",
                      !notif.is_read ? "text-destructive" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={cn(
                        "text-[12px] truncate",
                        !notif.is_read ? "font-semibold text-foreground" : "text-foreground"
                      )}>
                        {notif.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {notif.project?.name || "Проект"} {notif.body ? `· ${notif.body}` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {format(parseISO(notif.created_at), "dd.MM.yy HH:mm")}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <div className="h-2 w-2 rounded-full bg-destructive shrink-0 mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
