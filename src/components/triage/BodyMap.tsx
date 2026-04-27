import { BodyMapPainSelector, type PainRegion } from '@/components/shared/BodyMapPainSelector';

export type { PainRegion };

interface BodyMapProps {
  value?: PainRegion[];
  onChange?: (regions: PainRegion[]) => void;
}

export function BodyMap({ value = [], onChange }: BodyMapProps) {
  return (
    <BodyMapPainSelector
      initialPainRegions={value}
      onChange={onChange}
    />
  );
}
