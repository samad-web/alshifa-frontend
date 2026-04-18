import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

// Reusable skeleton building blocks

function SkeletonCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("rounded-2xl border border-border/50 bg-card p-6 space-y-4", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/50 bg-card p-5", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <Skeleton className="h-2 w-full mt-4 rounded-full" />
    </div>
  );
}

function SkeletonRing({ size = 180 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Skeleton className="rounded-full" style={{ width: size, height: size }} />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-border/30">
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/6" />
      <Skeleton className="h-4 w-1/5" />
      <Skeleton className="h-6 w-16 rounded-full ml-auto" />
    </div>
  );
}

function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/30">
      <Skeleton className="h-5 w-5 rounded" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-12 rounded-full" />
    </div>
  );
}

// Page-level skeleton compositions

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  );
}

export function WellnessSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-12 w-36 rounded-2xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left - Zen status */}
        <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-6">
          <Skeleton className="h-12 w-12 rounded-3xl mx-auto" />
          <SkeletonRing />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>

        {/* Right - Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonStatCard />
            <SkeletonStatCard />
          </div>
          <SkeletonCard lines={0} className="h-64" />
          <SkeletonCard lines={2} />
        </div>
      </div>
    </div>
  );
}

export function AppointmentsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-4 py-3 px-4 border-b border-border bg-muted/30">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonTableRow key={i} />
        ))}
      </div>
    </div>
  );
}

export function PatientScreenSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Greeting */}
      <div className="text-center space-y-3">
        <Skeleton className="h-9 w-64 mx-auto" />
        <Skeleton className="h-5 w-80 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left - progress ring */}
        <div className="flex flex-col items-center space-y-6 py-8 bg-card rounded-3xl border border-border/50">
          <SkeletonRing size={220} />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>

        {/* Right - cards */}
        <div className="space-y-6">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    </div>
  );
}

export function PharmacySkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonTableRow key={i} />
        ))}
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)] animate-in fade-in duration-300">
      {/* Sidebar */}
      <div className="w-80 border-r border-border p-4 space-y-3">
        <Skeleton className="h-9 w-full rounded-lg" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col p-4">
        <div className="flex-1 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn("flex gap-3", i % 2 === 0 ? "" : "justify-end")}>
              {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}
              <Skeleton className={cn("h-16 rounded-2xl", i % 2 === 0 ? "w-2/3" : "w-1/2")} />
            </div>
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl mt-4" />
      </div>
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GenericPageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <SkeletonCard lines={5} />
    </div>
  );
}

// Export building blocks for custom compositions
export { SkeletonCard, SkeletonStatCard, SkeletonRing, SkeletonTableRow, SkeletonListItem };
