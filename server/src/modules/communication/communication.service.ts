import {
  ConversationModel,
  MessageModel,
  MessageTemplateModel,
} from "../../models/communication.model";
import { errors } from "../../shared/errors";
import { inQuietHours } from "../../services/whatsapp.service";
import { enqueue } from "../../jobs/queue";

/*
 * Communication service (spec 2.8 / 5.4). The rule that matters: WhatsApp's
 * 24-hour session window. Inside it, staff may send free-form text; outside it
 * (or with no window yet) only an approved template may go out. This lives here
 * so the UI cannot bypass it and the webhook path stays consistent.
 */

/** True while the conversation can still receive a free-form (non-template) reply. */
export function withinSessionWindow(conv: { channel?: string; sessionWindowExpiresAt?: Date | null }): boolean {
  if (conv.channel !== "whatsapp") return true; // SMS/email have no session window
  return Boolean(conv.sessionWindowExpiresAt && new Date(conv.sessionWindowExpiresAt) > new Date());
}

interface SendInput {
  content?: string;
  template?: string;
  variables?: Record<string, string>;
  attachments?: { key: string; mimeType?: string; name?: string }[];
  respectQuietHours?: boolean;
}

/**
 * Send an outbound message on a conversation. Enforces the session-window rule,
 * records the Message, advances the conversation, bumps template usage, and
 * queues the actual dispatch (never inline). Quiet-hours suppression applies to
 * WhatsApp only and marks the message queued-until rather than failed.
 */
export async function sendMessage(
  clinicId: string,
  actorId: string,
  conversationId: string,
  input: SendInput,
): Promise<{ message: unknown; suppressed?: boolean }> {
  const conv = await ConversationModel.findOne({ _id: conversationId, clinicId });
  if (!conv) throw errors.notFound("Conversation");

  const usingTemplate = Boolean(input.template);
  if (!usingTemplate && !withinSessionWindow(conv)) {
    throw errors.conflictState("The 24-hour session window has closed — send an approved template instead");
  }

  let templateDoc = null;
  if (usingTemplate) {
    templateDoc = await MessageTemplateModel.findOne({ _id: input.template, clinicId });
    if (!templateDoc) throw errors.notFound("Template");
    if (templateDoc.approvalStatus !== "approved") {
      throw errors.conflictState("That template is not approved for sending");
    }
  }

  const suppressed = conv.channel === "whatsapp" && input.respectQuietHours !== false && inQuietHours();

  const message = await MessageModel.create({
    clinicId,
    conversation: conv._id,
    direction: "out",
    channel: conv.channel,
    template: templateDoc?._id,
    content: input.content ?? templateDoc?.body,
    attachments: input.attachments,
    status: "queued",
    timestamps: { queuedAt: new Date() },
    sentBy: actorId,
    createdBy: actorId,
  });

  conv.lastMessageAt = new Date();
  conv.status = "open";
  await conv.save();

  if (templateDoc) {
    templateDoc.usageCount = (templateDoc.usageCount ?? 0) + 1;
    await templateDoc.save();
  }

  if (!suppressed) {
    await enqueue(conv.channel === "email" ? "email" : "whatsapp", "outbound_message", {
      messageId: String(message._id),
      to: conv.externalThreadId,
      template: templateDoc?.whatsappName,
      variables: input.variables,
    });
  }

  return { message, suppressed };
}

/** Mark a conversation read (clears the unread counter). */
export async function markRead(clinicId: string, conversationId: string): Promise<void> {
  await ConversationModel.updateOne({ _id: conversationId, clinicId }, { unread: 0 });
}
