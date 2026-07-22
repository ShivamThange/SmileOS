import type { Request, Response } from "express";
import { ok } from "../../shared/envelope";
import { paginate } from "../../shared/list";
import { recordAudit } from "../../services/audit.service";
import { AuditModel } from "../../models/audit.model";
import * as svc from "./compliance.service";

/* Compliance controller (spec Part 7 — DPDP). */

/* ---------------------------------------------------------------- Audit trail */

export async function listAuditLogs(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.actor) filter.actor = req.query.actor;
  if (req.query.patient) filter.patient = req.query.patient;
  if (req.query.resourceType) filter.resourceType = req.query.resourceType;
  if (req.query.resourceId) filter.resourceId = req.query.resourceId;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.outcome) filter.outcome = req.query.outcome;
  if (req.query.from || req.query.to) {
    filter.createdAt = {
      ...(req.query.from ? { $gte: new Date(String(req.query.from)) } : {}),
      ...(req.query.to ? { $lte: new Date(String(req.query.to)) } : {}),
    };
  }
  return paginate(req, res, AuditModel, filter, { defaultSort: "createdAt", populate: ["actor"], maxLimit: 200 });
}

/* -------------------------------------------------------- Data-subject rights */

export async function exportPatientData(req: Request, res: Response): Promise<Response> {
  const data = await svc.patientDataExport(req.clinicId!, req.params.id);
  // Assembling a patient's full record is itself a read of clinical data — audit it.
  recordAudit(req, { action: "compliance.data_export", resourceType: "patient", resourceId: req.params.id, patient: req.params.id });
  return ok(res, data);
}

export async function withdrawConsent(req: Request, res: Response): Promise<Response> {
  const patient = await svc.withdrawConsent(req.clinicId!, req.auth!.userId, req.params.id);
  recordAudit(req, { action: "compliance.consent_withdrawn", resourceType: "patient", resourceId: req.params.id, patient: req.params.id });
  return ok(res, patient, { message: "Marketing consent withdrawn" });
}

export async function erasePatient(req: Request, res: Response): Promise<Response> {
  const result = await svc.anonymisePatient(req.clinicId!, req.auth!.userId, req.params.id);
  recordAudit(req, { action: "compliance.patient_erased", resourceType: "patient", resourceId: req.params.id, patient: req.params.id });
  return ok(res, result, { message: "Patient identifiers anonymised; records retained per policy" });
}
