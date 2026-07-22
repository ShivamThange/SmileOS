import { UserModel, type UserDoc } from "../../models/user.model";
import { AttendanceModel } from "../../models/operations.model";
import { InvoiceModel, PaymentModel } from "../../models/billing.model";
import { TreatmentPlanModel } from "../../models/treatment-plan.model";
import { AppointmentModel } from "../../models/appointment.model";
import { effectivePermissions, type Permission } from "../../shared/rbac";
import type { UserRole } from "../../shared/enums";
import { errors } from "../../shared/errors";

/*
 * User & team service (spec 2.1 / 4.13 / 5.13). Invitation creates the staff
 * record an OTP/Google login later resolves (self-registration stays refused).
 * Permission overrides are previewed against the role matrix so an admin sees
 * the effective set. Doctor performance aggregates real production, collection
 * and case-acceptance for a period.
 */

interface InviteInput {
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  employment?: Record<string, unknown>;
  doctor?: Record<string, unknown>;
}

export async function inviteUser(clinicId: string, actorId: string, input: InviteInput): Promise<UserDoc> {
  const email = input.email.toLowerCase();
  const existing = await UserModel.findOne({ clinicId, email });
  if (existing) throw errors.duplicate("A user with that email already exists");

  return UserModel.create({
    clinicId,
    name: input.name,
    email,
    phone: input.phone,
    role: input.role,
    authProviders: ["otp", "google"],
    employment: input.employment,
    doctor: input.role === "doctor" ? input.doctor : undefined,
    active: true,
    createdBy: actorId,
  });
}

/** Serialise a user with the effective permission set expanded from role + overrides. */
export function serialiseWithPermissions(user: UserDoc): Record<string, unknown> {
  const perms = effectivePermissions(
    user.role as UserRole,
    (user.permissionGrants ?? []) as Permission[],
    (user.permissionDenials ?? []) as Permission[],
  );
  const u = user.toObject() as unknown as Record<string, unknown>;
  delete u.passwordHash;
  return { ...u, id: String(user._id), effectivePermissions: [...perms] };
}

export async function setPermissions(
  clinicId: string,
  actorId: string,
  userId: string,
  grants: string[],
  denials: string[],
): Promise<UserDoc> {
  const user = await UserModel.findOne({ _id: userId, clinicId });
  if (!user) throw errors.notFound("User");
  user.permissionGrants = grants;
  user.permissionDenials = denials;
  user.updatedBy = actorId as never;
  await user.save();
  return user;
}

/**
 * Doctor performance for a period: production (invoiced), collection (paid
 * against those invoices), completed appointments, and case-acceptance
 * (accepted plans over presented plans). Money in paise.
 */
export async function doctorPerformance(
  clinicId: string,
  doctorId: string,
  from: Date,
  to: Date,
): Promise<Record<string, unknown>> {
  const invoices = await InvoiceModel.find({
    clinicId,
    performingDoctor: doctorId,
    createdAt: { $gte: from, $lte: to },
  })
    .select("_id totalPaise")
    .lean();

  const productionPaise = invoices.reduce((s, i) => s + (i.totalPaise ?? 0), 0);
  const invoiceIds = invoices.map((i) => i._id);

  const payments = invoiceIds.length
    ? await PaymentModel.find({ clinicId, invoice: { $in: invoiceIds }, status: "success" }).select("amountPaise").lean()
    : [];
  const collectionPaise = payments.reduce((s, p) => s + (p.amountPaise ?? 0), 0);

  const completedAppointments = await AppointmentModel.countDocuments({
    clinicId,
    doctor: doctorId,
    status: "completed",
    start: { $gte: from, $lte: to },
  });

  const presentedPlans = await TreatmentPlanModel.countDocuments({
    clinicId,
    doctor: doctorId,
    presentedAt: { $gte: from, $lte: to },
  });
  const acceptedPlans = await TreatmentPlanModel.countDocuments({
    clinicId,
    doctor: doctorId,
    presentedAt: { $gte: from, $lte: to },
    status: { $in: ["accepted", "partially_accepted", "completed"] },
  });

  return {
    doctorId,
    period: { from, to },
    productionPaise,
    collectionPaise,
    collectionRate: productionPaise > 0 ? Math.round((collectionPaise / productionPaise) * 100) : 0,
    completedAppointments,
    presentedPlans,
    acceptedPlans,
    caseAcceptanceRate: presentedPlans > 0 ? Math.round((acceptedPlans / presentedPlans) * 100) : 0,
  };
}

/* ----------------------------------------------------------------- Attendance */

export async function recordAttendance(
  clinicId: string,
  actorId: string,
  input: { staff: string; date?: Date; action: "check-in" | "check-out"; status?: string; notes?: string },
): Promise<unknown> {
  const day = input.date ?? new Date();
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  let record = await AttendanceModel.findOne({ clinicId, staff: input.staff, date: { $gte: dayStart, $lte: dayEnd } });
  if (!record) {
    record = await AttendanceModel.create({ clinicId, staff: input.staff, date: dayStart, status: "in", createdBy: actorId });
  }

  if (input.action === "check-in") {
    record.checkIn = new Date();
    record.status = "in";
  } else {
    record.checkOut = new Date();
    record.status = "out";
    if (record.checkIn) record.hours = Math.round(((record.checkOut.getTime() - record.checkIn.getTime()) / 3_600_000) * 100) / 100;
  }
  if (input.status) record.status = input.status as never;
  if (input.notes) record.notes = input.notes;
  record.updatedBy = actorId as never;
  await record.save();
  return record;
}
