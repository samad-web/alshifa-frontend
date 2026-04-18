import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Check, Star } from 'lucide-react';
import { BodyMap, type PainRegion } from './BodyMap';
import { TriageResultCard } from './TriageResultCard';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

const SUGGESTION_CHIPS = [
  'Digestive disorders', 'Joint pain', 'Skin conditions', 'Stress & anxiety',
  'Sleep disorders', "Women's health", 'Respiratory', 'Metabolic/weight',
];

const EXISTING_CONDITIONS = ['Diabetes', 'Hypertension', 'Thyroid', 'Heart disease', 'Asthma', 'None'];
const ONSET_PATTERNS = ['Sudden', 'Gradual', 'Recurrent'];
const DIET_TYPES = ['Vegetarian', 'Non-vegetarian', 'Vegan'];
const BOWEL_OPTIONS = ['Regular', 'Irregular', 'Constipated'];
const APPETITE_OPTIONS = ['Normal', 'Reduced', 'Increased'];

interface TriageData {
  chiefComplaint: string;
  painRegions: PainRegion[];
  existingConditions: string[];
  currentMedications: string;
  allergies: string;
  onsetPattern: string;
  sleepQuality: number;
  stressLevel: number;
  dietType: string;
  bowelRegularity: string;
  appetite: string;
}

const STORAGE_KEY = 'alshifa-triage-wizard';

const defaultData: TriageData = {
  chiefComplaint: '',
  painRegions: [],
  existingConditions: [],
  currentMedications: '',
  allergies: '',
  onsetPattern: '',
  sleepQuality: 3,
  stressLevel: 5,
  dietType: '',
  bowelRegularity: '',
  appetite: '',
};

export function TriageWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<TriageData>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultData, ...JSON.parse(saved) } : defaultData;
    } catch { return defaultData; }
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Autosave to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const update = useCallback(<K extends keyof TriageData>(key: K, value: TriageData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const canProceed = () => {
    if (step === 1) return data.chiefComplaint.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        chiefComplaint: data.chiefComplaint,
        painRegions: data.painRegions,
        painSeverity: data.painRegions.length > 0
          ? Math.max(...data.painRegions.map(r => r.intensity))
          : 0,
        duration: data.painRegions[0]?.duration || 'Days',
        symptoms: data.chiefComplaint.split(/[,;]/).map(s => s.trim()).filter(Boolean),
        existingConditions: data.existingConditions.filter(c => c !== 'None'),
        medicalHistory: data.existingConditions.join(', '),
        currentMedications: data.currentMedications,
        allergies: data.allergies,
        onsetPattern: data.onsetPattern,
        lifestyleData: {
          sleepQuality: data.sleepQuality,
          stressLevel: data.stressLevel,
          dietType: data.dietType,
          bowelRegularity: data.bowelRegularity,
          appetite: data.appetite,
        },
      };

      const res = await apiClient.post('/api/triage', payload);
      setResult(res);
      sessionStorage.removeItem(STORAGE_KEY);
      toast({ title: 'Triage submitted', description: 'Your assessment has been processed.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to submit triage', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return <TriageResultCard result={result} onBookAppointment={() => navigate('/appointments')} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress stepper */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          {['Chief Complaint', 'Medical Context', 'Lifestyle', 'Review'].map((label, i) => (
            <span key={label} className={step === i + 1 ? 'font-semibold text-foreground' : step > i + 1 ? 'text-primary' : ''}>
              {step > i + 1 ? <Check className="h-4 w-4 inline mr-1" /> : null}
              {label}
            </span>
          ))}
        </div>
        <Progress value={(step / 4) * 100} className="h-2" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {step === 1 && 'What brings you in today?'}
            {step === 2 && 'Medical Context'}
            {step === 3 && 'Lifestyle & Wellness'}
            {step === 4 && 'Review & Submit'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Chief Complaint + Body Map */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Chief Complaint</Label>
                <Textarea
                  value={data.chiefComplaint}
                  onChange={e => update('chiefComplaint', e.target.value.slice(0, 500))}
                  placeholder="Describe your main concern..."
                  maxLength={500}
                  rows={3}
                />
                <div className="text-xs text-muted-foreground text-right">{data.chiefComplaint.length}/500</div>
              </div>

              {/* Suggestion chips */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Common presentations</Label>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTION_CHIPS.map(chip => (
                    <Badge
                      key={chip}
                      variant={data.chiefComplaint.includes(chip) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        if (!data.chiefComplaint.includes(chip)) {
                          update('chiefComplaint', data.chiefComplaint ? `${data.chiefComplaint}, ${chip}` : chip);
                        }
                      }}
                    >
                      {chip}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Body Map */}
              <div className="space-y-2">
                <Label>Where does it hurt? (tap body regions)</Label>
                <BodyMap value={data.painRegions} onChange={v => update('painRegions', v)} />
              </div>
            </>
          )}

          {/* Step 2: Medical Context */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Existing Conditions</Label>
                <ToggleGroup
                  type="multiple"
                  value={data.existingConditions}
                  onValueChange={val => update('existingConditions', val)}
                  className="flex flex-wrap gap-2"
                >
                  {EXISTING_CONDITIONS.map(c => (
                    <ToggleGroupItem key={c} value={c} className="text-sm">{c}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="space-y-2">
                <Label>Current Medications</Label>
                <Textarea
                  value={data.currentMedications}
                  onChange={e => update('currentMedications', e.target.value)}
                  placeholder="List any medications you're currently taking..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Known Allergies</Label>
                <Input
                  value={data.allergies}
                  onChange={e => update('allergies', e.target.value)}
                  placeholder="Any known allergies?"
                />
              </div>

              <div className="space-y-2">
                <Label>Onset Pattern</Label>
                <ToggleGroup
                  type="single"
                  value={data.onsetPattern}
                  onValueChange={val => update('onsetPattern', val)}
                  className="flex gap-2"
                >
                  {ONSET_PATTERNS.map(p => (
                    <ToggleGroupItem key={p} value={p} className="text-sm">{p}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </>
          )}

          {/* Step 3: Lifestyle Signals */}
          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Sleep Quality</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => update('sleepQuality', n)}
                      className="p-1"
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`h-6 w-6 ${n <= data.sleepQuality ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
                      />
                    </button>
                  ))}
                  <span className="text-sm text-muted-foreground ml-2">{data.sleepQuality}/5</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Stress Level: {data.stressLevel}/10</Label>
                <Slider
                  value={[data.stressLevel]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={([v]) => update('stressLevel', v)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low stress</span><span>High stress</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Diet Type</Label>
                <Select value={data.dietType} onValueChange={v => update('dietType', v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {DIET_TYPES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Bowel Regularity</Label>
                <ToggleGroup
                  type="single"
                  value={data.bowelRegularity}
                  onValueChange={v => update('bowelRegularity', v)}
                  className="flex gap-2"
                >
                  {BOWEL_OPTIONS.map(b => (
                    <ToggleGroupItem key={b} value={b} className="text-sm">{b}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="space-y-2">
                <Label>Appetite</Label>
                <ToggleGroup
                  type="single"
                  value={data.appetite}
                  onValueChange={v => update('appetite', v)}
                  className="flex gap-2"
                >
                  {APPETITE_OPTIONS.map(a => (
                    <ToggleGroupItem key={a} value={a} className="text-sm">{a}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium text-sm">Chief Complaint</h4>
                <p className="text-sm text-muted-foreground">{data.chiefComplaint || 'Not provided'}</p>
              </div>

              {data.painRegions.length > 0 && (
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium text-sm">Pain Regions</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.painRegions.map(r => (
                      <Badge key={r.regionId} variant={r.intensity >= 7 ? 'destructive' : 'secondary'}>
                        {r.regionLabel}: {r.intensity}/10 ({r.duration})
                      </Badge>
                    ))}
                  </div>
                  {/* Mini body map thumbnail */}
                  <div className="flex justify-center">
                    <svg viewBox="0 0 280 460" className="w-24 h-auto opacity-60">
                      <path
                        d="M 140,10 C 115,15 108,45 115,75 L 128,85 L 128,100 Q 100,105 80,110 L 65,200 L 60,230 L 80,230 L 95,135 L 100,160 L 105,225 L 105,345 L 100,450 L 130,450 L 138,225 Q 140,225 142,225 L 150,450 L 180,450 L 175,345 L 175,225 L 180,160 L 185,135 L 200,230 L 220,230 L 210,200 L 200,110 Q 180,105 152,100 L 152,85 L 165,75 C 172,45 165,15 140,10 Z"
                        fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1"
                      />
                    </svg>
                  </div>
                </div>
              )}

              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium text-sm">Medical Context</h4>
                {data.existingConditions.length > 0 && (
                  <p className="text-sm"><span className="text-muted-foreground">Conditions:</span> {data.existingConditions.join(', ')}</p>
                )}
                {data.currentMedications && (
                  <p className="text-sm"><span className="text-muted-foreground">Medications:</span> {data.currentMedications}</p>
                )}
                {data.allergies && (
                  <p className="text-sm"><span className="text-muted-foreground">Allergies:</span> {data.allergies}</p>
                )}
                {data.onsetPattern && (
                  <p className="text-sm"><span className="text-muted-foreground">Onset:</span> {data.onsetPattern}</p>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium text-sm">Lifestyle</h4>
                <p className="text-sm"><span className="text-muted-foreground">Sleep:</span> {data.sleepQuality}/5 stars</p>
                <p className="text-sm"><span className="text-muted-foreground">Stress:</span> {data.stressLevel}/10</p>
                {data.dietType && <p className="text-sm"><span className="text-muted-foreground">Diet:</span> {data.dietType}</p>}
                {data.bowelRegularity && <p className="text-sm"><span className="text-muted-foreground">Bowel:</span> {data.bowelRegularity}</p>}
                {data.appetite && <p className="text-sm"><span className="text-muted-foreground">Appetite:</span> {data.appetite}</p>}
              </div>

              {/* Expected outcome preview */}
              {data.painRegions.length > 0 && (
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                  <p className="text-sm">
                    Based on your inputs, you'll be directed to our assessment team for evaluation.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        {step < 4 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Assessment'}
          </Button>
        )}
      </div>
    </div>
  );
}
