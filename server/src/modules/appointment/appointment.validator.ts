import { z } from "zod";
import { APPOINTMENT_TYPES, APPOINTMENT_SOURCES } from "../../shared/enums";

export const createAppointmentSchema = z.object({
  patient: z.string().optional(),
  lead: z.string().optional(),
  doctor: z.string().min(1),
  operatory: z.string().optional(),
  operatoryLabel: z.string().optional(),
  start: z.coerce.date(),
  end: z.coerce.date(),
  type: z.enum(APPOINTMENT_TYPES).default("treatment"),
  procedures: z.array(z.string()).optional(),
  chiefComplaint: z.string().optional(),
  source: z.enum(APPOINTMENT_SOURCES).default("phone"),
  notes: z.string().optional(),
  allowDoctorOverlap: z.boolean().optional(),
});

export const rescheduleSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  operatory: z.string().optional(),
  notify: z.boolean().default(false),
});

export const cancelSchema = z.object({ reason: z.string().min(1, "A reason is required") });
