import { z } from "zod";
import { USER_ROLES, RESOURCES, ACTIONS } from "../../shared/enums";

/*
 * User & team validators (spec 2.1 / 4.13). Staff admin: invite, profile,
 * role, per-user permission overrides, schedule, leave, attendance.
 */

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const permission = z
  .string()
  .refine(
    (p) => {
      const [r, a] = p.split(":");
      return (RESOURCES as readonly string[]).includes(r) && (ACTIONS as readonly string[]).includes(a);
    },
    { message: "Not a valid resource:action permission" },
  );

const doctorProfileSchema = z.object({
  registrationNumber: z.string().optional(),
  qualifications: z.array(z.string()).optional(),
  specialisations: z.array(z.string()).optional(),
  yearsExperience: z.number().int().min(0).optional(),
  bio: z.string().optional(),
  publicProfile: z.boolean().optional(),
  consultationFeePaise: z.number().int().nonnegative().optional(),
  slug: z.string().optional(),
  signatureUrl: z.string().optional(),
});

export const inviteUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(USER_ROLES),
  employment: z.object({ title: z.string().optional(), joinedAt: z.coerce.date().optional(), employeeCode: z.string().optional() }).optional(),
  doctor: doctorProfileSchema.optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(USER_ROLES).optional(),
  avatarUrl: z.string().optional(),
  employment: z.object({ title: z.string().optional(), joinedAt: z.coerce.date().optional(), employeeCode: z.string().optional() }).optional(),
  doctor: doctorProfileSchema.optional(),
});

export const setPermissionsSchema = z.object({
  grants: z.array(permission).default([]),
  denials: z.array(permission).default([]),
});

export const setScheduleSchema = z.object({
  workingSchedule: z.record(z.unknown()),
});

export const addLeaveSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  reason: z.string().optional(),
  approved: z.boolean().default(false),
});

/* ----------------------------------------------------------------- Attendance */

export const recordAttendanceSchema = z.object({
  staff: objectId,
  date: z.coerce.date().optional(),
  action: z.enum(["check-in", "check-out"]).default("check-in"),
  status: z.enum(["in", "out", "absent", "leave"]).optional(),
  notes: z.string().optional(),
});
