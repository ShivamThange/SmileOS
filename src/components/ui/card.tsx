import { cn } from "@/lib/utils";

/** Panel — the console's default surface: white, hairline border, 12px radius. */
export function Panel({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        // A hairline border plus the faintest contact shadow lifts the surface
        // off the warm canvas — the difference between a drawn box and a card
        // resting on paper.
        "bg-surface border border-border rounded-lg shadow-xs",
        interactive &&
          "cursor-pointer transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-spring-soft)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

/** Uppercase micro-label used above panels and stat groups. */
export function MicroLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "text-[11px] font-bold tracking-[0.09em] text-muted-2 uppercase",
        className,
      )}
      {...props}
    />
  );
}
