import { ReactNode } from "react";
import { Navigation } from "./navigation";
import { cn } from "@/lib/utils";
import { HomeTherapyAdminAlertListener } from "@/components/HomeTherapyAdminAlertListener";

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      {/* Global admin popup for new therapy requests. AppLayout wraps every
          authenticated page (Login does NOT use it), so mounting here keeps
          the login path completely free of the listener and its dependencies
          while still firing the popup on every admin route. The listener
          self-gates on role and renders null for non-admins. */}
      <HomeTherapyAdminAlertListener />
      <main className={cn("pt-14 md:pt-16 pb-20 md:pb-8", className)}>
        {children}
      </main>
    </div>
  );
}
