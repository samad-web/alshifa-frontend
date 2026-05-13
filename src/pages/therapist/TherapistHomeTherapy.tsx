// Therapist Home Therapy page — surfaces the same "Today's Home Therapy"
// panel the therapist sees on their dashboard, but as a standalone
// destination so the nav link has somewhere meaningful to land.
//
// Why a dedicated page rather than the admin /admin/home-therapy route?
// That admin page calls GET /api/home-therapy/requests, which the backend
// gates to ADMIN / ADMIN_DOCTOR / BRANCH_ADMIN only — therapists would 403.
// The therapist's slice is the *sessions* assigned to them, and the panel
// below already hits the THERAPIST-allowed GET /api/home-therapy/sessions
// endpoint with the backend forcing therapistId = caller.
//
// The completion-feedback modal + GPS broadcast intentionally live on the
// dashboard only — they're tied to the wider session lifecycle and don't
// need to be duplicated here.

import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import HomeTherapyTodayPanel from "@/components/dashboard/HomeTherapyTodayPanel";

export default function TherapistHomeTherapy() {
  return (
    <AppLayout>
      <div className="container max-w-6xl mx-auto px-4 py-8 space-y-6">
        <PageHeader
          title="Home Therapy"
          subtitle="Your scheduled home visits for today — depart, arrive, and complete each session inline."
        />
        <HomeTherapyTodayPanel />
      </div>
    </AppLayout>
  );
}
