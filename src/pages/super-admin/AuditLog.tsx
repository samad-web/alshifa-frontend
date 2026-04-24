import { useEffect, useState } from "react";
import { superAdminApi, AuditLogEntry } from "@/services/superAdmin.service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ action: "", hospitalId: "" });

  const load = () => {
    setLoading(true);
    superAdminApi
      .listAudit({
        action: filters.action || undefined,
        hospitalId: filters.hospitalId || undefined,
        page,
        pageSize: 50,
      })
      .then((p) => {
        setRows(p.items);
        setTotalPages(p.totalPages || 1);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  };

  useEffect(load, [page]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          All SUPER_ADMIN actions. Separate from tenant-level audit.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Action</label>
          <Input
            placeholder="HOSPITAL_SUSPENDED"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Hospital ID</label>
          <Input
            value={filters.hospitalId}
            onChange={(e) => setFilters({ ...filters, hospitalId: e.target.value })}
          />
        </div>
        <Button onClick={() => { setPage(1); load(); }}>Apply</Button>
      </div>

      {loading ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="rounded-md border bg-white">
          <ul className="divide-y">
            {rows.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">No audit entries match.</li>
            ) : (
              rows.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 p-3">
                  <div className="min-w-0">
                    <div className="font-medium">{a.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()} ·
                      {" "}
                      {a.superAdmin?.email ?? a.superAdminId}
                      {a.hospital ? ` · ${a.hospital.name}` : ""}
                      {a.featureKey ? ` · ${a.featureKey}` : ""}
                    </div>
                  </div>
                  {a.details ? (
                    <pre className="max-w-md overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-700">
                      {JSON.stringify(a.details, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
        <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  );
}
