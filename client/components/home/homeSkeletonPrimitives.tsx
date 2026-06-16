import { cn } from "@/lib/utils";

export function ShimmerBone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/40",
        className,
      )}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[featured-skeleton-shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary/20 to-transparent"
        aria-hidden
      />
    </div>
  );
}

export function SportChipsSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex gap-2 overflow-hidden py-0.5 -mx-1 px-1", className)}
      aria-hidden
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <ShimmerBone
          key={i}
          className="h-9 w-[5.5rem] shrink-0 rounded-full"
        />
      ))}
    </div>
  );
}

export function MobileFeaturedEventCardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90"
      aria-hidden
    >
      <div className="relative h-28 shrink-0 overflow-hidden">
        <ShimmerBone className="absolute inset-0 rounded-none" />
        <ShimmerBone className="absolute top-2 left-2 h-4 w-14 rounded-md" />
      </div>
      <div className="p-3 space-y-2">
        <ShimmerBone className="h-3.5 w-[92%]" />
        <ShimmerBone className="h-3.5 w-[68%]" />
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center gap-1.5">
            <ShimmerBone className="h-3 w-3 shrink-0 rounded-full" />
            <ShimmerBone className="h-2.5 flex-1 max-w-[7rem]" />
          </div>
          <div className="flex items-center gap-1.5">
            <ShimmerBone className="h-3 w-3 shrink-0 rounded-full" />
            <ShimmerBone className="h-2.5 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileFeaturedEventsRowsSkeleton({ cardsPerRow = 6 }: { cardsPerRow?: number }) {
  return (
    <div
      className={cn(
        "flex gap-3 overflow-hidden -mx-1 px-1",
        "[mask-image:linear-gradient(to_right,transparent_0,black_8px,black_calc(100%-16px),transparent_100%)]",
      )}
      aria-hidden
    >
      {Array.from({ length: cardsPerRow }).map((_, i) => (
        <div
          key={i}
          className="w-[min(46vw,11.5rem)] shrink-0"
        >
          <MobileFeaturedEventCardSkeleton />
        </div>
      ))}
    </div>
  );
}

export function MobileMapSectionSkeleton() {
  return (
    <div
      className="rounded-2xl border border-border/70 bg-card/80 overflow-hidden"
      aria-hidden
    >
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1 space-y-2">
          <ShimmerBone className="h-4 w-36" />
          <ShimmerBone className="h-3 w-full max-w-[14rem]" />
        </div>
        <ShimmerBone className="h-9 w-24 shrink-0 rounded-full" />
      </div>
      <ShimmerBone className="h-[220px] w-full rounded-none border-t border-border/50" />
    </div>
  );
}

export function DesktopFeaturedEventCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="card-sport overflow-hidden h-full flex flex-col"
      style={{ animationDelay: `${index * 80}ms` }}
      aria-hidden
    >
      <div className="relative h-52 md:h-56 shrink-0 overflow-hidden">
        <ShimmerBone className="absolute inset-0 rounded-none" />
        <ShimmerBone className="absolute top-4 right-4 h-7 w-24 rounded-full" />
      </div>

      <div className="p-5 md:p-6 flex flex-col flex-1">
        <ShimmerBone className="h-6 w-[88%] mb-3" />
        <ShimmerBone className="h-6 w-[62%] mb-5" />

        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2.5">
            <ShimmerBone className="h-4 w-4 shrink-0 rounded" />
            <ShimmerBone className="h-4 flex-1 max-w-[140px]" />
          </div>
          <div className="flex items-center gap-2.5">
            <ShimmerBone className="h-4 w-4 shrink-0 rounded" />
            <ShimmerBone className="h-4 flex-1 max-w-[120px]" />
          </div>
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-border/50 mt-auto">
          <ShimmerBone className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}
