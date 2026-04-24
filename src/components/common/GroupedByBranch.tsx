import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GroupedByBranchProps<T> {
  items: T[];
  getBranchId: (item: T) => string | null | undefined;
  getBranchName?: (item: T) => string | null | undefined;
  renderItem: (item: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
}

const UNASSIGNED = "__unassigned__";

export function GroupedByBranch<T>({
  items,
  getBranchId,
  getBranchName,
  renderItem,
  emptyState,
  className,
}: GroupedByBranchProps<T>) {
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: T[] }>();
    for (const item of items) {
      const id = getBranchId(item) ?? UNASSIGNED;
      const name = getBranchName?.(item) ?? (id === UNASSIGNED ? "Unassigned" : id);
      if (!map.has(id)) map.set(id, { name, items: [] });
      map.get(id)!.items.push(item);
    }
    return Array.from(map.entries())
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => {
        if (a.id === UNASSIGNED) return 1;
        if (b.id === UNASSIGNED) return -1;
        return a.name.localeCompare(b.name);
      });
  }, [items, getBranchId, getBranchName]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {groups.map((g) => {
        const isCollapsed = collapsed[g.id];
        return (
          <section key={g.id} className="rounded-lg border bg-card/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                {g.name}
                <span className="text-xs text-muted-foreground font-normal">({g.items.length})</span>
              </div>
              {isCollapsed
                ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {!isCollapsed && (
              <div className="p-3 space-y-2">
                {g.items.map((item, i) => <div key={i}>{renderItem(item)}</div>)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
