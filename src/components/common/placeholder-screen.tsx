import { useNavigate } from "react-router-dom";
import { Icon, type IconName } from "@/components/ui/icon";
import { useUIStore } from "@/hooks/use-ui-store";

/**
 * The design's own placeholder pattern, reused for Console routes the Claude
 * Design project did not draw at full fidelity. We do NOT invent bespoke
 * visuals for these — this keeps undesigned surfaces honest and consistent.
 */
export function PlaceholderScreen({
  icon = "revenue",
  title,
  body,
  cta,
  ctaTo,
  ctaAction,
}: {
  icon?: IconName;
  title: string;
  body: string;
  cta?: string;
  ctaTo?: string;
  ctaAction?: "palette";
}) {
  const navigate = useNavigate();
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen);

  return (
    <div className="max-w-[1240px] mx-auto pt-[10vh] flex flex-col items-center gap-2.5 text-center">
      <div className="w-11 h-11 rounded-lg bg-surface border border-border grid place-items-center text-primary">
        <Icon name={icon} size={18} />
      </div>
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      <div className="text-[12.5px] text-muted max-w-[380px] leading-relaxed">{body}</div>
      {cta && (
        <button
          onClick={() => (ctaAction === "palette" ? setPaletteOpen(true) : navigate(ctaTo ?? "/app"))}
          className="mt-1.5 text-[12.5px] font-semibold px-4 py-2 rounded-md bg-primary text-on-primary hover:bg-primary-hover"
        >
          {cta}
        </button>
      )}
    </div>
  );
}
