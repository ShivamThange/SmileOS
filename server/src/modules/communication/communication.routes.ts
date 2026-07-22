import { Router } from "express";
import * as ctrl from "./communication.controller";
import { asyncHandler } from "../../shared/http";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import {
  createConversationSchema,
  assignConversationSchema,
  conversationStatusSchema,
  sendMessageSchema,
  createTemplateSchema,
  updateTemplateSchema,
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
} from "./communication.validator";

/*
 * Communication routes (spec 4.10). Inbox conversations, messages, templates
 * and automation rules are gated on the `message` resource. Notifications are
 * the authenticated user's own feed and need only a valid session.
 */
const guard = [requireDb, authenticate(), resolveTenant] as const;

/* --------------------------------------------------------------- Conversation */

export const conversationRouter = Router();
conversationRouter.use(...guard);
conversationRouter.get("/", authorize("message", "read"), asyncHandler(ctrl.listConversations));
conversationRouter.post("/", authorize("message", "create"), validate({ body: createConversationSchema }), asyncHandler(ctrl.createConversation));
conversationRouter.get("/:id", authorize("message", "read"), asyncHandler(ctrl.getConversation));
conversationRouter.get("/:id/messages", authorize("message", "read"), asyncHandler(ctrl.listMessages));
conversationRouter.post("/:id/messages", authorize("message", "create"), validate({ body: sendMessageSchema }), asyncHandler(ctrl.sendMessage));
conversationRouter.post("/:id/assign", authorize("message", "update"), validate({ body: assignConversationSchema }), asyncHandler(ctrl.assignConversation));
conversationRouter.post("/:id/status", authorize("message", "update"), validate({ body: conversationStatusSchema }), asyncHandler(ctrl.setConversationStatus));
conversationRouter.post("/:id/read", authorize("message", "update"), asyncHandler(ctrl.markConversationRead));

/* ------------------------------------------------------------------- Template */

export const templateRouter = Router();
templateRouter.use(...guard);
templateRouter.get("/", authorize("message", "read"), asyncHandler(ctrl.listTemplates));
templateRouter.post("/", authorize("message", "create"), validate({ body: createTemplateSchema }), asyncHandler(ctrl.createTemplate));
templateRouter.get("/:id", authorize("message", "read"), asyncHandler(ctrl.getTemplate));
templateRouter.patch("/:id", authorize("message", "update"), validate({ body: updateTemplateSchema }), asyncHandler(ctrl.updateTemplate));
templateRouter.post("/:id/submit-approval", authorize("message", "update"), asyncHandler(ctrl.submitTemplate));
templateRouter.delete("/:id", authorize("message", "update"), asyncHandler(ctrl.deleteTemplate));

/* -------------------------------------------------------------- AutomationRule */

export const automationRuleRouter = Router();
automationRuleRouter.use(...guard);
automationRuleRouter.get("/", authorize("message", "read"), asyncHandler(ctrl.listAutomationRules));
automationRuleRouter.post("/", authorize("message", "create"), validate({ body: createAutomationRuleSchema }), asyncHandler(ctrl.createAutomationRule));
automationRuleRouter.get("/:id", authorize("message", "read"), asyncHandler(ctrl.getAutomationRule));
automationRuleRouter.patch("/:id", authorize("message", "update"), validate({ body: updateAutomationRuleSchema }), asyncHandler(ctrl.updateAutomationRule));
automationRuleRouter.post("/:id/toggle", authorize("message", "update"), asyncHandler(ctrl.toggleAutomationRule));
automationRuleRouter.get("/:id/logs", authorize("message", "read"), asyncHandler(ctrl.automationRuleLogs));
automationRuleRouter.delete("/:id", authorize("message", "update"), asyncHandler(ctrl.deleteAutomationRule));

/* --------------------------------------------------------------- Notification */

export const notificationRouter = Router();
notificationRouter.use(...guard);
notificationRouter.get("/", asyncHandler(ctrl.listNotifications));
notificationRouter.get("/unread-count", asyncHandler(ctrl.unreadCount));
notificationRouter.post("/read-all", asyncHandler(ctrl.markAllNotificationsRead));
notificationRouter.post("/:id/read", asyncHandler(ctrl.markNotificationRead));
