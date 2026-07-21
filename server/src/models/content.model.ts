import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";

/*
 * Content domain (spec 4.15). The editable Site: pages, blog, FAQs,
 * testimonials, gallery, banners — plus per-page SEO. Everything is clinic
 * scoped and soft-deleted. A clinical gallery case may only be published once
 * its consent flag is set (enforced in the service, not just here).
 */

const seoSchema = new Schema(
  { title: String, description: String, keywords: [String], ogImageKey: String, canonical: String },
  { _id: false },
);

/* ---------------------------------------------------------------- ContentPage */

const contentPageSchema = new Schema({
  pageKey: { type: String, required: true }, // home, about, contact, services, ...
  title: String,
  sections: { type: Schema.Types.Mixed, default: {} },
  seo: { type: seoSchema, default: {} },
  published: { type: Boolean, default: true },
});
contentPageSchema.plugin(baseFieldsPlugin);
contentPageSchema.index({ clinicId: 1, pageKey: 1 }, { unique: true });

export type ContentPage = InferSchemaType<typeof contentPageSchema> & BaseFields;
export type ContentPageDoc = HydratedDocument<ContentPage>;
export const ContentPageModel = model<ContentPage>("ContentPage", contentPageSchema);

/* ------------------------------------------------------------------- BlogPost */

const blogPostSchema = new Schema({
  slug: { type: String, required: true },
  title: { type: String, required: true },
  excerpt: String,
  body: String,
  coverImageKey: String,
  author: String,
  category: String,
  tags: [String],
  status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  publishedAt: Date,
  seo: { type: seoSchema, default: {} },
});
blogPostSchema.plugin(baseFieldsPlugin);
blogPostSchema.index({ clinicId: 1, slug: 1 }, { unique: true });

export type BlogPost = InferSchemaType<typeof blogPostSchema> & BaseFields;
export const BlogPostModel = model<BlogPost>("BlogPost", blogPostSchema);

/* ------------------------------------------------------------------------ Faq */

const faqSchema = new Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: String,
  displayOrder: { type: Number, default: 0 },
  published: { type: Boolean, default: true },
});
faqSchema.plugin(baseFieldsPlugin);
faqSchema.index({ clinicId: 1, displayOrder: 1 });

export type Faq = InferSchemaType<typeof faqSchema> & BaseFields;
export const FaqModel = model<Faq>("Faq", faqSchema);

/* ---------------------------------------------------------------- Testimonial */

const testimonialSchema = new Schema({
  patientName: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, default: 5 },
  text: { type: String, required: true },
  treatment: String,
  avatarKey: String,
  featured: { type: Boolean, default: false },
  published: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
});
testimonialSchema.plugin(baseFieldsPlugin);
testimonialSchema.index({ clinicId: 1, published: 1, displayOrder: 1 });

export type Testimonial = InferSchemaType<typeof testimonialSchema> & BaseFields;
export const TestimonialModel = model<Testimonial>("Testimonial", testimonialSchema);

/* --------------------------------------------------------------- GalleryItem */

const galleryItemSchema = new Schema({
  title: String,
  description: String,
  beforeKey: String,
  afterKey: String,
  category: String,
  // A clinical before/after may only be published after patient consent (spec 4.15).
  isClinical: { type: Boolean, default: true },
  consentObtained: { type: Boolean, default: false },
  consentRef: { type: Schema.Types.ObjectId, ref: "Consent" },
  patient: { type: Schema.Types.ObjectId, ref: "Patient" },
  published: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 0 },
});
galleryItemSchema.plugin(baseFieldsPlugin);
galleryItemSchema.index({ clinicId: 1, published: 1, displayOrder: 1 });

export type GalleryItem = InferSchemaType<typeof galleryItemSchema> & BaseFields;
export const GalleryItemModel = model<GalleryItem>("GalleryItem", galleryItemSchema);

/* ---------------------------------------------------------------------- Banner */

const bannerSchema = new Schema({
  title: String,
  subtitle: String,
  imageKey: String,
  ctaText: String,
  ctaLink: String,
  placement: { type: String, default: "home_hero" },
  active: { type: Boolean, default: true },
  startsAt: Date,
  endsAt: Date,
  displayOrder: { type: Number, default: 0 },
});
bannerSchema.plugin(baseFieldsPlugin);
bannerSchema.index({ clinicId: 1, placement: 1, active: 1, displayOrder: 1 });

export type Banner = InferSchemaType<typeof bannerSchema> & BaseFields;
export const BannerModel = model<Banner>("Banner", bannerSchema);
