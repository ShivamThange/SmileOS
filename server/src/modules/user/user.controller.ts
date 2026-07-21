import type { Request, Response } from "express";
import { ok, created } from "../../shared/envelope";
import { paginate } from "../../shared/list";
import { errors } from "../../shared/errors";
import { recordAudit } from "../../services/audit.service";
import { UserModel } from "../../models/user.model";
import { AttendanceModel } from "../../models/operations.model";
import * as svc from "./user.service";

/* User & team controller (spec 4.13). */

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

/* ----------------------------------------------------------------------- Users */

export async function list(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.active !== undefined) filter.active = req.query.active === "true";
  if (req.query.q) filter.name = { $regex: String(req.query.q), $options: "i" };
  return paginate(req, res, UserModel, filter, { defaultSort: "name", select: "-passwordHash", maxLimit: 200 });
}

export async function invite(req: Request, res: Response): Promise<Response> {
  const user = await svc.inviteUser(req.clinicId!, req.auth!.userId, req.body);
  recordAudit(req, { action: "user.invite", resourceType: "staff", resourceId: String(user._id) });
  return created(res, svc.serialiseWithPermissions(user), "User invited — they can now sign in with email OTP");
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const user = await UserModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!user) throw errors.notFound("User");
  return ok(res, svc.serialiseWithPermissions(user));
}

export async function update(req: Request, res: Response): Promise<Response> {
  const user = await UserModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { ...req.body, updatedBy: req.auth!.userId },
    { new: true },
  );
  if (!user) throw errors.notFound("User");
  recordAudit(req, { action: "user.update", resourceType: "staff", resourceId: req.params.id });
  return ok(res, svc.serialiseWithPermissions(user));
}

async function setActive(req: Request, res: Response, active: boolean): Promise<Response> {
  const user = await UserModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { active, updatedBy: req.auth!.userId },
    { new: true },
  );
  if (!user) throw errors.notFound("User");
  recordAudit(req, { action: active ? "user.activate" : "user.deactivate", resourceType: "staff", resourceId: req.params.id });
  return ok(res, svc.serialiseWithPermissions(user), { message: active ? "User activated" : "User deactivated" });
}

export const activate = (req: Request, res: Response): Promise<Response> => setActive(req, res, true);
export const deactivate = (req: Request, res: Response): Promise<Response> => setActive(req, res, false);

export async function setPermissions(req: Request, res: Response): Promise<Response> {
  const user = await svc.setPermissions(req.clinicId!, req.auth!.userId, req.params.id, req.body.grants, req.body.denials);
  recordAudit(req, { action: "user.permissions", resourceType: "staff", resourceId: req.params.id });
  return ok(res, svc.serialiseWithPermissions(user), { message: "Permissions updated" });
}

export async function setSchedule(req: Request, res: Response): Promise<Response> {
  const user = await UserModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { workingSchedule: req.body.workingSchedule, updatedBy: req.auth!.userId },
    { new: true },
  );
  if (!user) throw errors.notFound("User");
  return ok(res, svc.serialiseWithPermissions(user));
}

export async function addLeave(req: Request, res: Response): Promise<Response> {
  const user = await UserModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { $push: { leave: req.body }, updatedBy: req.auth!.userId },
    { new: true },
  );
  if (!user) throw errors.notFound("User");
  recordAudit(req, { action: "user.leave", resourceType: "staff", resourceId: req.params.id });
  return ok(res, svc.serialiseWithPermissions(user), { message: "Leave recorded" });
}

export async function performance(req: Request, res: Response): Promise<Response> {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  return ok(res, await svc.doctorPerformance(req.clinicId!, req.params.id, from, to));
}

/* ----------------------------------------------------------------- Attendance */

export async function listAttendance(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.staff) filter.staff = req.query.staff;
  if (req.query.from || req.query.to) {
    filter.date = {
      ...(req.query.from ? { $gte: startOfDay(new Date(String(req.query.from))) } : {}),
      ...(req.query.to ? { $lte: endOfDay(new Date(String(req.query.to))) } : {}),
    };
  }
  return paginate(req, res, AttendanceModel, filter, { defaultSort: "date", populate: ["staff"], maxLimit: 200 });
}

export async function recordAttendance(req: Request, res: Response): Promise<Response> {
  const record = await svc.recordAttendance(req.clinicId!, req.auth!.userId, req.body);
  return created(res, record, "Attendance recorded");
}
