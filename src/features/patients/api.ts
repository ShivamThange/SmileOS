import { api } from "@/lib/api";
import type { ApiResult } from "@/lib/api";
import type { Gender, PatientStatus } from "@/shared/enums";

/*
 * Patient endpoints (spec 4.4). The record shell everything hangs off. Typed
 * functions are the only place patient URLs are written; lists are server-driven
 * (pagination/sort/filter) and return the standard envelope with a pagination
 * block, so the caller uses api.getPage to keep the meta.
 */

/** A row in the patients list (GET /patients). The server flattens name and id. */
export interface PatientListRow {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName?: string;
  name: string;
  phone: string;
  dob?: string;
  gender?: Gender;
  ageFallback?: number;
  lastVisit?: string;
  balancePaise?: number;
  status?: PatientStatus;
  tags?: string[];
}

export interface PatientListParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  status?: PatientStatus;
  hasBalance?: boolean;
  recallDue?: boolean;
}

/** GET /patients — server-driven list. Returns rows + pagination meta. */
export function listPatients(params: PatientListParams): Promise<ApiResult<PatientListRow[]>> {
  return api.getPage<PatientListRow[]>("/patients", { query: { ...params } });
}

/** Fields the create form collects and the server accepts. */
export interface CreatePatientInput {
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  gender?: Gender;
  dob?: string;
  ageFallback?: number;
  address?: { line1?: string; locality?: string; city?: string };
  referralSource?: string;
  tags?: string[];
  notes?: string;
}

/** The full patient record (POST /patients response, GET /patients/:id). */
export interface PatientRecord extends PatientListRow {
  email?: string;
  altPhone?: string;
  bloodGroup?: string;
  occupation?: string;
  address?: { line1?: string; line2?: string; locality?: string; city?: string; state?: string; pincode?: string };
  emergencyContact?: { name?: string; relationship?: string; phone?: string };
  referralSource?: string;
  notes?: string;
  alerts?: string[];
  createdAt?: string;
}

/** POST /patients — creates a record and auto-assigns the patient number. */
export function createPatient(input: CreatePatientInput): Promise<PatientRecord> {
  return api.post<PatientRecord>("/patients", input);
}

/** GET /patients/:id — the full record. */
export function getPatient(id: string): Promise<PatientRecord> {
  return api.get<PatientRecord>(`/patients/${id}`);
}

/** GET /patients/:id/summary — alerts, balance, last/next visit. Loaded first
 *  and independently so the header bar can show medical alerts immediately. */
export interface PatientSummary {
  id: string;
  name: string;
  patientNumber: string;
  phone: string;
  alerts: string[];
  balancePaise: number;
  lastVisit?: string | null;
  nextVisit?: { id: string; start: string; proc?: string } | null;
  nextRecallDate?: string | null;
}
export function getPatientSummary(id: string): Promise<PatientSummary> {
  return api.get<PatientSummary>(`/patients/${id}/summary`);
}
