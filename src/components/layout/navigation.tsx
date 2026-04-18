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
  Receipt,
  Users,
  Megaphone,
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
  LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavLeaf = { path: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; icon: LucideIcon; items: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup =>
  (entry as NavGroup).items !== undefined;

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
            { path: "/assign-patient", label: "Assign Patient", icon: User },
            { path: "/prescriptions", label: "Prescriptions", icon: FilePlus2 },
            { path: "/billing", label: "Billing", icon: Receipt },
          ],
        },
        {
          label: "Staff",
          icon: Users,
          items: [
            { path: "/staff-activity", label: "Staff Activity", icon: Users },
            { path: "/performance-scorecards", label: "Scorecards", icon: ClipboardCheck },
            { path: "/attendance", label: "Attendance", icon: Clock },
            { path: "/skill-matrix", label: "Skill Matrix", icon: Shield },
            { path: "/doctor-availability", label: "Availability", icon: CalendarDays },
          ],
        },
        {
          label: "Operations",
          icon: Briefcase,
          items: [
            { path: "/resource-sharing", label: "Resource Sharing", icon: ArrowRightLeft },
            { path: "/centralized-inventory", label: "Inventory HQ", icon: Package },
            { path: "/announcements", label: "Announcements", icon: Megaphone },
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
      ];
    case "ADMIN_DOCTOR":
      return [
        { path: "/doctor-admin", label: "Dashboard", icon: Stethoscope },
        { path: "/appointments", label: "Appointments", icon: CalendarDays },
        {
          label: "Clinical",
          icon: FilePlus2,
          items: [
            { path: "/doctor", label: "My Patients", icon: User },
            { path: "/create-user", label: "Create User", icon: User },
            { path: "/assign-patient", label: "Assign Patient", icon: User },
            { path: "/prescriptions", label: "Prescriptions", icon: FilePlus2 },
            { path: "/billing", label: "Billing", icon: Receipt },
            { path: "/handoff-notes", label: "Handoff Notes", icon: FileText },
          ],
        },
        {
          label: "Staff",
          icon: Users,
          items: [
            { path: "/branch-management", label: "Branches", icon: Building2 },
            { path: "/staff-activity", label: "Staff Activity", icon: Users },
            { path: "/performance-scorecards", label: "Scorecards", icon: ClipboardCheck },
            { path: "/attendance", label: "Attendance", icon: Clock },
            { path: "/skill-matrix", label: "Skill Matrix", icon: Shield },
            { path: "/doctor-availability", label: "Availability", icon: CalendarDays },
          ],
        },
        {
          label: "Operations",
          icon: Briefcase,
          items: [
            { path: "/resource-sharing", label: "Resource Sharing", icon: ArrowRightLeft },
            { path: "/centralized-inventory", label: "Inventory HQ", icon: Package },
            { path: "/announcements", label: "Announcements", icon: Megaphone },
          ],
        },
        {
          label: "Engagement",
          icon: Trophy,
          items: [
            { path: "/xp-dashboard", label: "XP & Level", icon: Sparkles },
            { path: "/seasonal-challenges", label: "Challenges", icon: Swords },
            { path: "/team-quests", label: "Team Quests", icon: Map },
            { path: "/reward-store", label: "Rewards", icon: Gift },
            { path: "/mentor-hub", label: "Mentoring", icon: GraduationCap },
            { path: "/doctor-gamification", label: "Leaderboard", icon: Activity },
            { path: "/gamification-analytics", label: "Analytics", icon: Trophy },
          ],
        },
        { path: "/reports", label: "Reports", icon: BarChart3 },
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
            { path: "/billing", label: "Billing", icon: Receipt },
            { path: "/handoff-notes", label: "Handoff Notes", icon: FileText },
            { path: "/visit-summary", label: "Visit Summary", icon: ClipboardCheck },
          ],
        },
        {
          label: "Engagement",
          icon: Trophy,
          items: [
            { path: "/xp-dashboard", label: "XP & Level", icon: Sparkles },
            { path: "/seasonal-challenges", label: "Challenges", icon: Swords },
            { path: "/team-quests", label: "Team Quests", icon: Map },
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
            { path: "/attendance", label: "Attendance", icon: Clock },
            { path: "/doctor-availability", label: "Availability", icon: CalendarDays },
          ],
        },
        { path: "/reports", label: "Reports", icon: BarChart3 },
        { path: "/chat", label: "Chat", icon: MessageSquare },
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
            { path: "/handoff-notes", label: "Handoff Notes", icon: FileText },
            { path: "/visit-summary", label: "Visit Summary", icon: ClipboardCheck },
          ],
        },
        {
          label: "Engagement",
          icon: Trophy,
          items: [
            { path: "/xp-dashboard", label: "XP & Level", icon: Sparkles },
            { path: "/seasonal-challenges", label: "Challenges", icon: Swords },
            { path: "/team-quests", label: "Team Quests", icon: Map },
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
            { path: "/attendance", label: "Attendance", icon: Clock },
            { path: "/doctor-availability", label: "Availability", icon: CalendarDays },
          ],
        },
        { path: "/reports", label: "Reports", icon: BarChart3 },
        { path: "/chat", label: "Chat", icon: MessageSquare },
      ];
    case "PATIENT":
      return [
        { path: "/patient-portal", label: "My Portal", icon: Home },
        { path: "/appointments", label: "Appointments", icon: CalendarDays },
        {
          label: "Health",
          icon: Heart,
          items: [
            { path: "/patient", label: "My Journey", icon: Activity },
            { path: "/wellness", label: "Wellness", icon: Heart },
            { path: "/visit-summary", label: "Visit Summaries", icon: FileText },
          ],
        },
        {
          label: "Engagement",
          icon: Trophy,
          items: [
            { path: "/health-quests", label: "Quests", icon: Map },
            { path: "/health-avatar", label: "My Companion", icon: Sprout },
            { path: "/family-leaderboard", label: "Family", icon: Users },
            { path: "/referral-rewards", label: "Referrals", icon: Gift },
            { path: "/social-proof", label: "Streaks", icon: Flame },
            { path: "/health-content", label: "Content Library", icon: Lock },
          ],
        },
        { path: "/announcements", label: "Announcements", icon: Megaphone },
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
      ];
    default:
      return [];
  }
};

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const navItems = getRoleNavItems(role);

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
    group.items.some((item) => location.pathname === item.path);

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
                const isActive = location.pathname === entry.path;
                return (
                  <Link
                    key={entry.path}
                    to={entry.path}
                    className={cn(
                      "flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden lg:inline">{entry.label}</span>
                    <span className="lg:hidden">{entry.label.split(" ")[0]}</span>
                  </Link>
                );
              }

              const GroupIcon = entry.icon;
              const groupActive = groupHasActive(entry);
              return (
                <DropdownMenu key={entry.label}>
                  <DropdownMenuTrigger
                    className={cn(
                      "flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap outline-none",
                      groupActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <GroupIcon className="h-4 w-4" />
                    <span className="hidden lg:inline">{entry.label}</span>
                    <span className="lg:hidden">{entry.label.split(" ")[0]}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[12rem]">
                    {entry.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <DropdownMenuItem key={item.path} asChild>
                          <Link
                            to={item.path}
                            className={cn(
                              "flex items-center gap-2 w-full cursor-pointer",
                              isActive && "text-primary"
                            )}
                          >
                            <ItemIcon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
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
                const isActive = location.pathname === entry.path;
                return (
                  <Link
                    key={entry.path}
                    to={entry.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
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
              return (
                <div key={entry.label} className="flex flex-col">
                  <button
                    onClick={() => toggleSection(entry.label)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors",
                      groupActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <GroupIcon className="h-5 w-5" />
                    <span className="flex-1 text-left">{entry.label}</span>
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
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary"
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
