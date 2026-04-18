import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Activity, Calendar, FileText, Pill, Users, Settings, Home, ChevronLeft, ChevronRight, Menu, X, Stethoscope, FlaskConical, BarChart3, Heart, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CommandPalette } from './CommandPalette';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: any;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  // Patient
  { label: 'Dashboard', path: '/patient', icon: Home, roles: ['PATIENT'] },
  { label: 'Wellness', path: '/wellness-dashboard', icon: Heart, roles: ['PATIENT'] },
  { label: 'Appointments', path: '/appointments', icon: Calendar, roles: ['PATIENT'] },
  { label: 'Triage', path: '/triage', icon: Map, roles: ['PATIENT'] },
  { label: 'Exercises', path: '/exercise-library', icon: Activity, roles: ['PATIENT'] },
  // Doctor
  { label: 'Dashboard', path: '/doctor', icon: Home, roles: ['DOCTOR'] },
  { label: 'Dashboard', path: '/doctor-admin', icon: Home, roles: ['ADMIN_DOCTOR'] },
  { label: 'Appointments', path: '/appointments', icon: Calendar, roles: ['DOCTOR', 'ADMIN_DOCTOR', 'THERAPIST'] },
  { label: 'Prescriptions', path: '/prescriptions', icon: Pill, roles: ['DOCTOR', 'ADMIN_DOCTOR', 'THERAPIST'] },
  { label: 'Journey Builder', path: '/journey-builder', icon: Stethoscope, roles: ['DOCTOR', 'ADMIN_DOCTOR', 'THERAPIST'] },
  { label: 'Reports', path: '/reports', icon: BarChart3, roles: ['ADMIN', 'ADMIN_DOCTOR', 'DOCTOR', 'THERAPIST'] },
  // Admin
  { label: 'Dashboard', path: '/admin', icon: Home, roles: ['ADMIN'] },
  { label: 'Users', path: '/manage-users', icon: Users, roles: ['ADMIN', 'ADMIN_DOCTOR'] },
  { label: 'Branches', path: '/branch-management', icon: Settings, roles: ['ADMIN', 'ADMIN_DOCTOR'] },
  // Therapist
  { label: 'Dashboard', path: '/therapist', icon: Home, roles: ['THERAPIST'] },
  { label: 'My Patients', path: '/therapist/patients', icon: Users, roles: ['THERAPIST'] },
  // Pharmacist
  { label: 'Dashboard', path: '/pharmacy', icon: Home, roles: ['PHARMACIST'] },
  { label: 'Inventory', path: '/pharmacy/inventory', icon: FlaskConical, roles: ['PHARMACIST'] },
  { label: 'Dispense', path: '/pharmacy/dispense', icon: Pill, roles: ['PHARMACIST'] },
  { label: 'Orders', path: '/pharmacy/orders', icon: FileText, roles: ['PHARMACIST'] },
];

export function AppShell() {
  const { user, role, profile, signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return <Outlet />;

  const navItems = NAV_ITEMS.filter(item => role && item.roles.includes(role));
  const userInitials = (profile?.doctor?.fullName || profile?.patient?.fullName || profile?.therapist?.fullName || user.email || '')
    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex h-screen bg-[var(--surface-base)]">
      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden md:flex flex-col border-r bg-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2 p-4 border-b">
          <Activity className="h-6 w-6 text-[var(--brand-primary)] flex-shrink-0" />
          {!collapsed && <span className="font-bold text-lg text-[var(--brand-primary)]">Al-Shifa</span>}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors mx-2 rounded-lg',
                  isActive
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white z-50 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Activity className="h-6 w-6 text-[var(--brand-primary)]" />
                <span className="font-bold text-lg text-[var(--brand-primary)]">Al-Shifa</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 py-2 overflow-y-auto">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors mx-2 rounded-lg',
                      isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b bg-white flex items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <CommandPalette />
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[var(--brand-primary)] text-white text-xs">{userInitials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="hidden sm:block">
                  <div className="text-sm font-medium">{profile?.doctor?.fullName || profile?.patient?.fullName || user.email}</div>
                  <Badge variant="outline" className="text-[10px]">{role}</Badge>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden border-t bg-white flex items-center justify-around py-2">
          {navItems.slice(0, 5).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-0.5 text-[10px]',
                  isActive ? 'text-[var(--brand-primary)]' : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
