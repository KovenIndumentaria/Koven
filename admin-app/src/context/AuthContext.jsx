import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../services/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;

    async function applySession(nextSession) {
      setSession(nextSession);
      if (!nextSession) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", nextSession.user.id)
        .maybeSingle();

      setIsAdmin(Boolean(data));
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true);
      applySession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    session,
    isAdmin,
    loading,
    configured: isSupabaseConfigured,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }), [session, isAdmin, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
