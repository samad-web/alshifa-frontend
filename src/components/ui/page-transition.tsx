import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.06,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: "easeIn",
    },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

// Card hover animation wrapper
export function HoverCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      whileHover={{
        y: -4,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.div>
  );
}

// Fade-in on scroll
export function FadeInView({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

// Number counter animation
export function AnimatedCounter({
  value,
  className,
  duration = 1.5,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
    >
      <CountUp target={value} duration={duration} />
    </motion.span>
  );
}

function CountUp({ target, duration }: { target: number; duration: number }) {
  const nodeRef = { current: 0 };

  return (
    <motion.span
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      onUpdate={() => {}}
    >
      <motion.span
        animate={{ opacity: 1 }}
        transition={{ duration }}
      >
        {target}
      </motion.span>
    </motion.span>
  );
}

// Stagger list container
export function StaggerList({
  children,
  className,
  staggerDelay = 0.05,
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerListItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        initial: { opacity: 0, x: -10 },
        animate: {
          opacity: 1,
          x: 0,
          transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

// Pulse animation for notifications/badges
export function PulseDot({ className, color = "bg-primary" }: { className?: string; color?: string }) {
  return (
    <span className={className}>
      <span className="relative flex h-2.5 w-2.5">
        <motion.span
          className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-75`}
          animate={{ scale: [1, 1.8, 1], opacity: [0.75, 0, 0.75] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
      </span>
    </span>
  );
}
