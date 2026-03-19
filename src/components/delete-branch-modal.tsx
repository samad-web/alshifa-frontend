import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Info } from "lucide-react";

interface DeleteBranchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    branchName: string;
    loading?: boolean;
}

export function DeleteBranchModal({
    isOpen,
    onClose,
    onConfirm,
    branchName,
    loading = false
}: DeleteBranchModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none bg-background rounded-[32px] shadow-2xl">
                {/* Header Section with Icon */}
                <div className="bg-risk/10 p-8 flex flex-col items-center text-center space-y-4">
                    <div className="bg-risk/20 p-4 rounded-full animate-in zoom-in-50 duration-500">
                        <AlertTriangle className="w-10 h-10 text-risk" />
                    </div>
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">Delete Branch</DialogTitle>
                        <DialogDescription className="text-risk font-semibold uppercase tracking-widest text-[10px]">
                            Irreversible Clinical Action
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-8 space-y-8">
                    <div className="space-y-4">
                        <div className="text-center space-y-2">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Are you sure you want to permanently delete the <span className="font-bold text-foreground">"{branchName}"</span> branch?
                            </p>
                        </div>

                        {/* Warning Box */}
                        <div className="bg-secondary/40 rounded-2xl p-4 border border-border/60 space-y-3">
                            <div className="flex items-start gap-3">
                                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <p className="text-[11px] text-muted-foreground leading-normal italic">
                                    This action will permanently remove the branch records and may affect associated:
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 px-2 text-[9px] font-black uppercase tracking-tighter text-center">
                                <div className="bg-background/80 py-1.5 rounded-lg border border-border/40 text-foreground/70">Users</div>
                                <div className="bg-background/80 py-1.5 rounded-lg border border-border/40 text-foreground/70">Appointments</div>
                                <div className="bg-background/80 py-1.5 rounded-lg border border-border/40 text-foreground/70">Medical Records</div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-3 !justify-center w-full">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 font-bold text-xs uppercase tracking-widest h-12 rounded-[18px] hover:bg-secondary transition-all active:scale-[0.97]"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={onConfirm}
                            disabled={loading}
                            className="flex-1 font-bold text-xs uppercase tracking-widest h-12 rounded-[18px] bg-risk hover:bg-risk/90 shadow-xl shadow-risk/20 transition-all active:scale-[0.97] gap-2 border-none"
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
