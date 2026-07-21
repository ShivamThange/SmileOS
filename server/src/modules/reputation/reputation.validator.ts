import { z } from "zod";
import { CHANNELS, CAMPAIGN_TYPES, PATIENT_STATUS } from "../../shared/enums";

/*
 * Reviews & campaigns validators (spec 5.9 / 5.10). The segment schema is a
 * closed allow-list of filterable fields — arbitrary Mongo operators never
 * reach the query, so a stored segment can't become an injection vector.
 */

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const segmentSchema = z
  .object({
    status: z.enum(PATIENT_STATUS).optional(),
    tags: z.array(z.string()).optional(),
    lastVisitBeforeDays: z.number().int().positive().optional(),
    lastVisitAfterDays: z.number().int().positive().optional(),
    hasBalance: z.boolean().optional(),
    channelConsent: z.enum(CHANNELS).optional(),
  })
  .strict();

/* ------------------------------------------------------------------ Campaigns */

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  type: z.enum(CAMPAIGN_TYPES).default("recall"),
  channel: z.enum(CHANNELS).default("whatsapp"),
  segment: segmentSchema.optional(),
  template: objectId.optional(),
  schedule: z
    .object({
      mode: z.enum(["immediate", "scheduled", "recurring"]).default("immediate"),
      runAt: z.coerce.date().optional(),
      rule: z.string().optional(),
    })
    .optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const previewAudienceSchema = z.object({ segment: segmentSchema.optional() });

/* -------------------------------------------------------------------- Reviews */

export const requestReviewSchema = z.object({
  patient: objectId,
  appointment: objectId.optional(),
  channel: z.enum(CHANNELS).default("whatsapp"),
});

// Public capture (no auth) — the patient rates via a tokenised link.
export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().optional(),
});
