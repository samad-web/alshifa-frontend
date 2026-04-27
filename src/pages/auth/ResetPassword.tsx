import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Activity, AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/common/input";
import { Label } from "@/components/common/label";
import { Button } from "@/components/common/button";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:4000";

// Mirror of the backend `strongPassword` zod rule. Kept verbatim so the user
// gets the same checklist that the API would enforce.
const RULES: Array<{ test: (v: string) => boolean; label: string }> = [
  { test: (v) => v.length >= 8,        label: "At least 8 characters" },
  { test: (v) => /[A-Z]/.test(v),       label: "One uppercase letter" },
  { test: (v) => /[a-z]/.test(v),       label: "One lowercase letter" },
  { test: (v) => /[0-9]/.test(v),       label: "One number" },
  { test: (v) => /[^A-Za-z0-9]/.test(v),label: "One special character" },
];

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allRulesPass = RULES.every((r) => r.test(password));
  const matches = password.length > 0 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!token) {
      setErrorMsg("This reset link is missing its token. Please request a new one.");
      setStatus("error");
      return;
    }
    if (!allRulesPass) {
      setErrorMsg("Please satisfy all password requirements.");
      return;
    }
    if (!matches) {
      setErrorMsg("Passwords don't match.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 429) {
          setErrorMsg("Too many requests. Please wait a few minutes and try again.");
        } else {
          setErrorMsg(body?.error || "We couldn't reset your password. The link may have expired.");
        }
        setStatus("error");
        return;
      }
      setStatus("done");
      // Redirect to login after a short pause so the user sees the success state.
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
      setStatus("error");
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-[420px] rounded-2xl border bg-card p-6 space-y-4 text-center">
          <AlertCircle className="w-10 h-10 text-attention mx-auto" />
          <p className="text-sm font-bold">Invalid reset link</p>
          <p className="text-sm text-muted-foreground">
            This link is missing the reset token. Request a new password-reset email.
          </p>
          <Link to="/forgot-password">
            <Button className="w-full h-12 rounded-xl font-bold">Request new link</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-5">
          {status === "done" ? (
            <div className="flex flex-col items-center text-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-wellness" />
              <p className="text-sm font-bold">Password updated</p>
              <p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {errorMsg && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-attention/5 border border-attention/20">
                  <AlertCircle className="w-5 h-5 text-attention shrink-0 mt-0.5" />
                  <p className="text-sm">{errorMsg}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-bold text-muted-foreground ml-1">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={status === "loading"}
                    className="h-12 rounded-xl pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={show ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm font-bold text-muted-foreground ml-1">
                  Confirm Password
                </Label>
                <Input
                  id="confirm"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={status === "loading"}
                  className="h-12 rounded-xl"
                  aria-invalid={confirm.length > 0 && !matches ? true : undefined}
                />
                {confirm.length > 0 && !matches && (
                  <p className="text-xs text-attention ml-1">Passwords don't match</p>
                )}
              </div>

              <ul className="space-y-1.5 text-xs">
                {RULES.map((r) => {
                  const ok = r.test(password);
                  return (
                    <li key={r.label} className={`flex items-center gap-2 ${ok ? "text-wellness" : "text-muted-foreground"}`}>
                      <span className={`w-2 h-2 rounded-full ${ok ? "bg-wellness" : "bg-muted-foreground/30"}`} />
                      {r.label}
                    </li>
                  );
                })}
              </ul>

              <Button
                type="submit"
                disabled={status === "loading" || !allRulesPass || !matches}
                className="w-full h-12 rounded-xl font-bold"
              >
                {status === "loading" ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Updating…</>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          )}
        </div>

        <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
