/**
 * Centered notification modal + cross-app event bus.
 *
 * Why a bus:
 *   ~50 files import `toast` from `sonner` directly (corner toast). Patching
 *   them all to use a context hook would be a sprawling diff. Instead we
 *   monkey-patch the `toast` singleton's success/error/info/warning/message
 *   methods at module load, redirecting each invocation to a window CustomEvent
 *   that the <NotifyHost> picks up and renders as a centered modal.
 *
 * The original sonner Toaster is removed from <App> in the same change so
 * corner toasts no longer render at all.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NotifyVariant = "success" | "error" | "info" | "warning";

export interface NotifyPayload {
    id: string;
    variant: NotifyVariant;
    title: string;
    description?: string;
}

const EVENT_NAME = "app:notify";

function emit(payload: Omit<NotifyPayload, "id">) {
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    window.dispatchEvent(new CustomEvent<NotifyPayload>(EVENT_NAME, { detail: { id, ...payload } }));
    return id;
}

/** Programmatic API. Mirrors sonner's surface so existing callers keep working. */
export const notify = {
    success: (title: string, description?: string) => emit({ variant: "success", title, description }),
    error:   (title: string, description?: string) => emit({ variant: "error",   title, description }),
    info:    (title: string, description?: string) => emit({ variant: "info",    title, description }),
    warning: (title: string, description?: string) => emit({ variant: "warning", title, description }),
};

// ── Sonner toast monkey-patch ────────────────────────────────────────────────
// Done at module-eval time so every `import { toast } from "sonner"` in the
// codebase routes through our modal without each file having to be touched.
type ToastArg = string | { title?: unknown; description?: unknown; message?: unknown } | undefined | null;
function describe(arg: ToastArg, fallback = ""): { title: string; description?: string } {
    if (arg === undefined || arg === null) return { title: fallback };
    if (typeof arg === "string" || typeof arg === "number") return { title: String(arg) };
    if (typeof arg === "object") {
        const o = arg as Record<string, unknown>;
        const t = (o.title ?? o.message ?? fallback) as string;
        const d = typeof o.description === "string" ? o.description : undefined;
        return { title: String(t), description: d };
    }
    return { title: String(arg) };
}

(function patchSonner() {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __notifyToastPatched?: boolean };
    if (w.__notifyToastPatched) return;
    w.__notifyToastPatched = true;

    // Replace each variant on the sonner toast singleton.
    type SonnerToast = typeof sonnerToast & {
        success?: (...args: ToastArg[]) => string | number;
        error?:   (...args: ToastArg[]) => string | number;
        info?:    (...args: ToastArg[]) => string | number;
        warning?: (...args: ToastArg[]) => string | number;
        message?: (...args: ToastArg[]) => string | number;
    };
    const t = sonnerToast as unknown as SonnerToast;
    const wrap = (variant: NotifyVariant, fallback: string) =>
        ((arg?: ToastArg, opts?: { description?: string }) => {
            const { title, description } = describe(arg, fallback);
            return notify[variant](title, description ?? opts?.description);
        }) as unknown as (...args: ToastArg[]) => string | number;

    t.success = wrap("success", "Success");
    t.error   = wrap("error",   "Error");
    t.info    = wrap("info",    "");
    t.warning = wrap("warning", "Warning");
    t.message = wrap("info",    "");
})();

// ── Context (still useful for components that want a hook-style API) ─────────

interface NotifyApi {
    success: (title: string, description?: string) => string;
    error:   (title: string, description?: string) => string;
    info:    (title: string, description?: string) => string;
    warning: (title: string, description?: string) => string;
}

const NotifyContext = createContext<NotifyApi>(notify);
export const useNotify = () => useContext(NotifyContext);

// ── Host component — listens for events, renders the modal ──────────────────

const VARIANT_STYLE: Record<NotifyVariant, { Icon: typeof CheckCircle2; ring: string; bg: string; text: string; defaultTitle: string }> = {
    success: { Icon: CheckCircle2,  ring: "ring-emerald-500/30", bg: "bg-emerald-500/10",  text: "text-emerald-600", defaultTitle: "Success" },
    error:   { Icon: XCircle,       ring: "ring-red-500/30",     bg: "bg-red-500/10",       text: "text-red-600",     defaultTitle: "Error" },
    info:    { Icon: Info,          ring: "ring-blue-500/30",    bg: "bg-blue-500/10",      text: "text-blue-600",    defaultTitle: "Heads up" },
    warning: { Icon: AlertTriangle, ring: "ring-amber-500/30",   bg: "bg-amber-500/10",     text: "text-amber-600",   defaultTitle: "Warning" },
};

export function NotifyHost() {
    const [current, setCurrent] = useState<NotifyPayload | null>(null);
    // Queue extras so a flurry of toasts is shown one after another.
    const queue = useRef<NotifyPayload[]>([]);

    useEffect(() => {
        const onEvt = (e: Event) => {
            const detail = (e as CustomEvent<NotifyPayload>).detail;
            if (!detail) return;
            if (current) queue.current.push(detail);
            else setCurrent(detail);
        };
        window.addEventListener(EVENT_NAME, onEvt);
        return () => window.removeEventListener(EVENT_NAME, onEvt);
    }, [current]);

    const close = () => {
        const next = queue.current.shift();
        setCurrent(next ?? null);
    };

    const cfg = current ? VARIANT_STYLE[current.variant] : null;
    const Icon = cfg?.Icon;

    return (
        <Dialog open={!!current} onOpenChange={(o) => { if (!o) close(); }}>
            <DialogContent className="sm:max-w-md text-center p-0 overflow-hidden">
                {current && cfg && Icon && (
                    <>
                        <div className={cn("p-6 pt-8 flex flex-col items-center gap-3", cfg.bg)}>
                            <div className={cn("h-14 w-14 rounded-full flex items-center justify-center bg-background ring-4", cfg.ring)}>
                                <Icon className={cn("h-7 w-7", cfg.text)} />
                            </div>
                            <DialogHeader className="space-y-1.5">
                                <DialogTitle className="text-lg font-bold">
                                    {current.title || cfg.defaultTitle}
                                </DialogTitle>
                                {current.description && (
                                    <DialogDescription className="text-sm text-muted-foreground">
                                        {current.description}
                                    </DialogDescription>
                                )}
                            </DialogHeader>
                        </div>
                        <DialogFooter className="px-6 py-4 bg-background flex !justify-center">
                            <Button onClick={close} className="min-w-[120px]">
                                <X className="w-4 h-4 mr-1.5" /> Dismiss
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Provider wraps the app once. Memo'd so the context value stays stable. */
export function NotifyProvider({ children }: { children: React.ReactNode }) {
    const api = useMemo<NotifyApi>(() => notify, []);
    return (
        <NotifyContext.Provider value={api}>
            {children}
            <NotifyHost />
        </NotifyContext.Provider>
    );
}
