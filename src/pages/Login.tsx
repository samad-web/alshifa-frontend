import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, type SignInError, type SignInErrorKind } from "@/hooks/useAuth";
import { getRoleRedirectPath } from "@/components/auth/ProtectedRoute";
import { Activity, Loader2, AlertCircle, CheckCircle2, WifiOff, ShieldAlert, Mail, Clock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/common/input";
import { Label } from "@/components/common/label";
import { Button } from "@/components/common/button";
import { cn } from "@/lib/utils";
import { isValidEmail, stripLeadingSpaces, stripEdgeSpaces } from "@/lib/input-validators";

function errorCopy(kind: SignInErrorKind): { title: string; hint: string; icon: typeof AlertCircle } {
  switch (kind) {
    case "network":
      return { title: "Can't reach the server", hint: "Check your internet connection or try again in a moment.", icon: WifiOff };
    case "server":
      return { title: "Server is having trouble", hint: "Our backend is down or restarting. Please try again in a few minutes.", icon: ShieldAlert };
    case "rate_limited":
      return { title: "Too many attempts", hint: "You've tried too many times. Wait a minute and try again.", icon: Clock };
    case "email_not_verified":
      return { title: "Email not verified", hint: "Check your inbox for the verification link, then sign in.", icon: Mail };
    case "hospital_suspended":
      return { title: "Account suspended", hint: "Your clinic's access is paused. Contact your administrator.", icon: ShieldAlert };
    case "mfa_required":
      return { title: "Two-factor required", hint: "Redirecting you to verify your authenticator code.", icon: ShieldAlert };
    case "invalid_credentials":
      return { title: "Incorrect password. Please try again.", hint: "Double-check your password and try again. If you forgot it, contact your clinic administrator.", icon: AlertCircle };
    default:
      return { title: "Sign-in failed", hint: "Something unexpected happened. Please try again.", icon: AlertCircle };
  }
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signInErr, setSignInErr] = useState<SignInError | null>(null);
  const [emailIssue, setEmailIssue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inactivityNotice, setInactivityNotice] = useState(false);
  const { user, role, signIn, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role) {
      navigate(getRoleRedirectPath(role), { replace: true });
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("auth:logout-reason") === "inactivity") {
        setInactivityNotice(true);
        sessionStorage.removeItem("auth:logout-reason");
      }
    } catch { /* storage may be blocked */ }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInErr(null);
    setEmailIssue(null);

    if (!isValidEmail(email)) {
      setEmailIssue("Please enter a valid email address.");
      return;
    }
    if (password.length === 0) return;

    setIsLoading(true);
    try {
      const { error } = await signIn(stripEdgeSpaces(email), stripEdgeSpaces(password));
      if (error) {
        setSignInErr(error);
        // Clear the password on every failed attempt so it's never left
        // visible in the input for the next user at the same machine, and so
        // a wrong-password retry doesn't double-submit the same credentials.
        setPassword("");
        // MFA-required isn't really a "failure" — route to the MFA page
        // (the temp token was already stashed by useAuth.signIn).
        if (error.kind === "mfa_required") {
          navigate("/mfa", { replace: true });
        }
      }
    } finally {
      // Always reset the local spinner. On success, the auth-state effect
      // navigates away so this is a no-op; on error, it resets the button.
      // Previously this only fired in the error branch — leaving a successful
      // login stuck showing "Authenticating..." until the redirect raced in.
      setIsLoading(false);
    }
  };

  const copy = signInErr ? errorCopy(signInErr.kind) : null;
  const ErrIcon = copy?.icon ?? AlertCircle;

  // Show loading if checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Decorative Side Panel - Desktop Only */}
      <div className="hidden lg:flex flex-1 relative bg-primary items-center justify-center p-12 overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary-foreground/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

        <div className="relative z-10 max-w-md w-full space-y-12">
          {/* Hero Branding */}
          <div className="space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
              <Activity className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-5xl font-black text-white tracking-tight">IWIS</h2>
              <p className="text-xl text-white/80 font-medium">Illness to Wellness Intelligence System</p>
            </div>
          </div>

          {/* Value Props */}
          <div className="space-y-6">
            <div className="flex items-start gap-4 text-white">
              <div className="mt-1 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <p className="text-lg font-medium text-white/90">Personalized healing journeys for every patient</p>
            </div>
            <div className="flex items-start gap-4 text-white">
              <div className="mt-1 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <p className="text-lg font-medium text-white/90">Streamlined sit-management for therapists</p>
            </div>
            <div className="flex items-start gap-4 text-white">
              <div className="mt-1 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <p className="text-lg font-medium text-white/90">Data-driven insights for clinical administrators</p>
            </div>
          </div>

          {/* Trusted Footer */}
          <div className="pt-12 border-t border-white/10">
            <p className="text-sm text-white/60">Built with care for modern healthcare professionals.</p>
          </div>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-20 py-12">
        <div className="w-full max-w-[400px] space-y-10">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="lg:hidden flex flex-col items-center gap-4 mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <span className="text-2xl font-black text-foreground">IWIS</span>
          </div>

          {/* Welcome Text */}
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground">Sign in to access your intelligence dashboard</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {inactivityNotice && !copy && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">You were signed out</p>
                  <p className="text-sm text-muted-foreground">For your security, we ended your session after 15 minutes of inactivity.</p>
                </div>
              </div>
            )}
            {copy && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-attention/5 border border-attention/20 animate-shake">
                <ErrIcon className="w-5 h-5 text-attention shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">{copy.title}</p>
                  <p className="text-sm text-muted-foreground">{copy.hint}</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-bold text-muted-foreground ml-1">Email Address</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="doctor@iwis.com"
                value={email}
                onChange={(e) => { setEmail(stripLeadingSpaces(e.target.value)); setEmailIssue(null); }}
                onBlur={() => {
                  const trimmed = stripEdgeSpaces(email);
                  if (trimmed !== email) setEmail(trimmed);
                  if (trimmed && !isValidEmail(trimmed)) setEmailIssue("Please enter a valid email address.");
                }}
                required
                aria-invalid={emailIssue ? true : undefined}
                className="h-14 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl text-lg"
                disabled={isLoading}
              />
              {emailIssue && <p className="text-xs text-attention ml-1">{emailIssue}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" title="Password" className="text-sm font-bold text-muted-foreground ml-1">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-primary hover:underline mr-1"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(stripLeadingSpaces(e.target.value))}
                  onBlur={() => setPassword(p => stripEdgeSpaces(p))}
                  required
                  className="h-14 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl text-lg pr-12"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className={cn(
                "w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20",
                "transition-all duration-300"
              )}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Continue to Dashboard"
              )}
            </Button>
          </form>

          {/* Manual Redirect Fallback */}
          {user && role && !isLoading && (
            <div className="text-center lg:text-left space-y-4 p-5 rounded-2xl bg-primary/5 border border-primary/20 animate-fade-in shadow-sm">
              <p className="text-sm text-foreground font-bold">Session active</p>
              <Button
                onClick={() => navigate(getRoleRedirectPath(role), { replace: true })}
                variant="outline"
                className="w-full h-12 rounded-xl font-bold"
              >
                Go to Dashboard
              </Button>
            </div>
          )}

          {/* Footer Branding */}
          <div className="pt-8 border-t border-border/50 text-center lg:text-left">
            <p className="text-sm text-muted-foreground">
              Illness to Wellness Intelligence System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
