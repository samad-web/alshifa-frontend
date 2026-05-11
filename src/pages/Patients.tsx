/**
 * Patients index — admin-side patient roster.
 *
 * Lists every patient in the caller's scope (ADMIN / ADMIN_DOCTOR see the
 * whole hospital, BRANCH_ADMIN / DOCTOR / THERAPIST / PHARMACIST are
 * branch-scoped server-side). Each row links to the full Patient profile
 * page; the "Assign vitals" quick action deep-links straight into the
 * Vitals tab so the most common admin workflow is one click away.
 *
 * Renders a search box (matches against fullName, patientId, phoneNumber
 * server-side) and a debounced refetch so typing stays responsive.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  Search,
  Users,
  Phone,
  Building2,
  TrendingUp,
  ChevronRight,
  UserPlus,
} from "lucide-react";

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
}

export default function PatientsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 250ms debounce so each keystroke doesn't fire a fetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (debouncedSearch) params.search = debouncedSearch;
        const { data } = await apiClient.get<PatientRow[]>("/api/user/list-patients", params);
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
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, toast]);

  // Group by branch when we have multiple — keeps the list scannable for
  // ADMINs who see across branches. For branch-scoped roles every row
  // shares one branch so the heading is essentially decorative there.
  const grouped = useMemo(() => {
    const map = new Map<string, { branch: string; rows: PatientRow[] }>();
    for (const p of patients) {
      const key = p.branchId ?? "__no_branch__";
      const branch = p.branchName ?? "Unassigned branch";
      if (!map.has(key)) map.set(key, { branch, rows: [] });
      map.get(key)!.rows.push(p);
    }
    return [...map.values()].sort((a, b) => a.branch.localeCompare(b.branch));
  }, [patients]);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Patients
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Open a patient to manage vitals, prescriptions, journey, and appointments.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/create-user">
              <UserPlus className="w-4 h-4" />
              New patient
            </Link>
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, patient ID, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search patients"
          />
        </div>

        {/* List */}
        {loading ? (
          <Card>
            <CardContent className="p-2 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>
        ) : patients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="font-medium text-foreground">
                {debouncedSearch ? "No patients matched your search" : "No patients in your scope yet"}
              </p>
              {!debouncedSearch && (
                <p className="text-sm text-muted-foreground">
                  Use <span className="font-medium text-foreground">New patient</span> above to add one.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {grouped.map((group) => (
              <section key={group.branch} className="space-y-2">
                {grouped.length > 1 && (
                  <header className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {group.branch}
                    <span className="text-muted-foreground/60">· {group.rows.length}</span>
                  </header>
                )}
                <Card>
                  <CardContent className="p-1">
                    <ul className="divide-y divide-border/40">
                      {group.rows.map((p) => (
                        <li
                          key={p.id}
                          className="group flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/40 focus-within:bg-secondary/40 transition-colors"
                        >
                          {/* Patient identity */}
                          <Link
                            to={`/patients/${p.id}`}
                            className="flex-1 min-w-0 flex items-center gap-3 outline-none"
                            aria-label={`Open ${p.fullName ?? "patient"} profile`}
                          >
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                              {(p.fullName ?? "P").trim().charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                  {p.fullName ?? "Unnamed patient"}
                                </span>
                                {p.patientId && (
                                  <span className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                                    {p.patientId}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                                {p.phoneNumber && (
                                  <span className="inline-flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {p.phoneNumber}
                                  </span>
                                )}
                                {p.age != null && <span>· {p.age} yrs</span>}
                                {Array.isArray(p.therapyTypes) && p.therapyTypes.length > 0 &&
                                  p.therapyTypes.map((t) => (
                                    <Badge key={t} variant="outline" className="text-[10px] py-0 h-4 ml-1">
                                      {t}
                                    </Badge>
                                  ))
                                }
                              </div>
                            </div>
                          </Link>

                          {/* Assign vitals quick action — deep-links to Vitals tab. */}
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="gap-1.5 shrink-0"
                            title="Open the Vitals tab on this patient's profile"
                          >
                            <Link to={`/patients/${p.id}?tab=vitals`}>
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Assign vitals</span>
                            </Link>
                          </Button>

                          <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 hidden sm:block" />
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
