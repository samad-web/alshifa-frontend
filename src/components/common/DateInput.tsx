// DateInput — text-only DD/MM/YYYY field used everywhere we used to mount
// a calendar picker. Auto-formats as the user types (digits → "DD/MM/YYYY"),
// validates on blur, and surfaces inline errors. The stored value is always
// the DD/MM/YYYY string, never a Date object — call sites convert with the
// `toISOFromDDMMYYYY` helper below before sending to the API.

import { forwardRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface DateInputProps {
  /** Stored as DD/MM/YYYY string. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
  /** External error (e.g. server validation). Takes precedence over internal blur errors. */
  error?: string;
  /** DD/MM/YYYY — entered date must be ≥ minDate. */
  minDate?: string;
  /** DD/MM/YYYY — entered date must be ≤ maxDate. */
  maxDate?: string;
  id?: string;
  name?: string;
  /** ARIA attributes pass-through. */
  "aria-describedby"?: string;
}

const DDMMYYYY_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function parseDDMMYYYY(input: string): Date | null {
  const m = DDMMYYYY_RE.exec(input);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  // Use UTC midnight so the round-trip (string → Date → string) doesn't drift
  // by a day across timezones.
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  // Reject overflow dates like 31/02/2026 → JS would silently roll forward.
  if (
    d.getUTCFullYear() !== yyyy ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  ) {
    return null;
  }
  return d;
}

/**
 * Convert a DD/MM/YYYY string to ISO 8601 (UTC midnight). Returns null when
 * the input is missing or invalid. Use this in form submit handlers before
 * sending to the API; never persist Date objects directly.
 */
export function toISOFromDDMMYYYY(value: string | undefined | null): string | null {
  if (!value) return null;
  const d = parseDDMMYYYY(value);
  return d ? d.toISOString() : null;
}

/**
 * Format an ISO date string (or Date) back into DD/MM/YYYY for editing.
 * Used when the form prefills from an existing record.
 */
export function toDDMMYYYY(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  {
    value,
    onChange,
    placeholder = "DD/MM/YYYY",
    disabled,
    className,
    label,
    required,
    error,
    minDate,
    maxDate,
    id,
    name,
    "aria-describedby": ariaDescribedBy,
  },
  ref,
) {
  const [blurError, setBlurError] = useState<string | null>(null);
  const inputId = id ?? name ?? (label ? `date-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
    if (v.length >= 6) v = v.slice(0, 5) + "/" + v.slice(5);
    v = v.slice(0, 10);
    onChange(v);
    if (blurError) setBlurError(null);
  };

  const handleBlur = () => {
    if (!value) {
      setBlurError(null);
      return;
    }
    const parsed = parseDDMMYYYY(value);
    if (!parsed) {
      setBlurError("Enter a valid date in DD/MM/YYYY format");
      return;
    }
    if (minDate) {
      const min = parseDDMMYYYY(minDate);
      if (min && parsed.getTime() < min.getTime()) {
        setBlurError(`Date must be on or after ${minDate}`);
        return;
      }
    }
    if (maxDate) {
      const max = parseDDMMYYYY(maxDate);
      if (max && parsed.getTime() > max.getTime()) {
        setBlurError(`Date must be on or before ${maxDate}`);
        return;
      }
    }
    setBlurError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow digits, "/", and standard editing keys. Block letters and other
    // punctuation up front so users can't even type them.
    const k = e.key;
    if (k.length === 1 && !/[\d/]/.test(k)) {
      e.preventDefault();
    }
  };

  const shownError = error ?? blurError;

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <Label htmlFor={inputId} className="text-sm">
          {label}
          {required && <span className="text-rose-600 ml-0.5">*</span>}
        </Label>
      )}
      <Input
        ref={ref}
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value ?? ""}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={10}
        aria-invalid={!!shownError || undefined}
        aria-describedby={ariaDescribedBy}
        className={cn(shownError && "border-rose-500 focus-visible:ring-rose-500")}
      />
      {shownError && (
        <p className="text-xs text-rose-600">{shownError}</p>
      )}
    </div>
  );
});
