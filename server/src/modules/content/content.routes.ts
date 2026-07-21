import { Router } from "express";
import * as ctrl from "./content.controller";
import { asyncHandler } from "../../shared/http";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import { rateLimit } from "../../middleware/rate-limit";
import {
  upsertPageSchema,
  seoSchemaBody,
  createBlogSchema,
  updateBlogSchema,
  createFaqSchema,
  updateFaqSchema,
  createTestimonialSchema,
  updateTestimonialSchema,
  createGallerySchema,
  updateGallerySchema,
  createBannerSchema,
  updateBannerSchema,
  mediaUploadSchema,
} from "./content.validator";

/*
 * Content routes (spec 4.15). Admin editing is gated on the `settings`
 * resource; the public read surface is unauthenticated and IP-rate-limited,
 * mounted separately at /public/content so the Site can render without a
 * session.
 */
const guard = [requireDb, authenticate(), resolveTenant] as const;
const read = authorize("settings", "read");
const write = authorize("settings", "update");

export const contentRouter = Router();
contentRouter.use(...guard);

// Pages + SEO
contentRouter.get("/pages", read, asyncHandler(ctrl.listPages));
contentRouter.get("/pages/:pageKey", read, asyncHandler(ctrl.getPage));
contentRouter.put("/pages/:pageKey", write, validate({ body: upsertPageSchema }), asyncHandler(ctrl.upsertPage));
contentRouter.patch("/seo/:pageKey", write, validate({ body: seoSchemaBody }), asyncHandler(ctrl.updateSeo));

// Blog
contentRouter.get("/blog", read, asyncHandler(ctrl.listBlog));
contentRouter.post("/blog", write, validate({ body: createBlogSchema }), asyncHandler(ctrl.createBlog));
contentRouter.patch("/blog/:id", write, validate({ body: updateBlogSchema }), asyncHandler(ctrl.updateBlog));
contentRouter.delete("/blog/:id", write, asyncHandler(ctrl.deleteBlog));

// FAQs
contentRouter.get("/faqs", read, asyncHandler(ctrl.listFaqs));
contentRouter.post("/faqs", write, validate({ body: createFaqSchema }), asyncHandler(ctrl.createFaq));
contentRouter.patch("/faqs/:id", write, validate({ body: updateFaqSchema }), asyncHandler(ctrl.updateFaq));
contentRouter.delete("/faqs/:id", write, asyncHandler(ctrl.deleteFaq));

// Testimonials
contentRouter.get("/testimonials", read, asyncHandler(ctrl.listTestimonials));
contentRouter.post("/testimonials", write, validate({ body: createTestimonialSchema }), asyncHandler(ctrl.createTestimonial));
contentRouter.patch("/testimonials/:id", write, validate({ body: updateTestimonialSchema }), asyncHandler(ctrl.updateTestimonial));
contentRouter.delete("/testimonials/:id", write, asyncHandler(ctrl.deleteTestimonial));

// Gallery (consent-gated publish)
contentRouter.get("/gallery", read, asyncHandler(ctrl.listGallery));
contentRouter.post("/gallery", write, validate({ body: createGallerySchema }), asyncHandler(ctrl.createGallery));
contentRouter.patch("/gallery/:id", write, validate({ body: updateGallerySchema }), asyncHandler(ctrl.updateGallery));
contentRouter.delete("/gallery/:id", write, asyncHandler(ctrl.deleteGallery));

// Banners
contentRouter.get("/banners", read, asyncHandler(ctrl.listBanners));
contentRouter.post("/banners", write, validate({ body: createBannerSchema }), asyncHandler(ctrl.createBanner));
contentRouter.patch("/banners/:id", write, validate({ body: updateBannerSchema }), asyncHandler(ctrl.updateBanner));
contentRouter.delete("/banners/:id", write, asyncHandler(ctrl.deleteBanner));

// Media (presigned upload)
contentRouter.post("/media", write, validate({ body: mediaUploadSchema }), asyncHandler(ctrl.mediaUpload));

/* ----------------------------------------------------------- Public read surface */

export const publicContentRouter = Router();
publicContentRouter.use(requireDb, rateLimit({ windowMs: 60_000, max: 60, bucket: "public-content" }));
publicContentRouter.get("/pages/:pageKey", asyncHandler(ctrl.publicPage));
publicContentRouter.get("/blog", asyncHandler(ctrl.publicBlogList));
publicContentRouter.get("/blog/:slug", asyncHandler(ctrl.publicBlogPost));
publicContentRouter.get("/faqs", asyncHandler(ctrl.publicFaqs));
publicContentRouter.get("/testimonials", asyncHandler(ctrl.publicTestimonials));
publicContentRouter.get("/gallery", asyncHandler(ctrl.publicGallery));
publicContentRouter.get("/banners", asyncHandler(ctrl.publicBanners));
