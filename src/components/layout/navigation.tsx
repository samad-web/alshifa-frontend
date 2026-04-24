import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Stethoscope,
  User,
  Heart,
  Activity,
  Menu,
  X,
  LogOut,
  FilePlus2,
  CalendarDays,
  Package,
  ShoppingCart,
  History,
  MessageSquare,
  Building2,
  BarChart3,
  Trophy,
  Users,
  Megaphone,
  Phone,
  ArrowRightLeft,
  ClipboardCheck,
  Clock,
  Shield,
  Sparkles,
  Swords,
  Gift,
  GraduationCap,
  Star,
  Map,
  Flame,
  Lock,
  Home,
  FileText,
  Sprout,
  Briefcase,
  ChevronDown,
  DoorOpen,
  Salad,
  Camera,
  ImageIcon,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import { BranchScopeSwitcher } from "@/components/layout/BranchScopeSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavLeaf = { path: string; label: string; icon: LucideIcon; featureKey?: string };
type NavGroup = { label: string; icon: LucideIcon; items: NavLeaf[]; featureKey?: string };
type NavEntry = NavLeaf | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup =>
  (entry as NavGroup).items !== undefined;

/**
 * Path → FeatureRegistry key map. Nav items whose path (or one of a group's item
 * paths) appears here will be hidden when the tenant has disabled the feature in
 * the Super Admin console. Items without a mapping always show.
 */
const PATH_TO_FEATURE: Record<string, string> = {
  // IWIS competitor features
  "/therapy-rooms":       "THERAPY_ROOM_MANAGEMENT",
  "/treatment-packages":  "TREATMENT_PACKAGES",
  "/group-sessions":      "GROUP_SESSIONS",
  "/therapist-match":     "THERAPIST_SKILL_MATCHING",
  "/clinical-photos":     "CLINICAL_PHOTOS",
  "/diet-prescriptions":  "DIET_PRESCRIPTION",
  "/diet-packages":       "DIET_PRESCRIPTION",
  "/my-diet":             "DIET_PRESCRIPTION",
  "/self-exam":           "SELF_EXAM_PROTOCOL",
  "/self-exam-review":    "SELF_EXAM_PROTOCOL",
  "/self-exam-protocols": "SELF_EXAM_PROTOCOL",
  // Operations
  "/resource-sharing":        "RESOURCE_SHARING",
  "/centralized-inventory":   "CENTRALIZED_INVENTORY",
  "/staff-activity":          "STAFF_ACTIVITY_FEED",
  "/performance-scorecards":  "PERFORMANCE_SCORECARDS",
  "/attendance":              "STAFF_ATTENDANCE",
  "/staff-schedule":          "STAFF_ATTENDANCE",
  "/skill-matrix":            "STAFF_SKILL_MATRIX",
  // Clinician gamification
  "/xp-dashboard":         "CLINICIAN_XP",
  "/seasonal-challenges":  "SEASONAL_CHALLENGES",
  "/achievement-showcase": "ACHIEVEMENT_SHOWCASE",
  "/reward-store":         "REWARD_STORE",
  "/mentor-hub":           "MENTOR_SESSIONS",
  // Patient gamification
  "/health-quests":       "HEALTH_QUESTS",
  "/health-avatar":       "HEALTH_AVATAR",
  "/family-leaderboard":  "FAMILY_LEADERBOARD",
  "/referral-rewards":    "REFERRAL_TIERS",
  "/social-proof":        "SOCIAL_PROOF",
  "/health-content":      "UNLOCKABLE_CONTENT",
  // Communication & portal
  "/announcements":  "ANNOUNCEMENTS",
  "/handoff-notes":  "HANDOFF_NOTES",
  "/visit-summary":  "VISIT_SUMMARY",
  "/message-templates": "MESSAGING_TEMPLATES",
  "/reminder-settings": "MESSAGING_TEMPLATES",
  "/critical-journey":  "CRITICAL_JOURNEY_DASHBOARD",
};

/**
 * Match the current pathname against a nav leaf's path. Exact match for
 * top-level entries like "/" or "/chat"; otherwise prefix match so deep
 * sub-routes (e.g. `/pharmacy/orders/123`) still highlight their parent
 * nav entry (`/pharmacy/orders`).
 */
function pathMatchesNav(pathname: string, navPath: string): boolean {
  if (navPath === "/") return pathname === "/";
  if (pathname === navPath) return true;
  return pathname.startsWith(navPath + "/");
}

/**
 * When multiple nav leaves prefix-match the pathname (e.g. `/pharmacy` and
 * `/pharmacy/orders` both match `/pharmacy/orders`), pick the longest — so
 * only the most-specific entry lights up as active.
 */
function bestMatchingPath(pathname: string, paths: string[]): string | null {
  let best: string | null = null;
  for (const p of paths) {
    if (!pathMatchesNav(pathname, p)) continue;
    if (best === null || p.length > best.length) best = p;
  }
  return best;
}

/**
 * Filter nav items by the tenant's enabled feature set. Disabled features are
 * removed from nav entirely; direct URL access still hits the route but is
 * caught by <FeatureGate> which renders the "contact admin to upgrade" screen.
 */
function filterNavByFeatures(items: NavEntry[], has: (key: string) => boolean): NavEntry[] {
  return items
    .map((entry) => {
      if (isGroup(entry)) {
        const keptItems = entry.items.filter((leaf) => {
          const key = PATH_TO_FEATURE[leaf.path];
          return !key || has(key);
        });
        // Collapse the group entirely if every item got filtered out.
        return keptItems.length ? { ...entry, items: keptItems } : null;
      }
      const key = PATH_TO_FEATURE[entry.path];
      return !key || has(key) ? entry : null;
    })
    .filter((e): e is NavEntry => e !== null);
}

// Role-based grouped navigation. Top-level entries are either direct links
// or dropdown groups that collapse related destinations.
const getRoleNavItems = (role: AppRole | null): NavEntry[] => {
  switch (role) {
    case "ADMIN":
      return [
        { path: "/admin", label: "Dashboard", icon: Stethoscope },
        { path: "/appointments", label: "Appointments", icon: CalendarDays },
        {
          label: "Clinical",
          icon: FilePlus2,
          items: [
            { path: "/create-user", label: "Create User", icon: User },
            { path: "/manage-users", label: "Manage Users", icon: Users },
            { path: "/assign-patient", label: "Assign Patient", icon: User },
            { path: "/prescriptions", label: "Prescriptions", icon: FilePlus2 },
            { path: "/diet-packages", label: "Diet Package Reviews", icon: Salad },
            { path: "/self-exam-review", label: "Self-Exam Review", icon: ClipboardList },
          ],
        },
        {
          label: "Ayurveda",
          icon: Sprout,
          items: [
            { path: "/therapy-rooms", label: "Therapy Rooms", icon: DoorOpen },
            { path: "/treatment-packages", label: "Packages", icon: Package },
            { path: "/group-sessions", label: "Group Sessions", icon: Users },
            { path: "/therapist-match", label: "Match Therapist", icon: Sparkles },
            { path: "/clinical-photos", label: "Clinical Photos", icon: Camera },
          ],
        },
        {
          label: "Staff",
          icon: Users,
          items: [
            { path: "/branch-management", label: "Branches", icon: Building2 },
            { path: "/staff-activity", label: "Staff Activity", icon: Users },
            { path: "/performance-scorecards", label: "Scorecards", icon: ClipboardCheck },
            { path: "/staff-schedule", label: "Schedule", icon: CalendarDays },
            { path: "/skill-matrix", label: "Skill Matrix", icon: Shield },
          ],
        },
        {
          label: "Pharmacy",
          icon: Package,
          items: [
            { path: "/pharmacy", label: "Pharmacy Dashboard", icon: Stethoscope },
            { path: "/pharmacy/orders", label: "Orders", icon: ShoppingCart },
            { path: "/pharmacy/inventory", label: "Inventory", icon: Package },
            { path: "/pharmacy/dispense", label: "Dispense", icon: ShoppingCart },
            { path: "/pharmacy/history", label: "History", icon: History },
          ],
        },
        {
          label: "Operations",
          icon: Briefcase,
          items: [
            { path: "/resource-sharing", label: "Resource Sharing", icon: ArrowRightLeft },
            { path: "/centralized-inventory", label: "Inventory HQ", icon: Package },
            { path: "/announcements", label: "Announcements", icon: Megaphone },
            { path: "/self-exam-protocols", label: "Self-Exam Protocol", icon: ClipboardList },
            { path: "/message-templates", label: "Message Templates", icon: MessageSquare },
            { path: "/reminder-settings", label: "Daily Reminders", icon: CalendarDays },
            { path: "/critical-journey", label: "Critical Journey", icon: HeartPulse },
          ],
        },
        {
          label: "Engagement",
          icon: Trophy,
          items: [
            { path: "/doctor-gamification", label: "Gamification", icon: Activity },
            { path: "/gamification-analytics", label: "Analytics", icon: Trophy },
            { path: "/reward-store", label: "Reward Store", icon: Gift },
          ],
        },
        { path: "/reports", label: "Reports", icon: BarChart3 },
        { path: "/chat", label: "Chat", icon: MessageSquare },
        { path: "/staff-chat", label: "Team Chat", icon: Users },
      ];
    case "ADMIN_DOCTOR":
      return [
        { path: "/doctor-admin", label: "Dashboard", icon: Stethoscope },
        { path: "/appointments", label: "Appointments", icon: CalendarDays },
        {
          label: "Clinical",
          icon: FilePlus2,
          items: [
            { path: "/doctor", label: "My Patients", icon: User, section: "Patients" },
            { path: "/assign-patient", label: "Assign Patient", icon: User, section: "Patients" },
            { path: "/create-user", label: "Create User", icon: User, section: "Users" },
            { path: "/manage-users", label: "Manage Users", icon: Users, section: "Users" },
            { path: "/prescriptions", label: "Prescriptions", icon: FilePlus2, section: "Records" },
            { path: "/diet-prescriptions", label: "Diet Plans", icon: Salad, section: "Records" },
            { path: "/diet-packages", label: "Diet Package Reviews", icon: Salad, section: "Records" },
            { path: "/journey-builder", label: "Journey Builder", icon: Map, section: "Records" },
            { path: "/handoff-notes", label: "Handoff Notes", icon: FileText, section: "Records" },
            { path: "/visit-summary", label: "Visit Summary", icon: ClipboardCheck, section: "Records" },
            { path: "/self-exam-review", label: "Self-Exam Review", icon: ClipboardList, section: "Records" },
          ],
        },
        {
          label: "Ayurveda",
          icon: Sprout,
          items: [
            { path: "/therapy-rooms", label: "Therapy Rooms", icon: DoorOpen },
            { path: "/treatment-packages", label: "Packages", icon: Package },
            { path: "/group-sessions", label: "Group Sessions", icon: Users },
            { path: "/therapist-match", label: "Match Therapist", icon: Sparkles },
            { path: "/clinical-photos", label: "Clinical Photos", icon: Camera },
          ],
        },
        {
          label: "Admin",
          icon: Briefcase,
          items: [
            { path: "/branch-management", label: "Branches", icon: Building2, section: "Staff" },
            { path: "/staff-activity", label: "Staff Activity", icon: Users, section: "Staff" },
            { path: "/performance-scorecards", label: "Scorecards", icon: ClipboardCheck, section: "Staff" },
            { path: "/staff-schedule", label: "Schedule", icon: CalendarDays, section: "Staff" },
            { path: "/skill-matrix", label: "Skill Matrix", icon: Shield, section: "Staff" },
            { path: "/pharmacy", label: "Pharmacy Dashboard", icon: Stethoscope, section: "Pharmacy" },
            { path: "/pharmacy/orders", label: "Orders", icon: ShoppingCart, section: "Pharmacy" },
            { path: "/pharmacy/inventory", label: "Inventory", icon: Package, section: "Pharmacy" },
            { path: "/pharmacy/dispense", label: "Dispense", icon: ShoppingCart, section: "Pharmacy" },
            { path: "/pharmacy/history", label: "History", icon: History, section: "Pharmacy" },
            { path: "/resource-sharing", label: "Resource Sharing", icon: ArrowRightLeft, section: "Operations" },
            { path: "/centralized-inventory", label: "Inventory HQ", icon: Package, section: "Operations" },
            { path: "/announcements", label: "Announcements", icon: Megaphone, section: "Operations" },
            { path: "/self-exam-protocols", label: "Self-Exam Protocol", icon: ClipboardList, section: "Operations" },
            { path: "/message-templates", label: "Message Templates", icon: MessageSquare, section: "Operations" },
            { path: "/reminder-settings", label: "Daily Reminders", icon: CalendarDays, section: "Operations" },
            { path: "/critical-journey", label: "Critical Journey", icon: HeartPulse, section: "Operations" },
          ],
        },
        // Admin doctor supervises the gamification program without
        // participating — all oversight surfaces are included here so they
        // have full visibility into XP, challenges, rewards, leaderboards,
        // and achievements of the clinicians they manage.
        {
          label: "Engagement",
          icon: Trophy,
          items: [
            { path: "/xp-dashboard", label: "XP & Level", icon: Sparkles },
            { path: "/seasonal-challenges", label: "Challenges", icon: Swords },
            { path: "/reward-store", label: "Rewards", icon: Gift },
            { path: "/mentor-hub", label: "Mentoring", icon: GraduationCap },
            { path: "/doctor-gamification", label: "Leaderboard", icon: Activity },
            { path: "/gamification-analytics", label: "Analytics", icon: Trophy },
          ],
        },
        {
          label: "More",
          icon: BarChart3,
          items: [
            { path: "/reports", label: "Reports", icon: BarChart3 },
            { path: "/chat", label: "Chat", icon: MessageSquare },
            { path: "/staff-chat", label: "Team Chat", icon: Users },
          ],
        },
      ];
    case "DOCTOR":
      return [
        { path: "/doctor", label: "Dashboard", icon: User },
        { path: "/appointments", label: "Appointments", icon: CalendarDays },
        {
          label: "Clinical",
          icon: FilePlus2,
          items: [
            { path: "/prescriptions", label: "Prescriptions", icon: FilePlus2 },
            { path: "/diet-prescriptions", label: "Diet Plans", icon: Salad },
            { path: "/diet-packages", label: "Diet Packages", icon: Salad },
            { path: "/journey-builder", label: "Journey Builder", icon: Map },
            { path: "/handoff-notes", label: "Handoff Notes", icon: FileText },
            { path: "/visit-summary", label: "Visit Summary", icon: ClipboardCheck },
            { path: "/self-exam-review", label: "Self-Exam Review", icon: ClipboardList },
            { path: "/message-templates", label: "Message Templates", icon: MessageSquare },
          ],
        },
        {
          label: "Ayurveda",
          icon: Sprout,
          items: [
            { path: "/clinical-photos", label: "Clinical Photos", icon: Camera },
            { path: "/treatment-packages", label: "Packages", icon: Package },
            { path: "/therapist-match", label: "Match Therapist", icon: Sparkles },
            { path: "/group-sessions", label: "Group Sessions", icon: Users },
          ],
        },
        {
          label: "Engagement",
          icon: Trophy,
          items: [
            { path: "/xp-dashboard", label: "XP & Level", icon: Sparkles },
            { path: "/seasonal-challenges", label: "Challenges", icon: Swords },
            { path: "/achievement-showcase", label: "Achievements", icon: Star },
            { path: "/reward-store", label: "Rewards", icon: Gift },
            { path: "/mentor-hub", label: "Mentoring", icon: GraduationCap },
            { path: "/doctor-gamification", label: "Leaderboard", icon: Activity },
          ],
        },
        {
          label: "Work",
          icon: Briefcase,
          items: [
            { path: "/staff-schedule", label: "Schedule", icon: CalendarDays },
          ],
        },
        { path: "/reports", label: "Reports", icon: BarChart3 },
        { path: "/chat", label: "Chat", icon: MessageSquare },
        { path: "/staff-chat", label: "Team Chat", icon: Users },
      ];
    case "THERAPIST":
      return [
        { path: "/therapist", label: "Today's Sittings", icon: Heart },
        { path: "/appointments", label: "Appointments", icon: CalendarDays },
        {
          label: "Clinical",
          icon: FilePlus2,
          items: [
            { path: "/prescriptions", label: "Prescriptions", icon: FilePlus2 },
            { path: "/diet-packages", label: "Diet Packages", icon: Salad },
            { path: "/journey-builder", label: "Journey Builder", icon: Map },
            { path: "/handoff-notes", label: "Handoff Notes", icon: FileText },
            { path: "/visit-summary", label: "Visit Summary", icon: ClipboardCheck },
          ],
        },
        {
          label: "Ayurveda",
          icon: Sprout,
          items: [
            { path: "/therapy-rooms", label: "Therapy Rooms", icon: DoorOpen },
            { path: "/group-sessions", label: "Group Sessions", icon: Users },
            { path: "/clinical-photos", label: "Clinical Photos", icon: Camera },
          ],
        },
        {
          label: "Engagement",
          icon: Trophy,
          items: [
            { path: "/xp-dashboard", label: "XP & Level", icon: Sparkles },
            { path: "/seasonal-challenges", label: "Challenges", icon: Swords },
            { path: "/achievement-showcase", label: "Achievements", icon: Star },
            { path: "/reward-store", label: "Rewards", icon: Gift },
            { path: "/mentor-hub", label: "Mentoring", icon: GraduationCap },
            { path: "/doctor-gamification", label: "Leaderboard", icon: Activity },
          ],
        },
        {
          label: "Work",
          icon: Briefcase,
          items: [
            { path: "/staff-schedule", label: "Schedule", icon: CalendarDays },
          ],
        },
        { path: "/reports", label: "Reports", icon: BarChart3 },
        { path: "/chat", label: "Chat", icon: MessageSquare },
        { path: "/staff-chat", label: "Team Chat", icon: Users },
      ];
    case "PATIENT":
      return [
        { path: "/patient", label: "Today", icon: Home },
        { path: "/patient-portal", label: "My Records", icon: ClipboardList },
        { path: "/appointments", label: "Appointments", icon: CalendarDays },
        {
          label: "Health",
          icon: Heart,
          items: [
            { path: "/self-exam", label: "Self-Exam Kit", icon: ClipboardList },
            { path: "/my-diet", label: "My Diet", icon: Salad },
            { path: "/clinical-photos", label: "My Photos", icon: ImageIcon },
            { path: "/group-sessions", label: "Group Sessions", icon: Users },
            { path: "/visit-summary", label: "Visit Summaries", icon: FileText },
          ],
        },
        {
          label: "Engagement",
          icon: Trophy,
          items: [
            { path: "/health-quests", label: "Quests", icon: Map },
            { path: "/health-avatar", label: "My Companion", icon: Sprout },
            { path: "/social-proof", label: "Streaks", icon: Flame },
            { path: "/health-content", label: "Content Library", icon: Lock },
          ],
        },
        { path: "/announcements", label: "Announcements", icon: Megaphone },
        { path: "/contact-clinics", label: "Contact Clinics", icon: Phone },
        { path: "/chat", label: "Chat", icon: MessageSquare },
      ];
    case "PHARMACIST":
      return [
        { path: "/pharmacy", label: "Dashboard", icon: Stethoscope },
        { path: "/pharmacy/orders", label: "Manage Orders", icon: ShoppingCart },
        { path: "/pharmacy/inventory", label: "Inventory", icon: Package },
        { path: "/pharmacy/dispense", label: "Dispense", icon: ShoppingCart },
        { path: "/pharmacy/history", label: "History", icon: History },
        { path: "/chat", label: "Chat", icon: MessageSquare },
        { path: "/staff-chat", label: "Team Chat", icon: Users },
      ];
    default:
      return [];
  }
};

/**
 * Desktop nav dropdown that opens on hover with a short grace period so the
 * user can move from the trigger to the menu without it closing. Click still
 * works (Radix flips `open` via `onOpenChange`, which we mirror to state).
 */
function HoverNavGroup({
  entry,
  active,
  pathname,
}: {
  entry: NavGroup;
  active: boolean;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openNow = () => {
    cancelClose();
    setOpen(true);
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const GroupIcon = entry.icon;

  // Pick the single best-matching leaf inside this group so prefix-matched
  // parents don't light up alongside their children (e.g. "/pharmacy" stays
  // dim when the user is on "/pharmacy/orders"). The trigger surfaces that
  // leaf's label so it's obvious which section-child you're in without
  // opening the dropdown.
  const activeLeafPath = bestMatchingPath(pathname, entry.items.map((i) => i.path));
  const activeLeaf = entry.items.find((i) => i.path === activeLeafPath) ?? null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        onPointerEnter={openNow}
        onPointerLeave={closeSoon}
        // Radix moves focus off the trigger when the menu opens — using
        // onFocus/onBlur here caused an open/close race. Intentionally omitted.
        className={cn(
          "relative flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap outline-none",
          // Active-group treatment: stronger background, accent foreground,
          // bolder weight, and an underline bar anchored to the bottom edge
          // so the current section is unmistakable even when the dropdown
          // is closed.
          active
            ? "bg-primary/15 text-primary font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-primary after:rounded-full"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
      >
        <GroupIcon className="h-4 w-4" />
        <span className="hidden lg:inline">
          {entry.label}
          {active && activeLeaf && (
            <span className="ml-1.5 text-xs font-normal opacity-80">
              · {activeLeaf.label}
            </span>
          )}
        </span>
        <span className="lg:hidden">{entry.label.split(" ")[0]}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={0}
        onPointerEnter={openNow}
        onPointerLeave={closeSoon}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="min-w-[13rem] max-h-[70vh] overflow-y-auto"
      >
        {entry.items.map((item, idx) => {
          const ItemIcon = item.icon;
          const isActive = item.path === activeLeafPath;
          const prev = idx > 0 ? entry.items[idx - 1] : null;
          const showSection = item.section && (!prev || prev.section !== item.section);
          return (
            <div key={item.path}>
              {showSection && (
                <>
                  {idx > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    {item.section}
                  </DropdownMenuLabel>
                </>
              )}
              <DropdownMenuItem asChild>
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 w-full cursor-pointer",
                    isActive && "bg-primary/10 text-primary font-semibold"
                  )}
                >
                  <ItemIcon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, profile, signOut } = useAuth();
  const { has: hasFeature } = useTenantFeatures();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const navItems = filterNavByFeatures(getRoleNavItems(role), hasFeature);

  const sub = (profile?.doctor ?? profile?.therapist ?? profile?.patient ?? profile?.pharmacist) as { fullName?: string } | undefined;
  const displayName = sub?.fullName ?? user?.email ?? "User";

  const handleSignOut = async () => {
    await signOut();
    setMobileOpen(false);
    navigate("/login", { replace: true });
  };

  const toggleSection = (label: string) =>
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));

  const groupHasActive = (group: NavGroup) =>
    group.items.some((item) => pathMatchesNav(location.pathname, item.path));

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-16 items-center justify-between px-6 bg-card/80 backdrop-blur-md border-b border-border/50">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">IWIS</span>
        </Link>

        <div className="flex-1 flex items-center justify-center overflow-x-auto no-scrollbar px-4">
          <div className="flex items-center gap-0.5 min-w-max">
            {navItems.map((entry) => {
              if (!isGroup(entry)) {
                const Icon = entry.icon;
                const isActive = pathMatchesNav(location.pathname, entry.path);
                return (
                  <Link
                    key={entry.path}
                    to={entry.path}
                    className={cn(
                      "relative flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                      // Same active treatment as group triggers — stronger
                      // background, bolder weight, and a bottom accent bar so
                      // the selected section is unmistakable at a glance.
                      isActive
                        ? "bg-primary/15 text-primary font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-primary after:rounded-full"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden lg:inline">{entry.label}</span>
                    <span className="lg:hidden">{entry.label.split(" ")[0]}</span>
                  </Link>
                );
              }

              return (
                <HoverNavGroup
                  key={entry.label}
                  entry={entry}
                  active={groupHasActive(entry)}
                  pathname={location.pathname}
                />
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <BranchScopeSwitcher />
          <NotificationBell />
          <UserProfileMenu />
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 bg-card/80 backdrop-blur-md border-b border-border/50">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-sm">IWIS</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <NotificationBell />
          <UserProfileMenu />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            {mobileOpen ? (
              <X className="h-5 w-5 text-foreground" />
            ) : (
              <Menu className="h-5 w-5 text-foreground" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-sm pt-14 overflow-y-auto">
          <div className="flex flex-col p-4 gap-1">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-border mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Signed in as</p>
              <p className="font-semibold text-foreground mt-0.5">{displayName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>

            {navItems.map((entry) => {
              if (!isGroup(entry)) {
                const Icon = entry.icon;
                const isActive = pathMatchesNav(location.pathname, entry.path);
                return (
                  <Link
                    key={entry.path}
                    to={entry.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors border-l-4",
                      isActive
                        ? "bg-primary/15 text-primary font-semibold border-primary"
                        : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {entry.label}
                  </Link>
                );
              }

              const GroupIcon = entry.icon;
              const groupActive = groupHasActive(entry);
              const expanded = openSections[entry.label] ?? groupActive;
              const activeLeafPath = bestMatchingPath(location.pathname, entry.items.map((i) => i.path));
              const activeLeaf = entry.items.find((i) => i.path === activeLeafPath) ?? null;
              return (
                <div key={entry.label} className="flex flex-col">
                  <button
                    onClick={() => toggleSection(entry.label)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors border-l-4",
                      groupActive
                        ? "bg-primary/15 text-primary font-semibold border-primary"
                        : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <GroupIcon className="h-5 w-5" />
                    <span className="flex-1 text-left">
                      {entry.label}
                      {groupActive && activeLeaf && (
                        <span className="ml-2 text-xs font-normal opacity-80">
                          · {activeLeaf.label}
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        expanded && "rotate-180"
                      )}
                    />
                  </button>
                  {expanded && (
                    <div className="ml-4 pl-4 border-l border-border flex flex-col gap-1 mt-1 mb-1">
                      {entry.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = item.path === activeLeafPath;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                              isActive
                                ? "bg-primary/15 text-primary font-semibold"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                          >
                            <ItemIcon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-attention hover:bg-attention/10 transition-colors mt-4"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
