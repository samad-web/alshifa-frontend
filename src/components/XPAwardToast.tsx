// XPAwardToast — centered animated popup that fires when the clinician's
// dashboard receives an `xp_awarded` socket event. Distinct from the
// corner-toast NotifyProvider used elsewhere because XP wins deserve a
// proper celebration moment.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useWebSocket } from "@/contexts/WebSocketContext";

interface XPAwardEvent {
    amount: number;
    event:  string;
    source?: string;
}

const PRIMARY_TEAL = "#0D6E6E";

/**
 * Drop this near the top of any clinician page that should celebrate XP wins.
 * Renders nothing until an `xp_awarded` event lands; auto-dismisses 4s later.
 */
export function XPAwardToast() {
    const { socket } = useWebSocket();
    const [event, setEvent] = useState<XPAwardEvent | null>(null);

    useEffect(() => {
        if (!socket) return;
        const handler = (payload: XPAwardEvent) => {
            if (!payload || !Number.isFinite(payload.amount)) return;
            setEvent(payload);
            // Auto-dismiss after 4s.
            window.setTimeout(() => setEvent((curr) => (curr === payload ? null : curr)), 4000);
        };
        socket.on("xp_awarded", handler);
        return () => { socket.off("xp_awarded", handler); };
    }, [socket]);

    return (
        <AnimatePresence>
            {event && (
                <motion.div
                    key={`${event.event}-${event.amount}-${Date.now()}`}
                    initial={{ opacity: 0, scale: 0.5, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                    className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
                    aria-live="polite"
                >
                    <div
                        className="rounded-3xl shadow-2xl bg-white px-10 py-8 flex flex-col items-center gap-2 border-4 pointer-events-auto"
                        style={{ borderColor: PRIMARY_TEAL }}
                    >
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-7 h-7" style={{ color: PRIMARY_TEAL }} />
                            <motion.span
                                initial={{ scale: 0.5 }}
                                animate={{ scale: [0.5, 1.15, 1] }}
                                transition={{ duration: 0.6 }}
                                className="text-5xl font-black"
                                style={{ color: PRIMARY_TEAL }}
                            >
                                +{event.amount} XP
                            </motion.span>
                        </div>
                        <p className="text-sm font-bold text-foreground uppercase tracking-tight">
                            {event.source || "XP awarded"} ⭐
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
