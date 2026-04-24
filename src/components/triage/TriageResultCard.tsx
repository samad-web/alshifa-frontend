import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MessageCircle, Activity, AlertTriangle, Clock, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeldSlot {
  clinicianId: string;
  date: string;
  time: string;
}

interface TriageResult {
  compositeScore: number;
  urgencyLevel: string;
  suggestedSpecialty: string;
  confidenceScore: number;
  inputCompleteness?: number;
  routingMatchStrength?: number;
  alternativeSpecialties?: string[];
  flags?: string[];
  redFlagsMatched?: string[];
  redFlagForced?: boolean;
  recommendedAppointmentType?: string;
  triageNotes?: string;
  painRegions?: Array<{ regionId: string; regionLabel: string; intensity: number }>;
  heldSlot?: HeldSlot | null;
  selfExamSubmissionId?: string | null;
}

interface TriageResultCardProps {
  result: TriageResult;
  onBookAppointment?: () => void;
  compact?: boolean;
}

const urgencyConfig: Record<string, { color: string; bgColor: string; label: string; pulse?: boolean }> = {
  ROUTINE:  { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', label: 'Routine' },
  MODERATE: { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', label: 'Moderate' },
  URGENT:   { color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', label: 'Urgent' },
  CRITICAL: { color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', label: 'Critical', pulse: true },
};

function ConfidenceBar({ label, score }: { label: string; score: number }) {
  const percent = Math.round(score * 100);
  const filled = Math.round(percent / 20);
  const blocks = Array.from({ length: 5 }, (_, i) => i < filled ? '\u2588' : '\u2591');
  return (
    <span className="font-mono text-sm block">
      {label}: {blocks.join('')} {percent}%
    </span>
  );
}

function formatHeldSlot(slot: HeldSlot): string {
  try {
    const d = new Date(slot.date);
    return `${d.toLocaleDateString()} at ${slot.time}`;
  } catch {
    return `${slot.date} at ${slot.time}`;
  }
}

export function TriageResultCard({ result, onBookAppointment, compact = false }: TriageResultCardProps) {
  const navigate = useNavigate();
  const urgency = urgencyConfig[result.urgencyLevel] || urgencyConfig.ROUTINE;
  const isUrgent = result.urgencyLevel === 'URGENT' || result.urgencyLevel === 'CRITICAL';
  const hasSelfExam = !!result.selfExamSubmissionId;

  return (
    <Card className={`${urgency.bgColor} border-2 ${compact ? '' : 'max-w-lg mx-auto'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Triage Assessment
          </CardTitle>
          <Badge
            variant={isUrgent ? 'destructive' : 'secondary'}
            className={`text-sm ${urgency.pulse ? 'animate-pulse' : ''}`}
          >
            {urgency.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Red-flag banner — forces user attention when an override rule fired */}
        {result.redFlagForced && result.redFlagsMatched && result.redFlagsMatched.length > 0 && (
          <div className="rounded-md border-2 border-red-400 bg-red-50 p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-red-700">Urgent clinical red flag detected</div>
              <div className="text-red-700/90 mt-1">
                Please seek care immediately. Matched: {result.redFlagsMatched.map(f => f.replace(/_/g, ' ')).join(', ')}
              </div>
            </div>
          </div>
        )}

        {/* Auto-held priority slot */}
        {result.heldSlot && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
            <Clock className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">Priority slot reserved</div>
              <div className="text-muted-foreground mt-0.5">
                We've held {formatHeldSlot(result.heldSlot)} for the next 10 minutes. Confirm to book.
              </div>
            </div>
          </div>
        )}

        {/* Body map thumbnail with highlighted regions */}
        {result.painRegions && result.painRegions.length > 0 && !compact && (
          <div className="flex flex-wrap gap-1">
            {result.painRegions.map(r => (
              <Badge key={r.regionId} variant="outline" className="text-xs">
                {r.regionLabel}: {r.intensity}/10
              </Badge>
            ))}
          </div>
        )}

        {/* Suggested specialty */}
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Suggested Specialty</div>
          <div className="font-medium">{result.suggestedSpecialty}</div>
          {result.alternativeSpecialties && result.alternativeSpecialties.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Also consider: {result.alternativeSpecialties.join(', ')}
            </div>
          )}
        </div>

        {/* Split confidence — clinicians act differently on low input completeness vs ambiguous routing */}
        <div className="space-y-0.5">
          {result.inputCompleteness !== undefined ? (
            <>
              <ConfidenceBar label="Input completeness" score={result.inputCompleteness} />
              <ConfidenceBar label="Routing match"      score={result.routingMatchStrength ?? result.confidenceScore} />
            </>
          ) : (
            <ConfidenceBar label="Match strength" score={result.confidenceScore} />
          )}
        </div>

        {/* Triage notes */}
        {result.triageNotes && !compact && (
          <div className="text-sm text-muted-foreground bg-background/50 rounded p-3">
            {result.triageNotes}
          </div>
        )}

        {/* Flags */}
        {result.flags && result.flags.length > 0 && !compact && (
          <div className="flex flex-wrap gap-1">
            {result.flags.map(f => (
              <Badge key={f} variant="outline" className="text-xs">
                {f.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}

        {/* Self-Exam Kit prompt — created automatically from this triage.
            Shown as a dedicated section above the booking CTA so the patient
            understands they should fill this in before the Vaidya visit. */}
        {hasSelfExam && !compact && (
          <div className="rounded-md border bg-white/70 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <ClipboardList className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold">Complete your Self-Examination Kit</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tongue, stool (texture), urine and other observations over the
                  next 3 days. Sent to your Vaidya before the consultation so
                  they have context on day one.
                </p>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={() => navigate('/self-exam')}
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Open Self-Exam Kit
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={onBookAppointment}>
            <Calendar className="h-4 w-4 mr-2" />
            Book a Consultation
          </Button>
          {isUrgent && (
            <Button variant="outline" className="text-red-600 border-red-300">
              <MessageCircle className="h-4 w-4 mr-2" />
              Talk to us now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
