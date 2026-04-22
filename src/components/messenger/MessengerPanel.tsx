import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMessenger } from "@/contexts/MessengerContext";
import { usePresence } from "@/hooks/usePresence";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MessageSquare, Search, Users, Hash, X, Volume2, VolumeX } from "lucide-react";

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  position: string | null;
}

interface ConversationRow {
  id: string;
  type: "direct" | "group" | "project" | "company";
  title: string | null;
  project_id: string | null;
  last_message_at: string;
}

type Tab = "people" | "chats";

export function MessengerPanel() {
  const { user } = useAuth();
  const { isOpen, conversationId, open, close, setConversation } = useMessenger();
  const { isOnline } = usePresence();
  const sound = useNotificationSound();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("people");
  const [search, setSearch] = useState("");
  const lastSeenIdsRef = useRef<Set<string>>(new Set());

  // Floating draggable window (desktop)
  const PANEL_W = 380;
  const PANEL_H = 600;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setAnimateIn(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (!pos) {
      const x = Math.max(16, window.innerWidth - PANEL_W - 72);
      const y = Math.max(16, Math.round((window.innerHeight - PANEL_H) / 2));
      setPos({ x: window.innerWidth, y });
      requestAnimationFrame(() => {
        setAnimateIn(true);
        setPos({ x, y });
      });
    } else {
      setAnimateIn(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const onDragStart = (e: React.PointerEvent) => {
    if (!pos) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    setAnimateIn(false);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const x = Math.min(Math.max(0, e.clientX - dragRef.current.dx), window.innerWidth - 200);
    const y = Math.min(Math.max(0, e.clientY - dragRef.current.dy), window.innerHeight - 60);
    setPos({ x, y });
  };
  const onDragEnd = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    dragRef.current = null;
  };

  // All employees (active profiles) — exclude self
  const { data: employees = [] } = useQuery({
    queryKey: ["messenger-employees"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url, position")
        .eq("status", "active")
        .order("full_name", { ascending: true });
      return (data ?? []).filter((p) => p.user_id !== user?.id) as Profile[];
    },
  });

  // Conversations user participates in (or company)
  const { data: conversations = [] } = useQuery({
    queryKey: ["messenger-conversations", user?.id],
    enabled: !!user,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, type, title, project_id, last_message_at")
        .order("last_message_at", { ascending: false });
      return (data ?? []) as ConversationRow[];
    },
  });

  // Last-read map and unread counters
  const { data: parts = [] } = useQuery({
    queryKey: ["messenger-participation", user?.id],
    enabled: !!user,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at, muted")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });
  const lastReadMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of parts) m[p.conversation_id] = p.last_read_at;
    return m;
  }, [parts]);

  // Direct-conversation other-user index
  const { data: directOther = {} } = useQuery({
    queryKey: ["messenger-direct-other", user?.id, conversations.length],
    enabled: !!user && conversations.some((c) => c.type === "direct"),
    queryFn: async () => {
      const ids = conversations.filter((c) => c.type === "direct").map((c) => c.id);
      if (!ids.length) return {} as Record<string, string>;
      const { data } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((row) => {
        if (row.user_id !== user!.id) map[row.conversation_id] = row.user_id;
      });
      return map;
    },
  });

  // Unread per conversation
  const { data: unreadMap = {} } = useQuery({
    queryKey: ["messenger-unread", parts.length, user?.id],
    enabled: !!user && parts.length > 0,
    refetchInterval: 15_000,
    queryFn: async () => {
      const map: Record<string, number> = {};
      await Promise.all(
        parts.map(async (p) => {
          const { count } = await supabase
            .from("dm_messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", p.conversation_id)
            .gt("created_at", p.last_read_at)
            .neq("user_id", user!.id);
          map[p.conversation_id] = count ?? 0;
        }),
      );
      return map;
    },
  });

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  // Realtime: refresh queries on new messages + sound
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("messenger-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages" },
        (payload) => {
          const msg = payload.new as { id: string; conversation_id: string; user_id: string };
          qc.invalidateQueries({ queryKey: ["messenger-conversations", user.id] });
          qc.invalidateQueries({ queryKey: ["messenger-unread"] });
          qc.invalidateQueries({ queryKey: ["dm-messages", msg.conversation_id] });
          // Sound only for foreign messages and when conversation isn't open
          if (msg.user_id !== user.id && msg.conversation_id !== conversationId) {
            if (!lastSeenIdsRef.current.has(msg.id)) {
              lastSeenIdsRef.current.add(msg.id);
              sound.play();
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, conversationId, qc, sound]);

  const openDirect = async (otherUserId: string) => {
    const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
      _other_user: otherUserId,
    });
    if (error) return;
    qc.invalidateQueries({ queryKey: ["messenger-conversations"] });
    open(data as string);
  };

  const openCompany = async () => {
    const { data, error } = await supabase.rpc("get_or_create_company_conversation");
    if (error) return;
    qc.invalidateQueries({ queryKey: ["messenger-conversations"] });
    open(data as string);
  };

  // Project conversations list
  const projectConvs = conversations.filter((c) => c.type === "project");
  const directConvs = conversations.filter((c) => c.type === "direct");
  const companyConv = conversations.find((c) => c.type === "company");

  const filteredEmployees = employees.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (e.full_name || "").toLowerCase().includes(s) || e.email.toLowerCase().includes(s);
  });

  const employeeById = useMemo(() => {
    const m: Record<string, Profile> = {};
    for (const e of employees) m[e.user_id] = e;
    return m;
  }, [employees]);

  if (!user) return null;

  return (
    <>
      {/* Compact rail (always visible on md+) */}
      <aside className="hidden md:flex fixed right-0 top-0 bottom-0 z-30 w-14 flex-col items-center gap-2 border-l border-border/60 bg-card/80 backdrop-blur py-3">
        <button
          onClick={() => {
            if (isOpen) close();
            else open();
          }}
          className={cn(
            "relative h-10 w-10 rounded-full flex items-center justify-center transition-colors",
            isOpen ? "bg-primary/15 text-primary" : "hover:bg-accent text-foreground",
          )}
          title="Сообщения"
        >
          <MessageSquare className="h-5 w-5" />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
        <button
          onClick={openCompany}
          className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-accent text-foreground"
          title="Общий чат"
        >
          <Hash className="h-5 w-5" />
        </button>
        <div className="my-1 h-px w-8 bg-border" />
        <ScrollArea className="flex-1 w-full">
          <div className="flex flex-col items-center gap-2 px-1 pb-3">
            {employees.slice(0, 30).map((e) => {
              const online = isOnline(e.user_id);
              return (
                <button
                  key={e.user_id}
                  onClick={() => openDirect(e.user_id)}
                  className="relative group"
                  title={e.full_name || e.email}
                >
                  <Avatar className="h-9 w-9 ring-1 ring-border group-hover:ring-primary/40 transition">
                    <AvatarImage src={e.avatar_url || undefined} />
                    <AvatarFallback className="text-[11px]">
                      {(e.full_name || e.email).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card",
                      online ? "bg-emerald-500" : "bg-muted-foreground/40",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* Mobile floating button */}
      <button
        onClick={() => (isOpen ? close() : open())}
        className="md:hidden fixed bottom-20 right-3 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        title="Сообщения"
      >
        <MessageSquare className="h-5 w-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-background">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Slide-out panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-30 bg-card border-border/60 shadow-2xl flex flex-col",
            // Desktop
            "md:right-14 md:top-0 md:bottom-0 md:w-[380px] md:border-l",
            // Mobile (full screen)
            "inset-0 md:inset-auto",
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Мессенджер</h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={sound.toggle}
                title={sound.enabled ? "Отключить звук" : "Включить звук"}
              >
                {sound.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border/60">
            <button
              onClick={() => {
                setTab("chats");
                setConversation(null);
              }}
              className={cn(
                "flex-1 py-2 text-xs font-medium border-b-2 transition-colors",
                tab === "chats" && !conversationId
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Чаты
            </button>
            <button
              onClick={() => {
                setTab("people");
                setConversation(null);
              }}
              className={cn(
                "flex-1 py-2 text-xs font-medium border-b-2 transition-colors",
                tab === "people" && !conversationId
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Сотрудники
            </button>
          </div>

          {/* Conversation view */}
          {conversationId ? (
            <ConversationView conversationId={conversationId} onBack={() => setConversation(null)} employeeById={employeeById} directOther={directOther} />
          ) : (
            <>
              <div className="px-3 py-2 border-b border-border/60">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Поиск..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                {tab === "chats" ? (
                  <div className="py-2">
                    {/* Company chat */}
                    <button
                      onClick={openCompany}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent text-left"
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                        <Hash className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">Общий чат</p>
                        <p className="text-[11px] text-muted-foreground">Все сотрудники компании</p>
                      </div>
                      {companyConv && unreadMap[companyConv.id] > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                          {unreadMap[companyConv.id]}
                        </span>
                      )}
                    </button>

                    {projectConvs.length > 0 && (
                      <>
                        <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Проекты</p>
                        {projectConvs.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => open(c.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent text-left"
                          >
                            <div className="h-9 w-9 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center">
                              <Hash className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium truncate">{c.title || "Проект"}</p>
                            </div>
                            {unreadMap[c.id] > 0 && (
                              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                                {unreadMap[c.id]}
                              </span>
                            )}
                          </button>
                        ))}
                      </>
                    )}

                    {directConvs.length > 0 && (
                      <>
                        <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Личные</p>
                        {directConvs.map((c) => {
                          const otherId = directOther[c.id];
                          const other = otherId ? employeeById[otherId] : undefined;
                          const online = otherId ? isOnline(otherId) : false;
                          return (
                            <button
                              key={c.id}
                              onClick={() => open(c.id)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent text-left"
                            >
                              <div className="relative">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={other?.avatar_url || undefined} />
                                  <AvatarFallback className="text-[11px]">
                                    {(other?.full_name || other?.email || "?").slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span
                                  className={cn(
                                    "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card",
                                    online ? "bg-emerald-500" : "bg-muted-foreground/40",
                                  )}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium truncate">
                                  {other?.full_name || other?.email || "Пользователь"}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">{other?.position || ""}</p>
                              </div>
                              {unreadMap[c.id] > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                                  {unreadMap[c.id]}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </>
                    )}

                    {conversations.length === 0 && (
                      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        Нет активных чатов. Откройте сотрудника, чтобы начать переписку.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-2">
                    {filteredEmployees.map((e) => {
                      const online = isOnline(e.user_id);
                      return (
                        <button
                          key={e.user_id}
                          onClick={() => openDirect(e.user_id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent text-left"
                        >
                          <div className="relative">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={e.avatar_url || undefined} />
                              <AvatarFallback className="text-[11px]">
                                {(e.full_name || e.email).slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span
                              className={cn(
                                "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card",
                                online ? "bg-emerald-500" : "bg-muted-foreground/40",
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate">{e.full_name || e.email}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {e.position || (online ? "В сети" : "Не в сети")}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {filteredEmployees.length === 0 && (
                      <div className="px-4 py-8 text-center text-xs text-muted-foreground">Никого не найдено</div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      )}
    </>
  );
}

// =============== Conversation view (inline component) ===============
import { ConversationView } from "./ConversationView";
