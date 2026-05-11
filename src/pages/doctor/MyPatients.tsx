import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { Search, Users, ChevronRight } from "lucide-react";

interface PatientRow {
  id: string;
  fullName: string | null;
  patientId: string | null;
  phoneNumber: string | null;
  email: string | null;
  age: number | null;
  gender: string | null;
  branchId: string | null;
  branchName: string | null;
  therapyTypes: string[];
  profilePhoto?: string | null;
  lastVisitDate?: string | null;
  hasActiveJourney?: boolean;
}

function initialsFor(name: string | null | undefined): string {
  return (name || "Patient")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "P";
}

export default function MyPatients() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Existing list-patients endpoint already supports `assignedToMe`,
        // which restricts the result to patients with at least one visit
        // under the calling clinician.
        const { data } = await apiClient.get<PatientRow[]>(
          "/api/user/list-patients",
          { assignedToMe: "true" },
        );
        if (!cancelled) setPatients(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setPatients([]);
          toast({
            title: "Could not load patients",
            description: err instanceof Error ? err.message : "",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => (p.fullName || "").toLowerCase().includes(q));
  }, [patients, search]);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <PageHeader
          title="My Patients"
          subtitle="Patients you've consulted with — tap a card for full history."
        />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name…"
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">
                {search ? "No patients match your search" : "No patients yet"}
              </p>
              <p className="text-sm">
                Patients you consult with will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <Card
                key={p.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/patients/${p.id}/timeline`)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    {p.profilePhoto ? (
                      <AvatarImage src={p.profilePhoto} alt={p.fullName ?? ""} />
                    ) : null}
                    <AvatarFallback>{initialsFor(p.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {p.fullName || "Unnamed patient"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        p.age != null ? `${p.age}y` : null,
                        p.gender ? p.gender.charAt(0) + p.gender.slice(1).toLowerCase() : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Profile on file"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Last visit{" "}
                      {p.lastVisitDate
                        ? new Date(p.lastVisitDate).toLocaleDateString()
                        : "—"}
                    </p>
                    {p.hasActiveJourney && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        Active journey
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/patients/${p.id}/timeline`);
                    }}
                  >
                    View Details <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
