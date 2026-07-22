import { Router } from "express";
import * as ctrl from "./compliance.controller";
import { asyncHandler } from "../../shared/http";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import { auditQuerySchema, erasureSchema } from "./compliance.validator";

/*
 * Compliance routes (spec Part 7 — DPDP). The audit trail is read-only and
 * gated on audit_log:read. Data-subject rights are gated on the patient
 * permission matching their sensitivity (export/update/delete).
 */
const guard = [requireDb, authenticate(), resolveTenant] as const;

export const auditRouter = Router();
auditRouter.use(...guard);
auditRouter.get("/", authorize("audit_log", "read"), validate({ query: auditQuerySchema }), asyncHandler(ctrl.listAuditLogs));

export const complianceRouter = Router();
complianceRouter.use(...guard);
complianceRouter.get("/patients/:id/export", authorize("patient", "export"), asyncHandler(ctrl.exportPatientData));
complianceRouter.post("/patients/:id/withdraw-consent", authorize("patient", "update"), asyncHandler(ctrl.withdrawConsent));
complianceRouter.post("/patients/:id/erase", authorize("patient", "delete"), validate({ body: erasureSchema }), asyncHandler(ctrl.erasePatient));
