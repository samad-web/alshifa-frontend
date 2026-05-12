/**
 * /my-patients — clinician's personal patient list.
 *
 * Renders the `MyPatientsAdminView` component, which provides:
 *   - Search bar (debounced, name/patient-id)
 *   - Patient card grid (name, patient ID, assigned doctor, wellness score, last seen)
 *   - Pagination
 *   - Right-side vitals drawer (Sheet) on card click
 *
 * The Admin View component is intentionally reused as the canonical "my
 * patients" surface — previously this file shipped a thinner card grid
 * that called `/api/user/list-patients?assignedToMe=true` and lacked the
 * vitals drawer. MyPatientsAdminView already provides the spec'd UX, so
 * the wrapper here is just AppLayout + container padding around it.
 *
 * Roles: ADMIN_DOCTOR | DOCTOR.
 */

import { AppLayout } from "@/components/layout/app-layout";
import MyPatientsAdminView from "@/components/doctor/MyPatientsAdminView";

export default function MyPatients() {
  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <MyPatientsAdminView />
      </div>
    </AppLayout>
  );
}
