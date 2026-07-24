import { useUIStore } from "@/hooks/use-ui-store";

/** Bottom-centre toast on the ink surface — mirrors the design exactly. */
export function ToastHost() {
  const toast = useUIStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] bg-ink text-on-primary text-[12.5px] font-medium px-[18px] py-2.5 rounded-xl shadow-toast animate-dc-toast max-w-[70vw]"
      role="status"
      aria-live="polite"
    >
      {toast}
    </div>
  );
}
