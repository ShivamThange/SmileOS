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
import { errors } from "../../shared/errors";
import { CLINICAL_NOTE_LOCK_HOURS } from "../../config/constants";
import { TOOTH_PRESENCE, TOOTH_CONDITIONS, SURFACES } from "../../shared/enums";
import {
  DentalChartModel,
  ChartHistoryModel,
  ClinicalNoteModel,
  PrescriptionModel,
} from "../../models/clinical.model";
import { MedicalHistoryModel } from "../../models/patient.model";

/*
 * Clinical module (spec 2.4). The chair is the product's moat: the tooth chart
 * (one active per patient, every change appended to history), clinical notes
 * (editable within a window, append-only amendments thereafter), and
 * prescriptions (allergy cross-checked against the patient's medical history).
 * Reads need chart/clinical_note read; writes need the matching update/create.
 */
export const clinicalRouter = Router();
clinicalRouter.use(requireDb, authenticate(), resolveTenant);

/* ----------------------------------------------------------------- Chart --- */

async function loadOrCreateChart(clinicId: string, patient: string, userId?: string) {
  let chart = await DentalChartModel.findOne({ clinicId, patient });
  if (!chart) chart = await DentalChartModel.create({ clinicId, patient, createdBy: userId });
  return chart;
}

clinicalRouter.get("/patients/:patientId/chart", authorize("chart", "read"), asyncHandler(async (req, res) => {
  const chart = await loadOrCreateChart(req.clinicId!, req.params.patientId, req.auth!.userId);
  return ok(res, chart.toObject());
}));

const toothBody = z.object({
  presence: z.enum(TOOTH_PRESENCE).optional(),
  wholeConditions: z.array(z.enum(TOOTH_CONDITIONS)).optional(),
  surfaces: z.array(z.object({
    surface: z.enum(SURFACES),
    condition: z.enum(TOOTH_CONDITIONS),
    severity: z.string().optional(),
    note: z.string().optional(),
  })).optional(),
  mobility: z.number().optional(),
  endodonticStatus: z.string().optional(),
  extractedReason: z.string().optional(),
});

clinicalRouter.put("/patients/:patientId/chart/tooth/:toothNumber", authorize("chart", "update"), validate({ body: toothBody }), asyncHandler(async (req, res) => {
  const chart = await loadOrCreateChart(req.clinicId!, req.params.patientId, req.auth!.userId);
  const num = String(parseInt(req.params.toothNumber, 10));
  const before = chart.teeth.get(num) ?? null;
  const next = { toothNumber: Number(num), ...(before ? before : {}), ...req.body };
  chart.teeth.set(num, next);
  chart.updatedBy = req.auth!.userId as never;
  await chart.save();
  // Every change appends to the immutable chart history (spec 2.4).
  await ChartHistoryModel.create({
    clinicId: req.clinicId, patient: req.params.patientId, toothNumber: Number(num),
    change: { before, after: next }, doctor: req.auth!.userId, createdBy: req.auth!.userId,
  });
  recordAudit(req, { action: "chart.tooth.update", resourceType: "chart", resourceId: String(chart._id), patient: req.params.patientId as never });
  return ok(res, { toothNumber: Number(num), tooth: next });
}));

clinicalRouter.get("/patients/:patientId/chart/history", authorize("chart", "read"), asyncHandler(async (req, res) => {
  const history = await ChartHistoryModel.find({ clinicId: req.clinicId, patient: req.params.patientId })
    .sort({ createdAt: -1 }).limit(100).populate("doctor", "name").lean();
  return ok(res, history);
}));

/* ------------------------------------------------------------- Clinical notes */

const noteBody = z.object({
  appointment: z.string().optional(),
  chiefComplaint: z.string().optional(),
  historyPresentIllness: z.string().optional(),
  examination: z.string().optional(),
  investigations: z.string().optional(),
  diagnosis: z.array(z.object({ text: z.string(), teeth: z.array(z.number()).optional() })).optional(),
  anaesthesia: z.string().optional(),
  complications: z.string().optional(),
  postOpInstructions: z.string().optional(),
  advice: z.string().optional(),
  nextVisitPlan: z.string().optional(),
});

clinicalRouter.get("/patients/:patientId/notes", authorize("clinical_note", "read"), asyncHandler(async (req, res) => {
  const notes = await ClinicalNoteModel.find({ clinicId: req.clinicId, patient: req.params.patientId })
    .sort({ noteDate: -1 }).populate("doctor", "name").lean();
  // Surface the editability state so the UI needn't recompute the window.
  const now = Date.now();
  const withState = notes.map((n) => ({
    ...n,
    editable: !n.signed && !n.lockedAt && (now - new Date(n.noteDate).getTime()) < CLINICAL_NOTE_LOCK_HOURS * 3_600_000,
  }));
  return ok(res, withState);
}));

clinicalRouter.post("/patients/:patientId/notes", authorize("clinical_note", "create"), validate({ body: noteBody }), asyncHandler(async (req, res) => {
  const note = await ClinicalNoteModel.create({
    ...req.body, clinicId: req.clinicId, patient: req.params.patientId, doctor: req.auth!.userId, createdBy: req.auth!.userId,
  });
  recordAudit(req, { action: "note.create", resourceType: "clinical_note", resourceId: String(note._id), patient: req.params.patientId as never });
  return created(res, note.toObject(), "Note recorded");
}));

/** Within the lock window a note is freely editable; after it, it is append-only. */
function isWithinWindow(noteDate: Date): boolean {
  return Date.now() - noteDate.getTime() < CLINICAL_NOTE_LOCK_HOURS * 3_600_000;
}

clinicalRouter.patch("/clinical-notes/:id", authorize("clinical_note", "update"), validate({ body: noteBody }), asyncHandler(async (req, res) => {
  const note = await ClinicalNoteModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!note) throw errors.notFound("Clinical note");
  if (note.signed || note.lockedAt || !isWithinWindow(note.noteDate)) {
    throw errors.conflictState("This note is locked — record an amendment instead.");
  }
  Object.assign(note, req.body);
  note.updatedBy = req.auth!.userId as never;
  await note.save();
  recordAudit(req, { action: "note.update", resourceType: "clinical_note", resourceId: req.params.id });
  return ok(res, note.toObject());
}));

clinicalRouter.post("/clinical-notes/:id/amend", authorize("clinical_note", "update"), validate({ body: z.object({ text: z.string().min(1) }) }), asyncHandler(async (req, res) => {
  const note = await ClinicalNoteModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!note) throw errors.notFound("Clinical note");
  note.amendments.push({ text: req.body.text, author: req.auth!.userId as never, at: new Date() });
  await note.save();
  recordAudit(req, { action: "note.amend", resourceType: "clinical_note", resourceId: req.params.id });
  return ok(res, note.toObject());
}));

clinicalRouter.post("/clinical-notes/:id/sign", authorize("clinical_note", "update"), asyncHandler(async (req, res) => {
  const note = await ClinicalNoteModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!note) throw errors.notFound("Clinical note");
  note.signed = true;
  note.signedAt = new Date();
  note.lockedAt = new Date();
  await note.save();
  recordAudit(req, { action: "note.sign", resourceType: "clinical_note", resourceId: req.params.id });
  return ok(res, note.toObject());
}));

/* ------------------------------------------------------------- Prescriptions */

const rxBody = z.object({
  appointment: z.string().optional(),
  medications: z.array(z.object({
    drug: z.string().min(1), strength: z.string().optional(), form: z.string().optional(),
    dosage: z.string().optional(), frequency: z.string().optional(), durationDays: z.number().optional(),
    route: z.string().optional(), timing: z.string().optional(), quantity: z.number().optional(), instructions: z.string().optional(),
  })).min(1),
  advice: z.string().optional(),
  followUpDate: z.coerce.date().optional(),
});

/** Naive but useful allergy cross-check: flag any prescribed drug whose name
 *  contains a substance the patient is recorded as allergic to. */
async function allergyWarnings(clinicId: string, patientId: string, drugs: string[]): Promise<string[]> {
  const mh = await MedicalHistoryModel.findOne({ clinicId, patient: patientId }).sort({ version: -1 }).lean();
  const allergies = (mh?.allergies ?? []).map((a) => (a.substance ?? "").toLowerCase()).filter(Boolean);
  const warnings: string[] = [];
  for (const drug of drugs) {
    const d = drug.toLowerCase();
    for (const substance of allergies) {
      if (substance && (d.includes(substance) || substance.includes(d))) {
        warnings.push(`Patient is allergic to ${substance} — prescribed ${drug}`);
      }
    }
  }
  return warnings;
}

clinicalRouter.get("/patients/:patientId/prescriptions", authorize("prescription", "read"), asyncHandler(async (req, res) => {
  const rx = await PrescriptionModel.find({ clinicId: req.clinicId, patient: req.params.patientId })
    .sort({ date: -1 }).populate("doctor", "name").lean();
  return ok(res, rx);
}));

clinicalRouter.post("/patients/:patientId/prescriptions", authorize("prescription", "create"), validate({ body: rxBody }), asyncHandler(async (req, res) => {
  const warnings = await allergyWarnings(req.clinicId!, req.params.patientId, req.body.medications.map((m: { drug: string }) => m.drug));
  const rx = await PrescriptionModel.create({
    ...req.body, clinicId: req.clinicId, patient: req.params.patientId, doctor: req.auth!.userId, warnings, createdBy: req.auth!.userId,
  });
  recordAudit(req, { action: "prescription.create", resourceType: "prescription", resourceId: String(rx._id), patient: req.params.patientId as never });
  return created(res, rx.toObject(), warnings.length ? "Prescription saved with allergy warnings" : "Prescription saved");
}));
