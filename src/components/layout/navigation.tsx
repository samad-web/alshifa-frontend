import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Stethoscope,
  User,
  Heart,
  Activity,
  Menu,
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
  ArrowRightLeft,
  ClipboardCheck,
  Sparkles,
  Swords,
  Gift,
  GraduationCap,
  Star,
  // Aliased — `Map` would shadow the built-in `Map` constructor used by
  // the dropdown's section bucketing.
  Map as MapIcon,
  Flame,
  Home,
  FileText,
  Sprout,
  Briefcase,
  ChevronDown,
  DoorOpen,
  Salad,
  Camera,
  ImageIcon,
  ClipboardList,
  HeartPulse,
  MoreHorizontal,
  MessageSquareHeart,
  Leaf,
  BookOpen,
  Zap,
  AlertTriangle,
  Pill,
  LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { useHomeTherapyPendingCount } from "@/hooks/useHomeTherapyPendingCount";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import { BranchScopeSwitcher } from "@/components/layout/BranchScopeSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavLeaf = { path: string; label: string; icon: LucideIcon; featureKey?: string; section?: string; badgeCount?: number };
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
  // Voice Health Coach
  "/patient/coach":  "AYURVEDIC_VOICE_COACH",
};

function pathMatchesNav(pathname: string, navPath: string): boolean {
  if (navPath === "/") return pathname === "/";
  if (pathname === navPath) return true;
  return pathname.startsWith(navPath + "/");
}

function bestMatchingPath(pathname: string, paths: string[]): string | null {
  let best: string | null = null;
  for (const p of paths) {
    if (!pathMatchesNav(pathname, p)) continue;
    if (best === null || p.length > best.length) best = p;
  }
  return best;
}

function filterNavByFeatures(items: NavEntry[], has: (key: string) => boolean): NavEntry[] {
  return items
    .map((entry) => {
      if (isGroup(entry)) {
        const keptItems = entry.items.filter((leaf) => {
          const key = PATH_TO_FEATURE[leaf.path];
          return !key || has(key);
        });
        return keptItems.length ? { ...entry, items: keptItems } : null;
      }
      const key = PATH_TO_FEATURE[entry.path];
      return !key || has(key) ? entry : null;
    })
    .filter((e): e is NavEntry => e !== null);
}

/**
 * Stamp a `badgeCount` onto every leaf whose path appears in the supplied
 * `badges` map. Used by the navbar to surface live counts (e.g. pending
 * Home-Therapy requests). Returns a fresh structure — never mutates inputs.
 */
function annotateNavBadges(items: NavEntry[], badges: Record<string, number>): NavEntry[] {
  const apply = (leaf: NavLeaf): NavLeaf => {
    const c = badges[leaf.path];
    return c && c > 0 ? { ...leaf, badgeCount: c } : leaf;
  };
  return items.map((entry) => isGroup(entry)
    ? { ...entry, items: entry.items.map(apply) }
    : apply(entry));
}

const getRoleNavItems = (role: AppRole | null): NavEntry[] => {
  switch (role) {
    case "ADMIN":
      return [
        { path: "/admin", label: "Dashboard", icon: Stethoscope },
        { path: "/appointments", label: "Appointments", icon: CalendarDays },
        { path: "/admin/live-queue", label: "Live Queue", icon: Activity },
        {
          label: "Clinical",
          icon: FilePlus2,
          items: [
            { path: "/patients", label: "All Patients", icon: Users },
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
            { path: "/pharmacy/history", label: "Dispense History", icon: History },
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
            { path: "/admin/home-therapy", label: "Home Therapy", icon: Home },
            { path: "/admin/home-therapy/live-map", label: "Therapist Live Map", icon: MapIcon },
            { path: "/admin/workflow-automation", label: "Automation Rules", icon: Zap },
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
        // Patient + team chats are surfaced as tabs inside `/chat` via
        // <MessagesTabs>, so the sidebar carries a single entry. /staff-chat
        // remains routable for deep links from notifications.
        { path: "/chat", label: "Chat", icon: MessageSquare },
      ];
    case "ADMIN_DOCTOR":
      return [
        { path: "/doctor-admin", label: "Dashboard", icon: Stethoscope },
        { path: "/appointments", label: "Appointments", icon: CalendarDays },
        {
          label: "Clinical",
          icon: FilePlus2,
          items: [
            { path: "/my-patients", label: "My Patients", icon: Users, section: "Patients" },
            { path: "/patients", label: "All Patients", icon: Users, section: "Patients" },
            { path: "/patient-history", label: "Patient History", icon: FileText, section: "Patients" },
            { path: "/assign-patient", label: "Assign Patient", icon: User, section: "Patients" },
            { path: "/create-user", label: "Create User", icon: User, section: "Users" },
            { path: "/manage-users", label: "Manage Users", icon: Users, section: "Users" },
            { path: "/prescriptions", label: "Prescriptions", icon: FilePlus2, section: "Records" },
            // Diet Plans & Packages now live as two tabs under /diet-prescriptions.
            // /diet-packages still routes but is reached via the tab, not the nav.
            { path: "/diet-prescriptions", label: "Diet Plans & Packages", icon: Salad, section: "Records" },
            // Food Database & Recipe Library combined under /food-database.
            { path: "/food-database", label: "Food Database + Recipes", icon: Salad, section: "Records" },
            { path: "/journey-builder", label: "Journey Builder", icon: MapIcon, section: "Records" },
            { path: "/handoff-notes", label: "Handoff Notes", icon: FileText, section: "Records" },
            { path: "/visit-summary", label: "Visit Summary", icon: ClipboardCheck, section: "Records" },
            { path: "/self-exam-review", label: "Self-Exam Review", icon: ClipboardList, section: "Records" },
            { path: "/admin/workflow-automation", label: "Automation Rules", icon: Zap, section: "Operations" },
          ],
        },
        {
          label: "Ayurveda",
          icon: Sprout,
          items: [
            { path: "/therapy-rooms", label: "Therapy Rooms", icon: DoorOpen },
            { path: "/treatment-packages", label: "Packages", icon: Package },
            { path: "/group-sessions", label: "Group Sessions", icon: Users },
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
            { path: "/pharmacy", label: "Pharmacy Dashboard", icon: Stethoscope, section: "Pharmacy" },
            { path: "/pharmacy/orders", label: "Orders", icon: ShoppingCart, section: "Pharmacy" },
            { path: "/pharmacy/inventory", label: "Inventory", icon: Package, section: "Pharmacy" },
            { path: "/pharmacy/dispense", label: "Dispense", icon: ShoppingCart, section: "Pharmacy" },
            { path: "/pharmacy/history", label: "Dispense History", icon: History, section: "Pharmacy" },
            { path: "/resource-sharing", label: "Resource Sharing", icon: ArrowRightLeft, section: "Operations" },
            { path: "/centralized-inventory", label: "Inventory HQ", icon: Package, section: "Operations" },
            { path: "/announcements", label: "Announcements", icon: Megaphone, section: "Operations" },
            { path: "/self-exam-protocols", label: "Self-Exam Protocol", icon: ClipboardList, section: "Operations" },
            { path: "/message-templates", label: "Message Templates", icon: MessageSquare, section: "Operations" },
            { path: "/reminder-settings", label: "Daily Reminders", icon: CalendarDays, section: "Operations" },
            { path: "/critical-journey", label: "Critical Journey", icon: HeartPulse, section: "Operations" },
            { path: "/admin/home-therapy", label: "Home Therapy", icon: Home, section: "Operations" },
            { path: "/admin/home-therapy/live-map", label: "Therapist Live Map", icon: MapIcon, section: "Operations" },
          ],
        },
        {
          // ADMIN_DOCTOR is oversight + curator: they don't earn XP, redeem
          // rewards, or appear on the leaderboard, but they DO author the
          // challenges and reward catalogue alongside ADMIN, and retain
          // hospital-wide gamification analytics.
          label: "Engagement",
          icon: Trophy,
          items: [
            { path: "/seasonal-challenges", label: "Challenges", icon: Trophy },
            { path: "/reward-store", label: "Reward Store", icon: Trophy },
            { path: "/gamification-analytics", label: "Analytics", icon: Trophy },
          ],
        },
        {
          label: "More",
          icon: BarChart3,
          items: [
            { path: "/reports", label: "Reports", icon: BarChart3 },
            { path: "/care-gaps", label: "Care Gaps", icon: AlertTriangle },
            { path: "/medication-adherence", label: "Medication Adherence", icon: Pill },
          ],
        },
      ];
    case "BRANCH_ADMIN":
      return [
        { path: "/branch-admin", label: "Dashboard", icon: Stethoscope },
        { path: "/branch-admin/live-queue", label: "Live Queue", icon: Activity },
        { path: "/branch-admin/staff", label: "Staff Directory", icon: Users },
        {
          label: "Patients",
          icon: User,
          items: [
            { path: "/patients", label: "All Patients", icon: Users },
            { path: "/assign-patient", label: "Assign Patient", icon: User },
            { path: "/manage-users", label: "View Users", icon: Users },
          ],
        },
        {
          label: "Operations",
          icon: Briefcase,
          items: [
            { path: "/attendance", label: "Attendance", icon: ClipboardCheck },
            { path: "/branch-admin/scorecards", label: "Scorecards", icon: Trophy },
            { path: "/staff-schedule", label: "Schedule", icon: CalendarDays },
            { path: "/admin/home-therapy", label: "Home Therapy", icon: Home },
            { path: "/admin/home-therapy/live-map", label: "Therapist Live Map", icon: MapIcon },
          ],
        },
        // Patient + team chats are unified at /chat (in-page tab strip).
        { path: "/chat", label: "Chat", icon: MessageSquare },
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
            { path: "/food-database", label: "Food Database", icon: Leaf },
            { path: "/recipe-library", label: "Recipe Library", icon: BookOpen },
            { path: "/diet-packages", label: "Diet Packages", icon: Salad },
            { path: "/journey-builder", label: "Journey Builder", icon: MapIcon },
            { path: "/handoff-notes", label: "Handoff Notes", icon: FileText },
            { path: "/visit-summary", label: "Visit Summary", icon: ClipboardCheck },
            { path: "/self-exam-review", label: "Self-Exam Review", icon: ClipboardList },
          ],
        },
        {
          label: "Ayurveda",
          icon: Sprout,
          items: [
            { path: "/clinical-photos", label: "Clinical Photos", icon: Camera },
            { path: "/treatment-packages", label: "Packages", icon: Package },
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
        // Patient + team chats are surfaced as tabs inside `/chat`, so the
        // doctor sidebar carries only one entry. The /staff-chat route is
        // still mounted (and reachable from the in-page tab strip) for
        // direct deep links from notifications.
        { path: "/chat", label: "Chat", icon: MessageSquare },
      ];
    case "THERAPIST":
      return [
        { path: "/therapist", label: "Today's Sittings", icon: Heart },
        { path: "/appointments", label: "Appointments", icon: CalendarDays },
        { path: "/therapist/patients", label: "My Patients", icon: Users },
        {
          label: "Clinical",
          icon: FilePlus2,
          items: [
            { path: "/prescriptions", label: "Prescriptions", icon: FilePlus2 },
            { path: "/diet-packages", label: "Diet Packages", icon: Salad },
            { path: "/recipe-library", label: "Recipe Library", icon: BookOpen },
            { path: "/journey-builder", label: "Journey Builder", icon: MapIcon },
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
            { path: "/admin/home-therapy", label: "Home Therapy", icon: Home },
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
        // Patient + team chats are unified at /chat (in-page tab strip).
        { path: "/chat", label: "Chat", icon: MessageSquare },
      ];
    case "PATIENT":
      return [
        { path: "/patient", label: "Today", icon: Home },
        { path: "/patient/coach", label: "Health Coach", icon: MessageSquareHeart },
        { path: "/patient-portal", label: "My Records", icon: ClipboardList },
        { path: "/appointments", label: "Appointments", icon: CalendarDays },
        { path: "/triage", label: "Triage", icon: ClipboardList },
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
            { path: "/health-quests", label: "Quests", icon: MapIcon },
            { path: "/health-avatar", label: "My Companion", icon: Sprout },
            { path: "/social-proof", label: "Streaks", icon: Flame },
          ],
        },
      ];
    case "PHARMACIST":
      return [
        { path: "/pharmacy", label: "Dashboard", icon: Stethoscope },
        { path: "/pharmacy/orders", label: "Manage Orders", icon: ShoppingCart },
        { path: "/pharmacy/inventory", label: "Inventory", icon: Package },
        { path: "/pharmacy/dispense", label: "Dispense", icon: ShoppingCart },
        { path: "/pharmacy/history", label: "Dispense History", icon: History },
        // Patient + team chats are unified at /chat (in-page tab strip).
        { path: "/chat", label: "Chat", icon: MessageSquare },
      ];
    default:
      return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive overflow: measures the available width of the nav row and decides
// how many top-level entries can render visibly. Anything that doesn't fit is
// returned as `overflow` so it can be rendered behind a "More" dropdown — this
// replaces the old horizontal-scroll fallback, which felt cramped and made the
// overflowed entries effectively invisible.
// ─────────────────────────────────────────────────────────────────────────────
function useOverflowSplit(items: NavEntry[]): {
  containerRef: React.RefObject<HTMLDivElement>;
  ghostRef: React.RefObject<HTMLDivElement>;
  visibleCount: number;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  // Re-measure when the item set changes (role switch, feature flag toggle).
  const itemsKey = useMemo(
    () => items.map((e) => (isGroup(e) ? `g:${e.label}` : `l:${e.path}`)).join("|"),
    [items],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const ghost = ghostRef.current;
    if (!container || !ghost) return;

    const GAP = 4;          // matches `gap-1` between items
    const MORE_BTN_WIDTH = 92; // approximate width reserved for the "More ▾" trigger

    const measure = () => {
      const containerWidth = container.clientWidth;
      if (containerWidth === 0) return;
      const children = Array.from(ghost.children) as HTMLElement[];
      if (children.length === 0) return;

      // First pass: can everything fit without reserving space for "More"?
      let total = 0;
      for (let i = 0; i < children.length; i++) {
        total += children[i].getBoundingClientRect().width + (i > 0 ? GAP : 0);
      }
      if (total <= containerWidth) {
        setVisibleCount(items.length);
        return;
      }

      // Second pass: reserve room for the "More" trigger and pack what fits.
      const budget = containerWidth - MORE_BTN_WIDTH;
      let used = 0;
      let count = 0;
      for (let i = 0; i < children.length; i++) {
        const w = children[i].getBoundingClientRect().width + (i > 0 ? GAP : 0);
        if (used + w > budget) break;
        used += w;
        count++;
      }
      setVisibleCount(Math.max(0, count));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [items.length, itemsKey]);

  return { containerRef, ghostRef, visibleCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct-link nav pill. Underline accent + soft tint = unmistakable active
// state without shouting at the user.
// ─────────────────────────────────────────────────────────────────────────────
function NavLinkPill({ entry, pathname }: { entry: NavLeaf; pathname: string }) {
  const Icon = entry.icon;
  const isActive = pathMatchesNav(pathname, entry.path);
  const badge = entry.badgeCount;
  return (
    <Link
      to={entry.path}
      className={cn(
        "relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isActive
          ? "bg-primary/10 text-primary font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-primary after:rounded-full"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{entry.label}</span>
      {!!badge && badge > 0 && (
        <span
          aria-label={`${badge} pending`}
          className="ml-1 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Group dropdown: click-to-toggle (primary) with hover-to-open as enhancement
// (with a 150ms grace period so users can travel from trigger to menu without
// it closing). Mega-menu lays items out as a column-grouped list — sections
// become column captions, items render full-width inside their column for
// clean scannability.
// ─────────────────────────────────────────────────────────────────────────────
function NavGroupDropdown({
  entry,
  pathname,
  triggerClassName,
  showLabel = true,
}: {
  entry: NavGroup;
  pathname: string;
  triggerClassName?: string;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openOnHover = () => {
    cancelClose();
    setOpen(true);
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const GroupIcon = entry.icon;
  const active = entry.items.some((item) => pathMatchesNav(pathname, item.path));
  const activeLeafPath = bestMatchingPath(pathname, entry.items.map((i) => i.path));
  const activeLeaf = entry.items.find((i) => i.path === activeLeafPath) ?? null;

  // Bucket items by section. Items without a section land in "" which renders
  // without a caption.
  const sections = useMemo(() => {
    const buckets = new Map<string, NavLeaf[]>();
    for (const item of entry.items) {
      const key = item.section ?? "";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    }
    return Array.from(buckets.entries());
  }, [entry.items]);

  // Two columns when there are >= 2 sections OR > 6 items in a single section.
  const useTwoColumns =
    sections.length >= 2 || (sections[0]?.[1].length ?? 0) > 6;

  // Sum of badge counts across the group's leaves — surfaced on the group
  // trigger so admins see the pending Home-Therapy tally without opening
  // the dropdown.
  const groupBadge = useMemo(
    () => entry.items.reduce((acc, leaf) => acc + (leaf.badgeCount ?? 0), 0),
    [entry.items],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        onPointerEnter={openOnHover}
        onPointerLeave={closeSoon}
        className={cn(
          "relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group",
          active
            ? "bg-primary/10 text-primary font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-primary after:rounded-full"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
          triggerClassName,
        )}
      >
        <GroupIcon className="h-4 w-4 shrink-0" />
        {showLabel && (
          <span className="flex items-center">
            {entry.label}
            {active && activeLeaf && (
              <span className="ml-1.5 text-xs font-normal opacity-75 max-w-[8rem] truncate">
                · {activeLeaf.label}
              </span>
            )}
          </span>
        )}
        {groupBadge > 0 && (
          <span
            aria-label={`${groupBadge} pending`}
            className="ml-1 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none"
          >
            {groupBadge > 99 ? "99+" : groupBadge}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 opacity-60 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        onPointerEnter={openOnHover}
        onPointerLeave={closeSoon}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "p-2 max-h-[70vh] overflow-y-auto rounded-xl shadow-lg border-border/60",
          useTwoColumns ? "w-[36rem] max-w-[calc(100vw-2rem)]" : "w-72",
        )}
      >
        <div
          className={cn(
            "grid gap-x-3",
            useTwoColumns ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {sections.map(([sectionLabel, items], idx) => (
            <div
              key={sectionLabel || `__sec-${idx}`}
              className="flex flex-col"
            >
              {sectionLabel && (
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold px-2 pt-2 pb-1">
                  {sectionLabel}
                </div>
              )}
              <div className="flex flex-col">
                {items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = item.path === activeLeafPath;
                  const itemBadge = item.badgeCount;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors outline-none",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground/80 hover:bg-secondary hover:text-foreground focus-visible:bg-secondary",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary/60 text-muted-foreground",
                        )}
                      >
                        <ItemIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate">{item.label}</span>
                      {!!itemBadge && itemBadge > 0 && (
                        <span
                          aria-label={`${itemBadge} pending`}
                          className="ml-auto inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none"
                        >
                          {itemBadge > 99 ? "99+" : itemBadge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overflow "More" menu: collects entries that didn't fit in the visible row.
// Direct links render as rows with their icon; groups render as collapsed
// rows that expand inline (one nesting level only — keeps the menu shallow).
// ─────────────────────────────────────────────────────────────────────────────
function MoreMenu({
  entries,
  pathname,
}: {
  entries: NavEntry[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const anyActive = entries.some((e) =>
    isGroup(e)
      ? e.items.some((i) => pathMatchesNav(pathname, i.path))
      : pathMatchesNav(pathname, e.path),
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        className={cn(
          "relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          anyActive
            ? "bg-primary/10 text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span>More</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 opacity-60 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="p-2 w-72 max-h-[70vh] overflow-y-auto rounded-xl shadow-lg border-border/60"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {entries.map((entry) => {
          if (!isGroup(entry)) {
            const Icon = entry.icon;
            const isActive = pathMatchesNav(pathname, entry.path);
            return (
              <Link
                key={entry.path}
                to={entry.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors outline-none",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground/80 hover:bg-secondary hover:text-foreground",
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary/60 shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">{entry.label}</span>
              </Link>
            );
          }
          const GroupIcon = entry.icon;
          const isOpen = expanded[entry.label] ?? false;
          const groupActive = entry.items.some((i) =>
            pathMatchesNav(pathname, i.path),
          );
          return (
            <div key={entry.label} className="flex flex-col">
              <button
                type="button"
                onClick={() =>
                  setExpanded((p) => ({ ...p, [entry.label]: !p[entry.label] }))
                }
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors outline-none w-full",
                  groupActive
                    ? "text-primary font-semibold"
                    : "text-foreground/80 hover:bg-secondary hover:text-foreground",
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary/60 shrink-0">
                  <GroupIcon className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 text-left truncate">{entry.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 opacity-60 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen && (
                <div className="ml-9 mt-0.5 mb-1 flex flex-col border-l border-border/60 pl-2">
                  {entry.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = pathMatchesNav(pathname, item.path);
                    const itemBadge = item.badgeCount;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {!!itemBadge && itemBadge > 0 && (
                          <span
                            aria-label={`${itemBadge} pending`}
                            className="ml-auto inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none"
                          >
                            {itemBadge > 99 ? "99+" : itemBadge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile drawer: full sheet from the left with sticky search at top, sectioned
// accordion of groups, and sign-out anchored at the bottom.
// ─────────────────────────────────────────────────────────────────────────────
function MobileNav({
  navItems,
  pathname,
  displayName,
  email,
  role,
  onSignOut,
}: {
  navItems: NavEntry[];
  pathname: string;
  displayName: string;
  email: string;
  role: AppRole | null;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const close = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open menu"
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[88vw] max-w-sm p-0 flex flex-col gap-0"
      >
        {/* Header: brand + user identity */}
        <div className="px-5 pt-5 pb-3 border-b border-border/60">
          <Link to="/" onClick={close} className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">IWIS</span>
          </Link>
          <div className="mt-3">
            <p className="font-semibold text-foreground truncate">
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
            {role && (
              <span className="inline-flex mt-1.5 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {role.replace("_", " ")}
              </span>
            )}
          </div>
        </div>

        {/* Body: sectioned nav */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="flex flex-col gap-0.5">
            {navItems.map((entry) => {
              if (!isGroup(entry)) {
                const Icon = entry.icon;
                const isActive = pathMatchesNav(pathname, entry.path);
                return (
                  <Link
                    key={entry.path}
                    to={entry.path}
                    onClick={close}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground/80 hover:bg-secondary",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{entry.label}</span>
                  </Link>
                );
              }
              const GroupIcon = entry.icon;
              const groupActive = entry.items.some((i) =>
                pathMatchesNav(pathname, i.path),
              );
              const expanded = openSections[entry.label] ?? groupActive;
              const activeLeafPath = bestMatchingPath(
                pathname,
                entry.items.map((i) => i.path),
              );
              return (
                <div key={entry.label} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSections((p) => ({
                        ...p,
                        [entry.label]: !expanded,
                      }))
                    }
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full",
                      groupActive
                        ? "text-primary"
                        : "text-foreground/80 hover:bg-secondary",
                    )}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left truncate">
                      {entry.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 opacity-60 transition-transform",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                  {expanded && (
                    <div className="ml-7 mt-0.5 mb-1 pl-3 border-l border-border/60 flex flex-col">
                      {entry.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = item.path === activeLeafPath;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={close}
                            className={cn(
                              "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                            )}
                          >
                            <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sign out anchored at bottom */}
        <div className="border-t border-border/60 p-3">
          <button
            type="button"
            onClick={() => {
              close();
              onSignOut();
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-attention hover:bg-attention/10 transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main navbar.
// ─────────────────────────────────────────────────────────────────────────────
export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, profile, signOut } = useAuth();
  const { has: hasFeature } = useTenantFeatures();

  // Pending Home-Therapy approval count (admin-like roles only). Folded
  // into the navItems memo as a `badgeCount` on the matching leaf so the
  // pill renderer can show it without extra plumbing.
  const homeTherapyPending = useHomeTherapyPendingCount();

  const navItems = useMemo(
    () => annotateNavBadges(
      filterNavByFeatures(getRoleNavItems(role), hasFeature),
      { "/admin/home-therapy": homeTherapyPending },
    ),
    [role, hasFeature, homeTherapyPending],
  );

  const { containerRef, ghostRef, visibleCount } = useOverflowSplit(navItems);
  const visibleItems = navItems.slice(0, visibleCount);
  const overflowItems = navItems.slice(visibleCount);

  const sub = (profile?.doctor ?? profile?.therapist ?? profile?.patient ?? profile?.pharmacist) as { fullName?: string } | undefined;
  const displayName = sub?.fullName ?? user?.email ?? "User";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  // Close any lingering overflow / dropdowns when the route changes — guards
  // against menus that occasionally stay open during programmatic nav.
  useEffect(() => {
    // Intentionally empty — this hook exists so future per-menu close hooks
    // can subscribe to `location.pathname` without re-architecting the tree.
  }, [location.pathname]);

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Desktop / tablet navbar — three-column grid keeps the nav row
          truly centered between the brand (left) and tools (right) clusters
          regardless of how wide either side grows. */}
      <nav className="hidden md:grid fixed top-0 left-0 right-0 z-50 h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 lg:px-6 bg-card/85 backdrop-blur-md border-b border-border/60">
        {/* Brand (left column, left-aligned) */}
        <Link
          to="/"
          className="flex items-center gap-2 justify-self-start outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg pr-2"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">
            IWIS
          </span>
        </Link>

        {/* Adaptive nav row (middle column, centered) */}
        <div ref={containerRef} className="relative min-w-0 max-w-full">
          <div className="flex items-center gap-1 justify-center">
            {visibleItems.map((entry) =>
              isGroup(entry) ? (
                <NavGroupDropdown
                  key={entry.label}
                  entry={entry}
                  pathname={location.pathname}
                />
              ) : (
                <NavLinkPill
                  key={entry.path}
                  entry={entry}
                  pathname={location.pathname}
                />
              ),
            )}
            {overflowItems.length > 0 && (
              <MoreMenu entries={overflowItems} pathname={location.pathname} />
            )}
          </div>
          {/* Hidden ghost row — measured to decide overflow. Mirrors the
              full set of items so widths reflect the rendered look exactly. */}
          <div
            ref={ghostRef}
            aria-hidden
            className="absolute top-0 left-0 flex items-center gap-1 invisible pointer-events-none"
            style={{ visibility: "hidden" }}
          >
            {navItems.map((entry, idx) =>
              isGroup(entry) ? (
                <span
                  key={`ghost-g-${entry.label}-${idx}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                >
                  <entry.icon className="h-4 w-4 shrink-0" />
                  <span>{entry.label}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </span>
              ) : (
                <span
                  key={`ghost-l-${entry.path}-${idx}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                >
                  <entry.icon className="h-4 w-4 shrink-0" />
                  <span>{entry.label}</span>
                </span>
              ),
            )}
          </div>
        </div>

        {/* Right cluster: branch · notifications · profile (right column, right-aligned) */}
        <div className="flex items-center gap-1.5 justify-self-end">
          <div className="hidden lg:block">
            <BranchScopeSwitcher />
          </div>
          <NotificationBell />
          <UserProfileMenu />
        </div>
      </nav>

      {/* Mobile navbar */}
      <nav className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-3 bg-card/85 backdrop-blur-md border-b border-border/60">
        <div className="flex items-center gap-1">
          <MobileNav
            navItems={navItems}
            pathname={location.pathname}
            displayName={displayName}
            email={user?.email ?? ""}
            role={role}
            onSignOut={handleSignOut}
          />
          <Link to="/" className="flex items-center gap-2 ml-1">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
              <Activity className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground text-sm">IWIS</span>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <NotificationBell />
          <UserProfileMenu />
        </div>
      </nav>
    </>
  );
}

