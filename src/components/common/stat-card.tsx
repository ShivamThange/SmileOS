import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/card";
import { Meter } from "./meter";

export interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "warn";
  sub?: string;
  barPct?: number;
  onClick?: () => void;
}

const deltaColor: Record<NonNullable<StatCardProps["deltaTone"]>, string> = {
  up: "text-primary",
  down: "text-danger",
  warn: "text-warning",
};

export function StatCard({
  label,
  value,
  delta,
  deltaTone = "up",
  sub,
  barPct,
  onClick,
}: StatCardProps) {
  return (
    <Panel
      interactive={!!onClick}
      onClick={onClick}
      className="p-4 flex flex-col gap-1.5"
    >
      <div className="text-[11px] font-semibold text-muted uppercase tracking-[0.05em]">{label}</div>
      <div className="text-[22px] font-bold tnum tracking-[-0.03em] text-ink">{value}</div>
      {barPct !== undefined && <Meter value={barPct} className="my-0.5" />}
      {(delta || sub) && (
        <div className="text-[11.5px] flex gap-1.5 items-baseline">
          {delta && (
            <span className={cn("font-semibold", deltaColor[deltaTone])}>{delta}</span>
          )}
          {sub && <span className="text-muted-2">{sub}</span>}
        </div>
      )}
    </Panel>
  );
}
