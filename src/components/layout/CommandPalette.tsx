import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Calendar, User, Pill, FileText, Activity, Settings, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const PAGES = [
  { label: 'Dashboard', path: '/patient', roles: ['PATIENT'], icon: Activity },
  { label: 'My Appointments', path: '/appointments', roles: ['PATIENT'], icon: Calendar },
  { label: 'Wellness Dashboard', path: '/wellness-dashboard', roles: ['PATIENT'], icon: Activity },
  { label: 'Triage Assessment', path: '/triage', roles: ['PATIENT'], icon: FileText },
  { label: 'Exercise Library', path: '/exercise-library', roles: ['PATIENT'], icon: Activity },
  { label: 'Dashboard', path: '/doctor', roles: ['DOCTOR'], icon: Activity },
  { label: 'Dashboard', path: '/doctor-admin', roles: ['ADMIN_DOCTOR'], icon: Activity },
  { label: 'Dashboard', path: '/admin', roles: ['ADMIN'], icon: Settings },
  { label: 'Appointments', path: '/appointments', roles: ['DOCTOR', 'ADMIN_DOCTOR', 'ADMIN', 'THERAPIST'], icon: Calendar },
  { label: 'Prescriptions', path: '/prescriptions', roles: ['DOCTOR', 'ADMIN_DOCTOR', 'ADMIN', 'THERAPIST'], icon: Pill },
  { label: 'Reports', path: '/reports', roles: ['ADMIN', 'ADMIN_DOCTOR', 'DOCTOR', 'THERAPIST'], icon: FileText },
  { label: 'Create User', path: '/create-user', roles: ['ADMIN', 'ADMIN_DOCTOR'], icon: User },
  { label: 'Manage Users', path: '/manage-users', roles: ['ADMIN', 'ADMIN_DOCTOR'], icon: User },
  { label: 'Branch Management', path: '/branch-management', roles: ['ADMIN', 'ADMIN_DOCTOR'], icon: Settings },
  { label: 'Journey Builder', path: '/journey-builder', roles: ['DOCTOR', 'ADMIN_DOCTOR', 'THERAPIST'], icon: Activity },
  { label: 'Pharmacy Dashboard', path: '/pharmacy', roles: ['PHARMACIST'], icon: Pill },
  { label: 'Medicine Inventory', path: '/pharmacy/inventory', roles: ['PHARMACIST'], icon: Pill },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { role } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredPages = PAGES.filter(p => !role || p.roles.includes(role));

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border rounded-lg hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, patients, appointments..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {filteredPages.map(page => (
              <CommandItem
                key={page.path}
                onSelect={() => {
                  navigate(page.path);
                  setOpen(false);
                }}
              >
                <page.icon className="mr-2 h-4 w-4" />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { navigate('/appointments'); setOpen(false); }}>
              <Calendar className="mr-2 h-4 w-4" />
              Book Appointment
            </CommandItem>
            <CommandItem onSelect={() => { navigate('/triage'); setOpen(false); }}>
              <FileText className="mr-2 h-4 w-4" />
              Start Triage
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
