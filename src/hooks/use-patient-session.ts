import { create } from "zustand";
import type { PortalPatient } from "@/features/auth/api";

/*
 * Patient portal session (spec §3.2 / T1.3). Separate from the staff `useAuth`
 * store: the portal is its own surface and a patient token uses a distinct
 * audience, so a patient identity never mixes with a staff one. The access
 * token itself lives in the shared in-memory `session` (@/lib/api).
 */
interface PatientSessionState {
  patient: PortalPatient | null;
  setPatient: (p: PortalPatient) => void;
  clear: () => void;
}

export const usePatientSession = create<PatientSessionState>((set) => ({
  patient: null,
  setPatient: (patient) => set({ patient }),
  clear: () => set({ patient: null }),
}));
