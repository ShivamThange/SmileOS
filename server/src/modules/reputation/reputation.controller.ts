import type { Request, Response } from "express";
import { ok, created } from "../../shared/envelope";
import { paginate } from "../../shared/list";
import { errors } from "../../shared/errors";
import { recordAudit } from "../../services/audit.service";
import { CampaignModel, ReviewModel } from "../../models/growth.model";
import * as svc from "./reputation.service";

/* Reviews & campaigns controller (spec 5.9 / 5.10). */

/* ------------------------------------------------------------------ Campaigns */

export async function listCampaigns(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  return paginate(req, res, CampaignModel, filter, { defaultSort: "createdAt", populate: ["template"], maxLimit: 100 });
}

export async function createCampaign(req: Request, res: Response): Promise<Response> {
  const campaign = await CampaignModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId });
  recordAudit(req, { action: "campaign.create", resourceType: "campaign", resourceId: String(campaign._id) });
  return created(res, campaign, "Campaign created");
}

export async function getCampaign(req: Request, res: Response): Promise<Response> {
  const campaign = await CampaignModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).populate("template").lean();
  if (!campaign) throw errors.notFound("Campaign");
  return ok(res, campaign);
}

export async function updateCampaign(req: Request, res: Response): Promise<Response> {
  const campaign = await CampaignModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { ...req.body, updatedBy: req.auth!.userId },
    { new: true },
  ).lean();
  if (!campaign) throw errors.notFound("Campaign");
  return ok(res, campaign);
}

export async function previewAudience(req: Request, res: Response): Promise<Response> {
  // Preview against the body segment, or the campaign's stored segment.
  let segment = req.body.segment;
  if (!segment && req.params.id) {
    const campaign = await CampaignModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).select("segment").lean();
    segment = campaign?.segment;
  }
  return ok(res, await svc.previewAudience(req.clinicId!, segment ?? {}));
}

export async function sendCampaign(req: Request, res: Response): Promise<Response> {
  const campaign = await svc.sendCampaign(req.clinicId!, req.auth!.userId, req.params.id);
  recordAudit(req, { action: "campaign.send", resourceType: "campaign", resourceId: req.params.id });
  return ok(res, campaign, { message: "Campaign sending" });
}

export async function scheduleCampaign(req: Request, res: Response): Promise<Response> {
  const campaign = await CampaignModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { schedule: req.body.schedule, status: "scheduled", updatedBy: req.auth!.userId },
    { new: true },
  ).lean();
  if (!campaign) throw errors.notFound("Campaign");
  return ok(res, campaign, { message: "Campaign scheduled" });
}

export async function campaignResults(req: Request, res: Response): Promise<Response> {
  const campaign = await CampaignModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).select("name status stats recipients").lean();
  if (!campaign) throw errors.notFound("Campaign");
  return ok(res, { name: campaign.name, status: campaign.status, stats: campaign.stats, recipientCount: campaign.recipients?.length ?? 0 });
}

export async function deleteCampaign(req: Request, res: Response): Promise<Response> {
  const campaign = await CampaignModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!campaign) throw errors.notFound("Campaign");
  await (campaign as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  return ok(res, { deleted: true });
}

/* -------------------------------------------------------------------- Reviews */

export async function listReviews(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.responseStatus) filter.responseStatus = req.query.responseStatus;
  return paginate(req, res, ReviewModel, filter, { defaultSort: "createdAt", populate: ["patient"], maxLimit: 100 });
}

export async function reviewSummary(req: Request, res: Response): Promise<Response> {
  return ok(res, await svc.reviewSummary(req.clinicId!));
}

export async function requestReview(req: Request, res: Response): Promise<Response> {
  const review = await svc.requestReview(req.clinicId!, req.auth!.userId, {
    patient: req.body.patient,
    appointment: req.body.appointment,
    channel: req.body.channel,
  });
  recordAudit(req, { action: "review.request", resourceType: "campaign", resourceId: String((review as { _id: unknown })._id) });
  return created(res, review, "Review request queued");
}

/* ----------------------------------------------------------- Public capture */

export async function publicGetReview(req: Request, res: Response): Promise<Response> {
  const review = await ReviewModel.findOne({ token: req.params.token }).select("responseStatus requestChannel").lean();
  if (!review) throw errors.notFound("Review request");
  return ok(res, { status: review.responseStatus, alreadySubmitted: review.responseStatus !== "pending" });
}

export async function publicSubmitReview(req: Request, res: Response): Promise<Response> {
  const result = await svc.submitReview(req.params.token, req.body.rating, req.body.feedback);
  return ok(res, result, {
    message: result.routedToPublic ? "Thank you! Please share it publicly." : "Thank you — our team will reach out to make this right.",
  });
}
