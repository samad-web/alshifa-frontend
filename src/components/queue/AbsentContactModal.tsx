/**
 * AbsentContactModal — opens from the Live Queue Board when an admin or
 * branch admin clicks "Contact Patient" on an absent queue row. Three
 * actions:
 *   1. Mark as Contacted — POST /api/queue/:id/contact-absent with note
 *   2. Mark as No-Show — set Appointment.status to NO_SHOW (legacy path)
 *   3. Call Patient — tel:<phoneNumber> deep-link (mobile)
 *
 * Standard application Dialog — no native browser alerts.
 */

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Phone, UserCheck, UserX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { queueApi, type QueueEntry } from "@/services/queue.service";
import { apiClient } from "@/lib/api-client";

interface AbsentContactModalProps {
  open: boolean;
  onClose: () => void;
  entry: QueueEntry | null;
  onContacted?: () => void;
  onNoShow?: () => void;
}

export function AbsentContactModal({ open, onClose, entry, onContacted, onNoShow }: AbsentContactModalProps) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"none" | "contact" | "no-show">("none");

  useEffect(() => { if (open) setNote(""); }, [open, entry?.id]);

  if (!entry) return null;

  const patient = entry.appointment.patient;
  const phone = patient?.phoneNumber || null;
  const scheduled = new Date(entry.appointment.date);
  const time = scheduled.toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const submitContacted = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      toast.error("Please add a note before marking as contacted.");
      return;
    }
    setBusy("contact");
    try {
      await queueApi.contactAbsent(entry.appointmentId, trimmed);
      toast.success("Marked as contacted");
      onContacted?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark as contacted");
    } finally {
      setBusy("none");
    }
  };

  const submitNoShow = async () => {
    setBusy("no-show");
    try {
      // Keep the QueueEntry status as ABSENT; bump the underlying
      // Appointment.status to NO_SHOW so the existing no-show analytics
      // path (CSAT skip, retention checklist) kicks in.
      await apiClient.put(`/api/appointments/${entry.appointmentId}`, { status: "NO_SHOW" });
      toast.success("Marked as no-show");
      onNoShow?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark as no-show");
    } finally {
      setBusy("none");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact absent patient</DialogTitle>
          <DialogDescription>
            {patient?.fullName || "Patient"} — scheduled {time}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Phone</span>
              <span className="text-sm font-medium">{phone || "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Doctor</span>
              <span className="text-sm font-medium">{entry.doctor.fullName ? `Dr. ${entry.doctor.fullName}` : "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Queue position</span>
              <span className="text-sm font-medium">#{entry.queuePosition}</span>
            </div>
          </div>

          {phone && (
            <a href={`tel:${phone}`} className="block">
              <Button variant="outline" className="w-full" type="button">
                <Phone className="w-4 h-4 mr-2" /> Call {phone}
              </Button>
            </a>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="contactNote" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Contact note <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="contactNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Called patient — arriving in 20 minutes. Or: Patient cancelled — needs reschedule."
              className="min-h-[80px] text-sm"
              maxLength={500}
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground text-right">{note.length}/500</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50"
            type="button"
            onClick={submitNoShow}
            disabled={busy !== "none"}
          >
            {busy === "no-show" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserX className="w-4 h-4 mr-2" />}
            Mark as No-Show
          </Button>
          <Button
            type="button"
            onClick={submitContacted}
            disabled={busy !== "none" || !note.trim()}
            className="w-full sm:w-auto"
          >
            {busy === "contact" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
            Mark as Contacted
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AbsentContactModal;
