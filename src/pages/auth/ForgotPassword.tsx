import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/common/input";
import { Label } from "@/components/common/label";
import { Button } from "@/components/common/button";
import { isValidEmail, stripEdgeSpaces, stripLeadingSpaces } from "@/lib/input-validators";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:4000";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [emailIssue, setEmailIssue] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailIssue(null);
    setErrorMsg(null);
    const trimmed = stripEdgeSpaces(email);
    if (!isValidEmail(trimmed)) {
      setEmailIssue("Please enter a valid email address.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      // The backend deliberately returns the same shape regardless of whether
      // the email exists, so we don't leak account existence. Treat 2xx as
      // "request received" — the email may or may not actually be sent.
      if (!res.ok && res.status !== 200) {
        const body = await res.json().catch(() => null);
        if (res.status === 429) {
          setErrorMsg("Too many requests. Please wait a few minutes before trying again.");
        } else {
          setErrorMsg(body?.error || "We couldn't process that request. Please try again.");
        }
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setErrorMsg("We couldn't reach the server. Please check your connection.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground text-center">
            Enter the email tied to your account and we'll send you a link to reset your password.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-5">
          {status === "sent" ? (
            <div className="flex flex-col items-center text-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-wellness" />
              <p className="text-sm font-bold">Check your inbox</p>
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{email}</span>,
                we've sent a password-reset link. The link expires in 1 hour.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {errorMsg && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-attention/5 border border-attention/20">
                  <AlertCircle className="w-5 h-5 text-attention shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{errorMsg}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-bold text-muted-foreground ml-1">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  inputMode="email"
                  placeholder="you@alshifa.com"
                  value={email}
                  onChange={(e) => { setEmail(stripLeadingSpaces(e.target.value)); setEmailIssue(null); }}
                  onBlur={() => setEmail((v) => stripEdgeSpaces(v))}
                  required
                  disabled={status === "loading"}
                  className="h-12 rounded-xl"
                  aria-invalid={emailIssue ? true : undefined}
                />
                {emailIssue && <p className="text-xs text-attention ml-1">{emailIssue}</p>}
              </div>
              <Button
                type="submit"
                disabled={status === "loading"}
                className="w-full h-12 rounded-xl font-bold"
              >
                {status === "loading" ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending…</>
                ) : (
                  "Send reset link"
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
