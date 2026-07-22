import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/http";
import { ok } from "../../shared/envelope";
import { validate } from "../../middleware/validate";
import { requireDb } from "../../middleware/require-db";
import { rateLimit } from "../../middleware/rate-limit";
import { resolveClinic } from "../../services/clinic-context";
import { ProcedureModel } from "../../models/procedure.model";
import { UserModel } from "../../models/user.model";
import { LeadModel } from "../../models/growth.model";
import * as calc from "./calculator.service";
import { publicAvailability } from "./availability.service";
import { createPublicBooking, abandonBooking } from "./booking.service";

/*
 * Public surface (spec 4.13 / 4.9). Unauthenticated, IP-rate-limited, and never
 * returns data that could enumerate patients. Clinic is resolved by slug header
 * or the configured default. The calculator computes server-side.
 */
export const publicRouter = Router();

const ipLimit = rateLimit({ windowMs: 60_000, max: 60, bucket: "public" });
const writeLimit = rateLimit({ windowMs: 60_000, max: 10, bucket: "public-write" });
publicRouter.use(requireDb, ipLimit);

const clinicSlug = (req: import("express").Request) => req.headers["x-clinic-slug"] as string | undefined;

publicRouter.get("/clinic", asyncHandler(async (req, res) => {
  const c = await resolveClinic(clinicSlug(req));
  return ok(res, {
    name: c.name, slug: c.slug, tagline: c.tagline, description: c.description,
    branding: c.branding, logoUrl: c.logoUrl, address: c.address, geo: c.geo,
    phones: c.phones, email: c.email, social: c.social, workingHours: c.workingHours, holidays: c.holidays,
  });
}));

publicRouter.get("/services", asyncHandler(async (req, res) => {
  const c = await resolveClinic(clinicSlug(req));
  const procs = await ProcedureModel.find({ clinicId: c._id, publicVisible: true }).sort({ displayOrder: 1 }).select("name friendlyName category description defaultPricePaise").lean();
  return ok(res, procs);
}));

publicRouter.get("/doctors", asyncHandler(async (req, res) => {
  const c = await resolveClinic(clinicSlug(req));
  const docs = await UserModel.find({ clinicId: c._id, role: "doctor", "doctor.publicProfile": true, active: true })
    .select("name avatarUrl doctor").lean();
  return ok(res, docs.map((d) => ({ name: d.name, avatarUrl: d.avatarUrl, ...d.doctor })));
}));

/* Online booking — real availability from working hours + capacity (spec 5.3) */
const availabilityQuery = z.object({
  doctor: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  durationMin: z.coerce.number().int().positive().max(480).optional(),
  days: z.coerce.number().int().positive().max(60).optional(),
});
publicRouter.get("/availability", validate({ query: availabilityQuery }), asyncHandler(async (req, res) => {
  const c = await resolveClinic(clinicSlug(req));
  const q = req.query as unknown as z.infer<typeof availabilityQuery>;
  const days = await publicAvailability(String(c._id), { doctorId: q.doctor, durationMin: q.durationMin, days: q.days });
  return ok(res, days);
}));

/* Confirmed booking → appointment; abandoned booking → lead (spec 5.3) */
const bookSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  doctor: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  start: z.coerce.date(),
  durationMin: z.number().int().positive().max(480).optional(),
  treatment: z.string().optional(),
  note: z.string().optional(),
});
publicRouter.post("/book", writeLimit, validate({ body: bookSchema }), asyncHandler(async (req, res) => {
  const c = await resolveClinic(clinicSlug(req));
  const result = await createPublicBooking(String(c._id), {
    name: req.body.name, phone: req.body.phone, email: req.body.email,
    doctorId: req.body.doctor, start: req.body.start, durationMin: req.body.durationMin,
    treatment: req.body.treatment, note: req.body.note,
  });
  return ok(res, result, { message: "Appointment confirmed" });
}));

const abandonSchema = z.object({ name: z.string().min(1), phone: z.string().min(6), email: z.string().email().optional(), treatment: z.string().optional() });
publicRouter.post("/booking/abandon", writeLimit, validate({ body: abandonSchema }), asyncHandler(async (req, res) => {
  const c = await resolveClinic(clinicSlug(req));
  const result = await abandonBooking(String(c._id), req.body);
  return ok(res, result, { message: "We'll follow up on your booking" });
}));

/* Cost calculator */
publicRouter.get("/calculator/config", asyncHandler(async (_req, res) => ok(res, calc.calculatorConfig())));

const estimateSchema = z.object({
  treatment: z.string(), tier: z.string(),
  quantity: z.number().int().positive().optional(),
  severity: z.string().optional(), braceType: z.string().optional(),
  sessionId: z.string().optional(),
});
publicRouter.post("/calculator/estimate", validate({ body: estimateSchema }), asyncHandler(async (req, res) => {
  const c = await resolveClinic(clinicSlug(req));
  const result = calc.computeEstimate(req.body);
  const estimateId = await calc.logEstimate(String(c._id), req.body, result, { referrer: req.headers.referer, device: req.headers["user-agent"], sessionId: req.body.sessionId });
  return ok(res, { ...result, estimateId });
}));

const captureSchema = z.object({
  name: z.string().optional(), phone: z.string().min(6), email: z.string().email().optional(),
  treatment: z.string().optional(), highPaise: z.number().optional(), estimateId: z.string().optional(),
});
publicRouter.post("/calculator/capture", writeLimit, validate({ body: captureSchema }), asyncHandler(async (req, res) => {
  const c = await resolveClinic(clinicSlug(req));
  const leadId = await calc.captureToLead(String(c._id), req.body, req.body.estimateId);
  return ok(res, { leadId }, { message: "We'll be in touch shortly" });
}));

/* Appointment request (a lead, not a confirmed booking) */
const requestSchema = z.object({ name: z.string().min(1), phone: z.string().min(6), about: z.string().optional(), preferredDay: z.string().optional() });
publicRouter.post("/appointment-request", writeLimit, validate({ body: requestSchema }), asyncHandler(async (req, res) => {
  const c = await resolveClinic(clinicSlug(req));
  const lead = await LeadModel.create({ clinicId: c._id, name: req.body.name, phone: req.body.phone, source: "website", interest: req.body.about });
  return ok(res, { leadId: String(lead._id) }, { message: "Thank you — we'll call you to confirm" });
}));
