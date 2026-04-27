import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Building2, ClipboardCheck, Trophy, Shield, CalendarDays, UserPlus,
} from "lucide-react";

export default function BranchAdminDashboard() {
  const { profile } = useAuth();
  const branchName = profile?.branch?.name || "your branch";

  const tiles: Array<{ to: string; label: string; description: string; icon: typeof Users }> = [
    { to: "/branch-admin/staff",       label: "Staff Directory",   description: "Doctors and therapists assigned to your branch", icon: Users },
    { to: "/assign-patient",           label: "Assign Patient",    description: "Pair patients with clinicians in your branch",   icon: UserPlus },
    { to: "/attendance",               label: "Attendance",        description: "Set and review staff attendance",                icon: ClipboardCheck },
    { to: "/branch-admin/scorecards",  label: "Performance",       description: "Branch-level scorecards (read-only)",            icon: Trophy },
    { to: "/branch-admin/skill-matrix",label: "Skill Matrix",      description: "Therapist Ayurvedic skills (read-only)",         icon: Shield },
    { to: "/staff-schedule",           label: "Schedule",          description: "Weekly availability across the branch",          icon: CalendarDays },
  ];

  return (
    <AppLayout>
      <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Branch Admin"
          subtitle={`Manage clinicians, attendance, and patient assignments for ${branchName}.`}
        />

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4 text-primary" />
              {branchName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your access is scoped to this branch. You can view and assign patients to doctors
              and therapists in this branch, set attendance, and review performance scorecards.
              You cannot create or deactivate staff accounts, edit clinician availability, or
              modify therapist skills.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <Card key={t.to} className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="w-4 h-4 text-primary" />
                    {t.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  <Link to={t.to}>
                    <Button variant="outline" size="sm" className="w-full">Open</Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
