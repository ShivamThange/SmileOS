import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/http";
import { ok, created } from "../../shared/envelope";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import { recordAudit } from "../../services/audit.service";
import { WaitlistModel } from "../../models/appointment.model";
import { errors } from "../../shared/errors";

/*
 * Waitlist (spec 4.5) — patients wanting an earlier slot, ready to fill a freed
 * gap. Reads need appointment:read; adding and slotting-in need
 * appointment:update. Ordered by urgency then how long they have waited.
 */
export const waitlistRouter = Router();
waitlistRouter.use(requireDb, authenticate(), resolveTenant);

const URGENCY_ORDER: Record<string, number> = { high: 0, moderate: 1, routine: 2 };

waitlistRouter.get("/", authorize("appointment", "read"), asyncHandler(async (req, res) => {
  const status = (req.query.status as string) || "waiting";
  const rows = await WaitlistModel.find({ clinicId: req.clinicId, status })
    .populate("patient", "firstName lastName phone")
    .populate("preferredDoctor", "name")
    .lean();
  const mapped = rows
    .map((w) => {
      const patient = w.patient as unknown as { firstName?: string; lastName?: string; phone?: string } | null;
      const doctor = w.preferredDoctor as unknown as { name?: string } | null;
      return {
        id: String(w._id),
        name: w.name || (patient ? [patient.firstName, patient.lastName].filter(Boolean).join(" ") : "—"),
        phone: patient?.phone ?? null,
        desiredTreatment: w.desiredTreatment ?? "",
        preferredDoctor: doctor?.name ?? null,
        timeOfDay: w.timeOfDay,
        urgency: w.urgency,
        contactAttempts: w.contactAttempts ?? 0,
        createdAt: w.createdAt,
      };
    })
    .sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 3) - (URGENCY_ORDER[b.urgency] ?? 3) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return ok(res, mapped);
}));

const createSchema = z.object({
  patient: z.string().optional(),
  lead: z.string().optional(),
  name: z.string().optional(),
  desiredTreatment: z.string().optional(),
  preferredDoctor: z.string().optional(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "any"]).optional(),
  urgency: z.enum(["high", "moderate", "routine"]).optional(),
});

waitlistRouter.post("/", authorize("appointment", "update"), validate({ body: createSchema }), asyncHandler(async (req, res) => {
  const entry = await WaitlistModel.create({ ...req.body, clinicId: req.clinicId, status: "waiting", createdBy: req.auth!.userId });
  recordAudit(req, { action: "waitlist.add", resourceType: "appointment", resourceId: String(entry._id) });
  return created(res, entry.toObject(), "Added to the waitlist");
}));

/** Slotted into a freed gap — the entry is fulfilled. */
waitlistRouter.post("/:id/schedule", authorize("appointment", "update"), asyncHandler(async (req, res) => {
  const entry = await WaitlistModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { $set: { status: "scheduled", updatedBy: req.auth!.userId } },
    { new: true },
  );
  if (!entry) throw errors.notFound("Waitlist entry");
  recordAudit(req, { action: "waitlist.schedule", resourceType: "appointment", resourceId: req.params.id });
  return ok(res, { id: req.params.id, status: "scheduled" }, { message: "Slotted in" });
}));

/** Log an attempt to reach them about an opening. */
waitlistRouter.post("/:id/contact", authorize("appointment", "update"), asyncHandler(async (req, res) => {
  const entry = await WaitlistModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!entry) throw errors.notFound("Waitlist entry");
  entry.contactAttempts = (entry.contactAttempts ?? 0) + 1;
  await entry.save();
  return ok(res, { id: req.params.id, contactAttempts: entry.contactAttempts });
}));

waitlistRouter.delete("/:id", authorize("appointment", "update"), asyncHandler(async (req, res) => {
  const entry = await WaitlistModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { $set: { status: "cancelled", updatedBy: req.auth!.userId } },
    { new: true },
  );
  if (!entry) throw errors.notFound("Waitlist entry");
  recordAudit(req, { action: "waitlist.remove", resourceType: "appointment", resourceId: req.params.id });
  return ok(res, { id: req.params.id, removed: true });
}));
