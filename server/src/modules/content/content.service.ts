import { ContentPageModel, BlogPostModel, GalleryItemModel } from "../../models/content.model";
import { errors } from "../../shared/errors";

/*
 * Content service (spec 4.15). Holds the two rules the controllers must not
 * bypass: a clinical gallery case cannot go public without its consent flag,
 * and a blog post's publishedAt is stamped the first time it goes live.
 */

/** Create/update a page addressed by its stable key (one row per key per clinic). */
export async function upsertPage(
  clinicId: string,
  actorId: string,
  pageKey: string,
  patch: Record<string, unknown>,
): Promise<unknown> {
  return ContentPageModel.findOneAndUpdate(
    { clinicId, pageKey },
    { $set: { ...patch, pageKey, clinicId, updatedBy: actorId }, $setOnInsert: { createdBy: actorId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function updateSeo(clinicId: string, actorId: string, pageKey: string, seo: Record<string, unknown>): Promise<unknown> {
  const page = await ContentPageModel.findOneAndUpdate(
    { clinicId, pageKey },
    { $set: { seo, updatedBy: actorId }, $setOnInsert: { pageKey, clinicId, createdBy: actorId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return page;
}

/** Stamp publishedAt when a post first transitions to published. */
export async function saveBlog(
  clinicId: string,
  actorId: string,
  id: string | null,
  data: Record<string, unknown>,
): Promise<unknown> {
  if (data.status === "published" && !data.publishedAt) data.publishedAt = new Date();
  if (id) {
    const post = await BlogPostModel.findOneAndUpdate(
      { _id: id, clinicId },
      { ...data, updatedBy: actorId },
      { new: true },
    ).lean();
    if (!post) throw errors.notFound("Blog post");
    return post;
  }
  return BlogPostModel.create({ ...data, clinicId, createdBy: actorId });
}

/**
 * Update a gallery item, refusing to publish a clinical before/after unless
 * consent has been recorded — the one rule that keeps patient photos legal.
 */
export async function saveGallery(
  clinicId: string,
  actorId: string,
  id: string | null,
  data: Record<string, unknown>,
): Promise<unknown> {
  const existing = id ? await GalleryItemModel.findOne({ _id: id, clinicId }) : null;
  if (id && !existing) throw errors.notFound("Gallery item");

  const merged = { ...(existing?.toObject() ?? {}), ...data };
  if (merged.published && merged.isClinical !== false && !merged.consentObtained) {
    throw errors.validation(
      { consentObtained: "Patient consent is required before publishing a clinical case" },
      "Consent required",
    );
  }

  if (existing) {
    Object.assign(existing, data, { updatedBy: actorId });
    await existing.save();
    return existing;
  }
  return GalleryItemModel.create({ ...data, clinicId, createdBy: actorId });
}
