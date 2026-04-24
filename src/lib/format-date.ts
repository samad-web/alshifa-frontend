/**
 * Centralised date formatting — Indian locale, DD/MM/YYYY.
 *
 * All clinical date displays in the app should route through these helpers so
 * the format is consistent regardless of the browser's OS locale. Using the
 * browser default would render DD/MM on en-IN hosts but MM/DD on en-US hosts,
 * which confuses clinicians reviewing a patient's history across devices.
 */

type DateInput = Date | string | number | null | undefined;

function toDate(input: DateInput): Date | null {
    if (input === null || input === undefined || input === "") return null;
    const d = input instanceof Date ? input : new Date(input);
    return isNaN(d.getTime()) ? null : d;
}

/** "22/04/2026" — zero-padded DD/MM/YYYY. Fallback returned for invalid input. */
export function fmtDate(input: DateInput, fallback = "—"): string {
    const d = toDate(input);
    if (!d) return fallback;
    return d.toLocaleDateString("en-IN", {
        day:   "2-digit",
        month: "2-digit",
        year:  "numeric",
    });
}

/** "Wed, 22 Apr" — short day + date, useful for inline "ends on" previews. */
export function fmtShortDate(input: DateInput, fallback = "—"): string {
    const d = toDate(input);
    if (!d) return fallback;
    return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day:     "numeric",
        month:   "short",
    });
}

/** "22/04/2026, 14:30" — DD/MM/YYYY + 24-hour time. */
export function fmtDateTime(input: DateInput, fallback = "—"): string {
    const d = toDate(input);
    if (!d) return fallback;
    return `${fmtDate(d)}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}
