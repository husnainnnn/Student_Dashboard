// Authentication, client-side only.
//  - Supabase mode: real email + password accounts via Supabase Auth.
//  - Demo mode (no Supabase env vars): a local profile stored in this browser.
//    Clearly labelled as demo everywhere it appears.

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  mode: "supabase" | "demo";
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInDemo: (displayName: string, email: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_PROFILE_KEY = "sd-demo-profile";

function profileFromSupabaseUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AppUser {
  const email = u.email ?? "";
  const metaName = typeof u.user_metadata?.display_name === "string" ? (u.user_metadata.display_name as string) : "";
  return {
    id: u.id,
    email,
    displayName: metaName || email.split("@")[0] || "Student",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mode: "supabase" | "demo" = isSupabaseConfigured() ? "supabase" : "demo";

  useEffect(() => {
    const supabase = getSupabase();
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setUser(data.session?.user ? profileFromSupabaseUser(data.session.user) : null);
        setLoading(false);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ? profileFromSupabaseUser(session.user) : null);
        setLoading(false);
      });
      return () => listener.subscription.unsubscribe();
    }
    // Demo mode: read the local profile.
    try {
      const raw = localStorage.getItem(DEMO_PROFILE_KEY);
      setUser(raw ? (JSON.parse(raw) as AppUser) : null);
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  async function signUp(email: string, password: string, displayName: string) {
    const supabase = getSupabase();
    if (!supabase) return { error: "Supabase is not configured." };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) return { error: error.message };
    if (data.session?.user) setUser(profileFromSupabaseUser(data.session.user));
    return { error: null, needsConfirmation: !data.session };
  }

  async function signIn(email: string, password: string) {
    const supabase = getSupabase();
    if (!supabase) return { error: "Supabase is not configured." };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.session?.user) setUser(profileFromSupabaseUser(data.session.user));
    return { error: null };
  }

  function signInDemo(displayName: string, email: string) {
    const profile: AppUser = {
      id: `demo-${Date.now().toString(36)}`,
      email: email || "demo@student.local",
      displayName: displayName || "Demo Student",
    };
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(profile));
    setUser(profile);
  }

  async function signOut() {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(DEMO_PROFILE_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, mode, signUp, signIn, signInDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
