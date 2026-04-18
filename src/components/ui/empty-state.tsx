import { motion } from "framer-motion";
import { ReactNode } from "react";
import {
  Calendar, FileText, MessageSquare, Pill, Users, Activity,
  ClipboardList, Search, Bell, Heart, TrendingUp, Package,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateVariant =
  | "appointments"
  | "prescriptions"
  | "messages"
  | "patients"
  | "reports"
  | "notifications"
  | "wellness"
  | "pharmacy"
  | "search"
  | "generic";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
}

const VARIANT_CONFIG: Record<EmptyStateVariant, {
  icon: LucideIcon;
  title: string;
  description: string;
  illustration: () => ReactNode;
  gradient: string;
}> = {
  appointments: {
    icon: Calendar,
    title: "No Appointments Yet",
    description: "Your schedule is clear. Book your first appointment to start your wellness journey.",
    gradient: "from-blue-500/5 to-cyan-500/5",
    illustration: () => <AppointmentIllustration />,
  },
  prescriptions: {
    icon: Pill,
    title: "No Prescriptions",
    description: "Your prescription list is empty. Your doctor will add medications here after consultation.",
    gradient: "from-emerald-500/5 to-teal-500/5",
    illustration: () => <PrescriptionIllustration />,
  },
  messages: {
    icon: MessageSquare,
    title: "No Messages",
    description: "Start a conversation with your care team. They're here to help.",
    gradient: "from-violet-500/5 to-purple-500/5",
    illustration: () => <MessageIllustration />,
  },
  patients: {
    icon: Users,
    title: "No Patients Found",
    description: "No patients match your current filters. Try adjusting your search criteria.",
    gradient: "from-amber-500/5 to-orange-500/5",
    illustration: () => <PatientsIllustration />,
  },
  reports: {
    icon: TrendingUp,
    title: "No Reports Available",
    description: "Reports will appear here once there is sufficient data to analyze.",
    gradient: "from-indigo-500/5 to-blue-500/5",
    illustration: () => <ReportIllustration />,
  },
  notifications: {
    icon: Bell,
    title: "All Caught Up",
    description: "You have no new notifications. We'll let you know when something needs your attention.",
    gradient: "from-green-500/5 to-emerald-500/5",
    illustration: () => <NotificationIllustration />,
  },
  wellness: {
    icon: Heart,
    title: "Start Your Wellness Journey",
    description: "Complete your first daily check-in to begin tracking your health progress.",
    gradient: "from-rose-500/5 to-pink-500/5",
    illustration: () => <WellnessIllustration />,
  },
  pharmacy: {
    icon: Package,
    title: "No Inventory Data",
    description: "Your pharmacy inventory is empty. Add medicines to get started with stock management.",
    gradient: "from-teal-500/5 to-cyan-500/5",
    illustration: () => <PharmacyIllustration />,
  },
  search: {
    icon: Search,
    title: "No Results Found",
    description: "We couldn't find what you're looking for. Try different keywords or filters.",
    gradient: "from-slate-500/5 to-gray-500/5",
    illustration: () => <SearchIllustration />,
  },
  generic: {
    icon: ClipboardList,
    title: "Nothing Here Yet",
    description: "This section will populate with data as you use the platform.",
    gradient: "from-slate-500/5 to-gray-500/5",
    illustration: () => <GenericIllustration />,
  },
};

export function EmptyState({
  variant = "generic",
  title,
  description,
  actionLabel,
  onAction,
  icon: CustomIcon,
  className,
  children,
}: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = CustomIcon || config.icon;

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        "rounded-2xl bg-gradient-to-br border border-border/30",
        config.gradient,
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Illustration */}
      <motion.div
        className="mb-6"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
      >
        {config.illustration()}
      </motion.div>

      {/* Title */}
      <motion.h3
        className="text-lg font-bold text-foreground mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {title || config.title}
      </motion.h3>

      {/* Description */}
      <motion.p
        className="text-sm text-muted-foreground max-w-sm leading-relaxed"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {description || config.description}
      </motion.p>

      {/* Action button */}
      {actionLabel && onAction && (
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button onClick={onAction} className="rounded-xl">
            {actionLabel}
          </Button>
        </motion.div>
      )}

      {children && (
        <motion.div
          className="mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}

// SVG Illustrations - minimal, elegant, animated

function AppointmentIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="text-blue-500/30 dark:text-blue-400/20">
      <motion.rect
        x="20" y="25" width="80" height="75" rx="12"
        className="stroke-current" strokeWidth="2" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
      />
      <motion.line x1="20" y1="50" x2="100" y2="50" className="stroke-current" strokeWidth="2"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.8 }}
      />
      <motion.rect x="35" y="15" width="3" height="20" rx="1.5" className="fill-current"
        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.4 }}
      />
      <motion.rect x="82" y="15" width="3" height="20" rx="1.5" className="fill-current"
        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.5 }}
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.rect
          key={i}
          x={30 + (i % 3) * 22} y={60 + Math.floor(i / 3) * 18}
          width="16" height="12" rx="3"
          className="fill-current" opacity={0.3 + (i * 0.1)}
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ delay: 1 + i * 0.1 }}
        />
      ))}
    </svg>
  );
}

function PrescriptionIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="text-emerald-500/30 dark:text-emerald-400/20">
      <motion.rect
        x="30" y="20" width="60" height="80" rx="8"
        className="stroke-current" strokeWidth="2" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
      />
      <motion.path
        d="M45 45h30M45 57h20M45 69h25"
        className="stroke-current" strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      />
      <motion.circle cx="52" cy="33" r="5" className="stroke-current" strokeWidth="2" fill="none"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2, type: "spring" }}
      />
      <motion.path d="M49 33h6M52 30v6" className="stroke-current" strokeWidth="1.5" strokeLinecap="round"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
      />
    </svg>
  );
}

function MessageIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="text-violet-500/30 dark:text-violet-400/20">
      <motion.path
        d="M25 35c0-5.5 4.5-10 10-10h50c5.5 0 10 4.5 10 10v35c0 5.5-4.5 10-10 10H55l-15 12V80H35c-5.5 0-10-4.5-10-10V35z"
        className="stroke-current" strokeWidth="2" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
      />
      <motion.circle cx="48" cy="52" r="3" className="fill-current" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1 }} />
      <motion.circle cx="60" cy="52" r="3" className="fill-current" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.1 }} />
      <motion.circle cx="72" cy="52" r="3" className="fill-current" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2 }} />
    </svg>
  );
}

function PatientsIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="text-amber-500/30 dark:text-amber-400/20">
      <motion.circle cx="45" cy="40" r="12" className="stroke-current" strokeWidth="2" fill="none"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
      />
      <motion.path d="M25 80c0-11 9-20 20-20s20 9 20 20" className="stroke-current" strokeWidth="2" fill="none" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.6 }}
      />
      <motion.circle cx="75" cy="40" r="12" className="stroke-current" strokeWidth="2" fill="none" opacity={0.5}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }}
      />
      <motion.path d="M55 80c0-11 9-20 20-20s20 9 20 80" className="stroke-current" strokeWidth="2" fill="none" strokeLinecap="round" opacity={0.5}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.8 }}
      />
    </svg>
  );
}

function ReportIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="text-indigo-500/30 dark:text-indigo-400/20">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.rect
          key={i}
          x={25 + i * 16} y={90 - (20 + i * 12)}
          width="10" height={20 + i * 12} rx="3"
          className="fill-current" opacity={0.3 + i * 0.15}
          initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
          style={{ transformOrigin: `${30 + i * 16}px 90px` }}
          transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 200 }}
        />
      ))}
      <motion.path
        d="M25 85 L40 60 L55 70 L70 40 L85 30 L100 45"
        className="stroke-current" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 1 }}
      />
    </svg>
  );
}

function NotificationIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="text-green-500/30 dark:text-green-400/20">
      <motion.path
        d="M60 20v5"
        className="stroke-current" strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.3 }}
      />
      <motion.path
        d="M40 75V50c0-11 9-20 20-20s20 9 20 20v25l8 8H32l8-8z"
        className="stroke-current" strokeWidth="2" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
      />
      <motion.path d="M52 87c1.5 3 4.5 5 8 5s6.5-2 8-5" className="stroke-current" strokeWidth="2" fill="none" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.2 }}
      />
      <motion.circle cx="60" cy="55" r="0" className="fill-current"
        animate={{ r: [0, 15, 0], opacity: [0, 0.3, 0] }}
        transition={{ duration: 2, delay: 1.5, repeat: Infinity, repeatDelay: 1 }}
      />
    </svg>
  );
}

function WellnessIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="text-rose-500/30 dark:text-rose-400/20">
      <motion.path
        d="M60 95s-30-20-30-45c0-12 10-22 22-22 5 0 8 2 8 2s3-2 8-2c12 0 22 10 22 22 0 25-30 45-30 45z"
        className="stroke-current" strokeWidth="2" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, delay: 0.3 }}
      />
      <motion.path
        d="M40 55h10l5-8 8 16 5-8h12"
        className="stroke-current" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 1.3 }}
      />
    </svg>
  );
}

function PharmacyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="text-teal-500/30 dark:text-teal-400/20">
      <motion.rect
        x="30" y="30" width="60" height="60" rx="12"
        className="stroke-current" strokeWidth="2" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
      />
      <motion.path d="M52 60h16M60 52v16" className="stroke-current" strokeWidth="3" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 1 }}
      />
    </svg>
  );
}

function SearchIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="text-slate-500/30 dark:text-slate-400/20">
      <motion.circle cx="52" cy="52" r="25" className="stroke-current" strokeWidth="2" fill="none"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
      />
      <motion.line x1="70" y1="70" x2="95" y2="95" className="stroke-current" strokeWidth="3" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.5 }}
      />
      <motion.path d="M42 52h20" className="stroke-current" strokeWidth="2" strokeLinecap="round"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
      />
    </svg>
  );
}

function GenericIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="text-slate-500/30 dark:text-slate-400/20">
      <motion.rect
        x="25" y="25" width="70" height="70" rx="12"
        className="stroke-current" strokeWidth="2" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
      />
      <motion.path
        d="M40 50h40M40 62h28M40 74h34"
        className="stroke-current" strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      />
    </svg>
  );
}
