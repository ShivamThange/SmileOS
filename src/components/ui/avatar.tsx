import { cn } from "@/lib/utils";
import { initials as toInitials } from "@/lib/utils";

export function Avatar({
  name,
  size = 30,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-full bg-primary-tint text-primary grid place-items-center font-bold border border-primary-tint-border shrink-0",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={name}
    >
      {toInitials(name)}
    </div>
  );
}
