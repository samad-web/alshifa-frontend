
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type AppRole = "ADMIN" | "ADMIN_DOCTOR" | "DOCTOR" | "THERAPIST" | "PATIENT" | "PHARMACIST";

interface AuthUser {
  id: string;
  email: string;
}

interface AuthProfile {
  id: string;
  email: string;
  role: AppRole;
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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function getStoredTokens() {
  return {
    accessToken: localStorage.getItem("accessToken"),
    refreshToken: localStorage.getItem("refreshToken"),
  };
}

function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

/** Decode a JWT payload without verifying the signature (client-side only check). */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

/** Returns true if the token is expired (with a 30-second buffer). */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now() + 30_000;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Attempt to renew the access token using the stored refresh token.
  const refreshAccessToken = async (): Promise<boolean> => {
    const { refreshToken } = getStoredTokens();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { clearTokens(); return false; }
      const data = await res.json();
      if (!data.accessToken) { clearTokens(); return false; }
      localStorage.setItem('accessToken', data.accessToken);
      return true;
    } catch {
      return false;
    }
  };

  // Fetch user profile from backend
  const fetchProfile = async (shouldThrow = false) => {
    let { accessToken } = getStoredTokens();

    if (!accessToken) {
      setUser(null);
      setRole(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    // Proactively refresh if the stored token is already expired
    if (isTokenExpired(accessToken)) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        setUser(null); setRole(null); setProfile(null); setLoading(false);
        return;
      }
      accessToken = localStorage.getItem('accessToken')!;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // On auth failures, attempt a silent token refresh and retry once.
      if (res.status === 401 || res.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          const newToken = localStorage.getItem('accessToken');
          const retryRes = await fetch(`${API_BASE_URL}/api/user/me`, {
            headers: { Authorization: `Bearer ${newToken}` },
          });
          if (!retryRes.ok) throw new Error(`Profile fetch failed: ${retryRes.status}`);
          const retryData: AuthProfile = await retryRes.json();
          setUser({ id: retryData.id, email: retryData.email });
          setRole(retryData.role);
          setProfile(retryData);
          setLoading(false);
          return;
        }
        clearTokens();
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

    // Wrap fetchProfile so state updates are no-ops if the component unmounted
    const init = async () => {
      await fetchProfile();
      // (fetchProfile already guards individual setters, but guard top-level too)
      if (cancelled) {
        setLoading(false);
      }
    };
    init();

    const handleSessionExpired = () => {
      if (!cancelled) {
        setUser(null); setRole(null); setProfile(null); setLoading(false);
      }
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);

    return () => {
      cancelled = true;
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setLoading(false);
        return { error: new Error(data.error || "Login failed") };
      }
      const data = await res.json();
      storeTokens(data.accessToken, data.refreshToken);

      await fetchProfile(true);
      return { error: null };
    } catch (error) {
      setLoading(false);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    clearTokens();
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
