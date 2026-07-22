import { api } from "@/lib/api";

/*
 * Clinical endpoints (spec 2.4) — the chair. Chart persistence, clinical notes
 * (lock/amend), and prescriptions with a server-side allergy cross-check. Typed
 * functions are the only place clinical URLs are written.
 */

/* ------------------------------------------------------------------- Chart */

export interface ToothRecord {
  toothNumber: number;
  presence?: string;
  wholeConditions?: string[];
  surfaces?: { surface: string; condition: string; severity?: string; note?: string }[];
  mobility?: number;
  endodonticStatus?: string;
}
export interface DentalChart {
  _id: string;
  patient: string;
  numberingSystem: string;
  dentition: string;
  teeth: Record<string, ToothRecord>;
}
export interface ChartHistoryEntry {
  _id: string;
  toothNumber?: number;
  change?: { before?: ToothRecord | null; after?: ToothRecord };
  doctor?: { name?: string } | string;
  createdAt: string;
}

export function getChart(patientId: string): Promise<DentalChart> {
  return api.get<DentalChart>(`/patients/${patientId}/chart`);
}
export function updateTooth(patientId: string, toothNumber: number, body: Partial<ToothRecord>): Promise<{ toothNumber: number; tooth: ToothRecord }> {
  return api.put<{ toothNumber: number; tooth: ToothRecord }>(`/patients/${patientId}/chart/tooth/${toothNumber}`, body);
}
export function getChartHistory(patientId: string): Promise<ChartHistoryEntry[]> {
  return api.get<ChartHistoryEntry[]>(`/patients/${patientId}/chart/history`);
}

/* ------------------------------------------------------------ Clinical notes */

export interface ClinicalNote {
  _id: string;
  noteDate: string;
  chiefComplaint?: string;
  examination?: string;
  diagnosis?: { text: string; teeth?: number[] }[];
  advice?: string;
  signed?: boolean;
  lockedAt?: string | null;
  editable?: boolean;
  doctor?: { name?: string } | string;
  amendments?: { text: string; at: string }[];
}

export function getNotes(patientId: string): Promise<ClinicalNote[]> {
  return api.get<ClinicalNote[]>(`/patients/${patientId}/notes`);
}
export function createNote(patientId: string, body: Partial<ClinicalNote>): Promise<ClinicalNote> {
  return api.post<ClinicalNote>(`/patients/${patientId}/notes`, body);
}
export function amendNote(id: string, text: string): Promise<ClinicalNote> {
  return api.post<ClinicalNote>(`/clinical-notes/${id}/amend`, { text });
}
export function signNote(id: string): Promise<ClinicalNote> {
  return api.post<ClinicalNote>(`/clinical-notes/${id}/sign`);
}

/* ------------------------------------------------------------- Prescriptions */

export interface RxMedication {
  drug: string;
  strength?: string;
  form?: string;
  dosage?: string;
  frequency?: string;
  durationDays?: number;
  instructions?: string;
}
export interface Prescription {
  _id: string;
  date: string;
  medications: RxMedication[];
  advice?: string;
  warnings?: string[];
  doctor?: { name?: string } | string;
}

export function getPrescriptions(patientId: string): Promise<Prescription[]> {
  return api.get<Prescription[]>(`/patients/${patientId}/prescriptions`);
}
export function createPrescription(patientId: string, body: { medications: RxMedication[]; advice?: string }): Promise<Prescription> {
  return api.post<Prescription>(`/patients/${patientId}/prescriptions`, body);
}
