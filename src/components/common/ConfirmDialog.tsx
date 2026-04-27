import { useCallback, useEffect, useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, CheckCircle2, Loader2 } from "lucide-react";

type ConfirmTone = "default" | "danger" | "info" | "success";

export interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
    loading?: boolean;
    /** Hide the cancel button — used for "alert" style (single OK). */
    alertOnly?: boolean;
}

const toneIcon: Record<ConfirmTone, typeof AlertTriangle> = {
    default: Info,
    danger: AlertTriangle,
    info: Info,
    success: CheckCircle2,
};

const toneColor: Record<ConfirmTone, string> = {
    default: "text-primary",
    danger: "text-destructive",
    info: "text-primary",
    success: "text-wellness",
};

const toneBg: Record<ConfirmTone, string> = {
    default: "bg-primary/10",
    danger: "bg-destructive/10",
    info: "bg-primary/10",
    success: "bg-wellness/10",
};

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    tone = "default",
    loading = false,
    alertOnly = false,
}: ConfirmDialogProps) {
    const Icon = toneIcon[tone];
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-full ${toneBg[tone]}`}>
                            <Icon className={`w-5 h-5 ${toneColor[tone]}`} />
                        </div>
                        <div className="flex-1 text-left">
                            <DialogTitle>{title}</DialogTitle>
                            {description && (
                                <DialogDescription className="pt-1">{description}</DialogDescription>
                            )}
                        </div>
                    </div>
                </DialogHeader>
                <DialogFooter className="gap-2">
                    {!alertOnly && (
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            {cancelLabel}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant={tone === "danger" ? "destructive" : "default"}
                        onClick={onConfirm}
                        disabled={loading}
                        className="gap-2"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Imperative confirm/alert hook — drop-in replacement for window.confirm / alert.
 *
 *   const { confirm, alert, dialog } = useConfirm();
 *   if (await confirm({ title: "Delete?", tone: "danger" })) await del();
 *   await alert({ title: "Saved", tone: "success" });
 *   ...
 *   return <>...{dialog}</>;
 */
type ConfirmOptions = Omit<ConfirmDialogProps, "isOpen" | "onClose" | "onConfirm" | "loading"> & {
    /** Set to true for alert-style (single OK button). */
    alertOnly?: boolean;
};

interface PendingConfirm {
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
}

export function useConfirm() {
    const [pending, setPending] = useState<PendingConfirm | null>(null);
    const pendingRef = useRef(pending);
    useEffect(() => { pendingRef.current = pending; }, [pending]);

    const confirm = useCallback(
        (options: ConfirmOptions) =>
            new Promise<boolean>((resolve) => {
                setPending({ options, resolve });
            }),
        []
    );

    const alert = useCallback(
        (options: Omit<ConfirmOptions, "alertOnly">) =>
            new Promise<void>((resolve) => {
                setPending({
                    options: { ...options, alertOnly: true, confirmLabel: options.confirmLabel || "OK" },
                    resolve: () => resolve(),
                });
            }),
        []
    );

    const handleClose = useCallback(() => {
        const p = pendingRef.current;
        if (!p) return;
        p.resolve(false);
        setPending(null);
    }, []);

    const handleConfirm = useCallback(() => {
        const p = pendingRef.current;
        if (!p) return;
        p.resolve(true);
        setPending(null);
    }, []);

    const dialog = pending ? (
        <ConfirmDialog
            isOpen
            onClose={handleClose}
            onConfirm={handleConfirm}
            title={pending.options.title}
            description={pending.options.description}
            confirmLabel={pending.options.confirmLabel}
            cancelLabel={pending.options.cancelLabel}
            tone={pending.options.tone}
            alertOnly={pending.options.alertOnly}
        />
    ) : null;

    return { confirm, alert, dialog } as const;
}
