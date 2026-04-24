/**
 * FeatureGate — wraps a route / page so the tenant's feature toggle is enforced
 * client-side with a helpful "feature locked" screen instead of a 403 / blank.
 *
 * The backend still enforces the same key via `requireFeature(...)`, so this is
 * strictly a UX layer. If the feature set hasn't loaded yet, we render children
 * optimistically and let the backend 403 gracefully fall through if needed —
 * avoids a full-page spinner on every nav.
 */

import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Lock, Mail, ArrowLeft } from "lucide-react";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

interface FeatureGateProps {
    feature: string;
    /** Optional friendly display name shown in the locked screen header. */
    title?: string;
    children: React.ReactNode;
}

export function FeatureGate({ feature, title, children }: FeatureGateProps) {
    const { has, isLoading, isSuperAdmin } = useTenantFeatures();
    const navigate = useNavigate();

    // Fail-open while loading + for super-admins, matching the backend core-bypass rule.
    if (isLoading || isSuperAdmin || has(feature)) {
        return <>{children}</>;
    }

    return (
        <AppLayout>
            <div className="container max-w-2xl mx-auto px-4 py-16">
                <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in duration-500">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-2xl" />
                        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
                            <Lock className="w-9 h-9 text-amber-600" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-widest text-amber-600">
                            Feature locked
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {title ?? "This feature isn't enabled for your clinic"}
                        </h1>
                        <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                            Access to this module is controlled by your clinic's plan. Contact your
                            administrator to request an upgrade and unlock it for your team.
                        </p>
                    </div>

                    <div className="bg-secondary/20 border border-border/60 rounded-2xl px-6 py-4 text-left w-full max-w-md">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                            Feature key
                        </div>
                        <code className="text-sm font-mono text-foreground">{feature}</code>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button variant="outline" onClick={() => navigate(-1)}>
                            <ArrowLeft className="w-4 h-4 mr-2" /> Go back
                        </Button>
                        <Button asChild>
                            <a href="mailto:admin@sirah.digital?subject=Feature%20upgrade%20request">
                                <Mail className="w-4 h-4 mr-2" /> Contact Admin for Upgrade
                            </a>
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
