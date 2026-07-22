import { api } from "@/lib/api";

/*
 * Patient Portal endpoints (spec 4.14). Identity is derived from the patient
 * token on the server — these never pass a patient id. The dashboard is one
 * call that backs the whole home screen; appointments backs the visit history.
 */

export interface PortalMe {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  alerts?: { label: string; severity?: string }[];
}

export interface PortalDashboard {
  nextVisit: { id: string; start: string; detail?: string | null } | null;
  balancePaise: number;
  pendingPlans: { id: string; title?: string | null; status: string }[];
  dueRecalls: { type: string; dueDate: string }[];
}

export interface PortalAppointment {
  _id: string;
  start: string;
  end?: string;
  status: string;
  type?: string;
  chiefComplaint?: string | null;
}

export function getPortalMe(): Promise<PortalMe> {
  return api.get<PortalMe>("/portal/me");
}

export function getPortalDashboard(): Promise<PortalDashboard> {
  return api.get<PortalDashboard>("/portal/dashboard");
}

export function listPortalAppointments(): Promise<PortalAppointment[]> {
  return api.get<PortalAppointment[]>("/portal/appointments");
}

export interface PortalPlanItem {
  _id: string;
  name?: string | null;
  teeth?: number[];
  quantity?: number;
  lineTotalPaise?: number;
  priority?: string;
  status: string;
  phaseKey?: string | null;
  justification?: string | null;
}

export interface PortalPlan {
  _id: string;
  title?: string | null;
  status: string;
  planDate?: string;
  presentedAt?: string;
  notes?: string | null;
  items: PortalPlanItem[];
  totals: { grossPaise: number; acceptedPaise: number; itemCount: number };
}

export function getPortalPlan(id: string): Promise<PortalPlan> {
  return api.get<PortalPlan>(`/portal/treatment-plans/${id}`);
}

export interface PortalDecision {
  itemId: string;
  outcome: "accepted" | "declined" | "deferred";
  reason?: string;
}
export function submitPortalDecisions(id: string, decisions: PortalDecision[]): Promise<{ recorded: boolean }> {
  return api.post<{ recorded: boolean }>(`/portal/treatment-plans/${id}/decision`, { decisions });
}

export function listPortalPlans(): Promise<{ _id: string; title?: string; status: string; planDate?: string }[]> {
  return api.get<{ _id: string; title?: string; status: string; planDate?: string }[]>("/portal/treatment-plans");
}
