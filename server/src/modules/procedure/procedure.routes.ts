import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/http";
import { ok, created } from "../../shared/envelope";
import { validate } from "../../middleware/validate";
import { requireDb } from "../../middleware/require-db";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { recordAudit } from "../../services/audit.service";
import { ProcedureModel } from "../../models/procedure.model";
import { PROCEDURE_CATEGORIES } from "../../shared/enums";
import { errors } from "../../shared/errors";

/*
 * Procedure / Service Catalogue (spec 2.5 / 4.2). The price book every money
 * surface reads from: the fee schedule in Settings, the public cost calculator,
 * and the treatment-plan builder. Reads are open to any authenticated staff
 * member (a doctor building a plan needs the prices); writes are settings
 * changes, so they require settings:update and are audited.
 */
export const procedureRouter = Router();

procedureRouter.use(requireDb, authenticate(), resolveTenant);

/** Derive a stable uppercase code from a name when the caller didn't supply one. */
function codeFromName(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "PROC";
}

const listQuery = z.object({
  category: z.enum(PROCEDURE_CATEGORIES).optional(),
  publicVisible: z.coerce.boolean().optional(),
});

procedureRouter.get("/", validate({ query: listQuery }), asyncHandler(async (req, res) => {
  // validate() has coerced and replaced the raw query with typed values.
  const q = req.query as unknown as z.infer<typeof listQuery>;
  const filter: Record<string, unknown> = { clinicId: req.clinicId };
  if (q.category) filter.category = q.category;
  if (q.publicVisible !== undefined) filter.publicVisible = q.publicVisible;
  const procedures = await ProcedureModel.find(filter).sort({ category: 1, displayOrder: 1, name: 1 }).lean();
  return ok(res, procedures);
}));

procedureRouter.get("/:id", asyncHandler(async (req, res) => {
  const procedure = await ProcedureModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).lean();
  if (!procedure) throw errors.notFound("Procedure");
  return ok(res, procedure);
}));

const upsertBody = z.object({
  code: z.string().min(1).max(24).optional(),
  name: z.string().min(1),
  friendlyName: z.string().optional(),
  category: z.enum(PROCEDURE_CATEGORIES),
  description: z.string().optional(),
  defaultDurationMinutes: z.number().int().positive().optional(),
  defaultPricePaise: z.number().int().nonnegative().optional(),
  tierPrices: z.record(z.string(), z.number().int().nonnegative()).optional(),
  taxApplicable: z.boolean().optional(),
  taxRate: z.number().nonnegative().optional(),
  toothSpecific: z.boolean().optional(),
  surfaceSpecific: z.boolean().optional(),
  typicalSittings: z.number().int().positive().optional(),
  defaultRecallIntervalDays: z.number().int().positive().optional(),
  requiresConsent: z.boolean().optional(),
  requiresLab: z.boolean().optional(),
  publicVisible: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

procedureRouter.post("/", authorize("settings", "update"), validate({ body: upsertBody }), asyncHandler(async (req, res) => {
  const code = req.body.code || codeFromName(req.body.name);
  const clash = await ProcedureModel.findOne({ clinicId: req.clinicId, code }).lean();
  if (clash) throw errors.conflictState(`A procedure with code ${code} already exists`);
  const procedure = await ProcedureModel.create({ ...req.body, code, clinicId: req.clinicId, createdBy: req.auth!.userId });
  recordAudit(req, { action: "procedure.create", resourceType: "settings", resourceId: String(procedure._id) });
  return created(res, procedure.toObject(), "Procedure added");
}));

procedureRouter.patch("/:id", authorize("settings", "update"), validate({ body: upsertBody.partial() }), asyncHandler(async (req, res) => {
  const procedure = await ProcedureModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { $set: { ...req.body, updatedBy: req.auth!.userId } },
    { new: true },
  );
  if (!procedure) throw errors.notFound("Procedure");
  recordAudit(req, { action: "procedure.update", resourceType: "settings", resourceId: req.params.id });
  return ok(res, procedure.toObject());
}));

procedureRouter.delete("/:id", authorize("settings", "update"), asyncHandler(async (req, res) => {
  const procedure = await ProcedureModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!procedure) throw errors.notFound("Procedure");
  await (procedure as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  recordAudit(req, { action: "procedure.delete", resourceType: "settings", resourceId: req.params.id });
  return ok(res, { id: req.params.id }, { message: "Procedure removed" });
}));
