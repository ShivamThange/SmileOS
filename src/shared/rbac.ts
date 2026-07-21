/*
 * AUTO-GENERATED MIRROR of server/src/shared/rbac.ts — DO NOT EDIT BY HAND.
 * The backend copy is the single source of truth (spec §8.3).
 *   Regenerate:      npm run sync:enums
 *   CI drift guard:  npm run check:enums
 */
// ─── mirror begins (generated) ───
import { RESOURCES, ACTIONS, type UserRole, type Resource, type Action } from "@/shared/enums";

/*
 * RBAC matrix (spec 3.4). A permission is a `resource:action` pair. A user's
 * effective permissions are their role's grants, plus explicit grants, minus
 * explicit denials. Defined once on the backend; the frontend receives the
 * computed set from /auth/me and hides what the user cannot do.
 */

export type Permission = `${Resource}:${Action}`;

const ALL: Action[] = [...ACTIONS];
const RW: Action[] = ["create", "read", "update"];

/** Expand a role's coarse grants into concrete permission strings. */
function grants(map: Partial<Record<Resource, Action[]>>): Set<Permission> {
  const out = new Set<Permission>();
  for (const [resource, actions] of Object.entries(map) as [Resource, Action[]][]) {
    for (const action of actions) out.add(`${resource}:${action}`);
  }
  return out;
}

/** Every resource with the given actions — for the owner/admin broad grants. */
function everything(actions: Action[]): Partial<Record<Resource, Action[]>> {
  return Object.fromEntries(RESOURCES.map((r) => [r, actions])) as Partial<Record<Resource, Action[]>>;
}

export const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  // Owner — everything, including audit log, settings, financial exports, approvals.
  owner: grants(everything(ALL)),

  // Admin — everything except audit-log deletion (read only) and owner-level exports.
  admin: (() => {
    const s = grants(everything(ALL));
    s.delete("audit_log:delete");
    s.delete("audit_log:export");
    return s;
  })(),

  // Doctor — full clinical; read patients/appointments; plans + prescriptions; own analytics.
  doctor: grants({
    patient: ["read"], medical_history: RW, appointment: ["read", "update"],
    chart: RW, clinical_note: RW, prescription: RW, treatment_plan: [...RW, "approve"],
    invoice: ["read"], analytics: ["read"], lab_case: RW,
  }),

  // Receptionist — patients + appointments + invoices/payments + leads/messages; clinical summary only.
  receptionist: grants({
    patient: RW, appointment: [...ALL], invoice: ["create", "read"], payment: ["create", "read"],
    lead: [...RW, "delete"], campaign: RW, message: RW, treatment_plan: ["read"], lab_case: ["read", "update"],
  }),

  // Assistant — read appointments + patient basics; update chart + inventory consumption. No money.
  assistant: grants({
    patient: ["read"], appointment: ["read"], chart: ["read", "update"], inventory: ["read", "update"], lab_case: ["read", "update"],
  }),

  // Accountant — full financial read + payment/expense create. Identity + invoices, no clinical.
  accountant: grants({
    patient: ["read"], invoice: [...RW, "export"], payment: [...RW, "export"], refund: ["create", "read"],
    expense: [...RW, "delete"], analytics: ["read", "export"],
  }),

  // Lab technician — lab cases only, plus minimal patient identifiers.
  lab_technician: grants({
    lab_case: RW, patient: ["read"],
  }),
};

/** Compute effective permissions: role set + explicit grants − explicit denials. */
export function effectivePermissions(role: UserRole, extraGrants: Permission[] = [], denials: Permission[] = []): Set<Permission> {
  const set = new Set(ROLE_PERMISSIONS[role]);
  for (const g of extraGrants) set.add(g);
  for (const d of denials) set.delete(d);
  return set;
}

/** Sensitive actions requiring re-auth/second factor regardless of role (spec 3.4). */
export const SENSITIVE_ACTIONS: Permission[] = ["patient:delete", "refund:approve", "patient:export", "settings:update"];
