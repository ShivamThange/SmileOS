import type { Request, Response } from "express";
import { ok, created } from "../../shared/envelope";
import { paginate } from "../../shared/list";
import { errors } from "../../shared/errors";
import { recordAudit } from "../../services/audit.service";
import { presignUpload } from "../../services/storage.service";
import { resolveClinic } from "../../services/clinic-context";
import {
  ContentPageModel,
  BlogPostModel,
  FaqModel,
  TestimonialModel,
  GalleryItemModel,
  BannerModel,
} from "../../models/content.model";
import * as svc from "./content.service";

/* Content controller (spec 4.15). Admin CRUD + public read surface. */

/* --------------------------------------------------------------------- Pages */

export async function listPages(req: Request, res: Response): Promise<Response> {
  return paginate(req, res, ContentPageModel, {}, { defaultSort: "pageKey", maxLimit: 100 });
}

export async function getPage(req: Request, res: Response): Promise<Response> {
  const page = await ContentPageModel.findOne({ clinicId: req.clinicId, pageKey: req.params.pageKey }).lean();
  if (!page) throw errors.notFound("Page");
  return ok(res, page);
}

export async function upsertPage(req: Request, res: Response): Promise<Response> {
  const page = await svc.upsertPage(req.clinicId!, req.auth!.userId, req.params.pageKey, req.body);
  recordAudit(req, { action: "content.page.save", resourceType: "settings", resourceId: req.params.pageKey });
  return ok(res, page, { message: "Page saved" });
}

export async function updateSeo(req: Request, res: Response): Promise<Response> {
  const page = await svc.updateSeo(req.clinicId!, req.auth!.userId, req.params.pageKey, req.body);
  recordAudit(req, { action: "content.seo.save", resourceType: "settings", resourceId: req.params.pageKey });
  return ok(res, page, { message: "SEO updated" });
}

/* ---------------------------------------------------------------------- Blog */

export async function listBlog(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  return paginate(req, res, BlogPostModel, filter, { defaultSort: "createdAt", maxLimit: 100 });
}

export async function createBlog(req: Request, res: Response): Promise<Response> {
  const post = await svc.saveBlog(req.clinicId!, req.auth!.userId, null, req.body);
  recordAudit(req, { action: "content.blog.create", resourceType: "settings" });
  return created(res, post, "Blog post created");
}

export async function updateBlog(req: Request, res: Response): Promise<Response> {
  const post = await svc.saveBlog(req.clinicId!, req.auth!.userId, req.params.id, req.body);
  recordAudit(req, { action: "content.blog.update", resourceType: "settings", resourceId: req.params.id });
  return ok(res, post);
}

export async function deleteBlog(req: Request, res: Response): Promise<Response> {
  const post = await BlogPostModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!post) throw errors.notFound("Blog post");
  await (post as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  return ok(res, { deleted: true });
}

/* ----------------------------------------------------------------------- FAQs */

export async function listFaqs(req: Request, res: Response): Promise<Response> {
  return paginate(req, res, FaqModel, {}, { defaultSort: "displayOrder", maxLimit: 200 });
}
export async function createFaq(req: Request, res: Response): Promise<Response> {
  const faq = await FaqModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId });
  return created(res, faq, "FAQ created");
}
export async function updateFaq(req: Request, res: Response): Promise<Response> {
  const faq = await FaqModel.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, { ...req.body, updatedBy: req.auth!.userId }, { new: true }).lean();
  if (!faq) throw errors.notFound("FAQ");
  return ok(res, faq);
}
export async function deleteFaq(req: Request, res: Response): Promise<Response> {
  const faq = await FaqModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!faq) throw errors.notFound("FAQ");
  await (faq as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  return ok(res, { deleted: true });
}

/* --------------------------------------------------------------- Testimonials */

export async function listTestimonials(req: Request, res: Response): Promise<Response> {
  return paginate(req, res, TestimonialModel, {}, { defaultSort: "displayOrder", maxLimit: 200 });
}
export async function createTestimonial(req: Request, res: Response): Promise<Response> {
  const t = await TestimonialModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId });
  return created(res, t, "Testimonial created");
}
export async function updateTestimonial(req: Request, res: Response): Promise<Response> {
  const t = await TestimonialModel.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, { ...req.body, updatedBy: req.auth!.userId }, { new: true }).lean();
  if (!t) throw errors.notFound("Testimonial");
  return ok(res, t);
}
export async function deleteTestimonial(req: Request, res: Response): Promise<Response> {
  const t = await TestimonialModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!t) throw errors.notFound("Testimonial");
  await (t as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  return ok(res, { deleted: true });
}

/* -------------------------------------------------------------------- Gallery */

export async function listGallery(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.category) filter.category = req.query.category;
  return paginate(req, res, GalleryItemModel, filter, { defaultSort: "displayOrder", maxLimit: 200 });
}
export async function createGallery(req: Request, res: Response): Promise<Response> {
  const g = await svc.saveGallery(req.clinicId!, req.auth!.userId, null, req.body);
  recordAudit(req, { action: "content.gallery.create", resourceType: "settings" });
  return created(res, g, "Gallery item created");
}
export async function updateGallery(req: Request, res: Response): Promise<Response> {
  const g = await svc.saveGallery(req.clinicId!, req.auth!.userId, req.params.id, req.body);
  recordAudit(req, { action: "content.gallery.update", resourceType: "settings", resourceId: req.params.id });
  return ok(res, g);
}
export async function deleteGallery(req: Request, res: Response): Promise<Response> {
  const g = await GalleryItemModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!g) throw errors.notFound("Gallery item");
  await (g as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  return ok(res, { deleted: true });
}

/* --------------------------------------------------------------------- Banners */

export async function listBanners(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.placement) filter.placement = req.query.placement;
  return paginate(req, res, BannerModel, filter, { defaultSort: "displayOrder", maxLimit: 100 });
}
export async function createBanner(req: Request, res: Response): Promise<Response> {
  const b = await BannerModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId });
  return created(res, b, "Banner created");
}
export async function updateBanner(req: Request, res: Response): Promise<Response> {
  const b = await BannerModel.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, { ...req.body, updatedBy: req.auth!.userId }, { new: true }).lean();
  if (!b) throw errors.notFound("Banner");
  return ok(res, b);
}
export async function deleteBanner(req: Request, res: Response): Promise<Response> {
  const b = await BannerModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!b) throw errors.notFound("Banner");
  await (b as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  return ok(res, { deleted: true });
}

/* ----------------------------------------------------------------------- Media */

export async function mediaUpload(req: Request, res: Response): Promise<Response> {
  const folder = (req.body.folder as string) ?? "content";
  const key = `${req.clinicId}/${folder}/${Date.now()}-${req.body.filename}`;
  const presigned = presignUpload(key);
  return ok(res, presigned, { message: "Upload to the presigned URL, then save the returned key" });
}

/* ----------------------------------------------------------- Public read surface */
// Only published rows; addressed by clinic slug like the rest of /public.

const clinicSlug = (req: Request) => req.headers["x-clinic-slug"] as string | undefined;

export async function publicPage(req: Request, res: Response): Promise<Response> {
  const c = await resolveClinic(clinicSlug(req));
  const page = await ContentPageModel.findOne({ clinicId: c._id, pageKey: req.params.pageKey, published: true }).lean();
  if (!page) throw errors.notFound("Page");
  return ok(res, page);
}

export async function publicBlogList(req: Request, res: Response): Promise<Response> {
  const c = await resolveClinic(clinicSlug(req));
  const posts = await BlogPostModel.find({ clinicId: c._id, status: "published" })
    .sort({ publishedAt: -1 })
    .select("slug title excerpt coverImageKey author category tags publishedAt")
    .limit(50)
    .lean();
  return ok(res, posts);
}

export async function publicBlogPost(req: Request, res: Response): Promise<Response> {
  const c = await resolveClinic(clinicSlug(req));
  const post = await BlogPostModel.findOne({ clinicId: c._id, slug: req.params.slug, status: "published" }).lean();
  if (!post) throw errors.notFound("Blog post");
  return ok(res, post);
}

export async function publicFaqs(req: Request, res: Response): Promise<Response> {
  const c = await resolveClinic(clinicSlug(req));
  const faqs = await FaqModel.find({ clinicId: c._id, published: true }).sort({ displayOrder: 1 }).lean();
  return ok(res, faqs);
}

export async function publicTestimonials(req: Request, res: Response): Promise<Response> {
  const c = await resolveClinic(clinicSlug(req));
  const items = await TestimonialModel.find({ clinicId: c._id, published: true }).sort({ displayOrder: 1 }).lean();
  return ok(res, items);
}

export async function publicGallery(req: Request, res: Response): Promise<Response> {
  const c = await resolveClinic(clinicSlug(req));
  const items = await GalleryItemModel.find({ clinicId: c._id, published: true }).sort({ displayOrder: 1 }).lean();
  return ok(res, items);
}

export async function publicBanners(req: Request, res: Response): Promise<Response> {
  const c = await resolveClinic(clinicSlug(req));
  const now = new Date();
  const items = await BannerModel.find({
    clinicId: c._id,
    active: true,
    ...(req.query.placement ? { placement: req.query.placement } : {}),
    $and: [
      { $or: [{ startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
    ],
  })
    .sort({ displayOrder: 1 })
    .lean();
  return ok(res, items);
}
