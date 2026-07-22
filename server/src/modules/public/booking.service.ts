import { PatientModel } from "../../models/patient.model";
import { UserModel } from "../../models/user.model";
import { LeadModel } from "../../models/growth.model";
import { createAppointment } from "../appointment/appointment.service";
import { createPatient } from "../patient/patient.service";
import { errors } from "../../shared/errors";

/*
 * Public booking (spec 5.3). A confirmed booking becomes a real appointment
 * against the true conflict engine (any-doctor tries each doctor until one is
 * free); an abandoned one — details entered, never confirmed — is captured as a
 * lead so the front desk can follow up.
 */

async function findOrCreatePatient(clinicId: string, name: string, phone: string, email?: string) {
  const existing = await PatientModel.findOne({ clinicId, phone });
  if (existing) return existing;
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return createPatient(clinicId, phone, {
    firstName: firstName || "Guest",
    lastName: rest.join(" ") || undefined,
    phone,
    email,
    referralSource: "online_booking",
    tags: ["online-booking"],
  } as never);
}

export async function createPublicBooking(
  clinicId: string,
  input: { name: string; phone: string; email?: string; doctorId?: string; start: Date; durationMin?: number; treatment?: string; note?: string },
): Promise<{ appointmentId: string; patientId: string; start: Date; end: Date; doctor: string }> {
  const patient = await findOrCreatePatient(clinicId, input.name, input.phone, input.email);

  const durationMin = input.durationMin ?? 30;
  const start = input.start;
  const end = new Date(start.getTime() + durationMin * 60_000);

  const doctorIds = input.doctorId
    ? [input.doctorId]
    : (await UserModel.find({ clinicId, role: "doctor", active: true }).select("_id").lean()).map((d) => String(d._id));
  if (doctorIds.length === 0) throw errors.validation({ doctor: "No doctor is available to book" });

  // Try each candidate doctor; the conflict engine rejects a taken slot.
  for (const doctor of doctorIds) {
    try {
      const appt = await createAppointment(clinicId, String(patient._id), {
        patient: patient._id,
        doctor,
        start,
        end,
        type: "consultation",
        source: "online",
        chiefComplaint: input.treatment,
        notes: input.note,
      });
      return { appointmentId: String(appt._id), patientId: String(patient._id), start, end, doctor: String(appt.doctor) };
    } catch (err) {
      if ((err as { code?: string }).code === "CONFLICT_SLOT") continue;
      throw err;
    }
  }
  throw errors.conflictSlot({ reason: "no_free_doctor", start, end });
}

export async function abandonBooking(
  clinicId: string,
  input: { name: string; phone: string; email?: string; treatment?: string },
): Promise<{ leadId: string }> {
  const lead = await LeadModel.create({
    clinicId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    source: "booking_abandon",
    interest: input.treatment,
  });
  return { leadId: String(lead._id) };
}
