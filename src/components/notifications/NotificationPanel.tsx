import { useNotifications, Notification } from '@/contexts/NotificationContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, CheckCheck, Trash2, Calendar, FileText, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth, type AppRole } from '@/hooks/useAuth';

interface NotificationPanelProps {
    onClose?: () => void;
}

// Map a notification's type → the page to land on when the user clicks it.
// Returns null when there's no specific destination (the panel will just
// close in that case). The shape of `data` varies by emitter; we cast
// loosely and only read the fields we expect for each known type.
function resolveNotificationRoute(notification: Notification, role: AppRole | null): string | null {
    const data = (notification.data as Record<string, unknown> | undefined) || {};
    const conversationId = typeof data.conversationId === 'string' ? data.conversationId : undefined;
    const appointmentId  = typeof data.appointmentId  === 'string' ? data.appointmentId  : undefined;
    const summaryId      = typeof data.summaryId      === 'string' ? data.summaryId      : undefined;
    const handoffId      = typeof data.handoffId      === 'string' ? data.handoffId      : undefined;
    const patientId      = typeof data.patientId      === 'string' ? data.patientId      : undefined;

    const isPatient   = role === 'PATIENT';
    const isClinician = role === 'DOCTOR' || role === 'THERAPIST' || role === 'ADMIN_DOCTOR';
    const isAdmin     = role === 'ADMIN' || role === 'ADMIN_DOCTOR' || role === 'BRANCH_ADMIN';

    // Notifications can carry an explicit `link` in their data payload (the
    // backend uses this as a generic destination hint — e.g. FOLLOW_UP_TASK_CREATED
    // ships "/doctor?tab=follow-up-tasks"). When present, prefer it over
    // type-based routing so we don't have to maintain a case for every new
    // notification type the backend adds.
    //
    // SECURITY GATE: enforce that the link is reachable for the recipient's
    // role. A patient must never be routed into `/admin/*`, `/doctor/*`,
    // `/critical-journey`, `/super-admin/*`, etc. — even if the backend
    // accidentally (or maliciously) ships that link. The matching set
    // mirrors the route guards in App.tsx; widen cautiously.
    if (typeof data.link === 'string' && data.link.startsWith('/')) {
        const link = data.link;
        const isClinicianOnlyPrefix =
            /^\/(doctor|doctor-admin|therapist|admin|admin\/|branch-admin|critical-journey|care-gaps|super-admin|pharmacy|appointments|consultation|patients|self-exam-review|handoff-notes|reports|xp-dashboard)(\/|$|\?)/i
                .test(link);
        if (isPatient && isClinicianOnlyPrefix) {
            // Fall through to the type-based switch which has patient-safe
            // defaults; do NOT honour the unsafe link.
        } else {
            return link;
        }
    }

    switch (notification.type) {
        // ── Chat ────────────────────────────────────────────────────────────
        case 'NEW_MESSAGE':
            return conversationId ? `/chat?conversation=${conversationId}` : '/chat';

        // ── Appointments ────────────────────────────────────────────────────
        case 'NEW_APPOINTMENT':
        case 'APPOINTMENT_BOOKED':
        case 'APPOINTMENT_CANCELLED':
        case 'APPOINTMENT_REMINDER':
        case 'appointment_confirmed':
        case 'appointment_cancelled':
            return '/appointments';

        // ── Handoff notes ───────────────────────────────────────────────────
        case 'HANDOFF_ASSIGNED':
        case 'handoff_received':
            return handoffId ? `/handoff-notes?id=${handoffId}` : '/handoff-notes';

        // ── Visit summary ───────────────────────────────────────────────────
        case 'VISIT_SUMMARY':
        case 'visit_summary':
            return summaryId ? `/visit-summary?id=${summaryId}` : '/visit-summary';

        // ── Todos ───────────────────────────────────────────────────────────
        case 'TODO_ASSIGNED':
        case 'TODO_REMINDER':
        case 'TODO_DUE_SOON':
        case 'todo:assigned':
            // No dedicated page — TodoPanel lives on the role dashboard.
            if (role === 'DOCTOR' || role === 'ADMIN_DOCTOR') return '/doctor';
            if (role === 'THERAPIST') return '/therapist';
            return null;

        // ── Prescriptions ───────────────────────────────────────────────────
        case 'PRESCRIPTION_DISCONTINUED':
        case 'PRESCRIPTION_EXPIRY':
        case 'PRESCRIPTION_EXPIRY_CLINICIAN':
            return '/prescriptions';
        case 'PRESCRIPTION_READY':
            return isPatient ? '/patient' : '/pharmacy/orders';

        // ── Journey ─────────────────────────────────────────────────────────
        case 'JOURNEY_CREATED':
            if (isClinician) return patientId ? `/patients/${patientId}/timeline` : '/journey-builder';
            return '/patient';
        case 'JOURNEY_FEEDBACK_AVAILABLE':
        case 'JOURNEY_FEEDBACK_REMINDER':
            return '/patient';

        // ── Home therapy ────────────────────────────────────────────────────
        case 'HOME_THERAPY_BRIEF':
            return role === 'THERAPIST' ? '/therapist/home-therapy' : '/admin/home-therapy';
        case 'HOME_THERAPY_BRIEF_ADMIN':
            return '/admin/home-therapy';

        // ── Self exam ───────────────────────────────────────────────────────
        case 'SELF_EXAM_SUBMITTED':
            return isClinician ? '/self-exam-review' : '/self-exam';

        // ── Care gaps & critical journey ────────────────────────────────────
        case 'CARE_GAP_NO_VISIT':
        case 'CARE_GAP_INCOMPLETE_TRIAGE':
        case 'CARE_GAP_LOW_ADHERENCE':
        case 'CARE_GAP_WELLNESS_DECLINE':
        case 'CARE_GAP_OVERDUE_PHASE':
        case 'CARE_GAP_OVERDUE_PHASE_DOCTOR':
        case 'CARE_GAP_HIGH_PAIN':
            return '/care-gaps';
        case 'MISSED_MEDICATION':
        case 'MISSED_VITAL_UPLOAD':
        case 'MISSED_DAILY_CHECKIN':
        case 'MISSED_FOLLOWUP':
        case 'FOLLOWUP_MISSED':
            return isPatient ? '/patient' : '/critical-journey';

        // ── Triage escalation ───────────────────────────────────────────────
        // Fires when a CRITICAL / URGENT triage hits an admin-doctor's queue.
        // Land them on the Pending appointments tab so they can act on the
        // auto-held slot. Super admins keep their dedicated cross-hospital
        // view.
        case 'TRIAGE_ESCALATION':
            if (role === 'SUPER_ADMIN') return '/super-admin/triage';
            if (isClinician || isAdmin) return '/appointments?status=PENDING';
            return null;

        // ── Follow-up tasks (auto-generated from CRITICAL triage flow) ──────
        // Backend ships data.link='/doctor?tab=follow-up-tasks'; this case is
        // a fallback for older rows that pre-date the data.link convention.
        case 'FOLLOW_UP_TASK_CREATED':
        case 'FOLLOW_UP_TASK_REMINDER':
            if (role === 'DOCTOR' || role === 'ADMIN_DOCTOR') return '/doctor?tab=follow-up-tasks';
            if (role === 'THERAPIST') return '/therapist?tab=follow-up-tasks';
            return null;

        // ── F07 · Multi-Agent Orchestration notifications ───────────────────
        // careGapAgent — patient added to the critical monitor watch list.
        // Lands on Critical Journey so the clinician sees the new flag row.
        case 'CRITICAL_TRIAGE':
            return isPatient ? '/patient' : '/critical-journey';
        // dashboardSummariser — consolidated briefing card for the held
        // slot. Best landing surface is the Pending appointments queue
        // where the auto-held slot sits awaiting approval.
        case 'CRITICAL_TRIAGE_SUMMARY':
            return '/appointments?status=PENDING';
        // pharmacyAgent + platform-wide low-stock alerts. Canonical type
        // is LOW_STOCK_ALERT (see notification.service.sendLowStockAlert);
        // 'LOW_STOCK' kept as alias for back-compat with any older rows.
        case 'LOW_STOCK':
        case 'LOW_STOCK_ALERT':
            return '/pharmacy/inventory';

        // ── F04 · Predictive Dosha forecast alert ───────────────────────────
        // Surfaced on Critical Journey alongside the PatientCriticalFlag
        // row the cron upserted.
        case 'DOSHA_FORECAST_ALERT':
            return isPatient ? '/patient' : '/critical-journey';

        // ── Bulk patient import ─────────────────────────────────────────────
        case 'PATIENT_IMPORT':
            return '/manage-users';

        // ── Gamification (patient) ──────────────────────────────────────────
        case 'AVATAR_LEVEL_UP':
            return '/health-avatar';
        case 'ACHIEVEMENT':
        case 'achievement_unlocked':
            return '/achievement-showcase';
        case 'FAMILY_MEMBER_JOINED':
            return '/family-leaderboard';
        case 'QUEST_COMPLETE':
        case 'quest_completed':
            return '/health-quests';
        case 'level_up':
            return isPatient ? '/health-avatar' : '/xp-dashboard';
        case 'badge_earned':
            return isPatient ? '/achievement-showcase' : '/xp-dashboard';

        // ── Referrals ───────────────────────────────────────────────────────
        case 'REFERRAL_COMPLETED':
            return '/referrals';
        case 'REFERRAL_TIER':
            return '/referral-rewards';

        // ── Mentor sessions ─────────────────────────────────────────────────
        case 'mentor_session_scheduled':
            return '/mentor-hub';

        // ── Announcements ───────────────────────────────────────────────────
        // ANNOUNCEMENT (uppercase) is the canonical type written by the
        // announcement service's notification fan-out (one row per targeted
        // user — what makes doctor / patient bells light up at all). The
        // lowercase legacy variant stays for back-compat with any older
        // rows already in the DB.
        case 'ANNOUNCEMENT':
        case 'new_announcement':
            return '/announcements';

        // ── Reward store ────────────────────────────────────────────────────
        case 'reward_redeemed':
        case 'redemption_processed':
            return '/reward-store';

        // ── Appointment side-channel (used in legacy code paths) ────────────
        case 'APPOINTMENT':
            return appointmentId ? `/consultation/${appointmentId}` : '/appointments';

        default:
            // Unknown type — fall back to a role-appropriate dashboard so
            // the click still feels responsive.
            if (isPatient)   return '/patient';
            if (isAdmin)     return role === 'ADMIN_DOCTOR' ? '/doctor-admin' : '/admin';
            if (isClinician) return role === 'THERAPIST' ? '/therapist' : '/doctor';
            return null;
    }
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotifications();
    const { role } = useAuth();
    const navigate = useNavigate();
    const isPatient = role === 'PATIENT';

    const getPriorityStyles = (priority: string) => {
        switch (priority) {
            case 'HIGH':
                return {
                    border: 'border-l-4 border-l-destructive',
                    bg: 'bg-destructive/5',
                    text: 'text-destructive',
                    icon: <AlertCircle className="h-4 w-4 text-destructive" />,
                    badge: 'bg-destructive text-destructive-foreground'
                };
            case 'MEDIUM':
                return {
                    border: 'border-l-4 border-l-amber-500',
                    bg: 'bg-amber-500/5',
                    text: 'text-amber-600',
                    icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
                    badge: 'bg-amber-500 text-white'
                };
            case 'LOW':
                return {
                    border: 'border-l-4 border-l-blue-500',
                    bg: 'bg-blue-500/5',
                    text: 'text-blue-600',
                    icon: <Bell className="h-4 w-4 text-blue-500" />,
                    badge: 'bg-blue-500 text-white'
                };
            default:
                return {
                    border: 'border-l-4 border-l-transparent',
                    bg: '',
                    text: '',
                    icon: <Bell className="h-4 w-4 text-muted-foreground" />,
                    badge: 'bg-muted text-muted-foreground'
                };
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }
        const route = resolveNotificationRoute(notification, role);
        if (route) navigate(route);
        // Always close the panel after a click — the user has acted on it.
        onClose?.();
    };

    return (
        <Card className="w-[380px] max-w-[calc(100vw-2rem)] shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                            ({unreadCount} new)
                        </span>
                    )}
                </div>
                <div className="flex gap-1">
                    {!isPatient && unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={markAllAsRead}
                            className="h-8 text-xs"
                        >
                            <CheckCheck className="h-3 w-3 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </div>
            </div>

            <ScrollArea className="h-[450px]">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Bell className="h-12 w-12 text-muted-foreground/20 mb-3" />
                        <p className="text-sm text-muted-foreground">No notifications yet</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {notifications.map((notification) => {
                            const styles = getPriorityStyles(notification.priority);
                            return (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`p-4 cursor-pointer transition-colors hover:bg-accent/50 group relative ${styles.border} ${!notification.read ? styles.bg || 'bg-primary/5' : ''
                                        }`}
                                >
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 mt-1">
                                            {styles.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <div className="flex flex-col gap-1">
                                                    <h4 className={`text-sm font-medium leading-none ${!notification.read ? 'font-bold' : ''} ${notification.priority === 'HIGH' ? 'text-destructive' : ''}`}>
                                                        {notification.title}
                                                    </h4>
                                                    {notification.priority !== 'INFO' && (
                                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm w-fit ${styles.badge}`}>
                                                            {notification.priority}
                                                        </span>
                                                    )}
                                                </div>
                                                {!notification.read && (
                                                    <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                                                )}
                                            </div>
                                            <p className={`text-sm line-clamp-2 ${notification.priority === 'HIGH' && !notification.read ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-muted-foreground/60 mt-2">
                                                {formatDistanceToNow(new Date(notification.timestamp), {
                                                    addSuffix: true,
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>

            {notifications.length > 0 && (
                <div className="p-3 border-t flex justify-between items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearNotifications}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear all
                    </Button>
                </div>
            )}
        </Card>
    );
}
