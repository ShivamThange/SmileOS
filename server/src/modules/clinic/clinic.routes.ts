import { Router } from "express";
import { asyncHandler } from "../../shared/http";
import { ok } from "../../shared/envelope";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import { recordAudit } from "../../services/audit.service";
import { ClinicModel } from "../../models/clinic.model";
import { errors } from "../../shared/errors";

/*
 * Clinic & settings (spec 4.2). GET /clinic drives frontend theming and is
 * cached aggressively. Branding/features/working-hours patches are audited
 * settings changes.
 */
export const clinicRouter = Router();

clinicRouter.use(requireDb, authenticate(), resolveTenant);

clinicRouter.get("/", asyncHandler(async (req, res) => {
  const clinic = await ClinicModel.findById(req.clinicId).lean();
  if (!clinic) throw errors.notFound("Clinic");
  return ok(res, clinic);
}));

clinicRouter.patch("/", authorize("settings", "update"), asyncHandler(async (req, res) => {
  const before = await ClinicModel.findById(req.clinicId).lean();
  const clinic = await ClinicModel.findByIdAndUpdate(req.clinicId, { $set: req.body, updatedBy: req.auth!.userId }, { new: true });
  if (!clinic) throw errors.notFound("Clinic");
  recordAudit(req, { action: "clinic.update", resourceType: "settings", resourceId: req.clinicId, before, after: clinic.toObject() });
  return ok(res, clinic);
}));

clinicRouter.patch("/branding", authorize("settings", "update"), asyncHandler(async (req, res) => {
  const clinic = await ClinicModel.findByIdAndUpdate(req.clinicId, { $set: { branding: req.body }, updatedBy: req.auth!.userId }, { new: true });
  if (!clinic) throw errors.notFound("Clinic");
  recordAudit(req, { action: "clinic.branding", resourceType: "settings", resourceId: req.clinicId });
  return ok(res, clinic.branding);
}));

clinicRouter.get("/features", asyncHandler(async (req, res) => {
  const clinic = await ClinicModel.findById(req.clinicId).select("features").lean();
  return ok(res, clinic?.features ?? {});
}));

clinicRouter.patch("/features", authorize("settings", "update"), asyncHandler(async (req, res) => {
  const clinic = await ClinicModel.findByIdAndUpdate(req.clinicId, { $set: { features: req.body }, updatedBy: req.auth!.userId }, { new: true });
  recordAudit(req, { action: "clinic.features", resourceType: "settings", resourceId: req.clinicId });
  return ok(res, clinic?.features ?? {});
}));

clinicRouter.get("/working-hours", asyncHandler(async (req, res) => {
  const clinic = await ClinicModel.findById(req.clinicId).select("workingHours holidays scheduling").lean();
  return ok(res, { workingHours: clinic?.workingHours ?? [], holidays: clinic?.holidays ?? [], scheduling: clinic?.scheduling });
}));
