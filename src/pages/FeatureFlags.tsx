/**
 * FeatureFlags — admin interface to view and toggle feature flags.
 *
 * Accessible by: ADMIN, ADMIN_DOCTOR
 */

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, AlertCircle, RefreshCw, ToggleLeft, ToggleRight, Flag } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface FeatureFlag {
    id: string;
    key: string;
    enabled: boolean;
    description?: string;
    allowedRoles: string[];
    allowedBranches: string[];
    updatedAt: string;
}

export default function FeatureFlags() {
    const { toast } = useToast();
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toggling, setToggling] = useState<string | null>(null);

    const fetchFlags = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await apiClient.get<FeatureFlag[]>('/api/feature-flags');
            setFlags(data);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unexpected error";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchFlags(); }, [fetchFlags]);

    const handleToggle = async (key: string) => {
        setToggling(key);
        try {
            const { data: updated } = await apiClient.patch<FeatureFlag>(`/api/feature-flags/${key}/toggle`, {});
            setFlags((prev) =>
                prev.map((f) => (f.key === key ? updated : f))
            );
            toast({
                title: `Flag "${key}" ${updated.enabled ? "enabled" : "disabled"}`,
                description: `Updated successfully.`,
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Toggle failed";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setToggling(null);
        }
    };

    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <PageHeader
                        title="Feature Flags"
                        description="Enable or disable platform features in real-time without a deployment"
                    />
                    <Button variant="outline" size="sm" onClick={fetchFlags} className="flex gap-2">
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                </div>

                {loading && (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!loading && error && (
                    <Panel className="flex items-center gap-3 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </Panel>
                )}

                {!loading && !error && flags.length === 0 && (
                    <Panel>
                        <p className="text-center text-muted-foreground py-10">No feature flags found.</p>
                    </Panel>
                )}

                {!loading && !error && flags.length > 0 && (
                    <div className="space-y-3">
                        {flags.map((flag) => (
                            <Panel key={flag.id}>
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg ${flag.enabled ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                                            <Flag className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono font-semibold text-sm">{flag.key}</span>
                                                <Badge
                                                    variant={flag.enabled ? "default" : "secondary"}
                                                    className={flag.enabled ? "bg-green-600 text-white" : ""}
                                                >
                                                    {flag.enabled ? "ENABLED" : "DISABLED"}
                                                </Badge>
                                            </div>
                                            {flag.description && (
                                                <p className="text-sm text-muted-foreground mt-0.5">{flag.description}</p>
                                            )}
                                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                                {flag.allowedRoles.length > 0 && (
                                                    <span>Roles: {flag.allowedRoles.join(", ")}</span>
                                                )}
                                                {flag.allowedBranches.length > 0 && (
                                                    <span>Branches: {flag.allowedBranches.join(", ")}</span>
                                                )}
                                                <span>
                                                    Updated: {new Date(flag.updatedAt).toLocaleDateString("en-GB", {
                                                        day: "numeric", month: "short", year: "numeric"
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleToggle(flag.key)}
                                        disabled={toggling === flag.key}
                                        className={`min-w-[100px] flex gap-2 ${flag.enabled ? "border-green-300 text-green-700 hover:bg-green-50" : ""}`}
                                    >
                                        {toggling === flag.key ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : flag.enabled ? (
                                            <><ToggleRight className="h-4 w-4" /> Disable</>
                                        ) : (
                                            <><ToggleLeft className="h-4 w-4" /> Enable</>
                                        )}
                                    </Button>
                                </div>
                            </Panel>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
