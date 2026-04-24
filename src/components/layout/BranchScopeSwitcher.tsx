import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { useBranchScope, ALL_BRANCHES } from "@/hooks/useBranchScope";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BranchOption { id: string; name: string }

const ADMIN_ROLES = new Set(["ADMIN", "ADMIN_DOCTOR"]);

export function BranchScopeSwitcher() {
  const { role } = useAuth();
  const { scope, setBranchScope } = useBranchScope();
  const [branches, setBranches] = useState<BranchOption[]>([]);

  useEffect(() => {
    if (!ADMIN_ROLES.has(role ?? "")) return;
    apiClient.get<BranchOption[]>("/api/branches")
      .then(({ data }) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]));
  }, [role]);

  if (!ADMIN_ROLES.has(role ?? "")) return null;

  return (
    <Select value={scope || ALL_BRANCHES} onValueChange={setBranchScope}>
      <SelectTrigger className="h-9 w-[180px] gap-1.5">
        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <SelectValue placeholder="All Branches" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_BRANCHES}>All Branches</SelectItem>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
