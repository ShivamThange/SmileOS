import { cn } from "@/lib/utils";

/*
 * Skeletons matched to the final layout.
 *
 * The treatment-plan link is a patient's first impression of the clinic. It
 * should not open on the word "Loading…" in grey. A skeleton that has the shape
 * of the thing arriving reads as "this is nearly here"; a spinner reads as
 * "something is wrong". These are deliberately the same warm paper tones as the
 * surfaces they stand in for.
 */

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn("rounded-md bg-track animate-dc-shimmer", className)}
      style={style}
    />
  );
}

/** A line of text. `w` is a CSS width — vary it so blocks don't look printed. */
export function SkeletonLine({ w = "100%", h = 12, className }: { w?: string; h?: number; className?: string }) {
  return <Skeleton className={className} style={{ width: w, height: h }} />;
}

/**
 * Fallback for the lazily-loaded patient surfaces (/plan, /portal, /calculator).
 * Mirrors their shared shape: a slim header, a serif title block, then cards.
 */
export function PatientSurfaceSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="min-h-screen font-sans"
      style={{ background: "#EFEBE3" }}
    >
      <div className="h-[58px] border-b border-[#DFDAD0] flex items-center gap-3 px-5">
        <Skeleton className="w-8 h-8 rounded-[9px]" />
        <div className="flex flex-col gap-1.5">
          <SkeletonLine w="132px" h={11} />
          <SkeletonLine w="86px" h={8} />
        </div>
      </div>

      <div className="max-w-[720px] mx-auto px-5 pt-10 pb-16 flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <SkeletonLine w="120px" h={10} />
          <SkeletonLine w="78%" h={26} />
          <SkeletonLine w="55%" h={26} />
        </div>

        <div className="flex flex-col gap-2">
          <SkeletonLine w="100%" h={11} />
          <SkeletonLine w="94%" h={11} />
          <SkeletonLine w="61%" h={11} />
        </div>

        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[#DFDAD0] bg-white/70 p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <SkeletonLine w="42%" h={13} />
              <SkeletonLine w="72px" h={16} />
            </div>
            <SkeletonLine w="100%" h={10} />
            <SkeletonLine w="83%" h={10} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Fallback for console screens — page header plus a table shell. */
export function ConsoleScreenSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <SkeletonLine w="160px" h={18} />
          <SkeletonLine w="104px" h={10} />
        </div>
        <SkeletonLine w="118px" h={30} />
      </div>
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-bg-content">
          <SkeletonLine w="220px" h={11} />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 border-b border-border-faint flex items-center gap-3">
            <Skeleton className="w-[30px] h-[30px] rounded-full" />
            <SkeletonLine w={`${28 + ((i * 11) % 22)}%`} h={11} />
            <div className="flex-1" />
            <SkeletonLine w="72px" h={11} />
          </div>
        ))}
      </div>
    </div>
  );
}
