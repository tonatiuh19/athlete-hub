import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Subtle staggered pulse for staff loading surfaces. */
function Bone({
  className,
  delayMs = 0,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { delayMs?: number }) {
  return (
    <Skeleton
      className={cn(className)}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
      {...props}
    />
  );
}

export function StaffPageHeaderSkeleton({
  className,
  withIcon = false,
}: {
  className?: string;
  withIcon?: boolean;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        {withIcon ? <Bone className="h-7 w-7 rounded-lg" /> : null}
        <Bone className="h-8 w-48 sm:w-64 max-w-full" />
      </div>
      <Bone className="h-4 w-72 max-w-full" delayMs={60} />
    </div>
  );
}

export function StaffStatsCardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-sport p-5 space-y-3">
          <Bone className="h-5 w-5 rounded" delayMs={i * 40} />
          <Bone className="h-8 w-20" delayMs={i * 40 + 40} />
          <Bone className="h-3.5 w-28" delayMs={i * 40 + 80} />
        </div>
      ))}
    </div>
  );
}

export function StaffEventCardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card-sport p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-5 w-[75%] max-w-xs" delayMs={i * 50} />
            <Bone className="h-3 w-40" delayMs={i * 50 + 40} />
          </div>
          <div className="space-y-1 sm:text-right shrink-0">
            <Bone className="h-6 w-10 ml-auto" delayMs={i * 50 + 60} />
            <Bone className="h-2.5 w-16 ml-auto" delayMs={i * 50 + 80} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StaffTableSkeleton({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border overflow-hidden bg-card",
        className,
      )}
      aria-hidden
    >
      <div className="flex gap-3 border-b border-border bg-muted/40 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Bone key={i} className="h-3.5 flex-1" delayMs={i * 30} />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, c) => (
              <Bone
                key={c}
                className="h-4 flex-1"
                delayMs={r * 35 + c * 20}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StaffChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("card-sport p-5 space-y-4", className)} aria-hidden>
      <Bone className="h-4 w-40" />
      <div className="flex items-end gap-2 h-40 pt-2">
        {[40, 65, 45, 80, 55, 70, 50, 85, 60, 75].map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t-md bg-muted"
            style={{ height: `${h}%`, animationDelay: `${i * 45}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function StaffFormSkeleton({
  fields = 6,
  className,
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-5", className)} aria-hidden>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Bone className="h-3.5 w-28" delayMs={i * 40} />
          <Bone className="h-10 w-full rounded-lg" delayMs={i * 40 + 30} />
        </div>
      ))}
      <div className="flex gap-3 pt-2">
        <Bone className="h-10 w-28 rounded-lg" />
        <Bone className="h-10 w-24 rounded-lg" delayMs={40} />
      </div>
    </div>
  );
}

export function StaffSheetSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6 p-1", className)} aria-hidden>
      <div className="space-y-2">
        <Bone className="h-6 w-48" />
        <Bone className="h-4 w-64 max-w-full" delayMs={40} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Bone className="h-3 w-16" delayMs={i * 30} />
            <Bone className="h-4 w-full" delayMs={i * 30 + 20} />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Bone className="h-4 w-32" />
        <Bone className="h-20 w-full rounded-xl" delayMs={50} />
      </div>
    </div>
  );
}

export function StaffCalendarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("card-sport p-4 space-y-4", className)} aria-hidden>
      <div className="flex items-center justify-between gap-3">
        <Bone className="h-6 w-36" />
        <div className="flex gap-2">
          <Bone className="h-8 w-8 rounded-lg" />
          <Bone className="h-8 w-8 rounded-lg" delayMs={30} />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Bone key={`h-${i}`} className="h-3 w-full" delayMs={i * 20} />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <Bone
            key={`d-${i}`}
            className="aspect-square w-full rounded-lg"
            delayMs={(i % 7) * 25}
          />
        ))}
      </div>
    </div>
  );
}

export function StaffBlogCardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-sport overflow-hidden">
          <Bone className="h-36 w-full rounded-none" delayMs={i * 40} />
          <div className="p-4 space-y-2">
            <Bone className="h-5 w-[75%]" delayMs={i * 40 + 30} />
            <Bone className="h-3.5 w-full" delayMs={i * 40 + 50} />
            <Bone className="h-3.5 w-[66%]" delayMs={i * 40 + 70} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full page placeholder: header + optional stats + body. */
export function StaffPageSkeleton({
  variant = "default",
  className,
}: {
  variant?:
    | "default"
    | "dashboard"
    | "analytics"
    | "form"
    | "table"
    | "blog"
    | "payouts";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-6xl mx-auto w-full min-w-0 overflow-x-clip space-y-8",
        className,
      )}
      role="status"
      aria-busy="true"
    >
      <StaffPageHeaderSkeleton withIcon={variant === "analytics"} />
      {variant === "dashboard" || variant === "analytics" ? (
        <>
          <StaffStatsCardsSkeleton />
          {variant === "analytics" ? (
            <div className="grid md:grid-cols-2 gap-4">
              <StaffChartSkeleton />
              <StaffChartSkeleton />
            </div>
          ) : (
            <div className="space-y-4">
              <Bone className="h-5 w-32" />
              <StaffEventCardsSkeleton />
            </div>
          )}
        </>
      ) : null}
      {variant === "form" || variant === "payouts" ? (
        <div className="card-sport p-5 sm:p-6">
          <StaffFormSkeleton fields={variant === "payouts" ? 5 : 7} />
        </div>
      ) : null}
      {variant === "table" ? <StaffTableSkeleton /> : null}
      {variant === "blog" ? <StaffBlogCardsSkeleton /> : null}
      {variant === "default" ? (
        <div className="space-y-4">
          <StaffStatsCardsSkeleton count={3} />
          <StaffTableSkeleton rows={4} />
        </div>
      ) : null}
    </div>
  );
}
