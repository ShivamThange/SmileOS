import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/http";
import { ok, created } from "../../shared/envelope";
import { paginate } from "../../shared/list";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import { recordAudit } from "../../services/audit.service";
import { LeadModel } from "../../models/growth.model";
import { RecallModel } from "../../models/recall.model";
import * as svc from "./growth.service";

/* Leads + recalls routes (spec 4.9). */
const guard = [requireDb, authenticate(), resolveTenant] as const;

const createLeadSchema = z.object({
  name: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional(),
  source: z.string().optional(), interest: z.string().optional(),
  estimatedValuePaise: z.number().int().nonnegative().optional(),
});

/* Leads */
export const leadRouter = Router();
leadRouter.use(...guard);
leadRouter.get("/", authorize("lead", "read"), asyncHandler((req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.stage) filter.stage = req.query.stage;
  if (req.query.source) filter.source = req.query.source;
  if (req.query.assigned) filter.assignedTo = req.query.assigned;
  return paginate(req, res, LeadModel, filter, {
    defaultSort: "createdAt",
    transform: (rows) => (rows as unknown as Record<string, unknown>[]).map((l) => ({ ...l, id: String(l._id), timeToFirstContactMin: svc.timeToFirstContactMin(l as never) })),
  });
}));
leadRouter.get("/summary", authorize("lead", "read"), asyncHandler(async (req, res) => ok(res, await svc.leadSummary(req.clinicId!))));
leadRouter.post("/", authorize("lead", "create"), validate({ body: createLeadSchema }), asyncHandler(async (req, res) => {
  const lead = await LeadModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId });
  recordAudit(req, { action: "lead.create", resourceType: "lead", resourceId: String(lead._id) });
  return created(res, lead, "Lead created");
}));
leadRouter.get("/:id", authorize("lead", "read"), asyncHandler(async (req, res) => {
  const lead = await LeadModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).lean();
  return ok(res, lead);
}));
leadRouter.post("/:id/stage", authorize("lead", "update"), asyncHandler(async (req, res) => {
  await svc.setStage(req.clinicId!, req.auth!.userId, req.params.id, req.body.stage, req.body.lostReason);
  return ok(res, { updated: true });
}));
leadRouter.post("/:id/activities", authorize("lead", "update"), asyncHandler(async (req, res) => {
  await svc.logActivity(req.clinicId!, req.auth!.userId, req.params.id, req.body);
  return ok(res, { logged: true });
}));
leadRouter.post("/:id/convert", authorize("lead", "update"), asyncHandler(async (req, res) => {
  const result = await svc.convertLead(req.clinicId!, req.auth!.userId, req.params.id);
  recordAudit(req, { action: "lead.convert", resourceType: "lead", resourceId: req.params.id, patient: result.patientId });
  return ok(res, result, { message: "Lead converted to patient" });
}));

/* Recalls */
export const recallRouter = Router();
recallRouter.use(...guard);
recallRouter.get("/", authorize("patient", "read"), asyncHandler((req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;
  return paginate(req, res, RecallModel, filter, { defaultSort: "dueDate", populate: ["patient"] });
}));
recallRouter.get("/summary", authorize("patient", "read"), asyncHandler(async (req, res) => ok(res, await svc.recallSummary(req.clinicId!))));
recallRouter.post("/", authorize("patient", "update"), asyncHandler(async (req, res) => {
  const recall = await RecallModel.create({ ...req.body, clinicId: req.clinicId, source: "manual", createdBy: req.auth!.userId });
  return created(res, recall, "Recall created");
}));
recallRouter.post("/:id/contact", authorize("patient", "update"), asyncHandler(async (req, res) => {
  await RecallModel.updateOne({ _id: req.params.id, clinicId: req.clinicId }, { status: "contacted", $push: { contactAttempts: { date: new Date(), channel: req.body.channel, outcome: req.body.outcome, by: req.auth!.userId } } });
  return ok(res, { logged: true });
}));
