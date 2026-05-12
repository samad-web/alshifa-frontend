// DatePicker — text-only DD/MM/YYYY input (no calendar popover).
//
// Per platform decision: every date field across IWIS uses a plain text
// input with DD/MM/YYYY format. This file used to wrap react-day-picker;
// it now delegates entirely to <DateInput> while preserving the original
// `value: string (yyyy-MM-dd)` / `onChange(yyyy-MM-dd)` contract so the
// 18+ consumer pages keep working without per-file edits.

import { useEffect, useMemo, useState } from "react";
import { DateInput } from "@/components/common/DateInput";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** ISO `yyyy-MM-dd` string (matches the native `<input type="date">` value shape). */
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Min selectable date — mapped to DateInput's minDate (DD/MM/YYYY). */
  fromDate?: Date;
  /** Max selectable date — mapped to DateInput's maxDate. */
  toDate?: Date;
  /** Retained for backwards-compat with old call sites. Ignored — display
   *  format is always DD/MM/YYYY now. */
  displayFormat?: string;
  required?: boolean;
  id?: string;
}

function isoToDDMM(iso: string | undefined): string {
  if (!iso) return "";
  // Accept either "yyyy-MM-dd" or full ISO "yyyy-MM-ddTHH:mm:ss.sssZ".
  // Strip the time portion so the day component splits cleanly.
  const dateOnly = iso.split("T")[0];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!m) return "";
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

function ddmmToIso(ddmm: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmm);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function dateToDDMM(d: Date | undefined): string | undefined {
  if (!d) return undefined;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Drop-in replacement for the legacy calendar-popover DatePicker. Keeps
 * the same yyyy-MM-dd string I/O — call sites need zero changes.
 */
export function DatePicker({
  value, onChange,
  className, disabled, fromDate, toDate,
  required, id,
}: DatePickerProps) {
  // Local draft holds the in-progress DD/MM/YYYY string while the user is
  // typing partials ("12", "12/0", "12/03/202"). The previous version derived
  // the input's display directly from the parent's ISO value via useMemo and
  // only emitted upstream once 10 chars were entered — but DateInput is fully
  // controlled, so until the value completed, parent stayed empty, the derived
  // ddmmValue stayed "", and DateInput rendered an empty input on every
  // keystroke. The user literally couldn't enter anything.
  //
  // Owning the draft locally fixes that: DateInput renders the partial as
  // the user types, and we forward complete dates upstream when ready.
  const [draft, setDraft] = useState(() => isoToDDMM(value));
  const minDDMM = useMemo(() => dateToDDMM(fromDate), [fromDate]);
  const maxDDMM = useMemo(() => dateToDDMM(toDate), [toDate]);

  // Sync draft from parent on EXTERNAL changes only (form reset, API
  // prefill). During typing, parent.value doesn't change for partial input
  // because we don't emit, so this effect only fires when the parent's
  // value genuinely diverges from the current draft.
  useEffect(() => {
    setDraft(isoToDDMM(value));
  }, [value]);

  return (
    <DateInput
      id={id}
      value={draft}
      onChange={(v) => {
        setDraft(v);
        // Only emit a finished value upstream — partial typing ("12/")
        // shouldn't surface to consumers expecting yyyy-MM-dd. Empty
        // string also forwards so consumers can detect clearing.
        if (v === "" || /^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
          onChange(v ? ddmmToIso(v) : "");
        }
      }}
      placeholder="DD/MM/YYYY"
      disabled={disabled}
      required={required}
      minDate={minDDMM}
      maxDate={maxDDMM}
      className={cn(className)}
    />
  );
}
