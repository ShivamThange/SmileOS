import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/http";
import { ok } from "../../shared/envelope";
import { errors } from "../../shared/errors";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import { runReport, toCsv, REPORT_TYPES, type ReportType, type GroupBy } from "./reports.service";

/*
 * Analytics report library routes (spec 4.12 / 5.12). Mounted alongside the
 * existing analytics router; each report shares one range+comparison+grouping
 * contract. Export is gated on the analytics:export permission.
 */
const guard = [requireDb, authenticate(), resolveTenant] as const;

const rangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupBy: z.enum(["day", "week", "month"]).default("month"),
  compare: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

function resolveRange(q: z.infer<typeof rangeQuery>) {
  const to = q.to ?? new Date();
  const from = q.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to, groupBy: q.groupBy as GroupBy, compare: Boolean(q.compare) };
}

function assertType(type: string): ReportType {
  if (!(REPORT_TYPES as readonly string[]).includes(type)) {
    throw errors.validation({ type: `Unknown report — one of: ${REPORT_TYPES.join(", ")}` });
  }
  return type as ReportType;
}

export const analyticsReportsRouter = Router();
analyticsReportsRouter.use(...guard);

analyticsReportsRouter.get(
  "/reports/:type",
  authorize("analytics", "read"),
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) => {
    const type = assertType(req.params.type);
    return ok(res, await runReport(type, req.clinicId!, resolveRange(req.query as unknown as z.infer<typeof rangeQuery>)));
  }),
);

analyticsReportsRouter.get(
  "/export",
  authorize("analytics", "export"),
  validate({ query: rangeQuery.extend({ type: z.string() }) }),
  asyncHandler(async (req, res) => {
    const type = assertType(String(req.query.type));
    const report = await runReport(type, req.clinicId!, resolveRange(req.query as unknown as z.infer<typeof rangeQuery>));
    const csv = toCsv(report);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-report.csv"`);
    return res.send(csv);
  }),
);
