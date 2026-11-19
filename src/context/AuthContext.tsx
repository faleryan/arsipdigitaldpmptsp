import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import * as api from "../lib/api";

interface AuthState {
  session: Session | null;
  profile: api.Profile | null;
  loading: boolean;
  canWrite: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}
const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<api.Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (s: Session | null) => {
    if (!s) { setProfile(null); return; }
    try { setProfile(await api.getProfile(s.user.id)); } catch { setProfile(null); }
  };

  useEffect(() => {
    let alive = true;
    api.getSession().then(async (s) => {
      if (!alive) return;
      setSession(s);
      await loadProfile(s);
      setLoading(false);
    });
    const off = api.onAuthChange((s) => {
      setSession((prev) => {
        if (prev?.user.id !== s?.user.id) loadProfile(s);
        return s;
      });
    });
    return () => { alive = false; off(); };
  }, []);

  const role = profile?.role;
  return (
    <Ctx.Provider value={{
      session, profile, loading,
      canWrite: role === "admin" || role === "operator",
      isAdmin: role === "admin",
      refreshProfile: () => loadProfile(session),
    }}>
      {children}
    </Ctx.Provider>
  );
}
