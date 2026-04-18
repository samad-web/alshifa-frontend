import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Activity, MessageCircle } from 'lucide-react';

interface PatientCardProps {
  patient: {
    id: string;
    fullName?: string;
    age?: number;
    gender?: string;
    userId: string;
    zenPoints?: number;
  };
  wellnessScore?: number;
  lastVisitDate?: string;
  conditions?: string[];
  onBookAppointment?: () => void;
  onViewJourney?: () => void;
  onMessage?: () => void;
}

function getInitialsColor(name: string): string {
  const colors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-green-500', 'bg-indigo-500'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function MiniWellnessRing({ score }: { score: number }) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="3" />
      <circle
        cx="16" cy="16" r={radius} fill="none"
        stroke={score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'}
        strokeWidth="3"
        strokeDasharray={`${progress} ${circumference}`}
        transform="rotate(-90 16 16)"
        strokeLinecap="round"
      />
      <text x="16" y="18" textAnchor="middle" fontSize="8" fontWeight="bold" className="fill-foreground">{Math.round(score)}</text>
    </svg>
  );
}

export function PatientCard({
  patient,
  wellnessScore,
  lastVisitDate,
  conditions = [],
  onBookAppointment,
  onViewJourney,
  onMessage,
}: PatientCardProps) {
  const name = patient.fullName || 'Unknown';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarColor = getInitialsColor(name);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className={`${avatarColor} text-white text-sm`}>{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm truncate">{name}</h4>
              {wellnessScore !== undefined && <MiniWellnessRing score={wellnessScore} />}
            </div>

            <div className="text-xs text-muted-foreground mt-0.5">
              {patient.age && `${patient.age}y`}
              {patient.age && patient.gender && ' · '}
              {patient.gender}
            </div>

            {lastVisitDate && (
              <div className="text-xs text-muted-foreground mt-1">
                Last visit: {new Date(lastVisitDate).toLocaleDateString()}
              </div>
            )}

            {conditions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {conditions.slice(0, 3).map(c => (
                  <Badge key={c} variant="outline" className="text-[10px] py-0">{c}</Badge>
                ))}
                {conditions.length > 3 && (
                  <Badge variant="outline" className="text-[10px] py-0">+{conditions.length - 3}</Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 mt-3">
          {onBookAppointment && (
            <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={onBookAppointment}>
              <Calendar className="h-3 w-3 mr-1" /> Book
            </Button>
          )}
          {onViewJourney && (
            <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={onViewJourney}>
              <Activity className="h-3 w-3 mr-1" /> Journey
            </Button>
          )}
          {onMessage && (
            <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={onMessage}>
              <MessageCircle className="h-3 w-3 mr-1" /> Chat
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
