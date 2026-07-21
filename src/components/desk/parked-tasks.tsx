import { useDeskStore, type ParkedTask } from "@/hooks/use-desk-store";
import { Icon } from "@/components/ui/icon";

/*
 * Parked tasks.
 *
 * The receptionist is interrupted roughly every ninety seconds — a phone call
 * lands mid-settlement, a walk-in arrives mid-booking. Most practice software
 * treats that as data loss. Here it is an expected state: the half-finished
 * task collapses into a chip, several can coexist, and each reopens exactly
 * where it was left.
 *
 * This is a small amount of code and it is worth more to the desk than any
 * visual redesign in this product.
 */

export function ParkedTasks() {
  const { parked, resume, discard } = useDeskStore();
  if (parked.length === 0) return null;

  return (
    <div className="fixed left-4 bottom-4 z-[75] flex flex-col-reverse gap-1.5 max-w-[300px]">
      {parked.map((t) => (
        <Chip key={t.id} task={t} onResume={() => resume(t.id)} onDiscard={() => discard(t.id)} />
      ))}
    </div>
  );
}

function Chip({
  task,
  onResume,
  onDiscard,
}: {
  task: ParkedTask;
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-lg bg-surface border border-border shadow-raised animate-dc-pop">
      <span className="w-[22px] h-[22px] rounded-[6px] bg-primary-tint text-primary grid place-items-center flex-none">
        <Icon name={task.kind === "booking" ? "schedule" : "revenue"} size={12} />
      </span>

      <button onClick={onResume} className="min-w-0 flex-1 text-left">
        <span className="block text-[12px] font-semibold truncate">{task.label}</span>
        <span className="block text-[10.5px] text-muted-2 truncate">
          {task.sub ?? (task.kind === "booking" ? "Booking" : "Settlement")} ·{" "}
          {parkedAgo(task.parkedAt)}
        </span>
      </button>

      <button
        onClick={onDiscard}
        aria-label={`Discard parked task for ${task.label}`}
        title="Discard"
        className="w-[20px] h-[20px] grid place-items-center rounded-[5px] text-muted-3 opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-bg text-[11px] transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}

function parkedAgo(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} hr ago`;
}
