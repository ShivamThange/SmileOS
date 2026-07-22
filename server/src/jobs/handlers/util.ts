import { ClinicModel } from "../../models/clinic.model";
import { UserModel } from "../../models/user.model";

/*
 * Handler helpers. Scheduled jobs run cluster-wide, so every handler iterates
 * the active clinics itself; these keep that boilerplate in one place.
 */

/** All non-deleted clinics (soft-delete scope is applied by the base plugin). */
export async function activeClinics(): Promise<{ _id: unknown; name: string }[]> {
  return ClinicModel.find().select("_id name").lean() as unknown as Promise<{ _id: unknown; name: string }[]>;
}

/** Active owner/admin users of a clinic — the recipients for operational alerts. */
export async function clinicAdmins(clinicId: unknown): Promise<{ _id: unknown }[]> {
  return UserModel.find({ clinicId, role: { $in: ["owner", "admin"] }, active: true }).select("_id").lean() as unknown as Promise<{ _id: unknown }[]>;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
