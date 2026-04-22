import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence } from "@/hooks/usePresence";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ArrowLeft, Paperclip, Send, Check, CheckCheck, Loader2, X, FileText } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  position: string | null;
}

interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface DmMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  user_name: string;
  body: string;
  attachments: Attachment[];
  is_system: boolean;
  created_at: string;
}

interface Props {
  conversationId: string;
  onBack: () => void;
  employeeById: Record<string, Profile>;
  directOther: Record<string, string>;
}

export function ConversationView({ conversationId, onBack, employeeById, directOther }: Props) {
  const { user, profile } = useAuth();
  const { isOnline } = usePresence();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conversation meta + participants
  const { data: conv } = useQuery({
    queryKey: ["dm-conv", conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, type, title, project_id, created_by")
        .eq("id", conversationId)
        .maybeSingle();
      return data;
    },
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["dm-participants", conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_participants")
        .select("user_id, last_read_at")
        .eq("conversation_id", conversationId);
      return data ?? [];
    },
  });

  // Messages
  const { data: messages = [] } = useQuery({
    queryKey: ["dm-messages", conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data ?? []) as DmMessage[];
    },
  });

  // Mark as read on open / new msg arrival
  useEffect(() => {
    if (!user) return;
    supabase.rpc("mark_conversation_read", { _conv_id: conversationId }).then(() => {
      qc.invalidateQueries({ queryKey: ["messenger-unread"] });
      qc.invalidateQueries({ queryKey: ["messenger-participation"] });
    });
  }, [conversationId, messages.length, user, qc]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`dm-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["dm-messages", conversationId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["dm-participants", conversationId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, qc]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // Header info
  const otherUserId = conv?.type === "direct" ? directOther[conversationId] : null;
  const otherUser = otherUserId ? employeeById[otherUserId] : null;
  const headerTitle =
    conv?.type === "direct"
      ? otherUser?.full_name || otherUser?.email || "Диалог"
      : conv?.type === "company"
        ? "Общий чат"
        : conv?.title || "Чат";
  const headerSubtitle =
    conv?.type === "direct"
      ? otherUserId && isOnline(otherUserId)
        ? "В сети"
        : "Не в сети"
      : conv?.type === "company"
        ? `${participants.length} участников`
        : `${participants.length} участников`;

  // Latest peer last_read_at — for "read" indicator on direct chats
  const peerLastRead = (() => {
    if (conv?.type !== "direct" || !otherUserId) return null;
    const p = participants.find((x) => x.user_id === otherUserId);
    return p?.last_read_at || null;
  })();

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.size <= 20 * 1024 * 1024);
    setPendingFiles((prev) => [...prev, ...arr].slice(0, 5));
  };

  const uploadFiles = async (): Promise<Attachment[]> => {
    if (pendingFiles.length === 0) return [];
    setUploading(true);
    try {
      const out: Attachment[] = [];
      for (const file of pendingFiles) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user!.id}/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("messenger").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) {
          toast.error(`Не удалось загрузить ${file.name}`);
          continue;
        }
        const { data: pub } = supabase.storage.from("messenger").getPublicUrl(path);
        out.push({ url: pub.publicUrl, name: file.name, type: file.type, size: file.size });
      }
      return out;
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    if (!user || (!text.trim() && pendingFiles.length === 0)) return;
    setSending(true);
    try {
      const attachments = await uploadFiles();
      const { error } = await supabase.from("dm_messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        user_name: profile?.full_name || profile?.email || user.email || "Пользователь",
        body: text.trim(),
        attachments: attachments as unknown as never,
      });
      if (error) {
        toast.error("Не удалось отправить");
        return;
      }
      setText("");
      setPendingFiles([]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {conv?.type === "direct" && otherUser ? (
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={otherUser.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">
                {(otherUser.full_name || otherUser.email).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {otherUserId && (
              <span
                className={cn(
                  "absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-card",
                  isOnline(otherUserId) ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
            )}
          </div>
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
            {headerTitle.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold truncate">{headerTitle}</p>
          <p className="text-[11px] text-muted-foreground truncate">{headerSubtitle}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">Нет сообщений. Напишите первым!</p>
          )}
          {messages.map((m) => {
            const isMine = m.user_id === user?.id;
            const isRead = isMine && peerLastRead && new Date(m.created_at) <= new Date(peerLastRead);
            if (m.is_system) {
              return (
                <div key={m.id} className="text-center">
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{m.body}</span>
                </div>
              );
            }
            return (
              <div key={m.id} className={cn("flex gap-2", isMine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 text-[13px] break-words",
                    isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm",
                  )}
                >
                  {!isMine && conv?.type !== "direct" && (
                    <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.user_name}</p>
                  )}
                  {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                  {m.attachments?.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {m.attachments.map((a, i) => {
                        const isImage = a.type?.startsWith("image/");
                        return isImage ? (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block">
                            <img src={a.url} alt={a.name} className="max-w-full max-h-60 rounded" />
                          </a>
                        ) : (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "flex items-center gap-1.5 rounded px-2 py-1 text-[11px]",
                              isMine ? "bg-primary-foreground/15 hover:bg-primary-foreground/25" : "bg-background/80 hover:bg-background",
                            )}
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{a.name}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className={cn("text-[9px]", isMine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isMine && (
                      isRead ? (
                        <CheckCheck className="h-3 w-3 text-primary-foreground/80" />
                      ) : (
                        <Check className="h-3 w-3 text-primary-foreground/60" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Pending file chips */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-2 border-t border-border/60 bg-muted/30">
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-background border border-border rounded px-2 py-0.5 text-[11px]">
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border/60 p-2 flex items-end gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || uploading}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Написать сообщение..."
          rows={1}
          className="min-h-[36px] max-h-32 resize-none text-[13px] py-2"
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={send}
          disabled={sending || uploading || (!text.trim() && pendingFiles.length === 0)}
        >
          {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
