import { z } from "zod";

/*
 * Content validators (spec 4.15). Pages, blog, FAQs, testimonials, gallery,
 * banners, SEO, media. String schemas guard against NoSQL-operator injection.
 */

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const seoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  ogImageKey: z.string().optional(),
  canonical: z.string().optional(),
});

export const upsertPageSchema = z.object({
  title: z.string().optional(),
  sections: z.record(z.unknown()).optional(),
  seo: seoSchema.optional(),
  published: z.boolean().optional(),
});

export const seoSchemaBody = seoSchema;

export const createBlogSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase, hyphenated"),
  title: z.string().min(1),
  excerpt: z.string().optional(),
  body: z.string().optional(),
  coverImageKey: z.string().optional(),
  author: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  seo: seoSchema.optional(),
});
export const updateBlogSchema = createBlogSchema.partial();

export const createFaqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  category: z.string().optional(),
  displayOrder: z.number().int().default(0),
  published: z.boolean().default(true),
});
export const updateFaqSchema = createFaqSchema.partial();

export const createTestimonialSchema = z.object({
  patientName: z.string().min(1),
  rating: z.number().int().min(1).max(5).default(5),
  text: z.string().min(1),
  treatment: z.string().optional(),
  avatarKey: z.string().optional(),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});
export const updateTestimonialSchema = createTestimonialSchema.partial();

export const createGallerySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  beforeKey: z.string().optional(),
  afterKey: z.string().optional(),
  category: z.string().optional(),
  isClinical: z.boolean().default(true),
  consentObtained: z.boolean().default(false),
  consentRef: objectId.optional(),
  patient: objectId.optional(),
  published: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
});
export const updateGallerySchema = createGallerySchema.partial();

export const createBannerSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  imageKey: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
  placement: z.string().default("home_hero"),
  active: z.boolean().default(true),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  displayOrder: z.number().int().default(0),
});
export const updateBannerSchema = createBannerSchema.partial();

export const mediaUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().optional(),
  folder: z.string().optional(),
});
