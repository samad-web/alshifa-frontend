/**
 * PatientHistoryPanel — collapsible left-rail panel inside the
 * Consultation Room. Loads the entire patient context (prescriptions,
 * appointments, visit summaries, triage, pain & vitals, journey) in a
 * single API call so the doctor doesn't pay waterfall latency.
 *
 * Two display modes:
 *   - Expanded (~360px wide) — full tabbed UI, default open
 *   - Collapsed (~48px slim icon bar) — tab icons only; click any icon
 *     to expand back to that tab
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Pill, Calendar, FileText, Activity, ListChecks, MapPin,
  ChevronLeft, ChevronRight, Loader2, Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  consultationContextApi,
  type ConsultationContextResponse,
} from "@/services/consultationContext.service";
import { BodyMapPainSelector } from "@/components/shared/BodyMapPainSelector";

type TabKey = "prescriptions" | "appointments" | "summaries" | "triage" | "pain" | "journey";

const TABS: { key: TabKey; label: string; icon: typeof Pill }[] = [
  { key: "prescriptions", label: "Prescriptions", icon: Pill },
  { key: "appointments", label: "Appointments", icon: Calendar },
  { key: "summaries", label: "Visit Summaries", icon: FileText },
  { key: "triage", label: "Triage", icon: Activity },
  { key: "pain", label: "Pain & Vitals", icon: MapPin },
  { key: "journey", label: "Journey", icon: ListChecks },
];

function formatDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function urgencyBadgeStyle(level: string | null | undefined) {
  const map: Record<string, string> = {
    CRITICAL: "bg-red-600 text-white border-red-700",
    URGENT: "bg-red-500 text-white border-red-600",
    HIGH: "bg-orange-500 text-white border-orange-600",
    MODERATE: "bg-yellow-500 text-white border-yellow-600",
    MEDIUM: "bg-yellow-500 text-white border-yellow-600",
    LOW: "bg-emerald-500 text-white border-emerald-600",
  };
  return map[String(level || "").toUpperCase()] || "bg-slate-400 text-white";
}

export function PatientHistoryPanel({ patientId }: { patientId: string | null }) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("prescriptions");
  const [data, setData] = useState<ConsultationContextResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    consultationContextApi.get(patientId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId]);

  if (collapsed) {
    return (
      <div className="w-12 shrink-0 bg-card border-r border-border/60 flex flex-col items-center py-4 gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(false)}
          title="Expand patient history"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="h-px w-6 bg-border my-2" />
        {TABS.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", activeTab === key && "bg-primary/10 text-primary")}
            onClick={() => { setActiveTab(key); setCollapsed(false); }}
            title={label}
          >
            <Icon className="w-4 h-4" />
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-[360px] shrink-0 bg-card border-r border-border/60 flex flex-col">
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Stethoscope className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">Patient History</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCollapsed(true)}
          title="Collapse"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {!patientId ? (
        <div className="p-4 text-xs text-muted-foreground">No patient context.</div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="p-4 text-xs text-red-600">{error}</div>
      ) : data ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="m-2 grid grid-cols-6 h-auto">
            {TABS.map(({ key, icon: Icon, label }) => (
              <TabsTrigger key={key} value={key} className="flex flex-col items-center px-1 py-1.5 text-[10px]" title={label}>
                <Icon className="w-3.5 h-3.5 mb-0.5" />
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-3 pb-4">
              <TabsContent value="prescriptions" className="mt-0 space-y-2">
                <PrescriptionsTab data={data} />
              </TabsContent>
              <TabsContent value="appointments" className="mt-0 space-y-2">
                <AppointmentsTab data={data} />
              </TabsContent>
              <TabsContent value="summaries" className="mt-0 space-y-2">
                <SummariesTab data={data} />
              </TabsContent>
              <TabsContent value="triage" className="mt-0 space-y-2">
                <TriageTab data={data} />
              </TabsContent>
              <TabsContent value="pain" className="mt-0 space-y-3">
                <PainAndVitalsTab data={data} />
              </TabsContent>
              <TabsContent value="journey" className="mt-0 space-y-2">
                <JourneyTab data={data} />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      ) : null}
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────

function PrescriptionsTab({ data }: { data: ConsultationContextResponse }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (data.prescriptions.length === 0) {
    return <p className="text-xs text-muted-foreground">No prescriptions on file.</p>;
  }
  return (
    <>
      {data.prescriptions.map((p) => {
        const isOpen = expandedId === p.id;
        return (
          <div key={p.id} className="rounded-md border bg-background p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{p.medicationName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {[p.dosage, p.frequency].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatDDMMYYYY(p.createdAt)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {p.doctor?.fullName ? `Dr. ${p.doctor.fullName}` : p.therapist?.fullName || "—"}
            </div>
            <button
              type="button"
              className="mt-1 text-[10px] text-primary hover:underline"
              onClick={() => setExpandedId(isOpen ? null : p.id)}
            >
              {isOpen ? "Hide" : "View Full"}
            </button>
            {isOpen && (
              <div className="mt-2 pt-2 border-t border-border/40 space-y-0.5 text-[10px] text-muted-foreground">
                {p.duration && <p>Duration: {p.duration}</p>}
                {p.totalQuantity != null && <p>Total qty: {p.totalQuantity}</p>}
                {p.notes && <p>Notes: {p.notes}</p>}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function AppointmentsTab({ data }: { data: ConsultationContextResponse }) {
  if (data.appointments.length === 0) {
    return <p className="text-xs text-muted-foreground">No prior appointments.</p>;
  }
  return (
    <>
      {data.appointments.map((a) => (
        <div key={a.id} className="rounded-md border bg-background p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{a.consultationType} · {a.consultationMode}</p>
              <p className="text-[10px] text-muted-foreground">
                {a.doctor?.fullName ? `Dr. ${a.doctor.fullName}` : a.therapist?.fullName || "—"}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant="outline" className="text-[9px]">{a.status}</Badge>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{formatDDMMYYYY(a.date)}</p>
          {a.sessionNotes && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-3">{a.sessionNotes}</p>
          )}
        </div>
      ))}
    </>
  );
}

function SummariesTab({ data }: { data: ConsultationContextResponse }) {
  if (data.visitSummaries.length === 0) {
    return <p className="text-xs text-muted-foreground">No visit summaries sent yet.</p>;
  }
  return (
    <>
      {data.visitSummaries.map((s) => (
        <div key={s.id} className="rounded-md border bg-background p-2.5 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold truncate">{s.diagnosis || "Visit summary"}</p>
            <span className="text-[10px] text-muted-foreground shrink-0">{formatDDMMYYYY(s.sentAt || s.createdAt)}</span>
          </div>
          {s.clinicianName && <p className="text-[10px] text-muted-foreground">{s.clinicianName}</p>}
          {s.treatmentNotes && <p className="text-[10px] text-muted-foreground line-clamp-3">{s.treatmentNotes}</p>}
          {s.nextSteps && (
            <p className="text-[10px] text-primary mt-1">Next: {s.nextSteps}</p>
          )}
        </div>
      ))}
    </>
  );
}

function TriageTab({ data }: { data: ConsultationContextResponse }) {
  if (data.triageSessions.length === 0) {
    return <p className="text-xs text-muted-foreground">No triage history.</p>;
  }
  return (
    <>
      {data.triageSessions.map((t) => {
        const cc = (t.responses as { painArea?: string; chiefComplaint?: string } | null)?.painArea
          || (t.responses as { painArea?: string; chiefComplaint?: string } | null)?.chiefComplaint;
        const regions = Array.isArray(t.painRegions) ? t.painRegions : [];
        return (
          <div key={t.id} className="rounded-md border bg-background p-2.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Badge className={cn("text-[9px]", urgencyBadgeStyle(t.urgencyLevel || t.severity))}>
                  {t.urgencyLevel || t.severity || "—"}
                </Badge>
                {t.compositeScore != null && (
                  <span className="text-[10px] text-muted-foreground ml-2">
                    Score: {t.compositeScore.toFixed(1)}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatDDMMYYYY(t.createdAt)}</span>
            </div>
            {cc && <p className="text-[10px] text-muted-foreground">{cc}</p>}
            {regions.length > 0 && (
              <div className="scale-[0.85] origin-top-left -mb-12">
                <BodyMapPainSelector initialPainRegions={regions} readOnly />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function PainAndVitalsTab({ data }: { data: ConsultationContextResponse }) {
  return (
    <>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Latest vitals
        </p>
        {data.latestVitals.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No vitals logged.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {data.latestVitals.map((v) => (
              <div key={v.type} className="rounded-md border bg-background p-2">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{v.type}</p>
                <p className="text-xs font-semibold">
                  {v.value != null ? v.value : "—"} <span className="text-[10px] font-normal text-muted-foreground">{v.unit || ""}</span>
                </p>
                <p className="text-[9px] text-muted-foreground">{formatDDMMYYYY(v.recordedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 mt-3">
          Pain check-ins (last {data.painCheckIns.length})
        </p>
        {data.painCheckIns.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No pain check-ins yet.</p>
        ) : (
          <div className="space-y-2">
            {data.painCheckIns.map((c) => {
              const regions = Array.isArray(c.painRegions) ? c.painRegions : [];
              return (
                <div key={c.id} className="rounded-md border bg-background p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">{formatDDMMYYYY(c.createdAt)}</span>
                    <span className="text-[10px] font-semibold">Max {c.painLevel}/10</span>
                  </div>
                  {regions.length > 0 ? (
                    <div className="scale-[0.65] origin-top-left -mb-20">
                      <BodyMapPainSelector initialPainRegions={regions} readOnly />
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic">No regions logged.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function JourneyTab({ data }: { data: ConsultationContextResponse }) {
  if (!data.activeJourney) {
    return <p className="text-xs text-muted-foreground">No active treatment journey.</p>;
  }
  const j = data.activeJourney;
  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-background p-2.5">
        <p className="text-xs font-semibold">{j.title}</p>
        {j.condition && <p className="text-[10px] text-muted-foreground">{j.condition}</p>}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-[9px]">{j.status}</Badge>
          {j.wellnessScore != null && (
            <span className="text-[10px] text-muted-foreground">Wellness: {j.wellnessScore}</span>
          )}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Phases</p>
        <div className="space-y-1">
          {j.phases.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-[11px]">
              <span className={cn(
                "w-2 h-2 rounded-full shrink-0",
                p.status === "COMPLETED" ? "bg-emerald-500"
                : p.status === "ACTIVE" ? "bg-primary"
                  : p.status === "SKIPPED" ? "bg-slate-400"
                    : "bg-muted",
              )} />
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{p.durationDays}d</span>
            </div>
          ))}
        </div>
      </div>

      {j.milestones.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Milestones</p>
          <div className="space-y-1">
            {j.milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-[11px]">
                <span className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  m.achievedAt ? "bg-emerald-500" : "bg-muted",
                )} />
                <span className="flex-1 truncate">{m.title}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatDDMMYYYY(m.targetDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PatientHistoryPanel;
