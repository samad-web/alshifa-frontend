import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MessageCircle, Activity } from 'lucide-react';

interface TriageResult {
  compositeScore: number;
  urgencyLevel: string;
  suggestedSpecialty: string;
  confidenceScore: number;
  alternativeSpecialties?: string[];
  flags?: string[];
  recommendedAppointmentType?: string;
  triageNotes?: string;
  painRegions?: Array<{ regionId: string; regionLabel: string; intensity: number }>;
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

function ConfidenceBar({ score }: { score: number }) {
  const percent = Math.round(score * 100);
  const filled = Math.round(percent / 20);
  const blocks = Array.from({ length: 5 }, (_, i) => i < filled ? '\u2588' : '\u2591');
  return (
    <span className="font-mono text-sm">
      Match strength: {blocks.join('')} {percent}%
    </span>
  );
}

export function TriageResultCard({ result, onBookAppointment, compact = false }: TriageResultCardProps) {
  const urgency = urgencyConfig[result.urgencyLevel] || urgencyConfig.ROUTINE;
  const isUrgent = result.urgencyLevel === 'URGENT' || result.urgencyLevel === 'CRITICAL';

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

        {/* Confidence score */}
        <div>
          <ConfidenceBar score={result.confidenceScore} />
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
