
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuthUser as SupabaseAuthUser } from "@supabase/supabase-js";

export type AppRole = "SUPER_ADMIN" | "ADMIN" | "ADMIN_DOCTOR" | "BRANCH_ADMIN" | "DOCTOR" | "THERAPIST" | "PATIENT" | "PHARMACIST";

interface AuthUser {
  id: string;
  email: string;
}

interface AuthProfile {
  id: string;
  email: string;
  role: AppRole;
  branchId?: string | null;
  branch?: { id: string; name: string; address?: string } | null;
  doctor?: unknown;
  therapist?: unknown;
  patient?: unknown;
  pharmacist?: unknown;
}

interface AuthContextType {
  user: AuthUser | null;
  role: AppRole | null;
  profile: AuthProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: SignInError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export type SignInErrorKind =
  | "network"
  | "server"
  | "rate_limited"
  | "email_not_verified"
  | "hospital_suspended"
  | "mfa_required"
  | "invalid_credentials"
  | "unknown";

export interface SignInError extends Error {
  kind: SignInErrorKind;
  status?: number;
  code?: string;
}

function classifySignInError(status: number | null, data: { error?: string; code?: string } | null): SignInErrorKind {
  if (status === null || status === 0) return "network";
  if (status >= 500) return "server";
  if (status === 429) return "rate_limited";
  if (status === 403) {
    if (data?.code === "EMAIL_NOT_VERIFIED") return "email_not_verified";
    if (data?.code === "HOSPITAL_SUSPENDED") return "hospital_suspended";
    return "invalid_credentials";
  }
  if (status === 401) return "invalid_credentials";
  return "unknown";
}

function makeSignInError(kind: SignInErrorKind, message: string, status?: number, code?: string): SignInError {
  const err = new Error(message) as SignInError;
  err.kind = kind;
  err.status = status;
  err.code = code;
  return err;
}

let inFlightRefresh: Promise<boolean> | null = null;

export async function refreshAccessTokenShared(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) return false;
      return !!data.session;
    } catch {
      return false;
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (shouldThrow = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setUser(null);
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      // Fetch full profile from backend using Supabase token
      const token = session.access_token;
      const res = await fetch(`${API_BASE_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        await supabase.auth.signOut();
        setUser(null); setRole(null); setProfile(null); setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`Profile fetch failed: ${res.status}`);
      }

      const data: AuthProfile = await res.json();
      setUser({ id: data.id, email: data.email });
      setRole(data.role);
      setProfile(data);
    } catch (err) {
      setUser(null);
      setRole(null);
      setProfile(null);
      if (shouldThrow) throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Listen for Supabase auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!cancelled) {
          if (session?.user) {
            await fetchProfile();
          } else {
            setUser(null);
            setRole(null);
            setProfile(null);
            setLoading(false);
          }
        }
      });

      // Initial load
      await fetchProfile();

      return () => subscription?.unsubscribe();
    };

    const unsubscribe = init();
    return () => {
      cancelled = true;
      unsubscribe.then(u => u?.());
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const kind = classifySignInError(null, { error: error.message, code: error.code });
        return { error: makeSignInError(kind, error.message, undefined, error.code) };
      }

      if (!data.session) {
        return { error: makeSignInError("server", "Login succeeded but no session was created.") };
      }

      // Fetch profile after successful login
      try {
        await fetchProfile(true);
        return { error: null };
      } catch (err) {
        await supabase.auth.signOut();
        setUser(null); setRole(null); setProfile(null); setLoading(false);
        const message = err instanceof Error ? err.message : "We couldn't load your profile. Please try again.";
        return { error: makeSignInError("server", message) };
      }
    } catch (err) {
      setLoading(false);
      const message = err instanceof Error ? err.message : "Login failed. Please try again.";
      return { error: makeSignInError("network", message) };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, signIn, signOut, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
