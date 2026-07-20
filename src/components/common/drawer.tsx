import { cn } from "@/lib/utils";

/**
 * Right-hand contextual drawer shell — the console's quick-preview surface
 * (spec §Layer 4). Slides in over the current screen without navigating away.
 */
export function Drawer({
  open,
  onClose,
  width = 400,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div
        className={cn(
          "absolute top-0 right-0 bottom-0 max-w-[92vw] bg-surface border-l border-border",
          "shadow-drawer pointer-events-auto flex flex-col animate-dc-drawer",
        )}
        style={{ width }}
      >
        {children}
      </div>
    </div>
  );
}

export function DrawerCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="w-[26px] h-[26px] rounded-[7px] grid place-items-center cursor-pointer text-muted-2 hover:bg-bg text-sm"
      aria-label="Close"
    >
      ✕
    </button>
  );
}
