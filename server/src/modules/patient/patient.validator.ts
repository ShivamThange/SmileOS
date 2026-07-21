import { z } from "zod";
import { GENDERS, PATIENT_STATUS } from "../../shared/enums";

const addressSchema = z.object({
  line1: z.string().optional(), line2: z.string().optional(), locality: z.string().optional(),
  city: z.string().optional(), state: z.string().optional(), pincode: z.string().optional(),
}).partial();

export const createPatientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phone: z.string().min(6),
  altPhone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional(),
  dob: z.coerce.date().optional(),
  ageFallback: z.number().int().positive().optional(),
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.string().optional(),
  address: addressSchema.optional(),
  occupation: z.string().optional(),
  referralSource: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const updatePatientSchema = createPatientSchema.partial().extend({
  status: z.enum(PATIENT_STATUS).optional(),
});

export const checkDuplicateSchema = z.object({
  phone: z.string().min(6),
  name: z.string().optional(),
});
