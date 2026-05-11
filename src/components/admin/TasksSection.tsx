import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, Users, Bell } from "lucide-react";
import TodoPanel, { AssignedByMePanel } from "@/components/todo/TodoPanel";
import { FollowUpTaskPanel } from "@/components/doctor/FollowUpTaskPanel";
import { followUpTaskService } from "@/services/followUpTask.service";
import { cn } from "@/lib/utils";

// Single tabbed surface that consolidates the three task components on the
// Admin Dashboard:
//   • My tasks       → existing <TodoPanel canAssign title="My Tasks" />
//   • Assigned tasks → existing <AssignedByMePanel />
//   • Follow-up      → existing <FollowUpTaskPanel />
//
// Behaviour-preserving wrapper: every child renders its own data-fetching,
// mutations, dialogs, and actions verbatim. The only adjustment is the
// `bare` prop on each child to suppress its outer card chrome (border +
// radius + shadow) so we don't get a card-inside-a-card look.
//
// Active tab is mirrored to the URL via `?taskTab=mine|assigned|followup`
// so deep-links + hard refreshes land on the right tab.
//
// Badge counts:
//   - Follow-up: pulled from the existing `["follow-up-summary"]` query that
//     <FollowUpTaskPanel /> already subscribes to. TanStack dedupes by key,
//     so this is the same network response — no extra request.
//   - My / Assigned: <TodoPanel> and <AssignedByMePanel> manage state with
//     useState (no TanStack Query subscription we can dedupe against).
//     Reading their counts from this component would either re-fetch or
//     require touching the children's data layer — both out of scope. Per
//     spec ("never '0' as a placeholder"), we render no badge here.

type TaskTab = "mine" | "assigned" | "followup";

const TABS: Array<{ key: TaskTab; label: string; icon: typeof CheckSquare }> = [
    { key: "mine",     label: "My tasks",        icon: CheckSquare },
    { key: "assigned", label: "Assigned tasks",  icon: Users },
    { key: "followup", label: "Follow-up tasks", icon: Bell },
];

const TAB_QUERY_PARAM = "taskTab";

function isTaskTab(value: string | null): value is TaskTab {
    return value === "mine" || value === "assigned" || value === "followup";
}

export default function TasksSection() {
    const [searchParams, setSearchParams] = useSearchParams();
    const raw = searchParams.get(TAB_QUERY_PARAM);
    const activeTab: TaskTab = isTaskTab(raw) ? raw : "mine";

    const setTab = (next: TaskTab) => {
        const updated = new URLSearchParams(searchParams);
        updated.set(TAB_QUERY_PARAM, next);
        // `replace: true` so flipping tabs doesn't pollute the back button
        // with a history entry per tap.
        setSearchParams(updated, { replace: true });
    };

    // Subscribed via the same key <FollowUpTaskPanel /> uses → TanStack
    // dedupes; this is not an extra network call.
    const { data: followUpSummary } = useQuery({
        queryKey: ["follow-up-summary"],
        queryFn:  () => followUpTaskService.getSummary(),
        refetchInterval: 60_000,
    });
    const followUpBadge = followUpSummary?.pending;

    return (
        <section className="bg-white border-[0.5px] border-border rounded-2xl p-5 md:p-6">
            <header className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium">Tasks</h2>
                {/* "Open full view ↗" intentionally omitted — no standalone
                    tasks page exists in App.tsx today. Hooking it to a
                    non-existent route would 404. Add the link back here once
                    a /tasks (or equivalent) route lands. */}
            </header>

            <div
                role="tablist"
                aria-label="Tasks"
                className="flex items-center gap-1 bg-muted rounded-lg p-1"
            >
                {TABS.map(({ key, label, icon: Icon }) => {
                    const isActive = activeTab === key;
                    const showBadge = key === "followup" && typeof followUpBadge === "number";
                    return (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`tasks-tab-${key}`}
                            onClick={() => setTab(key)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 justify-center",
                                isActive
                                    ? "bg-[#0D6E6E] text-white"
                                    : "bg-transparent text-muted-foreground hover:bg-background",
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
                                            : "bg-background text-muted-foreground",
                                    )}
                                >
                                    {followUpBadge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div
                id={`tasks-tab-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`tasks-tab-${activeTab}`}
                className="pt-3"
            >
                {activeTab === "mine" && (
                    <TodoPanel canAssign title="My Tasks" bare />
                )}
                {activeTab === "assigned" && (
                    <AssignedByMePanel bare />
                )}
                {activeTab === "followup" && (
                    <FollowUpTaskPanel bare />
                )}
            </div>
        </section>
    );
}
