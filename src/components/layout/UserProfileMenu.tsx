/**
 * UserProfileMenu
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays the authenticated user's avatar, display name, and role in a
 * dropdown trigger.  The dropdown provides:
 *   • A labelled header (name + role)
 *   • "View Profile" → navigates to the user's role dashboard
 *   • "Sign Out" → clears auth and redirects to /login
 *
 * All data is sourced directly from useAuth() — no mock data.
 * The component is self-contained and renders nothing when the user is not
 * authenticated.
 */

import { useNavigate } from "react-router-dom";
import { LogOut, UserCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the display name from the nested role-specific profile object. */
function getDisplayName(profile: any, role: AppRole | null): string {
  if (!profile) return "User";

  if (role === "DOCTOR" || role === "ADMIN_DOCTOR") {
    return profile.doctor?.fullName ?? profile.email ?? "Doctor";
  }
  if (role === "THERAPIST") {
    return profile.therapist?.fullName ?? profile.email ?? "Therapist";
  }
  if (role === "PATIENT") {
    return profile.patient?.fullName ?? profile.email ?? "Patient";
  }
  if (role === "PHARMACIST") {
    return profile.pharmacist?.fullName ?? profile.email ?? "Pharmacist";
  }
  if (role === "ADMIN") {
    return profile.email ?? "Admin";
  }

  return profile.email ?? "User";
}

/** Extract the profile photo URL (stored on the role sub-profile, not on User). */
function getProfilePhoto(profile: any, role: AppRole | null): string | null {
  if (!profile) return null;
  if (role === "DOCTOR" || role === "ADMIN_DOCTOR") {
    return profile.doctor?.profilePhoto ?? null;
  }
  if (role === "THERAPIST") {
    return profile.therapist?.profilePhoto ?? null;
  }
  if (role === "PHARMACIST") {
    return profile.pharmacist?.profilePhoto ?? null;
  }
  return null;
}

/** Generate two-letter initials from a display name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Human-readable role label. */
const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Admin",
  ADMIN_DOCTOR: "Admin Doctor",
  DOCTOR: "Doctor",
  THERAPIST: "Therapist",
  PATIENT: "Patient",
  PHARMACIST: "Pharmacist",
};

/** Primary dashboard path for the role — used as the "View Profile" destination. */
function getRoleDashboardPath(role: AppRole | null): string {
  switch (role) {
    case "ADMIN":       return "/admin";
    case "ADMIN_DOCTOR": return "/doctor-admin";
    case "DOCTOR":      return "/doctor";
    case "THERAPIST":   return "/therapist";
    case "PATIENT":     return "/patient";
    case "PHARMACIST":  return "/pharmacy";
    default:            return "/";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface UserProfileMenuProps {
  /** Extra classes applied to the trigger button wrapper. */
  className?: string;
}

export function UserProfileMenu({ className }: UserProfileMenuProps) {
  const { user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Render nothing when not authenticated (navigation also guards this, but be safe).
  if (!user) return null;

  const displayName   = getDisplayName(profile, role);
  const photoUrl      = getProfilePhoto(profile, role);
  const initials      = getInitials(displayName);
  const roleLabel     = role ? ROLE_LABELS[role] : "";
  const dashboardPath = getRoleDashboardPath(role);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
            "hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          aria-label="User profile menu"
        >
          <Avatar className="h-8 w-8 shrink-0">
            {photoUrl && <AvatarImage src={photoUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Name + role — hidden on very small screens to keep the top bar tidy */}
          <div className="hidden sm:flex flex-col items-start leading-none">
            <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
              {displayName}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">{roleLabel}</span>
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* Header — always shows full name + role even on mobile where the
            trigger text is hidden */}
        <DropdownMenuLabel className="flex flex-col gap-0.5 pb-2">
          <span className="font-semibold text-foreground truncate">{displayName}</span>
          <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
          {roleLabel && (
            <span className="mt-1 inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {roleLabel}
            </span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 cursor-pointer"
          onClick={() => navigate(dashboardPath)}
        >
          <UserCircle2 className="h-4 w-4 text-muted-foreground" />
          View Profile
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
