/**
 * Doctor/Therapist name display normalizer.
 *
 * `Doctor.fullName` is stored inconsistently — some rows include a `Dr.`
 * prefix in the value itself (`"Dr. Rahman"`), others don't (`"E2E Test
 * Doctor"`). Naively rendering ``Dr. ${fullName}`` produces `"Dr. Dr. Rahman"`.
 *
 * `formatClinicianName` strips any leading `Dr.\s+` and re-applies the
 * prefix for doctors, so the rendered string is exactly one `Dr.` regardless
 * of how the row was entered. Therapists never get a `Dr.` prefix.
 */

export function formatClinicianName(
    name: string | null | undefined,
    opts: { isDoctor: boolean } = { isDoctor: false },
): string {
    if (!name) return "—";
    const stripped = name.replace(/^\s*dr\.?\s+/i, "").trim();
    if (!stripped) return "—";
    return opts.isDoctor ? `Dr. ${stripped}` : stripped;
}
