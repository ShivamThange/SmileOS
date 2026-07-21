import { Router } from "express";
import * as ctrl from "./patient.controller";
import { asyncHandler } from "../../shared/http";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import { createPatientSchema, updatePatientSchema, checkDuplicateSchema } from "./patient.validator";

/* Patient routes (spec 4.4). */
export const patientRouter = Router();

patientRouter.use(requireDb, authenticate(), resolveTenant);

patientRouter.get("/", authorize("patient", "read"), asyncHandler(ctrl.list));
patientRouter.get("/search", authorize("patient", "read"), asyncHandler(ctrl.search));
patientRouter.post("/check-duplicate", authorize("patient", "read"), validate({ body: checkDuplicateSchema }), asyncHandler(ctrl.checkDuplicate));
patientRouter.post("/", authorize("patient", "create"), validate({ body: createPatientSchema }), asyncHandler(ctrl.create));
patientRouter.get("/:id", authorize("patient", "read"), asyncHandler(ctrl.getOne));
patientRouter.get("/:id/summary", authorize("patient", "read"), asyncHandler(ctrl.summary));
patientRouter.patch("/:id", authorize("patient", "update"), validate({ body: updatePatientSchema }), asyncHandler(ctrl.update));
patientRouter.delete("/:id", authorize("patient", "delete"), asyncHandler(ctrl.remove));
