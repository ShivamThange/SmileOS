import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Local toast — the patient-facing surfaces (Site, Calculator, Treatment Plan,
 * Portal) render outside ConsoleLayout, so they don't share the console's global
 * toast. This is the same ink-on-cream, auto-dismissing toast, scoped per screen.
 */
export function useLocalToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const show = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  return { toast, show };
}

export function LocalToast({ toast, bottom = 24 }: { toast: string | null; bottom?: number }) {
  if (!toast) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[90] bg-ink text-on-primary text-[12.5px] font-medium px-[18px] py-2.5 rounded-[10px] shadow-toast animate-dc-fade max-w-[80vw] text-center"
      style={{ bottom }}
    >
      {toast}
    </div>
  );
}
