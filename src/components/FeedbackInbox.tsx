// FeedbackInbox — clinician-facing paginated list of patient feedback. Lives
// inside the new "Patient Feedback" tab on XPDashboard. Uses
// GET /api/feedback/clinician — backend strips patient identity for
// non-positive entries, so we render "Anonymous" wherever patientName falls
// through to "Anonymous".
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Star, Inbox } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format-date";

type FeedbackKind = "consultation" | "journey";

interface FeedbackEntry {
    kind: FeedbackKind;
    id: string;
    rating: number;
    sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
    categories?: string[];
    highlights?: string[];
    feedbackText?: string | null;
    wouldRecommend?: boolean | null;
    createdAt: string;
    patientName: string; // "Anonymous" for non-positive
}
interface ApiResponse {
    success: boolean;
    data: FeedbackEntry[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

const TYPE_OPTIONS: { value: "all" | FeedbackKind; label: string }[] = [
    { value: "all",          label: "All" },
    { value: "consultation", label: "Consultation" },
    { value: "journey",      label: "Journey" },
];

export function FeedbackInbox() {
    const [entries,    setEntries]    = useState<FeedbackEntry[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [page,       setPage]       = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [type,    setType]    = useState<"all" | FeedbackKind>("all");
    const [ratings, setRatings] = useState<number[]>([]);
    const [from,    setFrom]    = useState("");
    const [to,      setTo]      = useState("");

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            const params = new URLSearchParams();
            if (type !== "all") params.set("type", type);
            // The backend rating filter is single-valued; if the user picks
            // multiple, we client-filter the returned page. Pages remain
            // paginated server-side.
            if (ratings.length === 1) params.set("rating", String(ratings[0]));
            if (from) params.set("from", from);
            if (to)   params.set("to", to);
            params.set("page",  String(page));
            params.set("limit", "10");

            try {
                const res = await apiClient.get<ApiResponse>(`/api/feedback/clinician?${params.toString()}`);
                if (cancelled) return;
                const list = (res?.data ?? []).filter((e) =>
                    ratings.length <= 1 ? true : ratings.includes(e.rating)
                );
                setEntries(list);
                setTotalPages(res?.pagination?.totalPages ?? 1);
            } catch {
                if (!cancelled) setEntries([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [type, ratings.join("|"), from, to, page]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleRating = (n: number) => {
        setPage(1);
        setRatings((prev) => prev.includes(n) ? prev.filter((r) => r !== n) : [...prev, n]);
    };

    const Stars = ({ value }: { value: number }) => (
        <span className="inline-flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
                <Star
                    key={n}
                    className="w-3.5 h-3.5"
                    color={n <= value ? "#0D6E6E" : "#cbd5e1"}
                    fill={n <= value ? "#0D6E6E" : "none"}
                />
            ))}
        </span>
    );

    return (
        <Card>
            <CardContent className="p-4 space-y-4">
                {/* Filter bar */}
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Type</span>
                        <div className="inline-flex rounded-full overflow-hidden border">
                            {TYPE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setPage(1); setType(opt.value); }}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-bold uppercase tracking-tight",
                                        type === opt.value ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-secondary/40",
                                    )}
                                >{opt.label}</button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Rating</span>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => {
                                const on = ratings.includes(n);
                                return (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => toggleRating(n)}
                                        className={cn(
                                            "w-9 h-9 rounded-full text-xs font-bold border",
                                            on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-secondary/40",
                                        )}
                                    >{n}★</button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">From</span>
                        <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} className="w-[150px]" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">To</span>
                        <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} className="w-[150px]" />
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-20 w-full rounded-xl" />
                        ))}
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
                        <Inbox className="w-10 h-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No feedback yet — your first review will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {entries.map((e) => {
                            const tags = e.kind === "consultation" ? (e.categories ?? []) : (e.highlights ?? []);
                            return (
                                <div key={`${e.kind}-${e.id}`} className="rounded-xl border border-border/60 bg-background p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <Stars value={e.rating} />
                                            <Badge variant="outline" className="text-[10px] uppercase tracking-tight">{e.kind}</Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDate(e.createdAt)}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-foreground">{e.patientName}</span>
                                    </div>
                                    {tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {tags.map((t) => (
                                                <span key={t} className="text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                    {t.replaceAll("_", " ")}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {e.feedbackText && (
                                        <p className="text-sm text-foreground italic">&ldquo;{e.feedbackText}&rdquo;</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {!loading && entries.length > 0 && totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t">
                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                            Previous
                        </Button>
                        <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                            Next
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
