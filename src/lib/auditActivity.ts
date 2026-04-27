/**
 * Helpers for the AdminDashboard "Recent Updates" feed.
 *
 * Pure functions extracted from AdminDashboard.tsx so they can be unit-tested
 * in isolation. Keep them dependency-free — no React, no fetch, no DOM.
 */

export interface ActivityFeedItem {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
    actor: { id: string | null; name: string | null; role: string };
}

/**
 * Map raw audit-log actions to friendly verb/subject strings. Anything not
 * listed falls through to a snake-case-stripped default so new event types
 * still render gracefully.
 */
export function describeActivity(it: ActivityFeedItem): { verb: string; subject: string } {
    const a = it.action || "";
    const t = it.entityType || "";
    if (a === "CREATE_USER")               return { verb: "added a new user",          subject: "User" };
    if (a === "UPDATE_USER")               return { verb: "updated user profile",      subject: "User" };
    if (a === "DELETE_USER")               return { verb: "removed a user",            subject: "User" };
    if (a.startsWith("CREATE_PRESCRIPTION")) return { verb: "issued a prescription",   subject: "Prescription" };
    if (a.startsWith("UPDATE_PRESCRIPTION")) return { verb: "updated a prescription",  subject: "Prescription" };
    if (a.startsWith("UPDATE_APPOINTMENT")) return { verb: "updated appointment",     subject: t || "Appointment" };
    if (a.startsWith("CREATE_APPOINTMENT")) return { verb: "booked an appointment",   subject: "Appointment" };
    if (a === "CANCEL_APPOINTMENT")        return { verb: "cancelled an appointment", subject: "Appointment" };
    if (a === "DIET_PLAN_ASSIGNED")        return { verb: "assigned a diet plan",     subject: "Diet" };
    if (a === "JOURNEY_ACTIVATED")         return { verb: "activated a journey",      subject: "Journey" };
    return { verb: a.toLowerCase().replace(/_/g, " "), subject: t || "Event" };
}

/**
 * Format an ISO timestamp as a relative phrase ("2m ago", "3h ago", "5d ago",
 * else date string). Bound to the system clock — pass `now` for tests.
 */
export function formatRelative(iso: string, now: number = Date.now()): string {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    const diffMs = now - t;
    const min = Math.round(diffMs / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.round(hr / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
}
