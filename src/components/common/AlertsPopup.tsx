import { useState } from "react";
import { AlertTriangle, Bell } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AlertsPopupProps {
  /** Button label when there are zero alerts. */
  emptyLabel?: string;
  /** Button label when there are 1+ alerts. */
  alertLabel?: string;
  /** Dialog title shown inside the popup. */
  title: string;
  /** Number of active alerts — drives the badge + trigger styling. */
  count: number;
  /** Body content (one or more <AlertRow /> entries, or any custom JSX). */
  children: React.ReactNode;
  /**
   * Empty-state placeholder. Rendered inside the popup body when `count === 0`.
   * Defaults to a generic "No active alerts." line.
   */
  emptyState?: React.ReactNode;
  /** Optional extra trigger className for layout tweaks. */
  triggerClassName?: string;
}

/**
 * Generic "alerts" popup. Replaces the legacy inline alert sections that used
 * to take real estate on every dashboard. The trigger button shows the active
 * alert count and opens a centered dialog with the same row content.
 */
export function AlertsPopup({
  emptyLabel = "No alerts",
  alertLabel = "View alerts",
  title,
  count,
  children,
  emptyState,
  triggerClassName,
}: AlertsPopupProps) {
  const [open, setOpen] = useState(false);
  const hasAlerts = count > 0;

  return (
    <>
      <Button
        variant={hasAlerts ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {hasAlerts ? (
          <AlertTriangle className="w-4 h-4 mr-2 text-amber-50" />
        ) : (
          <Bell className="w-4 h-4 mr-2 text-muted-foreground" />
        )}
        {hasAlerts ? alertLabel : emptyLabel}
        {hasAlerts && (
          <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
            {count}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {title}
              {hasAlerts && (
                <Badge variant="outline" className="ml-1">
                  {count}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0 divide-y">
            {hasAlerts
              ? children
              : (emptyState ?? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No active alerts.
                  </div>
                ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface AlertRowProps {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  action?: React.ReactNode;
  /** When false, the row is suppressed. Useful for inline conditional rows. */
  visible?: boolean;
}

/** Single row inside an <AlertsPopup>. Mirrors the shape used by the legacy
 *  inline AlertRow on AdminDashboard so existing call sites can be lifted in
 *  with minimal changes. */
export function AlertRow({ icon, title, detail, action, visible = true }: AlertRowProps) {
  if (!visible) return null;
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{title}</div>
          {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
