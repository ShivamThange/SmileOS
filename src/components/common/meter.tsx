import { cn } from "@/lib/utils";

/** Thin single-hue progress meter used across the dashboard panels. */
export function Meter({
  value,
  className,
  height = 5,
  opacity = 1,
}: {
  value: number; // 0–100
  className?: string;
  height?: number;
  opacity?: number;
}) {
  return (
    <div
      className={cn("rounded-full bg-track overflow-hidden", className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-spring-soft)]"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          opacity,
          // A touch of vertical light on the fill so the bar reads as a solid
          // object rather than a flat rule.
          background: "linear-gradient(180deg, var(--primary-lift), var(--primary))",
        }}
      />
    </div>
  );
}
