import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";
import { LEAD_STAGES, LEAD_SOURCES, CAMPAIGN_TYPES, CHANNELS } from "../shared/enums";

/*
 * Growth domain (spec 2.7). Lead, LeadActivity, CostEstimate, Campaign, Review.
 * Time-to-first-contact is derived (createdAt → first outbound activity) and
 * surfaced on the list; index clinic+stage+nextFollowUp and clinic+phone.
 */

const leadSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, index: true },
  altPhone: String,
  email: String,
  source: { type: String, enum: LEAD_SOURCES, default: "website" },
  sourceDetail: String,
  utm: { source: String, medium: String, campaign: String, term: String, content: String },
  interest: String,
  estimatedValuePaise: { type: Number, default: 0 },
  calculatorSnapshot: Schema.Types.Mixed,
  stage: { type: String, enum: LEAD_STAGES, default: "new", index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
  priority: { type: String, enum: ["high", "moderate", "routine"], default: "routine" },
  firstContactAt: Date, // powers time-to-first-contact
  nextFollowUp: Date,
  convertedPatient: { type: Schema.Types.ObjectId, ref: "Patient" },
  convertedAt: Date,
  lostReason: String,
  tags: [String],
});

leadSchema.plugin(baseFieldsPlugin);
leadSchema.index({ clinicId: 1, stage: 1, nextFollowUp: 1 });
leadSchema.index({ clinicId: 1, phone: 1 });

export type Lead = InferSchemaType<typeof leadSchema> & BaseFields;
export type LeadDoc = HydratedDocument<Lead>;
export const LeadModel = model<Lead>("Lead", leadSchema);

/* --------------------------------------------------------------- LeadActivity */

const leadActivitySchema = new Schema({
  lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
  type: { type: String, enum: ["call", "whatsapp", "email", "sms", "note", "stage_change", "appointment"], required: true },
  direction: { type: String, enum: ["in", "out"] },
  content: String,
  outcome: String,
  staff: { type: Schema.Types.ObjectId, ref: "User" },
  durationSec: Number,
});
leadActivitySchema.plugin(baseFieldsPlugin);
leadActivitySchema.index({ clinicId: 1, lead: 1, createdAt: -1 });

export type LeadActivity = InferSchemaType<typeof leadActivitySchema> & BaseFields;
export const LeadActivityModel = model<LeadActivity>("LeadActivity", leadActivitySchema);

/* --------------------------------------------------------------- CostEstimate */

const costEstimateSchema = new Schema({
  sessionId: String,
  category: String,
  inputs: Schema.Types.Mixed,
  lowPaise: Number,
  highPaise: Number,
  breakdown: Schema.Types.Mixed,
  emiOptions: Schema.Types.Mixed,
  converted: { type: Boolean, default: false },
  lead: { type: Schema.Types.ObjectId, ref: "Lead" },
  referrer: String,
  utm: Schema.Types.Mixed,
  device: String,
});
costEstimateSchema.plugin(baseFieldsPlugin);
costEstimateSchema.index({ clinicId: 1, createdAt: -1 });

export type CostEstimate = InferSchemaType<typeof costEstimateSchema> & BaseFields;
export const CostEstimateModel = model<CostEstimate>("CostEstimate", costEstimateSchema);

/* ------------------------------------------------------------------ Campaign */

const campaignSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, enum: CAMPAIGN_TYPES, default: "recall" },
  channel: { type: String, enum: CHANNELS, default: "whatsapp" },
  segment: Schema.Types.Mixed, // stored filter query
  template: { type: Schema.Types.ObjectId, ref: "MessageTemplate" },
  schedule: { mode: { type: String, enum: ["immediate", "scheduled", "recurring"], default: "immediate" }, runAt: Date, rule: String },
  status: { type: String, enum: ["draft", "scheduled", "active", "done", "cancelled"], default: "draft", index: true },
  recipients: [{
    patient: { type: Schema.Types.ObjectId, ref: "Patient" },
    sentAt: Date, deliveredAt: Date, readAt: Date, repliedAt: Date, convertedAt: Date,
    revenuePaise: { type: Number, default: 0 },
  }],
  stats: { sent: Number, delivered: Number, read: Number, replied: Number, booked: Number, revenuePaise: Number },
});
campaignSchema.plugin(baseFieldsPlugin);
campaignSchema.index({ clinicId: 1, status: 1 });

export type Campaign = InferSchemaType<typeof campaignSchema> & BaseFields;
export const CampaignModel = model<Campaign>("Campaign", campaignSchema);

/* -------------------------------------------------------------------- Review */

const reviewSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
  appointment: { type: Schema.Types.ObjectId, ref: "Appointment" },
  requestSentAt: Date,
  requestChannel: { type: String, enum: CHANNELS },
  token: { type: String, index: true },
  internalRating: Number,
  internalFeedback: String,
  routedToPublic: { type: Boolean, default: false },
  publicPlatform: { type: String, enum: ["google", "practo", "justdial"] },
  publicLink: String,
  responseStatus: { type: String, enum: ["pending", "public", "recovery", "resolved"], default: "pending" },
});
reviewSchema.plugin(baseFieldsPlugin);
reviewSchema.index({ clinicId: 1, createdAt: -1 });

export type Review = InferSchemaType<typeof reviewSchema> & BaseFields;
export const ReviewModel = model<Review>("Review", reviewSchema);
