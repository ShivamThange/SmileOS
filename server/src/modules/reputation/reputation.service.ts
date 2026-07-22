import { CampaignModel, ReviewModel } from "../../models/growth.model";
import { PatientModel } from "../../models/patient.model";
import { errors } from "../../shared/errors";
import { opaqueToken } from "../../utils/ids";
import { enqueue } from "../../jobs/queue";

/*
 * Reviews & campaigns service (spec 5.9 / 5.10). Two ideas carry the value:
 * a campaign never fires blind — its audience is counted from a safe segment
 * before send; and a review request routes a happy rating outward to a public
 * platform while a poor one drops into service recovery.
 */

interface Segment {
  status?: string;
  tags?: string[];
  lastVisitBeforeDays?: number;
  lastVisitAfterDays?: number;
  hasBalance?: boolean;
  channelConsent?: string;
}

/** Translate a validated segment into a patient filter — allow-list only. */
export function segmentToFilter(clinicId: string, segment: Segment = {}): Record<string, unknown> {
  const filter: Record<string, unknown> = { clinicId };
  if (segment.status) filter.status = segment.status;
  if (segment.tags?.length) filter.tags = { $in: segment.tags };
  if (segment.hasBalance) filter.balancePaise = { $gt: 0 };
  if (segment.channelConsent) filter[`marketingConsent.${segment.channelConsent}`] = true;

  const lastVisit: Record<string, Date> = {};
  if (segment.lastVisitBeforeDays) lastVisit.$lt = new Date(Date.now() - segment.lastVisitBeforeDays * 86_400_000);
  if (segment.lastVisitAfterDays) lastVisit.$gt = new Date(Date.now() - segment.lastVisitAfterDays * 86_400_000);
  if (Object.keys(lastVisit).length) filter.lastVisit = lastVisit;

  return filter;
}

export async function previewAudience(
  clinicId: string,
  segment: Segment,
): Promise<{ count: number; sample: unknown[] }> {
  const filter = segmentToFilter(clinicId, segment);
  const [count, sample] = await Promise.all([
    PatientModel.countDocuments(filter),
    PatientModel.find(filter).select("firstName lastName phone lastVisit").limit(5).lean(),
  ]);
  return { count, sample };
}

/**
 * Send a campaign: resolve the audience now, materialise recipient rows, flip
 * to active, and queue the dispatch. Refuses to send an empty audience so a
 * misfired segment fails loudly instead of silently sending to nobody.
 */
export async function sendCampaign(clinicId: string, actorId: string, campaignId: string): Promise<unknown> {
  const campaign = await CampaignModel.findOne({ _id: campaignId, clinicId });
  if (!campaign) throw errors.notFound("Campaign");
  if (campaign.status === "active" || campaign.status === "done") {
    throw errors.conflictState("This campaign has already been sent");
  }

  const filter = segmentToFilter(clinicId, (campaign.segment as Segment) ?? {});
  const patients = await PatientModel.find(filter).select("_id").lean();
  if (patients.length === 0) throw errors.validation({ segment: "The audience is empty — refine the segment" });

  campaign.recipients = patients.map((p) => ({ patient: p._id })) as never;
  campaign.status = "active";
  campaign.stats = { sent: patients.length, delivered: 0, read: 0, replied: 0, booked: 0, revenuePaise: 0 } as never;
  campaign.updatedBy = actorId as never;
  await campaign.save();

  await enqueue("whatsapp", "campaign_dispatch", { campaignId: String(campaign._id), count: patients.length });
  return campaign;
}

/* -------------------------------------------------------------------- Reviews */

export async function requestReview(
  clinicId: string,
  actorId: string,
  input: { patient: string; appointment?: string; channel: string },
): Promise<unknown> {
  const token = opaqueToken();
  const review = await ReviewModel.create({
    clinicId,
    patient: input.patient,
    appointment: input.appointment,
    requestChannel: input.channel,
    requestSentAt: new Date(),
    token,
    responseStatus: "pending",
    createdBy: actorId,
  });
  await enqueue("whatsapp", "review_request", { reviewId: String(review._id), token });
  return review;
}

/**
 * Capture a rating from the tokenised public link. 4–5 stars route to a public
 * platform; 1–3 stars stay internal and open service recovery — the routing
 * that protects the public rating while still catching unhappy patients.
 */
export async function submitReview(
  token: string,
  rating: number,
  feedback: string | undefined,
): Promise<{ routedToPublic: boolean; publicLink?: string }> {
  const review = await ReviewModel.findOne({ token });
  if (!review) throw errors.notFound("Review request");
  if (review.responseStatus !== "pending") throw errors.conflictState("This review has already been submitted");

  review.internalRating = rating;
  review.internalFeedback = feedback;

  const routedToPublic = rating >= 4;
  review.routedToPublic = routedToPublic;
  review.responseStatus = routedToPublic ? "public" : "recovery";
  if (routedToPublic) {
    review.publicPlatform = "google";
    review.publicLink = "https://search.google.com/local/writereview";
  }
  await review.save();

  return { routedToPublic, publicLink: routedToPublic ? review.publicLink ?? undefined : undefined };
}

export async function reviewSummary(clinicId: string): Promise<Record<string, unknown>> {
  const reviews = await ReviewModel.find({ clinicId }).select("internalRating responseStatus routedToPublic").lean();
  const rated = reviews.filter((r) => typeof r.internalRating === "number");
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of rated) {
    distribution[r.internalRating as number] = (distribution[r.internalRating as number] ?? 0) + 1;
    sum += r.internalRating as number;
  }
  return {
    requested: reviews.length,
    responded: rated.length,
    averageRating: rated.length ? Math.round((sum / rated.length) * 10) / 10 : 0,
    distribution,
    routedToPublic: reviews.filter((r) => r.routedToPublic).length,
    inRecovery: reviews.filter((r) => r.responseStatus === "recovery").length,
  };
}
