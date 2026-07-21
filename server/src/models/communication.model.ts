import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";
import { CHANNELS, MESSAGE_STATUS } from "../shared/enums";

/*
 * Communication domain (spec 2.8). MessageTemplate, Conversation, Message,
 * AutomationRule, Notification. Message index on conversation+createdAt.
 */

const messageTemplateSchema = new Schema({
  name: { type: String, required: true },
  channel: { type: String, enum: CHANNELS, default: "whatsapp" },
  category: String,
  whatsappName: String,
  language: { type: String, default: "en" },
  approvalStatus: { type: String, enum: ["draft", "submitted", "approved", "rejected"], default: "draft" },
  header: String,
  body: { type: String, required: true },
  footer: String,
  buttons: [{ type: { type: String }, text: String, value: String }],
  variables: [String],
  active: { type: Boolean, default: true },
  usageCount: { type: Number, default: 0 },
});
messageTemplateSchema.plugin(baseFieldsPlugin);

export type MessageTemplate = InferSchemaType<typeof messageTemplateSchema> & BaseFields;
export const MessageTemplateModel = model<MessageTemplate>("MessageTemplate", messageTemplateSchema);

/* --------------------------------------------------------------- Conversation */

const conversationSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient" },
  lead: { type: Schema.Types.ObjectId, ref: "Lead" },
  channel: { type: String, enum: CHANNELS, default: "whatsapp" },
  externalThreadId: String,
  assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: ["open", "pending", "resolved"], default: "open", index: true },
  lastMessageAt: Date,
  unread: { type: Number, default: 0 },
  sessionWindowExpiresAt: Date, // WhatsApp 24-hour rule
  tags: [String],
});
conversationSchema.plugin(baseFieldsPlugin);
conversationSchema.index({ clinicId: 1, status: 1, lastMessageAt: -1 });

export type Conversation = InferSchemaType<typeof conversationSchema> & BaseFields;
export type ConversationDoc = HydratedDocument<Conversation>;
export const ConversationModel = model<Conversation>("Conversation", conversationSchema);

/* -------------------------------------------------------------------- Message */

const messageSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  direction: { type: String, enum: ["in", "out"], required: true },
  channel: { type: String, enum: CHANNELS, default: "whatsapp" },
  template: { type: Schema.Types.ObjectId, ref: "MessageTemplate" },
  content: String,
  attachments: [{ key: String, mimeType: String, name: String }],
  externalMessageId: String,
  status: { type: String, enum: MESSAGE_STATUS, default: "queued" },
  timestamps: { queuedAt: Date, sentAt: Date, deliveredAt: Date, readAt: Date, failedAt: Date },
  failureCode: String,
  failureReason: String,
  sentBy: { type: Schema.Types.ObjectId, ref: "User" },
  automation: { type: Schema.Types.ObjectId, ref: "AutomationRule" },
  costPaise: Number,
});
messageSchema.plugin(baseFieldsPlugin);
messageSchema.index({ conversation: 1, createdAt: 1 });

export type Message = InferSchemaType<typeof messageSchema> & BaseFields;
export const MessageModel = model<Message>("Message", messageSchema);

/* -------------------------------------------------------------- AutomationRule */

const automationRuleSchema = new Schema({
  name: { type: String, required: true },
  trigger: { type: String, required: true }, // appointment_booked, reminder_due, invoice_overdue, recall_due, ...
  conditions: Schema.Types.Mixed,
  delayMinutes: { type: Number, default: 0 },
  channel: { type: String, enum: CHANNELS, default: "whatsapp" },
  template: { type: Schema.Types.ObjectId, ref: "MessageTemplate" },
  audience: Schema.Types.Mixed,
  active: { type: Boolean, default: true },
  respectQuietHours: { type: Boolean, default: true }, // mandatory (spec 2.8)
  stats: { evaluated: Number, sent: Number, failed: Number },
});
automationRuleSchema.plugin(baseFieldsPlugin);

export type AutomationRule = InferSchemaType<typeof automationRuleSchema> & BaseFields;
export const AutomationRuleModel = model<AutomationRule>("AutomationRule", automationRuleSchema);

/* --------------------------------------------------------------- Notification */

const notificationSchema = new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, required: true },
  title: String,
  body: String,
  link: String,
  read: { type: Boolean, default: false },
  priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
});
notificationSchema.plugin(baseFieldsPlugin);
notificationSchema.index({ clinicId: 1, recipient: 1, read: 1, createdAt: -1 });

export type Notification = InferSchemaType<typeof notificationSchema> & BaseFields;
export const NotificationModel = model<Notification>("Notification", notificationSchema);
