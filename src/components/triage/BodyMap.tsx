import { useState, useCallback, useRef, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RotateCcw, Zap, Flame, Heart, Waves, Hand, Snowflake, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PainRegion {
  regionId: string;
  regionLabel: string;
  intensity: number;
  characters: string[];
  duration: string;
  radiatesTo?: string;
}

interface BodyMapProps {
  value?: PainRegion[];
  onChange?: (regions: PainRegion[]) => void;
}

const PAIN_CHARACTERS = [
  { label: 'Aching', icon: Waves },
  { label: 'Burning', icon: Flame },
  { label: 'Stabbing', icon: Zap },
  { label: 'Throbbing', icon: Heart },
  { label: 'Cramping', icon: Hand },
  { label: 'Numbness', icon: Snowflake },
  { label: 'Tingling', icon: Zap },
];

const DURATIONS = ['Just started', 'Hours', 'Days', 'Weeks', 'Months', 'Over a year'];

function getIntensityEmoji(v: number) {
  if (v <= 1) return '😊';
  if (v <= 3) return '🙂';
  if (v <= 5) return '😐';
  if (v <= 7) return '😟';
  if (v <= 9) return '😣';
  return '😭';
}

interface RegionDef {
  id: string;
  label: string;
  path: string;
  side: 'front' | 'back';
  cx: number;
  cy: number;
  /** Enlarged invisible hit-area for small regions on touch */
  touchPath?: string;
}

const BODY_REGIONS: RegionDef[] = [
  // ── Front View ──
  { id: 'head', label: 'Head', cx: 140, cy: 44, side: 'front',
    path: 'M 140,12 C 118,16 110,38 113,62 Q 112,72 118,78 L 127,83 Q 140,87 153,83 L 162,78 Q 168,72 167,62 C 170,38 162,16 140,12 Z' },
  { id: 'neck', label: 'Neck', cx: 140, cy: 93, side: 'front',
    path: 'M 129,83 L 129,102 Q 140,106 151,102 L 151,83 Q 140,89 129,83 Z',
    touchPath: 'M 124,78 L 124,107 Q 140,112 156,107 L 156,78 Q 140,86 124,78 Z' },
  { id: 'chest', label: 'Chest', cx: 140, cy: 135, side: 'front',
    path: 'M 102,108 Q 100,130 102,158 Q 140,168 178,158 Q 180,130 178,108 Q 158,102 140,102 Q 122,102 102,108 Z' },
  { id: 'abdomen', label: 'Abdomen', cx: 140, cy: 192, side: 'front',
    path: 'M 106,158 L 107,222 Q 140,232 173,222 L 174,158 Q 140,168 106,158 Z' },
  { id: 'left-shoulder', label: 'Left Shoulder', cx: 88, cy: 118, side: 'front',
    path: 'M 102,108 L 78,114 Q 76,124 77,132 L 100,126 Q 100,116 102,108 Z',
    touchPath: 'M 106,104 L 72,110 Q 70,126 71,138 L 104,130 Q 104,114 106,104 Z' },
  { id: 'right-shoulder', label: 'Right Shoulder', cx: 192, cy: 118, side: 'front',
    path: 'M 178,108 L 202,114 Q 204,124 203,132 L 180,126 Q 180,116 178,108 Z',
    touchPath: 'M 174,104 L 208,110 Q 210,126 209,138 L 176,130 Q 176,114 174,104 Z' },
  { id: 'left-arm', label: 'Left Arm', cx: 74, cy: 168, side: 'front',
    path: 'M 77,132 L 68,198 L 78,200 L 94,138 Z',
    touchPath: 'M 73,126 L 62,204 L 84,206 L 100,132 Z' },
  { id: 'right-arm', label: 'Right Arm', cx: 206, cy: 168, side: 'front',
    path: 'M 203,132 L 212,198 L 202,200 L 186,138 Z',
    touchPath: 'M 207,126 L 218,204 L 196,206 L 180,132 Z' },
  { id: 'left-hand', label: 'Left Hand', cx: 64, cy: 218, side: 'front',
    path: 'M 64,198 L 58,232 L 76,232 L 80,198 Z',
    touchPath: 'M 58,192 L 50,240 L 84,240 L 88,192 Z' },
  { id: 'right-hand', label: 'Right Hand', cx: 216, cy: 218, side: 'front',
    path: 'M 208,198 L 200,232 L 218,232 L 222,198 Z',
    touchPath: 'M 202,192 L 192,240 L 226,240 L 230,192 Z' },
  { id: 'left-thigh', label: 'Left Thigh', cx: 122, cy: 270, side: 'front',
    path: 'M 110,225 L 107,312 L 132,312 L 138,225 Q 124,232 110,225 Z' },
  { id: 'right-thigh', label: 'Right Thigh', cx: 158, cy: 270, side: 'front',
    path: 'M 142,225 L 148,312 L 173,312 L 170,225 Q 156,232 142,225 Z' },
  { id: 'left-knee', label: 'Left Knee', cx: 118, cy: 330, side: 'front',
    path: 'M 107,312 Q 104,330 108,348 L 130,348 Q 134,330 132,312 Z' },
  { id: 'right-knee', label: 'Right Knee', cx: 162, cy: 330, side: 'front',
    path: 'M 148,312 Q 146,330 150,348 L 172,348 Q 176,330 173,312 Z' },
  { id: 'left-calf', label: 'Left Calf', cx: 117, cy: 386, side: 'front',
    path: 'M 108,348 L 111,422 L 127,422 L 130,348 Z' },
  { id: 'right-calf', label: 'Right Calf', cx: 163, cy: 386, side: 'front',
    path: 'M 150,348 L 153,422 L 169,422 L 172,348 Z' },
  { id: 'left-foot', label: 'Left Foot', cx: 114, cy: 440, side: 'front',
    path: 'M 109,422 L 102,452 L 132,452 L 129,422 Z',
    touchPath: 'M 103,416 L 94,460 L 140,460 L 135,416 Z' },
  { id: 'right-foot', label: 'Right Foot', cx: 166, cy: 440, side: 'front',
    path: 'M 151,422 L 148,452 L 178,452 L 171,422 Z',
    touchPath: 'M 145,416 L 140,460 L 186,460 L 177,416 Z' },
  // ── Back View ──
  { id: 'upper-back', label: 'Upper Back', cx: 140, cy: 135, side: 'back',
    path: 'M 102,108 Q 100,130 102,158 Q 140,168 178,158 Q 180,130 178,108 Q 158,102 140,102 Q 122,102 102,108 Z' },
  { id: 'lower-back', label: 'Lower Back', cx: 140, cy: 192, side: 'back',
    path: 'M 106,158 L 107,222 Q 140,232 173,222 L 174,158 Q 140,168 106,158 Z' },
  { id: 'left-hip', label: 'Left Hip', cx: 115, cy: 236, side: 'back',
    path: 'M 102,220 L 110,248 L 132,248 L 132,220 Q 117,228 102,220 Z',
    touchPath: 'M 96,214 L 106,256 L 138,256 L 138,214 Q 117,226 96,214 Z' },
  { id: 'right-hip', label: 'Right Hip', cx: 165, cy: 236, side: 'back',
    path: 'M 148,220 L 148,248 L 170,248 L 178,220 Q 163,228 148,220 Z',
    touchPath: 'M 142,214 L 142,256 L 176,256 L 184,214 Q 163,226 142,214 Z' },
];

function getRegionColors(intensity: number) {
  if (intensity <= 0) return { fill: 'transparent', glow: 'transparent', ring: 'transparent' };
  if (intensity <= 3) return {
    fill: 'rgba(34, 197, 94, 0.35)',
    glow: 'rgba(34, 197, 94, 0.25)',
    ring: 'rgba(34, 197, 94, 0.6)',
  };
  if (intensity <= 6) return {
    fill: 'rgba(251, 191, 36, 0.40)',
    glow: 'rgba(251, 191, 36, 0.25)',
    ring: 'rgba(245, 158, 11, 0.7)',
  };
  return {
    fill: 'rgba(239, 68, 68, 0.45)',
    glow: 'rgba(239, 68, 68, 0.30)',
    ring: 'rgba(239, 68, 68, 0.7)',
  };
}

export function BodyMap({ value = [], onChange }: BodyMapProps) {
  const [view, setView] = useState<'front' | 'back'>('front');
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const regions = value;

  const getRegion = useCallback((id: string) => {
    return regions.find(r => r.regionId === id);
  }, [regions]);

  const updateRegion = useCallback((regionId: string, regionLabel: string, updates: Partial<PainRegion>) => {
    const existing = regions.find(r => r.regionId === regionId);
    let updated: PainRegion[];
    if (existing) {
      updated = regions.map(r =>
        r.regionId === regionId ? { ...r, ...updates } : r
      );
    } else {
      updated = [...regions, {
        regionId,
        regionLabel,
        intensity: 3,
        characters: [],
        duration: 'Days',
        ...updates
      }];
    }
    onChange?.(updated);
  }, [regions, onChange]);

  const removeRegion = useCallback((regionId: string) => {
    onChange?.(regions.filter(r => r.regionId !== regionId));
    setActiveRegion(null);
  }, [regions, onChange]);

  // Scroll the inline detail panel into view when a region is selected
  useEffect(() => {
    if (activeRegion && detailRef.current) {
      // Small delay to let the panel render
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [activeRegion]);

  const handleRegionTap = useCallback((regionId: string, regionLabel: string) => {
    if (activeRegion === regionId) {
      setActiveRegion(null);
      return;
    }
    // Auto-add the region if not already selected
    if (!regions.find(r => r.regionId === regionId)) {
      updateRegion(regionId, regionLabel, { intensity: 3 });
    }
    setActiveRegion(regionId);
  }, [activeRegion, regions, updateRegion]);

  const visibleRegions = BODY_REGIONS.filter(r => r.side === view);
  const allRegionsForRadiation = BODY_REGIONS.map(r => ({ id: r.id, label: r.label }));
  const activeRegionDef = BODY_REGIONS.find(r => r.id === activeRegion);
  const activeRegionData = activeRegion ? getRegion(activeRegion) : undefined;

  return (
    <div className="space-y-3">
      {/* Main container */}
      <div className="relative rounded-2xl border border-border/60 bg-gradient-to-b from-card to-secondary/20 shadow-sm overflow-hidden">
        {/* Decorative blurs */}
        <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-accent/5 blur-2xl pointer-events-none" />

        {/* Header: view toggle + reset */}
        <div className="relative flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex bg-muted/80 rounded-xl p-0.5 backdrop-blur-sm border border-border/40">
            <button
              onClick={() => setView('front')}
              className={cn(
                "px-3 py-1.5 sm:px-3.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-200",
                view === 'front'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Front
            </button>
            <button
              onClick={() => setView('back')}
              className={cn(
                "px-3 py-1.5 sm:px-3.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-200",
                view === 'back'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Back
            </button>
          </div>
          {regions.length > 0 && (
            <button
              onClick={() => { onChange?.([]); setActiveRegion(null); }}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-risk transition-colors active:scale-95"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>

        {/* Body SVG — responsive sizing */}
        <div className="flex justify-center px-2 pb-1 sm:px-4 sm:pb-2">
          <svg
            viewBox="0 0 280 465"
            className="w-full max-w-[200px] sm:max-w-[240px] h-auto select-none touch-manipulation"
          >
            <defs>
              <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feFlood floodColor="rgba(34, 197, 94, 0.35)" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="shadow" />
                <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feFlood floodColor="rgba(251, 191, 36, 0.35)" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="shadow" />
                <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feFlood floodColor="rgba(239, 68, 68, 0.35)" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="shadow" />
                <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="body-shadow" x="-10%" y="-5%" width="120%" height="110%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.06)" />
              </filter>
              <linearGradient id="bodyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(210 20% 96%)" />
                <stop offset="100%" stopColor="hsl(210 20% 92%)" />
              </linearGradient>
              <linearGradient id="bodyStrokeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(214 20% 85%)" />
                <stop offset="100%" stopColor="hsl(214 20% 80%)" />
              </linearGradient>
            </defs>

            {/* Body silhouette */}
            <path
              d="M 140,12 C 118,16 110,38 113,62 Q 112,72 118,78 L 127,83 L 129,102 Q 102,108 78,114 L 64,198 L 58,232 L 80,232 L 94,138 L 100,162 L 107,225 L 107,348 L 102,452 L 132,452 L 138,225 Q 140,225 142,225 L 148,452 L 178,452 L 173,348 L 173,225 L 180,162 L 186,138 L 200,232 L 222,232 L 216,198 L 202,114 Q 178,108 151,102 L 153,83 L 162,78 Q 168,72 167,62 C 170,38 162,16 140,12 Z"
              fill="url(#bodyGradient)"
              stroke="url(#bodyStrokeGrad)"
              strokeWidth="1.2"
              filter="url(#body-shadow)"
              strokeLinejoin="round"
            />

            {/* Joint dots */}
            {[
              { x: 140, y: 93 },
              { x: 88, y: 118 },
              { x: 192, y: 118 },
              { x: 118, y: 330 },
              { x: 162, y: 330 },
            ].map((dot, i) => (
              <circle key={i} cx={dot.x} cy={dot.y} r="2" fill="hsl(214 20% 82%)" opacity="0.5" />
            ))}

            {/* Clickable regions */}
            {visibleRegions.map(region => {
              const painData = getRegion(region.id);
              const colors = painData ? getRegionColors(painData.intensity) : { fill: 'transparent', glow: 'transparent', ring: 'transparent' };
              const isActive = activeRegion === region.id;
              const glowFilter = painData
                ? painData.intensity <= 3 ? 'url(#glow-green)'
                  : painData.intensity <= 6 ? 'url(#glow-amber)'
                    : 'url(#glow-red)'
                : undefined;

              return (
                <g
                  key={region.id}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`${region.label}${painData ? ` – pain level ${painData.intensity}` : ''}`}
                  onClick={() => handleRegionTap(region.id, region.label)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRegionTap(region.id, region.label);
                    }
                    if (e.key === 'Escape') setActiveRegion(null);
                  }}
                >
                  {/* Invisible enlarged touch target for small regions */}
                  {region.touchPath && (
                    <path d={region.touchPath} fill="transparent" strokeWidth="0" />
                  )}

                  {/* Glow layer */}
                  {painData && painData.intensity > 0 && (
                    <path d={region.path} fill={colors.glow} filter={glowFilter} className="pointer-events-none" />
                  )}

                  {/* Visible region */}
                  <path
                    d={region.path}
                    fill={colors.fill}
                    stroke={isActive ? 'hsl(158 64% 40%)' : painData && painData.intensity > 0 ? colors.ring : 'transparent'}
                    strokeWidth={isActive ? 2.5 : 1.2}
                    strokeLinejoin="round"
                    className={cn(
                      "transition-all duration-200",
                      !painData && "hover:fill-primary/10"
                    )}
                  />

                  {/* Intensity badge */}
                  {painData && painData.intensity > 0 && (
                    <>
                      <circle
                        cx={region.cx} cy={region.cy} r="8"
                        fill="white" stroke={colors.ring} strokeWidth="1.5"
                        className="drop-shadow-sm pointer-events-none"
                      />
                      <text
                        x={region.cx} y={region.cy + 3.5}
                        textAnchor="middle"
                        className="text-[8px] font-bold select-none pointer-events-none"
                        fill={painData.intensity >= 7 ? '#dc2626' : painData.intensity >= 4 ? '#d97706' : '#16a34a'}
                      >
                        {painData.intensity}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {/* View label */}
            <text x="140" y="462" textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium uppercase tracking-widest select-none pointer-events-none">
              {view === 'front' ? 'Front View' : 'Back View'}
            </text>
          </svg>
        </div>

        {/* Tap hint */}
        {regions.length === 0 && (
          <p className="text-center text-[10px] text-muted-foreground font-medium pb-3 animate-pulse">
            Tap a body area to mark where you feel pain
          </p>
        )}

        {/* ── Inline detail panel (replaces popover — mobile-friendly) ── */}
        {activeRegion && activeRegionDef && (
          <div ref={detailRef} className="border-t border-border/60 animate-in slide-in-from-bottom-2 duration-200">
            <PainDetailInline
              region={activeRegionDef}
              painData={activeRegionData}
              allRegions={allRegionsForRadiation.filter(r => r.id !== activeRegion)}
              onUpdate={(updates) => updateRegion(activeRegionDef.id, activeRegionDef.label, updates)}
              onRemove={() => removeRegion(activeRegionDef.id)}
              onClose={() => setActiveRegion(null)}
            />
          </div>
        )}
      </div>

      {/* Selected regions chips */}
      {regions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {regions.map(r => (
            <button
              key={r.regionId}
              onClick={() => setActiveRegion(activeRegion === r.regionId ? null : r.regionId)}
              className={cn(
                "group inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border transition-all duration-200 active:scale-95",
                r.intensity >= 7
                  ? "bg-risk/10 border-risk/25 text-risk hover:bg-risk/20"
                  : r.intensity >= 4
                    ? "bg-attention/10 border-attention/25 text-attention-foreground hover:bg-attention/20"
                    : "bg-wellness/10 border-wellness/25 text-foreground hover:bg-wellness/20"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                backgroundColor: r.intensity >= 7 ? 'hsl(0 60% 60%)' : r.intensity >= 4 ? 'hsl(38 92% 50%)' : 'hsl(158 64% 45%)',
              }} />
              <span className="truncate max-w-[80px] sm:max-w-none">{r.regionLabel}</span>
              <span className="opacity-60 shrink-0">{r.intensity}/10</span>
              <X
                className="w-3 h-3 opacity-40 sm:opacity-0 sm:group-hover:opacity-60 transition-opacity cursor-pointer shrink-0"
                onClick={(e) => { e.stopPropagation(); removeRegion(r.regionId); }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Inline Pain Detail Panel ── */

interface PainDetailInlineProps {
  region: RegionDef;
  painData?: PainRegion;
  allRegions: { id: string; label: string }[];
  onUpdate: (updates: Partial<PainRegion>) => void;
  onRemove: () => void;
  onClose: () => void;
}

function PainDetailInline({ region, painData, allRegions, onUpdate, onRemove, onClose }: PainDetailInlineProps) {
  const intensity = painData?.intensity ?? 3;
  const characters = painData?.characters ?? [];
  const duration = painData?.duration ?? 'Days';
  const radiatesTo = painData?.radiatesTo;
  const [showRadiation, setShowRadiation] = useState(!!radiatesTo);

  const intensityColor = intensity >= 7 ? 'hsl(0 60% 60%)' : intensity >= 4 ? 'hsl(38 92% 50%)' : 'hsl(158 64% 45%)';

  return (
    <div className="bg-card/80 backdrop-blur-sm">
      {/* Header — tap to collapse */}
      <button
        onClick={onClose}
        className="w-full flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-muted/30 transition-colors active:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: intensityColor }} />
          <span className="text-sm font-bold text-foreground">{region.label}</span>
          <span className="text-base" aria-hidden>{getIntensityEmoji(intensity)}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-3 sm:space-y-4">
        {/* Intensity slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Intensity</Label>
            <span className="text-xs font-bold tabular-nums" style={{ color: intensityColor }}>
              {intensity}/10
            </span>
          </div>
          <Slider
            value={[intensity]}
            min={1} max={10} step={1}
            onValueChange={([v]) => onUpdate({ intensity: v })}
            className="py-1"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
            <span>Mild</span><span>Moderate</span><span>Severe</span>
          </div>
        </div>

        {/* Pain type chips — horizontally scrollable on mobile */}
        <div className="space-y-1.5">
          <Label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type of pain</Label>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {PAIN_CHARACTERS.map(({ label, icon: Icon }) => {
              const selected = characters.includes(label);
              return (
                <button
                  key={label}
                  onClick={() => {
                    const next = selected
                      ? characters.filter(c => c !== label)
                      : [...characters, label];
                    onUpdate({ characters: next });
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all duration-150 active:scale-95",
                    selected
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/40 border-border/50 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                  )}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration + Radiation — side by side on larger screens, stacked on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">How long?</Label>
            <Select value={duration} onValueChange={(val) => onUpdate({ duration: val })}>
              <SelectTrigger className="h-8 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map(d => (
                  <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Switch
                checked={showRadiation}
                onCheckedChange={(checked) => {
                  setShowRadiation(checked);
                  if (!checked) onUpdate({ radiatesTo: undefined });
                }}
                className="scale-90"
              />
              <Label className="text-[10px] sm:text-[11px] font-medium text-muted-foreground">Spreads?</Label>
            </div>
            {showRadiation && (
              <Select value={radiatesTo || ''} onValueChange={(val) => onUpdate({ radiatesTo: val })}>
                <SelectTrigger className="h-8 text-xs rounded-lg">
                  <SelectValue placeholder="Select region..." />
                </SelectTrigger>
                <SelectContent>
                  {allRegions.map(r => (
                    <SelectItem key={r.id} value={r.id} className="text-xs">{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Remove */}
        {painData && (
          <button
            onClick={onRemove}
            className="text-[10px] font-bold uppercase tracking-wider text-risk/60 hover:text-risk transition-colors active:scale-95"
          >
            Remove this region
          </button>
        )}
      </div>
    </div>
  );
}
