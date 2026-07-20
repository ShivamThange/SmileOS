import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";

/** Every rupee figure renders through this — tabular figures, Indian grouping. */
export function MoneyText({
  paise,
  className,
  ...props
}: { paise: number } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("tnum", className)} {...props}>
      {inr(paise)}
    </span>
  );
}
