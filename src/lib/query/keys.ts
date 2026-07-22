/*
 * Query-key factory (spec §6.1).
 *
 * THE CONVENTION: every key is an array shaped `[entity, scope, id?, params?]`.
 *   • `entity`  — the resource namespace, e.g. "patients"
 *   • `scope`   — "list" | "detail" | a sub-resource, e.g. "summary"
 *   • `id`      — the specific record id, when scoped to one
 *   • `params`  — a serialisable object of filters/sort/pagination for lists
 *
 * Because related keys share a prefix, invalidation can target exactly the right
 * breadth: `queryKeys.patients.all` invalidates everything patient-shaped;
 * `queryKeys.patients.lists()` only the lists (leaving cached details warm);
 * `queryKeys.patients.detail(id)` only that record.
 *
 * Every mutation MUST document, in its hook, which keys it invalidates. See
 * `features/clinic/queries.ts` for the reference example.
 *
 * Adding an entity: add a namespace here following the same shape. Keep list
 * params LAST so a partial key (without params) still matches for invalidation.
 */

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export const queryKeys = {
  clinic: {
    all: ["clinic"] as const,
    public: () => ["clinic", "public"] as const,
    current: () => ["clinic", "current"] as const,
    features: () => ["clinic", "features"] as const,
  },

  procedures: {
    all: ["procedures"] as const,
    lists: () => ["procedures", "list"] as const,
    list: (params: QueryParams = {}) => ["procedures", "list", params] as const,
    detail: (id: string) => ["procedures", "detail", id] as const,
  },

  team: {
    all: ["team"] as const,
    users: () => ["team", "users"] as const,
    attendance: (params: QueryParams = {}) => ["team", "attendance", params] as const,
  },

  operations: {
    all: ["operations"] as const,
    inventory: () => ["operations", "inventory"] as const,
    labCases: () => ["operations", "lab-cases"] as const,
    suppliers: () => ["operations", "suppliers"] as const,
  },

  clinical: {
    all: ["clinical"] as const,
    chart: (patientId: string) => ["clinical", "chart", patientId] as const,
    chartHistory: (patientId: string) => ["clinical", "chart", patientId, "history"] as const,
    notes: (patientId: string) => ["clinical", "notes", patientId] as const,
    prescriptions: (patientId: string) => ["clinical", "prescriptions", patientId] as const,
  },

  patients: {
    all: ["patients"] as const,
    lists: () => ["patients", "list"] as const,
    list: (params: QueryParams = {}) => ["patients", "list", params] as const,
    details: () => ["patients", "detail"] as const,
    detail: (id: string) => ["patients", "detail", id] as const,
    summary: (id: string) => ["patients", "detail", id, "summary"] as const,
    timeline: (id: string) => ["patients", "detail", id, "timeline"] as const,
    ledger: (id: string) => ["patients", "detail", id, "ledger"] as const,
  },

  appointments: {
    all: ["appointments"] as const,
    calendar: (params: QueryParams = {}) => ["appointments", "calendar", params] as const,
    today: () => ["appointments", "today"] as const,
    queue: () => ["appointments", "queue"] as const,
    availability: (params: QueryParams = {}) => ["appointments", "availability", params] as const,
    detail: (id: string) => ["appointments", "detail", id] as const,
  },

  treatmentPlans: {
    all: ["treatment-plans"] as const,
    lists: () => ["treatment-plans", "list"] as const,
    list: (params: QueryParams = {}) => ["treatment-plans", "list", params] as const,
    detail: (id: string) => ["treatment-plans", "detail", id] as const,
  },

  revenue: {
    all: ["revenue"] as const,
    unscheduled: (params: QueryParams = {}) => ["revenue", "unscheduled", params] as const,
    unscheduledSummary: () => ["revenue", "unscheduled", "summary"] as const,
  },

  billing: {
    all: ["billing"] as const,
    invoices: (params: QueryParams = {}) => ["billing", "invoices", params] as const,
    invoice: (id: string) => ["billing", "invoices", id] as const,
    payments: (params: QueryParams = {}) => ["billing", "payments", params] as const,
  },

  leads: {
    all: ["leads"] as const,
    list: (params: QueryParams = {}) => ["leads", "list", params] as const,
    detail: (id: string) => ["leads", "detail", id] as const,
    summary: () => ["leads", "summary"] as const,
  },

  recalls: {
    all: ["recalls"] as const,
    list: (params: QueryParams = {}) => ["recalls", "list", params] as const,
  },

  analytics: {
    all: ["analytics"] as const,
    dashboard: (params: QueryParams = {}) => ["analytics", "dashboard", params] as const,
    revenueAtRisk: () => ["analytics", "revenue-at-risk"] as const,
  },
} as const;
