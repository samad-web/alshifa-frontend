import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import { useBranchScope } from "@/hooks/useBranchScope";

interface UserSnapshotRow {
    id: string;
    fullName: string | null;
    email: string;
    role: string;
    branchId: string | null;
    branchName: string | null;
    phoneNumber: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}

const ROLE_OPTIONS = ["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST", "PATIENT", "PHARMACIST"];

/**
 * Dedicated user-snapshot table — backed by UserSnapshot, the flat
 * reporting cache that's kept in sync by UserService.upsertSnapshot.
 * Lets admins eyeball the system roster without dropping into a CSV.
 */
export default function UsersExportPage() {
    const { toast } = useToast();
    const { branchIdParam } = useBranchScope();
    const [rows, setRows] = useState<UserSnapshotRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("ALL");
    const [showDeleted, setShowDeleted] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const params: Record<string, string | boolean | undefined> = {};
            if (branchIdParam) params.branchId = branchIdParam;
            if (roleFilter !== "ALL") params.role = roleFilter;
            if (showDeleted) params.includeDeleted = true;
            const { data } = await apiClient.get<{ users: UserSnapshotRow[]; count: number }>("/api/user/export", params);
            setRows(data.users || []);
        } catch (err) {
            toast({
                title: "Failed to load users",
                description: err instanceof Error ? err.message : "",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchIdParam, roleFilter, showDeleted]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) =>
            (r.fullName || "").toLowerCase().includes(q)
            || r.email.toLowerCase().includes(q)
            || (r.branchName || "").toLowerCase().includes(q)
            || (r.phoneNumber || "").toLowerCase().includes(q),
        );
    }, [rows, search]);

    async function downloadCsv() {
        setExporting(true);
        try {
            const params: Record<string, string | boolean> = { format: "csv" };
            if (branchIdParam) params.branchId = branchIdParam;
            if (roleFilter !== "ALL") params.role = roleFilter;
            if (showDeleted) params.includeDeleted = true;
            const blob = await apiClient.getBlob("/api/user/export", params);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast({
                title: "Export failed",
                description: err instanceof Error ? err.message : "",
                variant: "destructive",
            });
        } finally {
            setExporting(false);
        }
    }

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-6 space-y-4">
                <PageHeader
                    title="Users Snapshot"
                    subtitle="Flattened, role-agnostic view of every user. Backed by UserSnapshot for fast reporting."
                >
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Refresh
                        </Button>
                        <Button onClick={downloadCsv} disabled={exporting} className="gap-2">
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Export CSV
                        </Button>
                    </div>
                </PageHeader>

                <Card>
                    <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search name, email, branch, phone…"
                                className="pl-9"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All roles</SelectItem>
                                {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button
                            variant={showDeleted ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowDeleted((v) => !v)}
                        >
                            {showDeleted ? "Hiding deleted" : "Include deleted"}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr>
                                        <th className="text-left px-5 py-2 font-medium">Name</th>
                                        <th className="text-left px-3 py-2 font-medium">Email</th>
                                        <th className="text-left px-3 py-2 font-medium">Role</th>
                                        <th className="text-left px-3 py-2 font-medium">Branch</th>
                                        <th className="text-left px-3 py-2 font-medium">Phone</th>
                                        <th className="text-left px-3 py-2 font-medium">Status</th>
                                        <th className="text-left px-5 py-2 font-medium">Created</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {loading ? (
                                        Array.from({ length: 6 }).map((_, i) => (
                                            <tr key={i}>
                                                <td colSpan={7} className="px-5 py-3"><Skeleton className="h-4 w-full" /></td>
                                            </tr>
                                        ))
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">No users match.</td></tr>
                                    ) : filtered.map((u) => (
                                        <tr key={u.id} className="hover:bg-muted/20">
                                            <td className="px-5 py-2 font-medium">{u.fullName || "—"}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                                            <td className="px-3 py-2">
                                                <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                                            </td>
                                            <td className="px-3 py-2">{u.branchName || "—"}</td>
                                            <td className="px-3 py-2">{u.phoneNumber || "—"}</td>
                                            <td className="px-3 py-2">
                                                <Badge
                                                    variant={u.status === "ACTIVE" ? "default" : u.status === "DELETED" ? "destructive" : "secondary"}
                                                    className="text-[10px]"
                                                >
                                                    {u.status}
                                                </Badge>
                                            </td>
                                            <td className="px-5 py-2 text-xs text-muted-foreground">
                                                {new Date(u.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {!loading && (
                    <p className="text-xs text-muted-foreground text-right">
                        Showing {filtered.length} of {rows.length} users
                    </p>
                )}
            </div>
        </AppLayout>
    );
}
