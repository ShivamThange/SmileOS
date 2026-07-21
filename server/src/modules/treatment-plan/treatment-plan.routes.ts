import { Router } from "express";
import { z } from "zod";
import * as ctrl from "./treatment-plan.controller";
import { asyncHandler } from "../../shared/http";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";

/* Treatment plan + recovery routes (spec 4.7). */

const guard = [requireDb, authenticate(), resolveTenant] as const;

const decisionSchema = z.object({
  channel: z.enum(["in_clinic", "portal", "whatsapp"]).default("in_clinic"),
  decisions: z.array(z.object({
    itemId: z.string(),
    outcome: z.enum(["accepted", "declined", "deferred"]),
    reason: z.string().optional(),
    followUpDate: z.string().optional(),
  })).min(1),
});

const itemSchema = z.object({
  procedure: z.string().optional(),
  name: z.string().optional(),
  teeth: z.array(z.number()).optional(),
  surfaces: z.array(z.string()).optional(),
  quantity: z.number().int().positive().default(1),
  unitPricePaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative().default(0),
  priority: z.enum(["urgent", "recommended", "elective"]).default("recommended"),
  justification: z.string().optional(),
  phaseKey: z.string().optional(),
});

/* Plans */
export const treatmentPlanRouter = Router();
treatmentPlanRouter.use(...guard);
treatmentPlanRouter.get("/", authorize("treatment_plan", "read"), asyncHandler(ctrl.list));
treatmentPlanRouter.post("/", authorize("treatment_plan", "create"), asyncHandler(ctrl.create));
treatmentPlanRouter.get("/:id", authorize("treatment_plan", "read"), asyncHandler(ctrl.getOne));
treatmentPlanRouter.patch("/:id", authorize("treatment_plan", "update"), asyncHandler(ctrl.update));
treatmentPlanRouter.delete("/:id", authorize("treatment_plan", "update"), asyncHandler(ctrl.remove));
treatmentPlanRouter.post("/:id/items", authorize("treatment_plan", "update"), validate({ body: itemSchema }), asyncHandler(ctrl.addItem));
treatmentPlanRouter.post("/:id/present", authorize("treatment_plan", "update"), asyncHandler(ctrl.present));
treatmentPlanRouter.post("/:id/decision", authorize("treatment_plan", "update"), validate({ body: decisionSchema }), asyncHandler(ctrl.decision));

/* Plan items (top-level ids) */
export const planItemRouter = Router();
planItemRouter.use(...guard);
planItemRouter.patch("/:id", authorize("treatment_plan", "update"), asyncHandler(ctrl.updateItem));
planItemRouter.delete("/:id", authorize("treatment_plan", "update"), asyncHandler(ctrl.removeItem));
planItemRouter.post("/:id/schedule", authorize("treatment_plan", "update"), asyncHandler(ctrl.scheduleItem));

/* Revenue — the recovery worklist */
export const revenueRouter = Router();
revenueRouter.use(...guard);
revenueRouter.get("/unscheduled", authorize("treatment_plan", "read"), asyncHandler(ctrl.unscheduled));
revenueRouter.get("/unscheduled/summary", authorize("treatment_plan", "read"), asyncHandler(ctrl.unscheduledSummary));
revenueRouter.get("/case-acceptance", authorize("analytics", "read"), asyncHandler(ctrl.caseAcceptance));
revenueRouter.post("/unscheduled/:itemId/contact", authorize("treatment_plan", "update"), asyncHandler(ctrl.logContact));
revenueRouter.post("/unscheduled/:itemId/snooze", authorize("treatment_plan", "update"), asyncHandler(ctrl.snooze));
revenueRouter.post("/unscheduled/:itemId/decline", authorize("treatment_plan", "update"), asyncHandler(ctrl.declineItem));
revenueRouter.post("/unscheduled/:itemId/assign", authorize("treatment_plan", "update"), asyncHandler(ctrl.assign));
