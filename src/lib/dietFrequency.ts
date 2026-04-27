/**
 * Diet meal "frequency per day" helpers.
 *
 * `DietMeal.instructions` is a free-form String column on the schema. Rather
 * than ship a migration to add a frequency column, we encode the value as a
 * leading "Frequency: N×/day - …" prefix so the form input round-trips.
 *
 * Keep this contract stable — both writers (DietPrescriptions form submit)
 * and readers (PatientDiet display, edit-package round-trip) depend on it.
 */
const FREQ_PREFIX_RE = /^Frequency:\s*(\d+)x\/day(?:\s*[-—]\s*)?/i;

export function clampFrequency(n: number): number {
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(50, Math.floor(n)));
}

/**
 * Encode a numeric frequency + free-text instructions into the persisted
 * instruction string. Returns undefined when both are empty so we don't
 * write empty rows.
 */
export function composeInstructions(frequency: number, raw: string | null | undefined): string | undefined {
    const f = clampFrequency(frequency);
    const tail = (raw || "").trim();
    if (f <= 1 && !tail) return undefined;
    if (f <= 1) return tail;
    return tail ? `Frequency: ${f}x/day - ${tail}` : `Frequency: ${f}x/day`;
}

/** Inverse of `composeInstructions` — pull frequency back out of stored text. */
export function extractFrequency(stored: string | null | undefined): { frequency: number; instructions: string } {
    if (!stored) return { frequency: 1, instructions: "" };
    const m = stored.match(FREQ_PREFIX_RE);
    if (!m) return { frequency: 1, instructions: stored };
    const f = clampFrequency(Number(m[1]));
    return { frequency: f, instructions: stored.slice(m[0].length).trim() };
}
