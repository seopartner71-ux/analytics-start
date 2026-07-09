import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Send, Search, X, FileIcon, Trash2, SmilePlus, Pencil, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";

interface ProjectChatTabProps {
  projectId: string;
  projectName: string;
}

interface ChatMessage {
  id: string;
  project_id: string;
  user_id: string | null;
  user_name: string;
  body: string;
  is_system: boolean;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  mentions: string[];
  created_at: string;
  edited_at?: string | null;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  user_name: string;
  emoji: string;
}

const REACTION_EMOJIS = ["👍", "❤️", "🎉"];

interface Participant {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Вчера, ${format(d, "HH:mm")}`;
  return format(d, "d MMM, HH:mm", { locale: ru });
};

const initialsOf = (name: string) =>
  name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase() || "??";

const renderBodyWithMentions = (body: string, isMine: boolean) => {
  const parts = body.split(/(@[\p{L}0-9_]+)/gu);
  return parts.map((part, i) => {
    if (/^@[\p{L}0-9_]+$/u.test(part)) {
      return (
        <span
          key={i}
          className={`font-medium rounded px-1 ${
            isMine ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
          }`}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

export function ProjectChatTab({ projectId, projectName }: ProjectChatTabProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // --- Participants (project owner + assigned team_members) ---
  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ["project-chat-participants", projectId],
    queryFn: async () => {
      const { data: project } = await supabase
        .from("projects")
        .select("owner_id, seo_specialist_id, account_manager_id")
        .eq("id", projectId)
        .single();
      if (!project) return [];

      const tmIds = [project.seo_specialist_id, project.account_manager_id].filter(Boolean) as string[];
      const list: Participant[] = [];
      const seenUserIds = new Set<string>();
      const seenNames = new Set<string>();
      const push = (p: Participant) => {
        const key = (p.full_name || "").trim().toLowerCase();
        if (p.user_id && seenUserIds.has(p.user_id)) return;
        if (key && seenNames.has(key)) return;
        if (p.user_id) seenUserIds.add(p.user_id);
        if (key) seenNames.add(key);
        list.push(p);
      };

      // Owner profile
      const { data: ownerProf } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("user_id", project.owner_id)
        .maybeSingle();
      if (ownerProf) {
        push({
          id: project.owner_id,
          user_id: project.owner_id,
          full_name: ownerProf.full_name || ownerProf.email || "Владелец",
          role: "owner",
        });
      }

      if (tmIds.length) {
        const { data: tms } = await supabase
          .from("team_members")
          .select("id, owner_id, full_name, role")
          .in("id", tmIds);
        for (const tm of tms || []) {
          push({
            id: tm.id,
            user_id: tm.owner_id,
            full_name: tm.full_name,
            role: tm.role,
          });
        }
      }

      // Members from project_members table
      const { data: pmRows } = await supabase
        .from("project_members")
        .select("role, team_member:team_members(id, owner_id, full_name)")
        .eq("project_id", projectId);
      for (const row of (pmRows || []) as any[]) {
        const tm = row.team_member;
        if (!tm) continue;
        push({
          id: tm.id,
          user_id: tm.owner_id,
          full_name: tm.full_name,
          role: row.role,
        });
      }
      return list;
    },
  });

  // --- Messages ---
  const [messageLimit, setMessageLimit] = useState(500);
  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["project-messages", projectId, messageLimit],
    queryFn: async () => {
      // Берём последние N сообщений (по убыванию), затем разворачиваем для отображения
      const { data, error } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(messageLimit);
      if (error) throw error;
      return ((data ?? []) as ChatMessage[]).reverse();
    },
  });
  const canLoadMore = messages.length === messageLimit;

  // --- Avatars for message authors ---
  const authorIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of messages) if (m.user_id) s.add(m.user_id);
    return Array.from(s);
  }, [messages]);
  const { data: authorAvatars = {} } = useQuery<Record<string, string | null>>({
    queryKey: ["chat-author-avatars", authorIds],
    queryFn: async () => {
      if (!authorIds.length) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, avatar_url")
        .in("user_id", authorIds);
      const map: Record<string, string | null> = {};
      for (const p of data || []) map[p.user_id] = p.avatar_url;
      return map;
    },
    enabled: authorIds.length > 0,
  });

  // --- Reactions ---
  const messageIds = useMemo(() => messages.map(m => m.id), [messages]);
  const { data: reactions = [] } = useQuery<Reaction[]>({
    queryKey: ["project-message-reactions", projectId, messageIds.length],
    queryFn: async () => {
      if (!messageIds.length) return [];
      const { data, error } = await supabase
        .from("project_message_reactions")
        .select("*")
        .in("message_id", messageIds);
      if (error) throw error;
      return data as Reaction[];
    },
    enabled: messageIds.length > 0,
  });

  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const r of reactions) {
      const arr = map.get(r.message_id) || [];
      arr.push(r);
      map.set(r.message_id, arr);
    }
    return map;
  }, [reactions]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find(r => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      const { error } = await supabase.from("project_message_reactions").delete().eq("id", existing.id);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.from("project_message_reactions").insert({
        message_id: messageId,
        user_id: user.id,
        user_name: profile?.full_name || profile?.email || "Пользователь",
        emoji,
      });
      if (error) toast.error(error.message);
    }
  }, [user, profile, reactions]);

  // --- Realtime subscription ---
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`project-chat-${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_messages", filter: `project_id=eq.${projectId}` },
        (payload) => {
          queryClient.setQueryData<ChatMessage[]>(["project-messages", projectId, messageLimit], (old = []) => {
            if (old.find(m => m.id === (payload.new as any).id)) return old;
            return [...old, payload.new as ChatMessage];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "project_messages", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const updated = payload.new as ChatMessage;
          queryClient.setQueryData<ChatMessage[]>(["project-messages", projectId, messageLimit], (old = []) =>
            old.map(m => (m.id === updated.id ? { ...m, ...updated } : m))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "project_messages", filter: `project_id=eq.${projectId}` },
        (payload) => {
          queryClient.setQueryData<ChatMessage[]>(["project-messages", projectId, messageLimit], (old = []) =>
            old.filter(m => m.id !== (payload.old as any).id)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_message_reactions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-message-reactions", projectId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  // --- Mark as read ---
  useEffect(() => {
    if (!user || !messages.length) return;
    supabase
      .from("project_message_reads")
      .upsert({ project_id: projectId, user_id: user.id, last_read_at: new Date().toISOString() })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["unread-chat-counts"] });
      });
  }, [user, messages.length, projectId, queryClient]);

  // --- Auto-scroll to bottom ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // --- Filtered messages (search) ---
  const filtered = useMemo(() => {
    if (!search.trim()) return messages;
    const q = search.toLowerCase();
    return messages.filter(m => m.body.toLowerCase().includes(q));
  }, [messages, search]);

  // --- @mention autocomplete ---
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const onTextChange = (val: string) => {
    setText(val);
    const m = val.match(/@(\S*)$/);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  };
  const mentionMatches = mentionQuery !== null
    ? participants.filter(p => p.full_name.toLowerCase().includes(mentionQuery))
    : [];

  const insertMention = (p: Participant) => {
    const newText = text.replace(/@\S*$/, `@${p.full_name.replace(/\s+/g, "_")} `);
    setText(newText);
    setMentionQuery(null);
    textRef.current?.focus();
  };

  // --- Send message ---
  const send = async () => {
    if (!user) return;
    const body = text.trim();
    if (!body && !file) return;
    setSending(true);

    try {
      let attachment_url: string | null = null;
      let attachment_name: string | null = null;
      let attachment_mime: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${projectId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);
        attachment_url = pub.publicUrl;
        attachment_name = file.name;
        attachment_mime = file.type;
      }

      // Detect mentions
      const mentions: string[] = [];
      for (const p of participants) {
        const tag = `@${p.full_name.replace(/\s+/g, "_")}`;
        if (body.includes(tag)) mentions.push(p.user_id);
      }

      const { error } = await supabase.from("project_messages").insert({
        project_id: projectId,
        user_id: user.id,
        user_name: profile?.full_name || profile?.email || "Пользователь",
        body,
        attachment_url,
        attachment_name,
        attachment_mime,
        mentions,
      });
      if (error) throw error;
      // Уведомления упомянутым пользователям создаются триггером notify_chat_mentions

      setText("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message || "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const deleteMessage = useCallback(async (id: string) => {
    const { error } = await supabase.from("project_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  }, []);

  // --- Edit message ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setEditText(m.body);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };
  const saveEdit = async (id: string) => {
    const body = editText.trim();
    if (!body) {
      toast.error("Сообщение не может быть пустым");
      return;
    }
    const { error } = await supabase
      .from("project_messages")
      .update({ body, edited_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Оптимистичное обновление на случай, если realtime UPDATE не долетит
    queryClient.setQueryData<ChatMessage[]>(["project-messages", projectId, messageLimit], (old = []) =>
      old.map(m => (m.id === id ? { ...m, body, edited_at: new Date().toISOString() } : m))
    );
    cancelEdit();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[500px] bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">💬 Чат проекта — {projectName}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {participants.length} {participants.length === 1 ? "участник" : "участников"}:{" "}
            {participants.map(p => p.full_name).join(", ") || "—"}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Поиск по сообщениям..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-4 space-y-3 overflow-y-auto h-full">
          {canLoadMore && (
            <div className="flex justify-center pb-2">
              <Button size="sm" variant="outline" onClick={() => setMessageLimit(l => l + 500)}>
                Загрузить ещё
              </Button>
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              {search ? "Ничего не найдено" : "Пока нет сообщений. Начните диалог."}
            </div>
          ) : (
            filtered.map((m) => {
              if (m.is_system) {
                return (
                  <div key={m.id} className="flex justify-center">
                    <Badge variant="secondary" className="text-xs font-normal">
                      {m.body} · {formatTime(m.created_at)}
                    </Badge>
                  </div>
                );
              }
              const isMine = m.user_id === user?.id;
              return (
                <div key={m.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                  <UserAvatar
                    avatarUrl={m.user_id ? authorAvatars[m.user_id] : null}
                    name={m.user_name}
                    seed={m.user_id || m.user_name}
                    size="sm"
                    className="shrink-0"
                    fallbackClassName="bg-muted"
                  />
                  <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{m.user_name}</span>
                      <span>{formatTime(m.created_at)}</span>
                      {m.edited_at && <span className="italic">(изменено)</span>}
                    </div>
                    {editingId === m.id ? (
                      <div className={`w-full flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveEdit(m.id);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }}
                          rows={2}
                          autoFocus
                          className="resize-none min-w-[240px] text-sm"
                        />
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancelEdit}>
                            Отмена
                          </Button>
                          <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => saveEdit(m.id)}>
                            <Check className="h-3 w-3" /> Сохранить
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                          isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        }`}
                      >
                        {renderBodyWithMentions(m.body, isMine)}
                        {m.attachment_url && (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`mt-2 flex items-center gap-2 text-xs underline ${
                              isMine ? "text-primary-foreground/90" : "text-primary"
                            }`}
                          >
                            {m.attachment_mime?.startsWith("image/") ? (
                              <img src={m.attachment_url} alt={m.attachment_name || ""} className="max-h-40 rounded" />
                            ) : (
                              <>
                                <FileIcon className="h-3.5 w-3.5" />
                                {m.attachment_name}
                              </>
                            )}
                          </a>
                        )}
                      </div>
                    )}
                    {(() => {
                      const msgReactions = reactionsByMessage.get(m.id) || [];
                      const grouped = new Map<string, Reaction[]>();
                      for (const r of msgReactions) {
                        const arr = grouped.get(r.emoji) || [];
                        arr.push(r);
                        grouped.set(r.emoji, arr);
                      }
                      return (
                        <div className={`flex items-center gap-1 flex-wrap ${isMine ? "justify-end" : ""}`}>
                          {Array.from(grouped.entries()).map(([emoji, list]) => {
                            const mine = list.some(r => r.user_id === user?.id);
                            return (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(m.id, emoji)}
                                title={list.map(r => r.user_name).join(", ")}
                                className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                  mine
                                    ? "bg-primary/15 border-primary/40 text-foreground"
                                    : "bg-muted border-border text-muted-foreground hover:bg-muted/70"
                                }`}
                              >
                                <span className="mr-0.5">{emoji}</span>
                                <span className="text-2xs">{list.length}</span>
                              </button>
                            );
                          })}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                                title="Добавить реакцию"
                              >
                                <SmilePlus className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1 flex gap-1" side="top" align={isMine ? "end" : "start"}>
                              {REACTION_EMOJIS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => toggleReaction(m.id, emoji)}
                                  className="text-lg hover:bg-accent rounded px-1.5 py-0.5 transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </PopoverContent>
                          </Popover>
                          {isMine && editingId !== m.id && (
                            <>
                              <button
                                onClick={() => startEdit(m)}
                                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                                title="Редактировать"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => deleteMessage(m.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                                title="Удалить"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3 relative">
        {mentionMatches.length > 0 && (
          <div className="absolute bottom-full left-3 mb-1 bg-popover border border-border rounded-md shadow-lg z-20 max-h-48 overflow-y-auto min-w-[220px]">
            {mentionMatches.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(p); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2"
              >
                <UserAvatar name={p.full_name} seed={p.id} size="xs" />
                {p.full_name}
              </button>
            ))}
          </div>
        )}
        {file && (
          <div className="mb-2 flex items-center gap-2 text-xs bg-muted rounded px-2 py-1 w-fit">
            <FileIcon className="h-3.5 w-3.5" />
            <span>{file.name}</span>
            <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            ref={textRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Напишите сообщение... (@ — упомянуть)"
            rows={2}
            className="resize-y min-h-[40px] max-h-[400px] text-sm"
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || (!text.trim() && !file)} size="icon" className="h-9 w-9 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
