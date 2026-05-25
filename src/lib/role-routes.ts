/**
 * Canonical "where does this role live" mapping.
 *
 * Mirrors the route paths registered in App.tsx and the role-aware
 * navigation already used by NotificationPanel.tsx, so post-action
 * redirects land users on the dashboard their role actually has access to
 * (a DOCTOR sent to `/therapist` would just be bounced by the role guard).
 */

export type UserRole =
    | "ADMIN"
    | "ADMIN_DOCTOR"
    | "DOCTOR"
    | "THERAPIST"
    | "PATIENT"
    | string
    | null
    | undefined;

export function roleToDashboard(role: UserRole): string {
    switch (role) {
        case "ADMIN_DOCTOR": return "/doctor-admin";
        case "ADMIN":        return "/admin";
        case "THERAPIST":    return "/therapist";
        case "DOCTOR":       return "/doctor";
        case "PATIENT":      return "/patient";
        default:             return "/";
    }
}
