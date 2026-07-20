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
        "bg-surface border border-border rounded-lg",
        interactive && "cursor-pointer hover:border-border-strong transition-colors",
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
