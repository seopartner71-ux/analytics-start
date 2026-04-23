import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton screen for the heavy ProjectAnalyticsTab.
 * Shows the rough shape of the page (filter bar, KPI grid, chart, table)
 * so the user sees the layout immediately instead of an empty spinner.
 */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Filter bar */}
      <Card className="border-border bg-card p-3">
        <div className="flex items-center gap-2 flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-md" />
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          <Skeleton className="h-7 w-44 rounded-md" />
          <Skeleton className="h-7 w-32 rounded-md ml-auto" />
        </div>
      </Card>

      {/* KPI grid (Topvisor summary style) */}
      <Card className="bg-card border-border p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-muted/40 px-3 py-2 space-y-1.5">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </div>
      </Card>

      {/* Two metric cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="bg-card border-border p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[180px] w-full rounded-md" />
          </Card>
        ))}
      </div>

      {/* Big chart */}
      <Card className="bg-card border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-[280px] w-full rounded-md" />
      </Card>

      {/* Queries table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-8 rounded-full" />
        </div>
        <div className="divide-y divide-border/40">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center gap-4">
              <Skeleton className="h-3 w-4" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
