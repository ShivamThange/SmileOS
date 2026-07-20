import { create } from "zustand";

/*
 * Small global UI store (Zustand) — toast queue, command palette and the
 * quick-preview drawer. Server state lives in TanStack Query; this is only
 * ephemeral client UI state per the spec's §6.1 split.
 */

interface UIState {
  toast: string | null;
  showToast: (msg: string) => void;
  clearToast: () => void;

  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;

  // Quick patient preview drawer (id) — opens over any screen.
  previewPatientId: string | null;
  openPatientPreview: (id: string) => void;
  closePatientPreview: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUIStore = create<UIState>((set) => ({
  toast: null,
  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
  clearToast: () => set({ toast: null }),

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  previewPatientId: null,
  openPatientPreview: (id) => set({ previewPatientId: id }),
  closePatientPreview: () => set({ previewPatientId: null }),
}));
