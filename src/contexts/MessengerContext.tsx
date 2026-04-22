import { createContext, useCallback, useContext, useState, ReactNode } from "react";

interface MessengerState {
  isOpen: boolean;
  conversationId: string | null;
  open: (conversationId?: string | null) => void;
  close: () => void;
  toggle: () => void;
  setConversation: (id: string | null) => void;
}

const Ctx = createContext<MessengerState>({
  isOpen: false,
  conversationId: null,
  open: () => {},
  close: () => {},
  toggle: () => {},
  setConversation: () => {},
});

export const useMessenger = () => useContext(Ctx);

export function MessengerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const open = useCallback((id?: string | null) => {
    if (id !== undefined) setConversationId(id);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const setConversation = useCallback((id: string | null) => setConversationId(id), []);

  return (
    <Ctx.Provider value={{ isOpen, conversationId, open, close, toggle, setConversation }}>
      {children}
    </Ctx.Provider>
  );
}
