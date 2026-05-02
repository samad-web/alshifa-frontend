import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBranchScope } from "@/hooks/useBranchScope";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiClient } from "@/lib/api-client";
import {
    iwisApi,
    type AyurvedicSkill,
    type Proficiency,
    type TherapistSkill,
    type TherapistMatchResult,
} from "@/services/iwis.service";
import {
    Loader2, Grid3X3, Sparkles, X, Award, GraduationCap, Activity, Building2, Search,
} from "lucide-react";
import { toast } from "sonner";

const AYUR_SKILLS: AyurvedicSkill[] = [
    "ABHYANGA", "SHIRODHARA", "PANCHAKARMA_GENERAL", "BASTI", "VIRECHANA",
    "NASYA", "KIZHI", "NJAVARA", "PIZHICHIL", "MARMA_THERAPY", "YOGA_THERAPY", "NATUROPATHY",
];

const SKILL_LABEL: Record<AyurvedicSkill, string> = {
    ABHYANGA: "Abhyanga",
    SHIRODHARA: "Shirodhara",
    PANCHAKARMA_GENERAL: "Panchakarma",
    BASTI: "Basti",
    VIRECHANA: "Virechana",
    NASYA: "Nasya",
    KIZHI: "Kizhi",
    NJAVARA: "Njavara",
    PIZHICHIL: "Pizhichil",
    MARMA_THERAPY: "Marma",
    YOGA_THERAPY: "Yoga",
    NATUROPATHY: "Naturopathy",
};

// Proficiency cycle for click-to-edit. Each click rotates: none → LEARNING →
// EXPERIENCED → CERTIFIED → none. Lets the admin edit the matrix in place.
const PROFICIENCY_CYCLE: (Proficiency | null)[] = [null, "LEARNING", "EXPERIENCED", "CERTIFIED"];

const PROF_TONE: Record<Proficiency, { bg: string; label: string; rank: number }> = {
    CERTIFIED:   { bg: "bg-wellness text-white",            label: "Certified",   rank: 3 },
    EXPERIENCED: { bg: "bg-primary text-primary-foreground", label: "Experienced", rank: 2 },
    LEARNING:    { bg: "bg-amber-500 text-white",           label: "Learning",    rank: 1 },
};

interface TherapistRow {
    id: string;                 // Therapist.id (not User.id)
    fullName: string | null;
    specialization: string | null;
    qualification: string | null;
    branchId: string | null;
    branchName: string | null;
    skills: Map<AyurvedicSkill, Proficiency>;
}

export default function SkillMatrix() {
    const { role, profile } = useAuth();
    const { branchIdParam: navbarBranchId } = useBranchScope();
    // BRANCH_ADMIN has no branch switcher and is locked to their JWT branch.
    const branchIdParam = role === "BRANCH_ADMIN" ? (profile?.branchId ?? undefined) : navbarBranchId;
    const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";

    const [rows, setRows] = useState<TherapistRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingCell, setPendingCell] = useState<string | null>(null); // "<therapistId>:<skill>"

    // Patient-matching panel state
    const [requiredSkills, setRequiredSkills] = useState<AyurvedicSkill[]>([]);
    const [matchResults, setMatchResults] = useState<TherapistMatchResult[]>([]);
    const [matching, setMatching] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = branchIdParam ? { branchId: branchIdParam } : undefined;
            const { data: therapists } = await apiClient.get<Array<{
                id: string; fullName: string | null; specialization: string | null;
                qualification: string | null; branchId: string | null; branchName: string | null;
            }>>("/api/user/list-therapists", params);

            // Skills are fetched in parallel — one round-trip per therapist is
            // fine for a typical clinic (<20 therapists per branch). If this
            // becomes a hotspot we can add a bulk endpoint later.
            const skillsByTherapist = await Promise.all(
                therapists.map((t) =>
                    iwisApi.getSkills(t.id).catch(() => [] as TherapistSkill[]),
                ),
            );

            setRows(therapists.map((t, i) => {
                const map = new Map<AyurvedicSkill, Proficiency>();
                for (const s of skillsByTherapist[i]) map.set(s.skill, s.proficiency);
                return {
                    id: t.id,
                    fullName: t.fullName,
                    specialization: t.specialization,
                    qualification: t.qualification,
                    branchId: t.branchId,
                    branchName: t.branchName,
                    skills: map,
                };
            }));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load skill matrix");
        } finally {
            setLoading(false);
        }
    }, [branchIdParam]);

    useEffect(() => { load(); }, [load]);

    // Click-to-edit cell. Rotates through PROFICIENCY_CYCLE; null removes the
    // skill row. Optimistic UI — we revert if the API call fails so the
    // grid doesn't lie about persisted state.
    const cycleCell = async (therapistId: string, skill: AyurvedicSkill) => {
        if (!isAdmin) return;
        const row = rows.find((r) => r.id === therapistId);
        if (!row) return;
        const current = row.skills.get(skill) ?? null;
        const idx = PROFICIENCY_CYCLE.indexOf(current);
        const next = PROFICIENCY_CYCLE[(idx + 1) % PROFICIENCY_CYCLE.length];

        const cellKey = `${therapistId}:${skill}`;
        setPendingCell(cellKey);

        // Optimistic update.
        setRows((prev) => prev.map((r) => {
            if (r.id !== therapistId) return r;
            const m = new Map(r.skills);
            if (next == null) m.delete(skill); else m.set(skill, next);
            return { ...r, skills: m };
        }));

        try {
            if (next == null) {
                await iwisApi.removeSkill(therapistId, skill);
            } else {
                await iwisApi.upsertSkill(therapistId, { skill, proficiency: next });
            }
        } catch (err) {
            // Revert on failure.
            setRows((prev) => prev.map((r) => {
                if (r.id !== therapistId) return r;
                const m = new Map(r.skills);
                if (current == null) m.delete(skill); else m.set(skill, current);
                return { ...r, skills: m };
            }));
            toast.error(err instanceof Error ? err.message : "Update failed");
        } finally {
            setPendingCell(null);
        }
    };

    const toggleRequired = (skill: AyurvedicSkill) =>
        setRequiredSkills((prev) =>
            prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
        );

    const runMatch = async () => {
        if (requiredSkills.length === 0) return;
        setMatching(true);
        try {
            const results = await iwisApi.matchTherapists({
                skills: requiredSkills,
                branchId: branchIdParam,
                top: 10,
            });
            setMatchResults(results);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Match failed");
        } finally {
            setMatching(false);
        }
    };

    // Coverage stats for the strip at the top — counts per proficiency.
    const totals = useMemo(() => {
        const t = { CERTIFIED: 0, EXPERIENCED: 0, LEARNING: 0, none: 0 };
        for (const r of rows) {
            for (const skill of AYUR_SKILLS) {
                const p = r.skills.get(skill);
                if (!p) t.none++;
                else t[p]++;
            }
        }
        return t;
    }, [rows]);

    if (loading) {
        return (
            <AppLayout>
                <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
                <PageHeader
                    title="Therapist Skill Matrix"
                    subtitle="Manage Ayurvedic therapy skills and match therapists to patient needs in one place."
                >
                    <Badge variant="outline" className="gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {branchIdParam ? "Active branch" : "All branches"} · switch via navbar
                    </Badge>
                </PageHeader>

                {/* Coverage strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <CoverageCard label="Certified slots" value={totals.CERTIFIED} icon={Award} tone="text-wellness" />
                    <CoverageCard label="Experienced slots" value={totals.EXPERIENCED} icon={Activity} tone="text-primary" />
                    <CoverageCard label="Learning slots" value={totals.LEARNING} icon={GraduationCap} tone="text-amber-600" />
                    <CoverageCard label="Therapists" value={rows.length} icon={Grid3X3} tone="text-foreground" />
                </div>

                {/* Heatmap */}
                <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Grid3X3 className="w-5 h-5 text-primary" />
                            Skill × Therapist Heatmap
                            {isAdmin && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    Click a cell to cycle proficiency: none → Learning → Experienced → Certified.
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        {rows.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground text-sm">
                                No therapists in the active branch.{" "}
                                <Link to="/create-user" className="text-primary hover:underline">
                                    Create one →
                                </Link>
                            </div>
                        ) : (
                            <table className="min-w-full border-separate border-spacing-[2px]">
                                <thead>
                                    <tr>
                                        <th className="text-left text-xs font-semibold text-muted-foreground pr-3 sticky left-0 bg-background min-w-[180px]">Therapist</th>
                                        {AYUR_SKILLS.map((s) => (
                                            <th key={s} className="text-[10px] font-semibold text-muted-foreground px-1 text-center min-w-[88px]">
                                                <div className="rotate-[-25deg] origin-bottom-left whitespace-nowrap">
                                                    {SKILL_LABEL[s]}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.id}>
                                            <td className="text-sm font-medium pr-3 whitespace-nowrap sticky left-0 bg-background">
                                                <div>{r.fullName || "Unnamed"}</div>
                                                {r.specialization && (
                                                    <div className="text-[10px] text-muted-foreground">
                                                        Primary: {SKILL_LABEL[r.specialization as AyurvedicSkill] || r.specialization}
                                                    </div>
                                                )}
                                            </td>
                                            {AYUR_SKILLS.map((s) => {
                                                const p = r.skills.get(s);
                                                const cellKey = `${r.id}:${s}`;
                                                const pending = pendingCell === cellKey;
                                                return (
                                                    <td key={s} className="px-1 align-middle">
                                                        <button
                                                            type="button"
                                                            disabled={!isAdmin || pending}
                                                            onClick={() => cycleCell(r.id, s)}
                                                            title={p ? `${SKILL_LABEL[s]} · ${PROF_TONE[p].label}` : `Add ${SKILL_LABEL[s]}`}
                                                            className={`w-full h-9 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                                                                p ? PROF_TONE[p].bg : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                                                            } ${isAdmin ? "cursor-pointer" : "cursor-default"}`}
                                                        >
                                                            {pending ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                                                            ) : p ? (
                                                                p.charAt(0)
                                                            ) : ""}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>

                {/* Patient-matching panel */}
                <Panel
                    title="Match a patient to therapists"
                    description="Pick the skills the patient needs. Therapists are ranked by proficiency (Certified > Experienced > Learning) and current load."
                >
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {AYUR_SKILLS.map((s) => (
                                <Badge
                                    key={s}
                                    variant={requiredSkills.includes(s) ? "default" : "outline"}
                                    className="cursor-pointer select-none"
                                    onClick={() => toggleRequired(s)}
                                >
                                    {SKILL_LABEL[s]}
                                    {requiredSkills.includes(s) && <X className="w-3 h-3 ml-1" />}
                                </Badge>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button onClick={runMatch} disabled={requiredSkills.length === 0 || matching}>
                                {matching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                                Find best therapist
                            </Button>
                            {matchResults.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => { setMatchResults([]); setRequiredSkills([]); }}>
                                    Clear
                                </Button>
                            )}
                        </div>

                        {matchResults.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {matchResults.map((m, i) => (
                                    <Panel
                                        key={m.therapist.id}
                                        title={m.therapist.fullName || "Unnamed"}
                                        description={m.therapist.specialization || m.therapist.qualification || undefined}
                                        className={i === 0 ? "ring-2 ring-primary/40" : ""}
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {i === 0 && <Badge className="bg-primary text-primary-foreground">Best Match</Badge>}
                                                <Badge variant="outline">Score {m.score}</Badge>
                                                <Badge variant="outline">{m.activePatientLoad} active</Badge>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground mb-1">
                                                    Skill coverage · {Math.round(m.coverage * 100)}%
                                                </div>
                                                <Progress value={m.coverage * 100} />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Matched</div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {m.matchedSkills.map((s) => (
                                                        <Badge key={s.skill} variant="outline" className={PROF_TONE[s.proficiency].bg}>
                                                            {SKILL_LABEL[s.skill]} · {PROF_TONE[s.proficiency].label}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            {m.missingSkills.length > 0 && (
                                                <div className="space-y-1">
                                                    <div className="text-xs font-bold uppercase tracking-widest text-destructive/80">Missing</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {m.missingSkills.map((s) => (
                                                            <Badge key={s} variant="outline" className="text-destructive border-destructive/40">
                                                                {SKILL_LABEL[s]}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Panel>
                                ))}
                            </div>
                        )}
                    </div>
                </Panel>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-wellness inline-block" /> Certified (C)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-primary inline-block" /> Experienced (E)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Learning (L)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-muted/60 inline-block border" /> None
                    </span>
                </div>
            </div>
        </AppLayout>
    );
}

function CoverageCard({
    label, value, icon: Icon, tone,
}: { label: string; value: number; icon: typeof Sparkles; tone: string }) {
    return (
        <Card className="border-none shadow-sm">
            <CardContent className="py-4 flex items-center gap-3">
                <Icon className={`w-6 h-6 ${tone}`} />
                <div>
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
                </div>
            </CardContent>
        </Card>
    );
}
