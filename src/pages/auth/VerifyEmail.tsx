import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/common/button";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:4000";

type Status = "pending" | "success" | "error";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("pending");
  const [message, setMessage] = useState<string>("Verifying your email…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This link is missing a verification token. Open the link from the email we sent you.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
        );
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setMessage(
            body?.error
              || "We couldn't verify this link. It may have expired or already been used.",
          );
          return;
        }
        setStatus("success");
        setMessage(body?.message || "Your email is verified. You can sign in now.");
      } catch {
        if (cancelled) return;
        setStatus("error");
        setMessage("We couldn't reach the server. Please check your connection and try again.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const Icon = status === "success" ? CheckCircle2 : status === "error" ? AlertCircle : Loader2;
  const iconClass = status === "success"
    ? "text-wellness"
    : status === "error"
      ? "text-attention"
      : "text-primary animate-spin";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Email Verification</h1>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-4 text-center">
          <Icon className={`w-10 h-10 mx-auto ${iconClass}`} />
          <p className="text-sm text-muted-foreground">{message}</p>
          {status !== "pending" && (
            <Link to="/login">
              <Button className="w-full h-12 rounded-xl font-bold mt-2">Go to sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
