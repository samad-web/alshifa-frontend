
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";

export type AppRole = "SUPER_ADMIN" | "ADMIN" | "ADMIN_DOCTOR" | "BRANCH_ADMIN" | "DOCTOR" | "THERAPIST" | "PATIENT" | "PHARMACIST";

interface AuthUser {
  id: string;
  email: string;
}

interface AuthProfile {
  id: string;
  email: string;
  role: AppRole;
  // Flat branchId for branch-scoped role checks (BRANCH_ADMIN, DOCTOR, THERAPIST,
  // PHARMACIST). Mirrors User.branchId on the backend; null for SUPER_ADMIN /
  // ADMIN-style global roles that aren't pinned to a branch.
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

// Auto-logout after this many ms of no user interaction.
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

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

function classifySignInError(status: number, data: { error?: string; code?: string } | null): SignInErrorKind {
  if (status === 0) return "network";
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

function getStoredTokens() {
  const access = localStorage.getItem("accessToken");
  const refresh = localStorage.getItem("refreshToken");
  // Treat the literal strings "undefined" / "null" as absent — older builds
  // could write these by accident when the login response was malformed.
  return {
    accessToken: access && access !== "undefined" && access !== "null" ? access : null,
    refreshToken: refresh && refresh !== "undefined" && refresh !== "null" ? refresh : null,
  };
}

function storeTokens(accessToken: unknown, refreshToken: unknown): boolean {
  // Reject anything that isn't a non-empty string. This used to silently
  // write `undefined` into localStorage when the login response shape was
  // wrong, leaving the app in a state where every request 401'd.
  if (typeof accessToken !== "string" || accessToken.length === 0) return false;
  if (typeof refreshToken !== "string" || refreshToken.length === 0) return false;
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
  return true;
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
    // atob throws on non-base64 characters — guard against corrupted tokens
    // by wrapping the whole decode in the catch below.
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

// Single-flight refresh guard. Multiple parallel requests that all hit a 401
// at the same moment used to each fire their own /refresh call — duplicating
// load and (with reuse-detection on the server) sometimes nuking valid
// sessions. Now a refresh in progress is shared by all callers.
let inFlightRefresh: Promise<boolean> | null = null;

// Exported so api-client.ts can call it on 401 to attempt a transparent
// retry before clearing tokens and bouncing the user to /login.
export async function refreshAccessTokenShared(apiBase: string): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    const { refreshToken } = getStoredTokens();
    if (!refreshToken) { clearTokens(); return false; }
    try {
      const res = await fetch(`${apiBase}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { clearTokens(); return false; }
      const data = await res.json();
      if (typeof data?.accessToken !== 'string' || data.accessToken.length === 0) {
        clearTokens();
        return false;
      }
      localStorage.setItem('accessToken', data.accessToken);
      // Some backends rotate the refresh token on every refresh — store the
      // new one when it's present, keep the existing one when it isn't.
      if (typeof data.refreshToken === 'string' && data.refreshToken.length > 0) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      return true;
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

  // Attempt to renew the access token using the stored refresh token. Routes
  // through the module-level singleton so concurrent callers share the same
  // in-flight request.
  const refreshAccessToken = (): Promise<boolean> => refreshAccessTokenShared(API_BASE_URL);

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
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      setLoading(false);
      return { error: makeSignInError("network", "Can't reach the server. Check your connection and try again.") };
    }

    if (!res.ok) {
      let data: { error?: string; code?: string } | null = null;
      try { data = await res.json(); } catch { /* ignore non-JSON body */ }
      setLoading(false);
      const kind = classifySignInError(res.status, data);
      return { error: makeSignInError(kind, data?.error || "Login failed", res.status, data?.code) };
    }

    let data: {
      mfaRequired?: boolean;
      tempToken?: string;
      accessToken?: unknown;
      refreshToken?: unknown;
    };
    try {
      data = await res.json();
    } catch {
      setLoading(false);
      return { error: makeSignInError("server", "The server returned an invalid response. Please try again.") };
    }

    if (data.mfaRequired) {
      // Stash the short-lived temp token so the (forthcoming) MFA challenge
      // page can submit it to /mfa/validate. Stored in sessionStorage so it
      // doesn't outlive the browser tab.
      try {
        if (typeof data.tempToken === "string" && data.tempToken.length > 0) {
          sessionStorage.setItem("auth:mfa-temp-token", data.tempToken);
        }
      } catch { /* storage may be blocked */ }
      setLoading(false);
      return { error: makeSignInError("mfa_required", "MFA verification required", 200) };
    }

    if (!storeTokens(data.accessToken, data.refreshToken)) {
      setLoading(false);
      return { error: makeSignInError("server", "Login succeeded but the server's response was malformed. Please try again.") };
    }

    // If the profile fetch fails, the partial state would otherwise be:
    // tokens stored but no user/role → ProtectedRoute thinks we're logged in
    // (token present) but every screen reads `useAuth().user` and bounces
    // back to /login. Roll back the tokens and surface the failure.
    try {
      await fetchProfile(true);
      return { error: null };
    } catch (err) {
      clearTokens();
      setUser(null); setRole(null); setProfile(null); setLoading(false);
      const message = err instanceof Error ? err.message : "We couldn't load your profile. Please try again.";
      return { error: makeSignInError("server", message) };
    }
  };

  const signOut = async () => {
    // Best-effort revoke on the server. We deliberately don't await this on
    // the UI critical path — even if the network is dead, the local logout
    // must still complete so the user isn't trapped in an authenticated UI.
    const { accessToken, refreshToken } = getStoredTokens();
    if (accessToken) {
      void fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken: refreshToken ?? undefined }),
        // keepalive lets the request finish even if this tab is closing.
        keepalive: true,
      }).catch(() => { /* swallow — local sign-out still proceeds */ });
    }
    clearTokens();
    try { sessionStorage.removeItem("auth:mfa-temp-token"); } catch { /* ignore */ }
    setUser(null);
    setRole(null);
    setProfile(null);
    setLoading(false);
  };

  // Inactivity auto-logout. Resets on any user interaction; fires once
  // 15 minutes of silence pass while a user is signed in.
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user) return;

    const triggerLogout = () => {
      // Surface a one-shot reason flag so the next page load can show a
      // toast or banner if it wants to.
      try { sessionStorage.setItem("auth:logout-reason", "inactivity"); } catch { /* storage may be blocked */ }
      void signOut();
    };
    const reset = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(triggerLogout, INACTIVITY_TIMEOUT_MS);
    };

    const events: (keyof DocumentEventMap)[] = [
      "mousemove", "mousedown", "keydown", "click", "scroll", "touchstart", "visibilitychange",
    ];
    events.forEach(evt => document.addEventListener(evt, reset, { passive: true }));
    reset();

    return () => {
      events.forEach(evt => document.removeEventListener(evt, reset));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [user]);

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
