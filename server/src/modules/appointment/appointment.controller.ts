import type { Request, Response } from "express";
import { ok, created } from "../../shared/envelope";
import { paginate } from "../../shared/list";
import { AppointmentModel } from "../../models/appointment.model";
import { recordAudit } from "../../services/audit.service";
import { errors } from "../../shared/errors";
import { enqueue } from "../../jobs/queue";
import { onAppointmentCompleted } from "../../jobs/events";
import * as svc from "./appointment.service";
import type { AppointmentStatus } from "../../shared/enums";

/* Appointment controller (spec 4.5). */

function startOfDay(d = new Date()): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d = new Date()): Date { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

export async function list(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.doctor) filter.doctor = req.query.doctor;
  if (req.query.operatory) filter.operatory = req.query.operatory;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.patient) filter.patient = req.query.patient;
  if (req.query.from || req.query.to) filter.start = { ...(req.query.from ? { $gte: new Date(String(req.query.from)) } : {}), ...(req.query.to ? { $lte: new Date(String(req.query.to)) } : {}) };
  return paginate(req, res, AppointmentModel, filter, { defaultSort: "start", populate: ["patient"], maxLimit: 200 });
}

export async function calendar(req: Request, res: Response): Promise<Response> {
  const from = req.query.from ? new Date(String(req.query.from)) : startOfDay();
  const to = req.query.to ? new Date(String(req.query.to)) : endOfDay();
  return ok(res, await svc.calendarPayload(req.clinicId!, from, to));
}

export async function create(req: Request, res: Response): Promise<Response> {
  const appt = await svc.createAppointment(req.clinicId!, req.auth!.userId, { ...req.body, bookedBy: req.auth!.userId });
  recordAudit(req, { action: "appointment.create", resourceType: "appointment", resourceId: String(appt._id), patient: appt.patient });
  return created(res, appt, "Appointment booked");
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const appt = await AppointmentModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).populate("patient doctor").lean();
  if (!appt) throw errors.notFound("Appointment");
  return ok(res, appt);
}

export async function reschedule(req: Request, res: Response): Promise<Response> {
  const appt = await AppointmentModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!appt) throw errors.notFound("Appointment");
  const start = req.body.start as Date, end = req.body.end as Date;
  await svc.assertNoConflict({ clinicId: req.clinicId!, operatory: (req.body.operatory ?? appt.operatory) as string, doctor: String(appt.doctor), start, end, excludeId: req.params.id });
  appt.start = start; appt.end = end;
  if (req.body.operatory) appt.operatory = req.body.operatory;
  appt.durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  await appt.save();
  if (req.body.notify) await enqueue("whatsapp", "reschedule_notice", { appointmentId: req.params.id });
  recordAudit(req, { action: "appointment.reschedule", resourceType: "appointment", resourceId: req.params.id });
  return ok(res, appt);
}

function transitionHandler(
  to: AppointmentStatus,
  audit: string,
  after?: (clinicId: string, actorId: string, appointmentId: string) => Promise<void>,
) {
  return async (req: Request, res: Response): Promise<Response> => {
    const appt = await svc.transition(req.clinicId!, req.params.id, to, req.auth!.userId, req.body ?? {});
    recordAudit(req, { action: audit, resourceType: "appointment", resourceId: req.params.id, patient: appt.patient });
    if (after) await after(req.clinicId!, req.auth!.userId, req.params.id);
    return ok(res, appt);
  };
}

export const confirm = transitionHandler("confirmed", "appointment.confirm");
export const checkIn = transitionHandler("checked_in", "appointment.check_in");
export const start = transitionHandler("in_progress", "appointment.start");
// Completion fans out its follow-on effects (consumable deduction, review request).
export const complete = transitionHandler("completed", "appointment.complete", onAppointmentCompleted);
export const cancel = transitionHandler("cancelled", "appointment.cancel");
export const noShow = transitionHandler("no_show", "appointment.no_show");

export async function today(req: Request, res: Response): Promise<Response> {
  const rows = await AppointmentModel.find({ clinicId: req.clinicId, start: { $gte: startOfDay(), $lte: endOfDay() } })
    .sort({ start: 1 }).populate("patient", "firstName lastName phone").lean();
  return ok(res, rows);
}

export async function queue(req: Request, res: Response): Promise<Response> {
  const rows = await AppointmentModel.find({ clinicId: req.clinicId, status: { $in: ["checked_in", "in_progress"] } })
    .sort({ checkedInAt: 1 }).populate("patient", "firstName lastName").lean();
  const now = Date.now();
  return ok(res, rows.map((a) => ({ ...a, waitMinutes: a.checkedInAt ? Math.round((now - new Date(a.checkedInAt).getTime()) / 60000) : 0 })));
}
