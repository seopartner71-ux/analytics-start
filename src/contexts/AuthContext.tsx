import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: Database["public"]["Tables"]["profiles"]["Row"] | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isViewer: boolean;
  canEdit: boolean;
  hasFinanceAccess: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isManager: false,
  isViewer: false,
  canEdit: false,
  hasFinanceAccess: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Database["public"]["Tables"]["profiles"]["Row"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const [{ data: roles }, { data: prof }] = await Promise.all([
              supabase.from("user_roles").select("role").eq("user_id", session.user.id).limit(1),
              supabase.from("profiles").select("*").eq("user_id", session.user.id).single(),
            ]);
            setRole(roles?.[0]?.role ?? null);
            setProfile(prof);
            setLoading(false);
          }, 0);
        } else {
          setRole(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (prof) setProfile(prof);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isViewer = role === "viewer";
  const canEdit = isAdmin || isManager;
  const hasFinanceAccess = isAdmin || (profile as any)?.finance_access === true;

  return (
    <AuthContext.Provider value={{ session, user, role, profile, loading, isAdmin, isManager, isViewer, canEdit, hasFinanceAccess, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
