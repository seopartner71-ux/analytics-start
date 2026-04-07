import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function hashColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h % 360);
  return `hsl(${hue}, 55%, 55%)`;
}

interface ChatMessage {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  body: string;
  created_at: string;
}

export default function ChatPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data as ChatMessage[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channelName = `chat-realtime-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("chat_messages").insert({
        user_id: user!.id,
        user_email: user!.email || "",
        user_name: profile?.full_name || user!.email || "",
        body,
      });
      if (error) throw error;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSend = () => {
    const text = message.trim();
    if (!text) return;
    setMessage("");
    sendMutation.mutate(text);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const d = new Date(msg.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    if (d !== currentDate) {
      currentDate = d;
      groupedMessages.push({ date: d, messages: [] });
    }
    groupedMessages[groupedMessages.length - 1].messages.push(msg);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Общий чат</h1>
          <p className="text-xs text-muted-foreground">Чат для всех сотрудников компании</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-16 w-16 mb-4 text-muted-foreground/20" />
            <p className="text-lg font-medium">Начните общение</p>
            <p className="text-sm">Напишите первое сообщение в общий чат</p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex items-center justify-center my-4">
                <span className="text-[11px] text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                  {group.date}
                </span>
              </div>
              <AnimatePresence>
                {group.messages.map((msg) => {
                  const isMine = msg.user_id === user?.id;
                  const displayName = msg.user_name || msg.user_email;
                  const color = hashColor(msg.user_id);

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className={cn("flex gap-2.5 mb-3", isMine && "flex-row-reverse")}
                    >
                      {!isMine && (
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-1"
                          style={{ backgroundColor: color }}
                        >
                          {getInitials(displayName)}
                        </div>
                      )}
                      <div className={cn("max-w-[65%]", isMine && "items-end")}>
                        {!isMine && (
                          <p className="text-[11px] font-medium mb-0.5 px-1" style={{ color }}>
                            {displayName}
                          </p>
                        )}
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                            isMine
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted/60 text-foreground rounded-bl-md"
                          )}
                        >
                          {msg.body}
                        </div>
                        <p className={cn(
                          "text-[10px] text-muted-foreground mt-0.5 px-1",
                          isMine && "text-right"
                        )}>
                          {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишите сообщение..."
            className="flex-1 h-10 bg-muted/30 border-border/60 focus:bg-card transition-colors"
            autoFocus
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            size="icon"
            className="h-10 w-10 shrink-0"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
