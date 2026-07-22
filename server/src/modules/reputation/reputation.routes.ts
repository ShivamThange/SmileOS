import { Router } from "express";
import * as ctrl from "./reputation.controller";
import { asyncHandler } from "../../shared/http";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import { rateLimit } from "../../middleware/rate-limit";
import {
  createCampaignSchema,
  updateCampaignSchema,
  previewAudienceSchema,
  requestReviewSchema,
  submitReviewSchema,
} from "./reputation.validator";

/*
 * Reviews & campaigns routes (spec 5.9 / 5.10). Staff surfaces gated on the
 * `campaign` resource; the tokenised review capture is public and rate-limited.
 */
const guard = [requireDb, authenticate(), resolveTenant] as const;

/* Campaigns */
export const campaignRouter = Router();
campaignRouter.use(...guard);
campaignRouter.get("/", authorize("campaign", "read"), asyncHandler(ctrl.listCampaigns));
campaignRouter.post("/", authorize("campaign", "create"), validate({ body: createCampaignSchema }), asyncHandler(ctrl.createCampaign));
campaignRouter.post("/preview-audience", authorize("campaign", "read"), validate({ body: previewAudienceSchema }), asyncHandler(ctrl.previewAudience));
campaignRouter.get("/:id", authorize("campaign", "read"), asyncHandler(ctrl.getCampaign));
campaignRouter.patch("/:id", authorize("campaign", "update"), validate({ body: updateCampaignSchema }), asyncHandler(ctrl.updateCampaign));
campaignRouter.post("/:id/preview-audience", authorize("campaign", "read"), asyncHandler(ctrl.previewAudience));
campaignRouter.post("/:id/send", authorize("campaign", "update"), asyncHandler(ctrl.sendCampaign));
campaignRouter.post("/:id/schedule", authorize("campaign", "update"), asyncHandler(ctrl.scheduleCampaign));
campaignRouter.get("/:id/results", authorize("campaign", "read"), asyncHandler(ctrl.campaignResults));
campaignRouter.delete("/:id", authorize("campaign", "update"), asyncHandler(ctrl.deleteCampaign));

/* Reviews */
export const reviewRouter = Router();
reviewRouter.use(...guard);
reviewRouter.get("/", authorize("campaign", "read"), asyncHandler(ctrl.listReviews));
reviewRouter.get("/summary", authorize("campaign", "read"), asyncHandler(ctrl.reviewSummary));
reviewRouter.post("/request", authorize("campaign", "update"), validate({ body: requestReviewSchema }), asyncHandler(ctrl.requestReview));

/* Public tokenised review capture */
export const publicReviewRouter = Router();
publicReviewRouter.use(requireDb, rateLimit({ windowMs: 60_000, max: 20, bucket: "public-review" }));
publicReviewRouter.get("/:token", asyncHandler(ctrl.publicGetReview));
publicReviewRouter.post("/:token", validate({ body: submitReviewSchema }), asyncHandler(ctrl.publicSubmitReview));
