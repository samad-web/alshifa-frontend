import { ReactNode, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface HoverActionCardProps {
  children: ReactNode;
  /** Called when the user clicks the edit icon. Hidden when `canEdit` is false. */
  onEdit?: () => void;
  /** Called after the user confirms the delete dialog. Hidden when `canDelete` is false. */
  onDelete?: () => void | Promise<void>;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Override the default delete-confirm copy if a card needs more specific wording. */
  deleteTitle?: string;
  deleteDescription?: string;
  /** Forwarded to the wrapper so callers can keep their own padding/margins. */
  className?: string;
  /** Tooltip text on the icon buttons (rendered as title attribute for accessibility). */
  editLabel?: string;
  deleteLabel?: string;
}

/**
 * Wraps any card-like content with a hover-revealed top-right action bar
 * (Edit + Delete). Delete is gated behind a shadcn AlertDialog. Both buttons
 * disappear when the corresponding `can*` prop is false, so a single component
 * can serve "owner can edit + delete", "owner can edit, admin can delete",
 * or any other permutation.
 *
 * Pattern: Tailwind `group` + `group-hover:flex` + `bg-white/90` overlay so the
 * card content stays uncluttered until a clinician points at it.
 */
export function HoverActionCard({
  children,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
  deleteTitle = "Are you sure you want to delete this?",
  deleteDescription = "This action cannot be undone.",
  className,
  editLabel = "Edit",
  deleteLabel = "Delete",
}: HoverActionCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // No actions to show? Render the children naked so the wrapper is a no-op
  // for non-privileged users (avoids the empty `group` overhead on every card).
  if (!canEdit && !canDelete) return <>{children}</>;

  async function handleConfirmDelete() {
    if (!onDelete) return setConfirmOpen(false);
    try {
      setDeleting(true);
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className={cn("group relative", className)}>
      {children}

      <div
        className="absolute top-2 right-2 hidden group-hover:flex gap-1 bg-white/90 dark:bg-card/90 backdrop-blur-sm rounded-lg p-1 shadow ring-1 ring-border/40 z-10"
        role="toolbar"
      >
        {canEdit && onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title={editLabel}
            aria-label={editLabel}
            className="p-1.5 rounded-md hover:bg-muted text-foreground/70 hover:text-foreground transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {canDelete && onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            title={deleteLabel}
            aria-label={deleteLabel}
            className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
