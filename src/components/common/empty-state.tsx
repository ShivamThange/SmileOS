import { Icon, type IconName } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

/**
 * EmptyState — every list/table/panel must define one. An empty screen with
 * no guidance is the most common reason a demo falls flat (spec §3, Layer 2).
 */
export function EmptyState({
  icon = "search",
  title,
  body,
  cta,
  onCta,
}: {
  icon?: IconName;
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="px-5 py-12 flex flex-col items-center gap-2 text-center">
      <div className="w-9 h-9 rounded-full bg-primary-tint grid place-items-center text-primary">
        <Icon name={icon} size={16} />
      </div>
      <div className="text-[13.5px] font-semibold">{title}</div>
      <div className="text-[12.5px] text-muted max-w-[340px] leading-relaxed">{body}</div>
      {cta && (
        <Button variant="primary" className="mt-1.5" onClick={onCta}>
          {cta}
        </Button>
      )}
    </div>
  );
}
