import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface VitalChartProps {
  journeyId: string;
  type?: string;
  days?: number;
  compact?: boolean;
}

const VITAL_CONFIG: Record<string, { label: string; color: string; unit: string; targetMin?: number; targetMax?: number }> = {
  PAIN_SCORE:  { label: 'Pain Score', color: '#ef4444', unit: 'NRS', targetMin: 0, targetMax: 3 },
  WEIGHT:      { label: 'Weight', color: '#3b82f6', unit: 'kg' },
  BP_SYSTOLIC: { label: 'Blood Pressure (Sys)', color: '#f59e0b', unit: 'mmHg', targetMin: 90, targetMax: 120 },
  BP_DIASTOLIC:{ label: 'Blood Pressure (Dia)', color: '#f97316', unit: 'mmHg', targetMin: 60, targetMax: 80 },
  GLUCOSE:     { label: 'Glucose', color: '#8b5cf6', unit: 'mg/dL', targetMin: 70, targetMax: 140 },
  SLEEP_HOURS: { label: 'Sleep', color: '#06b6d4', unit: 'hours', targetMin: 7, targetMax: 9 },
  MOOD:        { label: 'Mood', color: '#10b981', unit: 'scale' },
};

const DATE_RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: 365 },
];

export function VitalChart({ journeyId, type = 'PAIN_SCORE', days: initialDays = 30, compact = false }: VitalChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [days, setDays] = useState(initialDays);
  const [loading, setLoading] = useState(true);

  const config = VITAL_CONFIG[type] || VITAL_CONFIG.PAIN_SCORE;

  useEffect(() => {
    loadData();
  }, [journeyId, type, days]);

  async function loadData() {
    try {
      const vitals = await apiClient.get(`/api/journeys/${journeyId}/vitals?type=${type}&days=${days}`);
      setData((vitals || []).map((v: any) => ({
        date: new Date(v.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: v.value,
        notes: v.notes,
        fullDate: v.recordedAt,
      })));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Loading...</div>;
  if (data.length === 0) return <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">No data yet</div>;

  if (compact) {
    return (
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={config.color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{config.label} ({config.unit})</h4>
        <div className="flex gap-1">
          {DATE_RANGES.map(r => (
            <Button
              key={r.label}
              variant={days === r.days ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-background border rounded-lg p-2 shadow-sm text-xs">
                  <div className="font-medium">{d.date}</div>
                  <div className="text-muted-foreground">{config.label}: {d.value} {config.unit}</div>
                  {d.notes && <div className="text-muted-foreground italic mt-1">{d.notes}</div>}
                </div>
              );
            }}
          />
          {/* Target range (green zone) */}
          {config.targetMin !== undefined && config.targetMax !== undefined && (
            <ReferenceArea
              y1={config.targetMin}
              y2={config.targetMax}
              fill="#10b981"
              fillOpacity={0.1}
              stroke="#10b981"
              strokeOpacity={0.3}
              strokeDasharray="3 3"
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={config.color}
            strokeWidth={2}
            dot={{ r: 3, fill: config.color }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
