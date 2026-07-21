/*
 * TanStack Query conventions (spec §6.1). Import from `@/lib/query`.
 *   • queryKeys   — the hierarchical [entity, scope, id, params] key factory
 *   • queryClient — the shared, error-aware client mounted in main.tsx
 *
 * Query hooks live beside their feature (`features/<name>/queries.ts`) and use
 * these keys. Every mutation documents its invalidation list — see
 * features/clinic/queries.ts for the reference example.
 */
export { queryKeys } from "./keys";
export type { QueryParams } from "./keys";
export { queryClient } from "./client";
