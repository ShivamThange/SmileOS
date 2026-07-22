import { z } from "zod";

/*
 * Compliance validators (spec Part 7 — DPDP). Audit-trail query filters and the
 * data-subject request bodies. String schemas guard against operator injection.
 */

export const auditQuerySchema = z.object({
  actor: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  patient: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  action: z.string().optional(),
  outcome: z.enum(["success", "failure"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const erasureSchema = z.object({
  reason: z.string().optional(),
  // Explicit confirmation — anonymisation is irreversible.
  confirm: z.literal(true, { errorMap: () => ({ message: "Erasure must be explicitly confirmed" }) }),
});
