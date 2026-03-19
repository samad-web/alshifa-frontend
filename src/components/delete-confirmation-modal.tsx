import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    userName: string;
    userRole: string;
    loading?: boolean;
}

export function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    userName,
    userRole,
    loading = false
}: DeleteConfirmationModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
            <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none bg-background rounded-2xl shadow-2xl">
                <div className="bg-risk/10 p-6 flex flex-col items-center text-center space-y-3">
                    <div className="bg-risk/20 p-3 rounded-full">
                        <AlertTriangle className="w-8 h-8 text-risk" />
                    </div>
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-2xl font-bold text-foreground">Delete User</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium">
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground text-center leading-relaxed">
                            Are you sure you want to permanently delete <span className="font-bold text-foreground">{userName || "this user"}</span>?
                            This will remove their access as a <span className="font-semibold text-primary/80 uppercase tracking-wider text-xs">{userRole}</span> from the system.
                        </p>

                        <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground font-medium uppercase tracking-tight">Status</span>
                                <span className="text-risk font-bold uppercase">Permanent Deletion</span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 !justify-center w-full">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 font-bold text-xs uppercase tracking-widest h-12 rounded-xl hover:bg-secondary/80 transition-all border border-transparent active:scale-[0.98]"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={onConfirm}
                            disabled={loading}
                            className="flex-1 font-bold text-xs uppercase tracking-widest h-12 rounded-xl bg-risk hover:bg-risk/90 shadow-lg shadow-risk/20 transition-all active:scale-[0.98] gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Delete Permanently"
                            )}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
