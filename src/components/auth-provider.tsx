import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Buscar a sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Escutar por mudanças (login, logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let interval: number;

    const checkSession = async (currentUser: User) => {
      const localToken = localStorage.getItem('zapflow.session');
      if (!localToken) return;
      
      const { data } = await supabase.from('user_sessions').select('session_token').eq('user_id', currentUser.id).single();
      if (data && data.session_token !== localToken) {
        toast.error("Sua conta foi acessada em outro dispositivo. Você foi desconectado.");
        await supabase.auth.signOut();
        localStorage.removeItem('zapflow.session');
        window.location.href = '/login';
      }
    };

    if (user) {
      checkSession(user);
      interval = window.setInterval(() => checkSession(user), 30000);
    }

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('zapflow.session');
  };

  const value = {
    session,
    user,
    signOut,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
