/**
 * SuperAdminShell — layout for /super-admin/*.
 * Distinct brand treatment (dark header + SUPER ADMIN badge) to make it
 * visually obvious that the operator is in a platform-level context.
 */
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Building2,
  ToggleRight,
  FileText,
  Database,
  LogOut,
  ShieldCheck,
  Activity,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/super-admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/super-admin/hospitals", label: "Hospitals", icon: Building2 },
  { to: "/super-admin/feature-registry", label: "Feature Registry", icon: Database },
  { to: "/super-admin/triage", label: "Triage Oversight", icon: Activity },
  { to: "/super-admin/triage/routes", label: "Specialty Routes", icon: Stethoscope },
  { to: "/super-admin/audit", label: "Audit Log", icon: FileText },
];

export function SuperAdminShell() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Dark header — distinct from tenant UI */}
      <header className="sticky top-0 z-40 bg-slate-900 text-slate-100 shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            <div>
              <div className="text-sm font-semibold tracking-wide">IWIS · Sirah Digital</div>
              <div className="text-xs uppercase tracking-widest text-amber-400">
                Super Admin Console
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs">
              <div className="text-slate-400">Signed in as</div>
              <div className="text-slate-100">{profile?.email ?? "—"}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-200"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
