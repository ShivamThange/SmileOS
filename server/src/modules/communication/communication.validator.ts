import { z } from "zod";
import { CHANNELS } from "../../shared/enums";

/*
 * Communication validators (spec 2.8 / 4.10). Conversations, messages,
 * templates, automation rules, notifications. String schemas double as the
 * NoSQL-injection guard.
 */

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

/* --------------------------------------------------------------- Conversation */

export const createConversationSchema = z
  .object({
    patient: objectId.optional(),
    lead: objectId.optional(),
    channel: z.enum(CHANNELS).default("whatsapp"),
    externalThreadId: z.string().optional(),
    assignedTo: objectId.optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine((v) => v.patient || v.lead, { message: "A conversation needs a patient or a lead", path: ["patient"] });

export const assignConversationSchema = z.object({ assignedTo: objectId.nullable() });

export const conversationStatusSchema = z.object({ status: z.enum(["open", "pending", "resolved"]) });

/* -------------------------------------------------------------------- Message */

export const sendMessageSchema = z
  .object({
    // Free-form text (session window) OR a template send (outside the window).
    content: z.string().min(1).optional(),
    template: objectId.optional(),
    variables: z.record(z.string()).optional(),
    attachments: z
      .array(z.object({ key: z.string(), mimeType: z.string().optional(), name: z.string().optional() }))
      .optional(),
    respectQuietHours: z.boolean().optional(),
  })
  .refine((v) => v.content || v.template, { message: "A message needs content or a template", path: ["content"] });

/* ------------------------------------------------------------------- Template */

const templateButtonSchema = z.object({ type: z.string().optional(), text: z.string(), value: z.string().optional() });

export const createTemplateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(CHANNELS).default("whatsapp"),
  category: z.string().optional(),
  whatsappName: z.string().optional(),
  language: z.string().default("en"),
  header: z.string().optional(),
  body: z.string().min(1),
  footer: z.string().optional(),
  buttons: z.array(templateButtonSchema).optional(),
  variables: z.array(z.string()).optional(),
  active: z.boolean().default(true),
});

export const updateTemplateSchema = createTemplateSchema.partial();

/* -------------------------------------------------------------- AutomationRule */

export const createAutomationRuleSchema = z.object({
  name: z.string().min(1),
  trigger: z.string().min(1),
  conditions: z.record(z.unknown()).optional(),
  delayMinutes: z.number().int().min(0).default(0),
  channel: z.enum(CHANNELS).default("whatsapp"),
  template: objectId.optional(),
  audience: z.record(z.unknown()).optional(),
  active: z.boolean().default(true),
  respectQuietHours: z.boolean().default(true),
});

export const updateAutomationRuleSchema = createAutomationRuleSchema.partial();
