import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Sparkles, Building2, X } from "lucide-react";
import { iwisApi, type AyurvedicSkill, type TherapistMatchResult } from "@/services/iwis.service";
import { branchesApi } from "@/services/branches.service";

const AYUR_SKILLS: AyurvedicSkill[] = [
    "ABHYANGA","SHIRODHARA","PANCHAKARMA_GENERAL","BASTI","VIRECHANA",
    "NASYA","KIZHI","NJAVARA","PIZHICHIL","MARMA_THERAPY","YOGA_THERAPY","NATUROPATHY",
];

const PROF_TONE: Record<string, string> = {
    CERTIFIED: "bg-wellness/10 text-wellness border-wellness/30",
    EXPERIENCED: "bg-primary/10 text-primary border-primary/30",
    LEARNING: "bg-muted text-muted-foreground",
};

export default function TherapistMatchPage() {
    const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
    const [branchId, setBranchId] = useState<string>("");
    const [selected, setSelected] = useState<AyurvedicSkill[]>([]);
    const [results, setResults] = useState<TherapistMatchResult[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { branchesApi.list().then(setBranches); }, []);

    const toggle = (s: AyurvedicSkill) =>
        setSelected((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

    const run = async () => {
        if (selected.length === 0) return;
        setLoading(true);
        try {
            setResults(await iwisApi.matchTherapists({ skills: selected, branchId: branchId || undefined }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout>
            <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
                <PageHeader title="Match Therapist by Skill" subtitle="Rank therapists by required skills, proficiency, and current load">
                    <Button onClick={run} disabled={selected.length === 0 || loading}>
                        <Sparkles className="w-4 h-4 mr-2" /> Find Match
                    </Button>
                </PageHeader>

                <Panel title="Required skills" description="Select one or more Ayurvedic skills the patient needs">
                    <div className="flex flex-wrap gap-2">
                        {AYUR_SKILLS.map((s) => (
                            <Badge key={s} variant={selected.includes(s) ? "default" : "outline"}
                                   className="cursor-pointer select-none"
                                   onClick={() => toggle(s)}>
                                {s}
                                {selected.includes(s) && <X className="w-3 h-3 ml-1" />}
                            </Badge>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 pt-4 border-t border-border/40 mt-4">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <Select value={branchId || "__any__"} onValueChange={(v) => setBranchId(v === "__any__" ? "" : v)}>
                            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Any branch" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__any__">Any branch</SelectItem>
                                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </Panel>

                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : results.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">Select skills and click "Find Match" to rank therapists.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {results.map((r, i) => (
                            <Panel key={r.therapist.id} title={r.therapist.fullName || "Unnamed"}
                                   description={r.therapist.specialization || r.therapist.qualification || undefined}
                                   className={i === 0 ? "ring-2 ring-primary/40" : ""}>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        {i === 0 && <Badge className="bg-primary text-primary-foreground">Best Match</Badge>}
                                        <Badge variant="outline">Score {r.score}</Badge>
                                        <Badge variant="outline">{r.activePatientLoad} active</Badge>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground mb-1">Skill coverage · {Math.round(r.coverage * 100)}%</div>
                                        <Progress value={r.coverage * 100} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Matched</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {r.matchedSkills.map((s) => (
                                                <Badge key={s.skill} variant="outline" className={PROF_TONE[s.proficiency]}>
                                                    {s.skill} · {s.proficiency}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    {r.missingSkills.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="text-xs font-bold uppercase tracking-widest text-destructive/80">Missing</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {r.missingSkills.map((s) => <Badge key={s} variant="outline" className="text-destructive border-destructive/40">{s}</Badge>)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Panel>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
