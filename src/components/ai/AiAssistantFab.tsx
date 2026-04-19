import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bot, Send, Loader2, X, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-junior-assistant`;

export function AiAssistantFab() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect current project id from URL
  const projectId = (() => {
    const m = location.pathname.match(/\/(?:project|crm-projects)\/([0-9a-f-]{36})/i);
    return m?.[1] || null;
  })();

  // Load history when opening
  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("ai_assistant_messages")
      .select("role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(80)
      .then(({ data }) => {
        setMessages(((data || []) as any[]).filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })));
        setLoading(false);
        setTimeout(() => scrollToEnd(), 50);
      });
  }, [open, user]);

  const scrollToEnd = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => { scrollToEnd(); }, [messages, streaming]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming || !user) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setStreaming(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: next, projectId }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Слишком много запросов. Попробуйте через минуту.");
        else if (resp.status === 402) toast.error("Закончились кредиты AI. Пополните в настройках workspace.");
        else toast.error("Ошибка ассистента");
        setStreaming(false);
        return;
      }

      let acc = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || !line.trim()) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) {
              acc += c;
              setMessages((prev) => {
                const copy = prev.slice();
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const clearHistory = async () => {
    if (!user || !confirm("Очистить историю диалога?")) return;
    await supabase.from("ai_assistant_messages").delete().eq("user_id", user.id);
    setMessages([]);
    toast.success("История очищена");
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg z-40 bg-primary hover:bg-primary/90"
          aria-label="AI-ассистент"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 md:inset-auto md:bottom-6 md:right-6 z-50 md:w-[400px] md:h-[600px] h-[80vh] flex flex-col bg-card border border-border md:rounded-2xl rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-200">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold">AI-ассистент SEO</h3>
              <p className="text-[11px] text-muted-foreground">Помощник для джунов</p>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={clearHistory} title="Очистить">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="px-4 py-3 space-y-3 overflow-y-auto h-full">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  <Sparkles className="h-10 w-10 mx-auto mb-2 text-primary/40" />
                  <p className="font-medium text-foreground mb-1">Привет! Я твой AI-ассистент.</p>
                  <p className="text-xs">Спроси меня про задачи, стандарты или статьи базы знаний.</p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2",
                      m.role === "user" ? "flex-row-reverse" : ""
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      )}
                    >
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2 prose-pre:bg-background/50">
                          <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">{m.content}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
              {streaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1].content && (
                <div className="flex gap-1 px-3">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:120ms]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:240ms]" />
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border p-3 flex items-center gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Спросите что-нибудь…"
              disabled={streaming}
              className="flex-1 h-10"
              autoFocus
            />
            <Button onClick={send} disabled={!input.trim() || streaming} size="icon" className="h-10 w-10 shrink-0">
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
