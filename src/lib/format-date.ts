/**
 * Centralised date formatting — Indian locale, DD/MM/YYYY.
 *
 * All clinical date displays in the app should route through these helpers so
 * the format is consistent regardless of the browser's OS locale. Using the
 * browser default would render DD/MM on en-IN hosts but MM/DD on en-US hosts,
 * which confuses clinicians reviewing a patient's history across devices.
 *
 * Public surface (use these from components):
 *   formatDate(input)       → "22/04/2026"
 *   formatDateTime(input)   → "22/04/2026, 14:30"
 *   formatShortDate(input)  → "Wed, 22 Apr"
 *   formatDateRange(a, b)   → "22/04/2026 → 25/04/2026"
 *   toIsoDate(input)        → "2026-04-22" (for <input type="date">)
 *
 * Legacy aliases (`fmtDate`, `fmtDateTime`, `fmtShortDate`) are re-exported
 * to avoid touching every existing call site in this round.
 */

export type DateInput = Date | string | number | null | undefined;

function toDate(input: DateInput): Date | null {
    if (input === null || input === undefined || input === "") return null;
    const d = input instanceof Date ? input : new Date(input);
    return isNaN(d.getTime()) ? null : d;
}

/** "22/04/2026" — zero-padded DD/MM/YYYY. Fallback returned for invalid input. */
export function formatDate(input: DateInput, fallback = "—"): string {
    const d = toDate(input);
    if (!d) return fallback;
    // Force `en-GB` so the platform default never silently flips to MM/DD/YYYY
    // on en-US hosts. en-IN also returns DD/MM but uses non-ASCII separators
    // on some platforms — en-GB is the safest "DD/MM/YYYY with slashes" pick.
    return d.toLocaleDateString("en-GB", {
        day:   "2-digit",
        month: "2-digit",
        year:  "numeric",
    });
}

/** "Wed, 22 Apr" — short day + date, useful for inline "ends on" previews. */
export function formatShortDate(input: DateInput, fallback = "—"): string {
    const d = toDate(input);
    if (!d) return fallback;
    return d.toLocaleDateString("en-GB", {
        weekday: "short",
        day:     "numeric",
        month:   "short",
    });
}

/** "22/04/2026, 14:30" — DD/MM/YYYY + 24-hour time. */
export function formatDateTime(input: DateInput, fallback = "—"): string {
    const d = toDate(input);
    if (!d) return fallback;
    return `${formatDate(d)}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

/** "5:30 PM" — 12-hour clock with am/pm, en-IN. Used for appointment times. */
export function formatTime(input: DateInput, fallback = "—"): string {
    const d = toDate(input);
    if (!d) return fallback;
    return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** "22/04/2026 → 25/04/2026" — date range (single date if start === end). */
export function formatDateRange(start: DateInput, end: DateInput, fallback = ""): string {
    const s = formatDate(start, "");
    const e = formatDate(end, "");
    if (!s && !e) return fallback;
    if (!e || s === e) return s;
    return `${s} → ${e}`;
}

/** ISO yyyy-MM-dd suitable for `<input type="date">` value bindings. */
export function toIsoDate(input: DateInput): string {
    const d = toDate(input);
    if (!d) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Expiry tone helper used by inventory / prescription / dispense surfaces.
 *   "expired"   → expiryDate already in the past
 *   "expiring"  → within `withinDays` (default 30)
 *   "ok"        → fresher than that
 *   null        → no date supplied
 *
 * Components use this to colour expiry chips amber for "expiring" and
 * red for "expired" without having to repeat the comparison logic.
 */
export type ExpiryTone = "expired" | "expiring" | "ok" | null;
export function expiryTone(input: DateInput, withinDays = 30): ExpiryTone {
    const d = toDate(input);
    if (!d) return null;
    const now = Date.now();
    if (d.getTime() <= now) return "expired";
    const ms = withinDays * 24 * 60 * 60 * 1000;
    return d.getTime() - now <= ms ? "expiring" : "ok";
}

// ── Legacy aliases ───────────────────────────────────────────────────────────
// Keep the old fmt* names alive so the existing call sites compile while the
// rest of the codebase migrates to the new formatDate/formatDateTime names.
export const fmtDate      = formatDate;
export const fmtShortDate = formatShortDate;
export const fmtDateTime  = formatDateTime;
