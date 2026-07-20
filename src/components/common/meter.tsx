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
      className={cn("rounded-[3px] bg-track overflow-hidden", className)}
      style={{ height }}
    >
      <div
        className="h-full bg-primary rounded-[3px]"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, opacity }}
      />
    </div>
  );
}
