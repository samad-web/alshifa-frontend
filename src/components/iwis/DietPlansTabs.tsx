import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
// Spec asked for `UserHeart` but lucide-react 0.462 (project version) does
// not export it. `HeartPulse` is the closest patient-care alias and is
// already used elsewhere in the codebase (AdminDashboard).
import { Plus, HeartPulse, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import DietPrescriptionsPage, { type DietPrescriptionsHandle } from "@/pages/iwis/DietPrescriptions";
import DietPackagesPage, { type DietPackagesHandle } from "@/pages/iwis/DietPackages";
import { useDietPlansCounts } from "@/hooks/useDietPlansCounts";

// Two-tab surface that lets a clinician (typically ADMIN_DOCTOR) work on
// per-patient diet prescriptions and reusable templates without leaving the
// page. Both children are existing pages — they're rendered with
// `embedded` so each suppresses its own page chrome (AppLayout +
// PageHeader) and we own the single shared header here.
//
// Tab state mirrors `?tab=patient|templates`. `replace: true` on writes so
// switching tabs doesn't pollute history (back button exits the page).
// Hard-refresh on `?tab=templates` lands directly on Templates. Missing or
// invalid tab values fall back to `patient` without rewriting the URL.
//
// Tab badge counts: powered by useDietPlansCounts() which subscribes to a
// single TanStack query (key `diet-plans-counts`). Templates count is
// available; patient count is `undefined` because no aggregate "list all
// prescriptions" service function exists today. We render no badge for
// undefined or 0 (per spec — "never `0` as a placeholder"). See the hook
// for the full rationale.
//
// CTA wiring: each child exposes an imperative handle via forwardRef so
// our header CTA can fire the existing create flow that lives on each
// child's local state. The Patient tab's CTA is disabled-gated by a
// `onCanCreateChange` callback the child fires when its `patientId` toggles.

type ActiveTab = "patient" | "templates";

export default function DietPlansTabs() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const activeTab: ActiveTab = tabParam === "templates" ? "templates" : "patient";

    const setActiveTab = (next: ActiveTab) => {
        // `replace` so tab switches don't trap the back button.
        setSearchParams({ tab: next }, { replace: true });
    };

    const [canCreatePlan, setCanCreatePlan] = useState(false);

    const { data: counts } = useDietPlansCounts();

    const prescriptionsRef = useRef<DietPrescriptionsHandle>(null);
    const packagesRef = useRef<DietPackagesHandle>(null);

    const onCtaClick = () => {
        if (activeTab === "patient") {
            prescriptionsRef.current?.openCreate();
        } else {
            packagesRef.current?.openCreate();
        }
    };

    const ctaLabel = activeTab === "patient" ? "New diet plan" : "New template";
    const ctaDisabled = activeTab === "patient" && !canCreatePlan;

    return (
        <AppLayout>
            <div className="container max-w-6xl mx-auto px-4 py-8 space-y-4">
                {/* Single shared header — children render `embedded` so their
                    own PageHeader is suppressed. */}
                <header className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Diet plans</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Pathya-Apathya — author templates and assign them to patients
                        </p>
                    </div>
                    <Button
                        onClick={onCtaClick}
                        disabled={ctaDisabled}
                        title={ctaDisabled ? "Pick a patient on the Patient plans tab first" : undefined}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        {ctaLabel}
                    </Button>
                </header>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
                    <TabsList className="bg-muted rounded-lg p-1 gap-1 h-auto">
                        {(
                            [
                                // patientCount is structurally undefined today
                                // (no aggregate prescription endpoint); we
                                // intentionally render no badge for the
                                // Patient tab until a list-all service exists.
                                { key: "patient",   label: "Patient plans", icon: HeartPulse, count: undefined },
                                { key: "templates", label: "Templates",     icon: LayoutGrid, count: counts?.templateCount },
                            ] as const
                        ).map(({ key, label, icon: Icon, count }) => {
                            // Render no badge for undefined (loading or
                            // unavailable) or 0 — a "0" looks broken; an
                            // empty list speaks for itself.
                            const showBadge = typeof count === "number" && count > 0;
                            const isActive = activeTab === key;
                            return (
                                <TabsTrigger
                                    key={key}
                                    value={key}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                        "data-[state=active]:bg-[#0D6E6E] data-[state=active]:text-white data-[state=active]:shadow-none",
                                        "data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-background",
                                    )}
                                >
                                    <Icon className="w-4 h-4" aria-hidden />
                                    <span>{label}</span>
                                    {showBadge && (
                                        <span
                                            className={cn(
                                                "min-w-5 h-5 px-1.5 inline-flex items-center justify-center text-[11px] font-medium rounded-full",
                                                isActive
                                                    ? "bg-white/20 text-white"
                                                    : "bg-black/[0.06] text-muted-foreground",
                                            )}
                                        >
                                            {count}
                                        </span>
                                    )}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>

                    {/* `forceMount` keeps both children mounted across tab
                        switches so we don't lose scroll, refetch, or flash
                        empty content. We hide the inactive panel via CSS to
                        keep DOM layout stable. */}
                    <TabsContent value="patient" forceMount className="pt-4 data-[state=inactive]:hidden mt-0">
                        <DietPrescriptionsPage
                            ref={prescriptionsRef}
                            embedded
                            onCanCreateChange={setCanCreatePlan}
                        />
                    </TabsContent>
                    <TabsContent value="templates" forceMount className="pt-4 data-[state=inactive]:hidden mt-0">
                        <DietPackagesPage ref={packagesRef} embedded />
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
