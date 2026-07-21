import type { Request, Response } from "express";
import { ok, created } from "../../shared/envelope";
import { paginate } from "../../shared/list";
import { PatientModel } from "../../models/patient.model";
import { recordAudit } from "../../services/audit.service";
import { errors } from "../../shared/errors";
import * as svc from "./patient.service";

/* Patient controller (spec 4.4) — translates HTTP to patient-service calls. */

export async function list(req: Request, res: Response): Promise<Response> {
  const filter = svc.buildPatientFilter(req.clinicId!, req.query);
  return paginate(req, res, PatientModel, filter, {
    defaultSort: "createdAt",
    transform: (rows) => (rows as unknown as Record<string, unknown>[]).map((p) => ({
      id: String(p._id),
      ...p,
      name: [p.firstName, p.lastName].filter(Boolean).join(" "),
    })),
  });
}

export async function create(req: Request, res: Response): Promise<Response> {
  const patient = await svc.createPatient(req.clinicId!, req.auth!.userId, req.body);
  recordAudit(req, { action: "patient.create", resourceType: "patient", resourceId: String(patient._id), patient: patient._id });
  return created(res, await svc.getFullPatient(req.clinicId!, String(patient._id)), "Patient created");
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  return ok(res, await svc.getFullPatient(req.clinicId!, req.params.id));
}

export async function summary(req: Request, res: Response): Promise<Response> {
  return ok(res, await svc.getSummary(req.clinicId!, req.params.id));
}

export async function update(req: Request, res: Response): Promise<Response> {
  const before = await PatientModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).lean();
  if (!before) throw errors.notFound("Patient");
  const patient = await PatientModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { $set: req.body, updatedBy: req.auth!.userId },
    { new: true },
  );
  recordAudit(req, { action: "patient.update", resourceType: "patient", resourceId: req.params.id, patient: req.params.id, before });
  return ok(res, patient);
}

export async function remove(req: Request, res: Response): Promise<Response> {
  const patient = await PatientModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!patient) throw errors.notFound("Patient");
  await (patient as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  recordAudit(req, { action: "patient.delete", resourceType: "patient", resourceId: req.params.id, patient: req.params.id });
  return ok(res, { deleted: true });
}

export async function search(req: Request, res: Response): Promise<Response> {
  const s = String(req.query.q ?? "").trim();
  if (!s) return ok(res, []);
  const rows = await PatientModel.find({
    clinicId: req.clinicId,
    $or: [{ firstName: new RegExp(s, "i") }, { lastName: new RegExp(s, "i") }, { phone: new RegExp(s.replace(/\s/g, ""), "i") }, { patientNumber: new RegExp(s, "i") }],
  }).select("patientNumber firstName lastName phone").limit(10).lean();
  return ok(res, rows.map((p) => ({ id: String(p._id), name: [p.firstName, p.lastName].filter(Boolean).join(" "), phone: p.phone, patientNumber: p.patientNumber })));
}

export async function checkDuplicate(req: Request, res: Response): Promise<Response> {
  return ok(res, await svc.checkDuplicate(req.clinicId!, req.body.phone, req.body.name));
}
