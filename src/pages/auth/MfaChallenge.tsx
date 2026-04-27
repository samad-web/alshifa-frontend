import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, AlertCircle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Input } from "@/components/common/input";
import { Label } from "@/components/common/label";
import { Button } from "@/components/common/button";
import { useAuth } from "@/hooks/useAuth";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:4000";

export default function MfaChallenge() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = sessionStorage.getItem("auth:mfa-temp-token"); } catch { /* storage may be blocked */ }
    if (!stored) {
      // No temp token means the user landed here without going through login.
      navigate("/login", { replace: true });
      return;
    }
    setTempToken(stored);
    // Defer the focus to the next tick — useEffect fires before the DOM is
    // committed in some Strict Mode tear-down scenarios.
    queueMicrotask(() => codeInputRef.current?.focus());
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) return;
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setErrorMsg("Enter the 6-digit code from your authenticator (or an 8-character backup code).");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/mfa/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 429) {
          setErrorMsg("Too many attempts. Please wait a minute before trying again.");
        } else if (res.status === 401 || res.status === 403) {
          setErrorMsg(body?.error || "That code doesn't match. Please try again.");
        } else {
          setErrorMsg(body?.error || "We couldn't verify that code. Please try again.");
        }
        setCode("");
        codeInputRef.current?.focus();
        setSubmitting(false);
        return;
      }
      if (typeof body?.accessToken !== "string" || typeof body?.refreshToken !== "string") {
        setErrorMsg("The server's response was malformed. Please try again.");
        setSubmitting(false);
        return;
      }
      localStorage.setItem("accessToken", body.accessToken);
      localStorage.setItem("refreshToken", body.refreshToken);
      try { sessionStorage.removeItem("auth:mfa-temp-token"); } catch { /* ignore */ }
      // Refresh the auth context so ProtectedRoute sees the new session,
      // then bounce through `/` — AuthenticatedRedirect there resolves the
      // role-specific landing page.
      await refreshProfile();
      navigate("/", { replace: true });
    } catch {
      setErrorMsg("We couldn't reach the server. Please check your connection.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Two-factor authentication</h1>
          <p className="text-sm text-muted-foreground text-center">
            Enter the 6-digit code from your authenticator app, or one of your 8-character backup codes.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-attention/5 border border-attention/20">
              <AlertCircle className="w-5 h-5 text-attention shrink-0 mt-0.5" />
              <p className="text-sm">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-sm font-bold text-muted-foreground ml-1">
                Verification code
              </Label>
              <Input
                ref={codeInputRef}
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                disabled={submitting}
                className="h-14 rounded-xl text-center text-2xl tracking-[0.4em] font-mono"
                placeholder="••••••"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting || code.length < 6}
              className="w-full h-12 rounded-xl font-bold"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying…</>
              ) : (
                <><ShieldCheck className="w-5 h-5 mr-2" /> Verify and continue</>
              )}
            </Button>
          </form>
        </div>

        <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
