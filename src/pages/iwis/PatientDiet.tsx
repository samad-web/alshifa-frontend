import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Salad, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { iwisApi, type DietPrescription, type DietDailyPlan, type MealTime } from "@/services/iwis.service";
import { apiClient } from "@/lib/api-client";
import type { MealFoodLinks, DietMealFoodLink } from "@/types/ayurvedicFood";
import { cn } from "@/lib/utils";

const MEAL_LABEL: Record<MealTime, string> = {
    MORNING_EMPTY: "Morning (empty)",
    BREAKFAST: "Breakfast",
    MID_MORNING: "Mid-morning",
    LUNCH: "Lunch",
    EVENING: "Evening",
    DINNER: "Dinner",
    BEDTIME: "Bedtime",
};

export default function PatientDietPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState<DietDailyPlan[]>([]);
    const [patientId, setPatientId] = useState<string>("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const profile = await apiClient.get<{ patient?: { id: string } | null }>("/api/user/me").then(r => r.data);
            const pid = profile?.patient?.id || user?.id || "";
            setPatientId(pid);
            if (!pid) return;
            const prescriptions: DietPrescription[] = await iwisApi.listDietForPatient(pid);
            const active = prescriptions.filter((p) => p.isActive);
            const dailies = await Promise.all(active.map((p) => iwisApi.getDietToday(p.id)));
            setPlans(dailies);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    // Realtime: when the doctor assigns a new diet plan, the backend emits a
    // 'diet_assigned' socket event to this patient's user room. Refetch the
    // active plans so the new assignment appears without a page reload.
    const { socket } = useWebSocket();
    useEffect(() => {
        if (!socket) return;
        const handler = (payload: { prescriptionId: string; title: string }) => {
            toast({
                title: "New diet plan assigned",
                description: `Your doctor has assigned "${payload.title}". Refreshing your plan…`,
            });
            load();
        };
        socket.on('diet_assigned', handler);
        return () => { socket.off('diet_assigned', handler); };
    }, [socket, load, toast]);

    const log = async (prescriptionId: string, mealTime: MealTime, followed: boolean) => {
        try {
            await iwisApi.logDietMeal(prescriptionId, { patientId, mealTime, followed });
            toast({ title: followed ? "Logged — well done!" : "Logged" });
            load();
        } catch (err: unknown) {
            toast({ title: "Error", description: err instanceof Error ? err.message : "Log failed", variant: "destructive" });
        }
    };

    return (
        <AppLayout>
            <div className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
                <PageHeader title="Today's Diet" subtitle="Track what you eat — your Pathya-Apathya adherence feeds into your wellness score" />

                {loading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : plans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-secondary/5">
                        <Salad className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground">No active diet prescription yet. Your doctor will share one shortly.</p>
                    </div>
                ) : (
                    plans.map((plan) => (
                        <Panel key={plan.prescription.id} title={plan.prescription.title} description={`Dosha target: ${plan.prescription.doshaTarget} · ${plan.prescription.category}`}>
                            <div className="space-y-3">
                                {plan.meals.map((m) => {
                                    const logged = m.loggedToday;
                                    return (
                                        <div key={m.mealTime} className="p-4 rounded-xl border border-border/60 bg-secondary/5 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="font-semibold">{MEAL_LABEL[m.mealTime]}</div>
                                                {logged ? (
                                                    <Badge variant={logged.followed ? "default" : "outline"} className={logged.followed ? "bg-wellness text-white" : "text-destructive border-destructive/40"}>
                                                        {logged.followed ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Followed</> : <><XCircle className="w-3 h-3 mr-1" /> Missed</>}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="gap-1"><AlertCircle className="w-3 h-3" /> Not logged</Badge>
                                                )}
                                            </div>
                                            {m.foods.length > 0 && (
                                                <div className="text-sm"><span className="font-bold text-wellness">Eat:</span> {m.foods.map(f => f.name).join(", ")}</div>
                                            )}
                                            {m.avoidFoods.length > 0 && (
                                                <div className="text-sm"><span className="font-bold text-destructive">Avoid:</span> {m.avoidFoods.map(f => f.name).join(", ")}</div>
                                            )}
                                            {m.instructions && <div className="text-xs text-muted-foreground italic">{m.instructions}</div>}
                                            {/* Read-only structured foods linked from the food database
                                                (Feature 1). Renders nothing when no structured links exist —
                                                the free-text Eat/Avoid lines above remain the patient's view. */}
                                            {m.id && <StructuredFoodList mealId={m.id} />}
                                            {!logged && (
                                                <div className="flex gap-2 pt-2">
                                                    <Button size="sm" onClick={() => log(plan.prescription.id, m.mealTime, true)} className="bg-wellness hover:bg-wellness/90">
                                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Followed
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => log(plan.prescription.id, m.mealTime, false)}>
                                                        <XCircle className="w-4 h-4 mr-2" /> Missed
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </Panel>
                    ))
                )}
            </div>
        </AppLayout>
    );
}

// ── Read-only structured-food block per meal (Feature 1) ───────────────────
//
// Fetches /api/ayurvedic-foods/meals/:mealId/foods on its own. Renders nothing
// when no structured links exist for the meal — the patient sees only the
// existing free-text Eat/Avoid lines above. Patient cannot link, unlink, or
// see allergy alerts here (clinical action — doctor handles those upstream).

function StructuredFoodList({ mealId }: { mealId: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ["meal-food-links", mealId],
        queryFn: async () => {
            const { data } = await apiClient.get<MealFoodLinks>(`/api/ayurvedic-foods/meals/${mealId}/foods`);
            return data;
        },
        staleTime: 30_000,
    });

    if (isLoading) return null;
    const eat = data?.foods ?? [];
    const avoid = data?.avoidFoods ?? [];
    if (eat.length === 0 && avoid.length === 0) return null;

    return (
        <div className="pt-2 border-t border-border/40 space-y-1.5">
            {eat.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {eat.map((l) => <ReadonlyChip key={l.id} link={l} />)}
                </div>
            )}
            {avoid.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {avoid.map((l) => <ReadonlyChip key={l.id} link={l} avoid />)}
                </div>
            )}
        </div>
    );
}

function ReadonlyChip({ link, avoid }: { link: DietMealFoodLink; avoid?: boolean }) {
    const display = link.food?.name ?? link.foodNameFree ?? "Unnamed";
    const qtyUnit = [link.quantity, link.unit].filter((v) => v !== null && v !== undefined && `${v}`.length > 0).join(" ");
    const calories = link.food?.calories;
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
            avoid
                ? "bg-rose-50 text-rose-900 border-rose-200"
                : "bg-emerald-50 text-emerald-900 border-emerald-200",
        )}>
            {avoid && <span aria-hidden>⚠</span>}
            <span className="font-medium">{display}</span>
            {qtyUnit && <span className="opacity-70">{qtyUnit}</span>}
            {calories != null && <span className="opacity-60">({Math.round(calories)} kcal)</span>}
        </span>
    );
}
