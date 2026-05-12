import { useQuery } from "@tanstack/react-query";
import { iwisApi } from "@/services/iwis.service";

// Single TanStack query that powers tab-badge counts on <DietPlansTabs />.
//
// Why this separate hook (rather than reading from the children's lists):
//   • <DietPrescriptionsPage> and <DietPackagesPage> manage their lists with
//     `useState` + plain service calls — no `useQuery` to dedupe against.
//   • Modifying either page to expose its list count upward is forbidden by
//     this task's rules (children stay in their Prompt A state).
//   • So we run one tiny parallel query here. Templates count is real;
//     `staleTime: 30_000` keeps it cached so tab switches don't refetch.
//
// Why patientCount is not in the result shape:
//   • iwisApi exposes only `listDietForPatient(patientId)` and a search
//     endpoint requiring ≥ 2 chars. There is no aggregate "list all
//     prescriptions across patients in scope" service function today.
//   • Synthesising a count by re-using the search endpoint would require
//     either a backend change (out of scope) or hitting the per-patient
//     endpoint N times (clearly wrong).
//   • Per the spec ("never `0` as a placeholder"), we extend the rule for
//     "structurally unavailable" the same way: render no badge. The badge
//     consumer in DietPlansTabs hardcodes `count: undefined` for the patient
//     tab; that flows here unchanged.
//
// When a backend `GET /api/diet-prescriptions/all` (or equivalent) ships,
// extend the `Promise.all` here to include it and return `patientCount`.

export interface DietPlansCounts {
    /** Number of approved diet-package templates the user can see. */
    templateCount: number;
}

const QUERY_KEY = ["diet-plans-counts"] as const;

export function useDietPlansCounts() {
    return useQuery<DietPlansCounts>({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            // Mirrors the call <DietPackagesPage> already makes on mount —
            // backend dedupes at the HTTP cache level too, but the staleTime
            // below is the primary reason tab switches don't refetch.
            const packages = await iwisApi.listDietPackages({ status: "APPROVED" });
            return {
                templateCount: packages.length,
            };
        },
        // 30 seconds matches typical "fresh enough" for a navigational badge;
        // the children's own list views still refetch on their normal cadence.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
    });
}
