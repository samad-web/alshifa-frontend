import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AllergyConflict } from "@/types/ayurvedicFood";

interface Props {
  conflicts: AllergyConflict[];
  className?: string;
}

/**
 * Inline alert that surfaces every food → patient-allergy conflict for the
 * current meal. Caller is expected to render only when conflicts.length > 0.
 * Each row reads "{Food} contains {Allergen}" so the doctor can act
 * without translation.
 */
export function AllergyConflictAlert({ conflicts, className }: Props) {
  if (!conflicts || conflicts.length === 0) return null;
  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Allergy conflict detected</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 space-y-0.5 text-sm">
          {conflicts.map((c, i) => (
            <li key={`${c.foodId}-${c.allergen}-${i}`}>
              <span className="font-semibold">{c.foodName}</span> contains <span className="font-semibold">{c.allergen}</span> — patient is allergic.
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
