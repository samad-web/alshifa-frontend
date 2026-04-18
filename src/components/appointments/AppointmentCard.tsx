import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Circle, Clock, Video, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppointmentCardProps {
  appointment: {
    id: string;
    date: string;
    status: string;
    consultationType?: string;
    consultationMode?: string;
    meetingLink?: string;
    notes?: string;
    doctor?: { fullName?: string };
    therapist?: { fullName?: string };
    patient?: { fullName?: string };
  };
  userRole?: string;
  onApprove?: () => void;
  onReject?: () => void;
  onReschedule?: () => void;
  onJoinMeeting?: () => void;
}

const STATUS_STEPS = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  PENDING:                    { color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Pending' },
  SCHEDULED:                  { color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Scheduled' },
  CONFIRMED:                  { color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Confirmed' },
  ACCEPTED:                   { color: 'text-green-600', bgColor: 'bg-green-50', label: 'Accepted' },
  COMPLETED:                  { color: 'text-green-700', bgColor: 'bg-green-50', label: 'Completed' },
  CANCELLED:                  { color: 'text-red-600', bgColor: 'bg-red-50', label: 'Cancelled' },
  NO_SHOW:                    { color: 'text-red-500', bgColor: 'bg-red-50', label: 'No Show' },
  PENDING_DOCTOR_APPROVAL:    { color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Awaiting Doctor' },
  PENDING_THERAPIST_APPROVAL: { color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Awaiting Therapist' },
};

function getStepStatus(currentStatus: string, step: string) {
  const stepOrder = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
  const normalizedCurrent = ['ACCEPTED', 'SCHEDULED'].includes(currentStatus) ? 'CONFIRMED' : currentStatus;
  const currentIdx = stepOrder.indexOf(normalizedCurrent);
  const stepIdx = stepOrder.indexOf(step);

  if (currentStatus === 'CANCELLED' || currentStatus === 'NO_SHOW') return 'cancelled';
  if (stepIdx < currentIdx) return 'completed';
  if (stepIdx === currentIdx) return 'current';
  return 'future';
}

export function AppointmentCard({
  appointment,
  userRole,
  onApprove,
  onReject,
  onReschedule,
  onJoinMeeting,
}: AppointmentCardProps) {
  const config = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.PENDING;
  const isDoctor = userRole === 'DOCTOR' || userRole === 'ADMIN_DOCTOR';
  const isPending = ['PENDING', 'PENDING_DOCTOR_APPROVAL', 'PENDING_THERAPIST_APPROVAL'].includes(appointment.status);
  const isOnline = appointment.consultationMode === 'ONLINE';
  const appointmentDate = new Date(appointment.date);
  const now = new Date();
  const minutesUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60);
  const canJoin = isOnline && appointment.meetingLink && minutesUntil <= 15 && minutesUntil >= -60;

  const clinicianName = appointment.doctor?.fullName || appointment.therapist?.fullName || 'Doctor';

  return (
    <Card className={cn('border', config.bgColor)}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">{clinicianName}</div>
            <div className="text-xs text-muted-foreground">
              {appointmentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' at '}
              {appointmentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <Badge variant="outline" className={cn('text-xs', config.color)}>
            {config.label}
          </Badge>
        </div>

        {/* Status timeline stepper */}
        <div className="flex items-center gap-1">
          {STATUS_STEPS.map((step, i) => {
            const status = getStepStatus(appointment.status, step);
            return (
              <div key={step} className="flex items-center gap-1 flex-1">
                <div className={cn(
                  'flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors',
                  status === 'completed' ? 'bg-green-500 border-green-500' :
                  status === 'current' ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]' :
                  status === 'cancelled' ? 'border-red-300 bg-red-100' :
                  'border-gray-200'
                )}>
                  {status === 'completed' ? <Check className="h-3 w-3 text-white" /> :
                   status === 'current' ? <Circle className="h-2 w-2 fill-white text-white" /> :
                   null}
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5',
                    status === 'completed' ? 'bg-green-400' :
                    status === 'cancelled' ? 'bg-red-200' :
                    'bg-gray-200'
                  )} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>Requested</span>
          <span>Confirmed</span>
          <span>In Progress</span>
          <span>Completed</span>
        </div>

        {/* Consultation type + mode */}
        <div className="flex gap-2">
          {appointment.consultationType && (
            <Badge variant="outline" className="text-xs">{appointment.consultationType}</Badge>
          )}
          {isOnline && (
            <Badge variant="outline" className="text-xs">
              <Video className="h-3 w-3 mr-1" /> Online
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {/* Doctor approval actions */}
          {isDoctor && isPending && onApprove && (
            <>
              <Button size="sm" className="flex-1 h-8 text-xs" onClick={onApprove}>
                <Check className="h-3 w-3 mr-1" /> Approve
              </Button>
              {onReject && (
                <Button variant="destructive" size="sm" className="flex-1 h-8 text-xs" onClick={onReject}>
                  <X className="h-3 w-3 mr-1" /> Reject
                </Button>
              )}
              {onReschedule && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onReschedule}>
                  <Clock className="h-3 w-3 mr-1" /> Reschedule
                </Button>
              )}
            </>
          )}

          {/* Join meeting button (visible within 15 min window) */}
          {canJoin && onJoinMeeting && (
            <Button size="sm" className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={onJoinMeeting}>
              <Video className="h-3 w-3 mr-1" /> Join Meeting
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
