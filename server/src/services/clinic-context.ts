import { ClinicModel, type ClinicDoc } from "../models/clinic.model";
import { env } from "../config/env";
import { errors } from "../shared/errors";

/*
 * Clinic context resolution for unauthenticated flows (login, public, booking).
 * Single-tenant deployment: the clinic is resolved by an optional X-Clinic-Slug
 * header, else the configured default slug, else the only clinic present. Once
 * multi-tenant, this becomes a host/subdomain lookup — the callers don't change.
 */
export async function resolveClinic(slug?: string): Promise<ClinicDoc> {
  const wanted = slug || env.DEFAULT_CLINIC_SLUG;
  let clinic = await ClinicModel.findOne({ slug: wanted });
  if (!clinic) clinic = await ClinicModel.findOne();
  if (!clinic) throw errors.notFound("Clinic");
  return clinic;
}
