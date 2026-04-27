import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

/**
 * Shared tab strip rendered at the top of both `/chat` (patient ↔ clinician)
 * and `/staff-chat` (staff DMs + branch group chats). Lets a clinician switch
 * between the two surfaces without bouncing through the sidebar — what the
 * doctor experiences as a single combined "Chat" entry.
 *
 * Patients never see the team tab — they have no access to `/staff-chat`.
 */
export function MessagesTabs() {
    const { pathname } = useLocation();
    const { role } = useAuth();
    const isPatient = role === "PATIENT";

    const tabs = [
        { to: "/chat", label: "Patients", icon: MessageSquare, active: pathname.startsWith("/chat") && !pathname.startsWith("/staff-chat") },
        ...(isPatient ? [] : [{ to: "/staff-chat", label: "Team", icon: Users, active: pathname.startsWith("/staff-chat") }]),
    ];

    if (tabs.length <= 1) return null;

    return (
        <div className="border-b bg-card/60">
            <div className="container max-w-7xl mx-auto px-4 flex items-center gap-1 h-11">
                {tabs.map((t) => {
                    const Icon = t.icon;
                    return (
                        <Link
                            key={t.to}
                            to={t.to}
                            className={cn(
                                "inline-flex items-center gap-1.5 px-3 h-full text-sm font-medium border-b-2 transition-colors",
                                t.active
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
