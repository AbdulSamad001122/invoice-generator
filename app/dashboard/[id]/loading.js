import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly while a client's page loads: same layout as the page
// (client header + invoice card with toolbar and the first 5 rows).
export default function ClientDashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading client">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Invoice list card */}
      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-4 border-b p-4 md:p-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Skeleton className="h-9 sm:max-w-xs sm:flex-1" />
            <Skeleton className="h-9 sm:w-44" />
            <Skeleton className="h-9 sm:w-40" />
            <Skeleton className="hidden h-8 w-16 sm:ml-auto sm:block" />
          </div>
        </div>
        <div className="space-y-3 p-4 md:p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
