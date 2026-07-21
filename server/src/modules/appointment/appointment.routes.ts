import { Router } from "express";
import * as ctrl from "./appointment.controller";
import { asyncHandler } from "../../shared/http";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import { createAppointmentSchema, rescheduleSchema, cancelSchema } from "./appointment.validator";

/* Appointment routes (spec 4.5). */
export const appointmentRouter = Router();

appointmentRouter.use(requireDb, authenticate(), resolveTenant);

appointmentRouter.get("/", authorize("appointment", "read"), asyncHandler(ctrl.list));
appointmentRouter.get("/calendar", authorize("appointment", "read"), asyncHandler(ctrl.calendar));
appointmentRouter.get("/today", authorize("appointment", "read"), asyncHandler(ctrl.today));
appointmentRouter.get("/queue", authorize("appointment", "read"), asyncHandler(ctrl.queue));
appointmentRouter.post("/", authorize("appointment", "create"), validate({ body: createAppointmentSchema }), asyncHandler(ctrl.create));
appointmentRouter.get("/:id", authorize("appointment", "read"), asyncHandler(ctrl.getOne));
appointmentRouter.post("/:id/reschedule", authorize("appointment", "update"), validate({ body: rescheduleSchema }), asyncHandler(ctrl.reschedule));
appointmentRouter.post("/:id/confirm", authorize("appointment", "update"), asyncHandler(ctrl.confirm));
appointmentRouter.post("/:id/check-in", authorize("appointment", "update"), asyncHandler(ctrl.checkIn));
appointmentRouter.post("/:id/start", authorize("appointment", "update"), asyncHandler(ctrl.start));
appointmentRouter.post("/:id/complete", authorize("appointment", "update"), asyncHandler(ctrl.complete));
appointmentRouter.post("/:id/cancel", authorize("appointment", "update"), validate({ body: cancelSchema }), asyncHandler(ctrl.cancel));
appointmentRouter.post("/:id/no-show", authorize("appointment", "update"), asyncHandler(ctrl.noShow));
