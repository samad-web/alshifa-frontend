import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, GripVertical, Trash2, Pill, Dumbbell, Salad, Heart, Leaf, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

const TASK_TYPES = [
  { value: 'MEDICATION', label: 'Medication', icon: '💊' },
  { value: 'EXERCISE', label: 'Exercise', icon: '🏃' },
  { value: 'DIET', label: 'Diet', icon: '🥗' },
  { value: 'THERAPY', label: 'Therapy', icon: '🧘' },
  { value: 'LIFESTYLE', label: 'Lifestyle', icon: '🌿' },
];

const PHASE_COLORS: Record<string, string> = {
  Acute: 'bg-red-100 text-red-800',
  Recovery: 'bg-amber-100 text-amber-800',
  Maintenance: 'bg-blue-100 text-blue-800',
  Prevention: 'bg-green-100 text-green-800',
};

interface TaskDraft {
  type: string;
  title: string;
  description: string;
  frequency: string;
}

interface PhaseDraft {
  name: string;
  durationDays: number;
  colorTag: string;
  tasks: TaskDraft[];
  expanded: boolean;
}

interface MilestoneDraft {
  title: string;
  description: string;
  targetDate: string;
  badgeIcon: string;
}

export default function JourneyBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patientId, setPatientId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [title, setTitle] = useState('');
  const [condition, setCondition] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [phases, setPhases] = useState<PhaseDraft[]>([]);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function addPhase() {
    setPhases(prev => [...prev, {
      name: '',
      durationDays: 14,
      colorTag: 'Recovery',
      tasks: [],
      expanded: true,
    }]);
  }

  function updatePhase(index: number, updates: Partial<PhaseDraft>) {
    setPhases(prev => prev.map((p, i) => i === index ? { ...p, ...updates } : p));
  }

  function removePhase(index: number) {
    setPhases(prev => prev.filter((_, i) => i !== index));
  }

  function movePhase(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= phases.length) return;
    const updated = [...phases];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setPhases(updated);
  }

  function addTask(phaseIndex: number) {
    const updated = [...phases];
    updated[phaseIndex].tasks.push({ type: 'MEDICATION', title: '', description: '', frequency: 'Daily' });
    setPhases(updated);
  }

  function updateTask(phaseIndex: number, taskIndex: number, updates: Partial<TaskDraft>) {
    const updated = [...phases];
    updated[phaseIndex].tasks[taskIndex] = { ...updated[phaseIndex].tasks[taskIndex], ...updates };
    setPhases(updated);
  }

  function removeTask(phaseIndex: number, taskIndex: number) {
    const updated = [...phases];
    updated[phaseIndex].tasks.splice(taskIndex, 1);
    setPhases(updated);
  }

  function addMilestone() {
    setMilestones(prev => [...prev, { title: '', description: '', targetDate: '', badgeIcon: '' }]);
  }

  async function handleSubmit() {
    if (!patientId || !branchId || !title || !condition) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        patientId,
        branchId,
        title,
        condition,
        targetDate: targetDate || undefined,
        phases: phases.map((p, i) => ({
          name: p.name || `Phase ${i + 1}`,
          order: i,
          durationDays: p.durationDays,
          tasks: p.tasks.filter(t => t.title).map(t => ({
            type: t.type,
            title: t.title,
            description: t.description || undefined,
            frequency: t.frequency,
          })),
        })),
        milestones: milestones.filter(m => m.title).map(m => ({
          title: m.title,
          description: m.description || undefined,
          targetDate: m.targetDate || undefined,
          badgeIcon: m.badgeIcon || undefined,
        })),
      };

      await apiClient.post('/api/journeys', payload);
      toast({ title: 'Journey created', description: `Treatment journey "${title}" has been created.` });
      navigate(-1);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Create Treatment Journey</h1>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Journey Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Patient ID *</Label>
              <Input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="User ID" />
            </div>
            <div className="space-y-2">
              <Label>Branch ID *</Label>
              <Input value={branchId} onChange={e => setBranchId(e.target.value)} placeholder="Branch ID" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Journey Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Knee Osteoarthritis Recovery" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Condition *</Label>
              <Input value={condition} onChange={e => setCondition(e.target.value)} placeholder="e.g. Knee Osteoarthritis" />
            </div>
            <div className="space-y-2">
              <Label>Target Date</Label>
              <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phases */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Treatment Phases</CardTitle>
          <Button size="sm" onClick={addPhase}><Plus className="h-4 w-4 mr-1" /> Add Phase</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {phases.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No phases yet. Add treatment phases to build the journey.</p>
          )}
          {phases.map((phase, pi) => (
            <div key={pi} className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 p-3 bg-muted/50">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <Badge className={PHASE_COLORS[phase.colorTag] || 'bg-gray-100'}>{phase.colorTag}</Badge>
                <Input
                  className="flex-1 h-8 text-sm"
                  value={phase.name}
                  onChange={e => updatePhase(pi, { name: e.target.value })}
                  placeholder="Phase name"
                />
                <Input
                  className="w-20 h-8 text-sm"
                  type="number"
                  value={phase.durationDays}
                  onChange={e => updatePhase(pi, { durationDays: parseInt(e.target.value) || 1 })}
                  min={1}
                />
                <span className="text-xs text-muted-foreground">days</span>
                <Select value={phase.colorTag} onValueChange={v => updatePhase(pi, { colorTag: v })}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(PHASE_COLORS).map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePhase(pi, 'up')} disabled={pi === 0}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePhase(pi, 'down')} disabled={pi === phases.length - 1}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePhase(pi)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Tasks within phase */}
              <div className="p-3 space-y-2">
                {phase.tasks.map((task, ti) => (
                  <div key={ti} className="flex items-center gap-2">
                    <span className="text-lg">{TASK_TYPES.find(t => t.value === task.type)?.icon || '📋'}</span>
                    <Select value={task.type} onValueChange={v => updateTask(pi, ti, { type: v })}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.icon} {t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="flex-1 h-8 text-xs" value={task.title} onChange={e => updateTask(pi, ti, { title: e.target.value })} placeholder="Task title" />
                    <Input className="w-24 h-8 text-xs" value={task.frequency} onChange={e => updateTask(pi, ti, { frequency: e.target.value })} placeholder="Frequency" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeTask(pi, ti)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="text-xs" onClick={() => addTask(pi)}>
                  <Plus className="h-3 w-3 mr-1" /> Add Task
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2"><Award className="h-5 w-5" /> Milestones</CardTitle>
          <Button size="sm" onClick={addMilestone}><Plus className="h-4 w-4 mr-1" /> Add Milestone</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input className="flex-1 h-8 text-sm" value={m.title} onChange={e => {
                const updated = [...milestones];
                updated[i] = { ...updated[i], title: e.target.value };
                setMilestones(updated);
              }} placeholder="e.g. First week pain-free" />
              <Input type="date" className="w-36 h-8 text-xs" value={m.targetDate} onChange={e => {
                const updated = [...milestones];
                updated[i] = { ...updated[i], targetDate: e.target.value };
                setMilestones(updated);
              }} />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setMilestones(prev => prev.filter((_, j) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Journey'}
        </Button>
      </div>
    </div>
  );
}
