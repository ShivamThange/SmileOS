import type { Request, Response } from "express";
import { ok, created } from "../../shared/envelope";
import { paginate } from "../../shared/list";
import { parsePageParams, buildPagination } from "../../utils/pagination";
import { errors } from "../../shared/errors";
import { recordAudit } from "../../services/audit.service";
import {
  ConversationModel,
  MessageModel,
  MessageTemplateModel,
  AutomationRuleModel,
  NotificationModel,
} from "../../models/communication.model";
import * as svc from "./communication.service";

/* Communication controller (spec 4.10). */

/* --------------------------------------------------------------- Conversation */

export async function listConversations(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = { clinicId: req.clinicId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.channel) filter.channel = req.query.channel;
  if (req.query.assigned) filter.assignedTo = req.query.assigned;
  if (req.query.patient) filter.patient = req.query.patient;

  const { page, limit, skip, sort } = parsePageParams(req, { defaultSort: "lastMessageAt", maxLimit: 100 });
  const [rows, total] = await Promise.all([
    ConversationModel.find(filter).sort(sort).skip(skip).limit(limit).populate("patient lead assignedTo").lean(),
    ConversationModel.countDocuments(filter),
  ]);

  // Batch the latest message per conversation so the list can show a preview
  // without an N+1 — one aggregation over the page's conversations.
  const ids = rows.map((r) => r._id);
  const last = ids.length
    ? await MessageModel.aggregate([
        { $match: { conversation: { $in: ids } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$conversation", content: { $first: "$content" }, direction: { $first: "$direction" } } },
      ])
    : [];
  const previewById = new Map(last.map((m) => [String(m._id), m as { content?: string; direction?: string }]));

  const data = rows.map((c) => ({
    ...c,
    withinSessionWindow: svc.withinSessionWindow(c as never),
    lastMessagePreview: previewById.get(String(c._id))?.content ?? "",
    lastMessageDirection: previewById.get(String(c._id))?.direction ?? null,
  }));
  return ok(res, data, { pagination: buildPagination(page, limit, total) });
}

export async function createConversation(req: Request, res: Response): Promise<Response> {
  const conv = await ConversationModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId });
  recordAudit(req, { action: "conversation.create", resourceType: "message", resourceId: String(conv._id) });
  return created(res, conv, "Conversation started");
}

export async function getConversation(req: Request, res: Response): Promise<Response> {
  const conv = await ConversationModel.findOne({ _id: req.params.id, clinicId: req.clinicId })
    .populate("patient lead assignedTo")
    .lean();
  if (!conv) throw errors.notFound("Conversation");
  return ok(res, { ...conv, withinSessionWindow: svc.withinSessionWindow(conv as never) });
}

export async function listMessages(req: Request, res: Response): Promise<Response> {
  const conv = await ConversationModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).select("_id").lean();
  if (!conv) throw errors.notFound("Conversation");
  return paginate(req, res, MessageModel, { conversation: req.params.id }, { defaultSort: "createdAt", maxLimit: 200 });
}

export async function sendMessage(req: Request, res: Response): Promise<Response> {
  const result = await svc.sendMessage(req.clinicId!, req.auth!.userId, req.params.id, req.body);
  recordAudit(req, { action: "message.send", resourceType: "message", resourceId: req.params.id });
  return created(res, result, result.suppressed ? "Held for quiet hours" : "Message sent");
}

export async function assignConversation(req: Request, res: Response): Promise<Response> {
  const conv = await ConversationModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { assignedTo: req.body.assignedTo, updatedBy: req.auth!.userId },
    { new: true },
  ).lean();
  if (!conv) throw errors.notFound("Conversation");
  return ok(res, conv, { message: "Conversation assigned" });
}

export async function setConversationStatus(req: Request, res: Response): Promise<Response> {
  const conv = await ConversationModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { status: req.body.status, updatedBy: req.auth!.userId },
    { new: true },
  ).lean();
  if (!conv) throw errors.notFound("Conversation");
  return ok(res, conv);
}

export async function markConversationRead(req: Request, res: Response): Promise<Response> {
  await svc.markRead(req.clinicId!, req.params.id);
  return ok(res, { read: true });
}

/* ------------------------------------------------------------------- Template */

export async function listTemplates(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.channel) filter.channel = req.query.channel;
  if (req.query.approvalStatus) filter.approvalStatus = req.query.approvalStatus;
  if (req.query.active !== undefined) filter.active = req.query.active === "true";
  return paginate(req, res, MessageTemplateModel, filter, { defaultSort: "name", maxLimit: 200 });
}

export async function createTemplate(req: Request, res: Response): Promise<Response> {
  const tpl = await MessageTemplateModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId });
  recordAudit(req, { action: "template.create", resourceType: "message", resourceId: String(tpl._id) });
  return created(res, tpl, "Template created");
}

export async function getTemplate(req: Request, res: Response): Promise<Response> {
  const tpl = await MessageTemplateModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).lean();
  if (!tpl) throw errors.notFound("Template");
  return ok(res, tpl);
}

export async function updateTemplate(req: Request, res: Response): Promise<Response> {
  const tpl = await MessageTemplateModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { ...req.body, updatedBy: req.auth!.userId },
    { new: true },
  ).lean();
  if (!tpl) throw errors.notFound("Template");
  return ok(res, tpl);
}

export async function submitTemplate(req: Request, res: Response): Promise<Response> {
  const tpl = await MessageTemplateModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!tpl) throw errors.notFound("Template");
  if (tpl.approvalStatus === "approved") throw errors.conflictState("Template is already approved");
  tpl.approvalStatus = "submitted";
  tpl.updatedBy = req.auth!.userId as never;
  await tpl.save();
  recordAudit(req, { action: "template.submit", resourceType: "message", resourceId: req.params.id });
  return ok(res, tpl, { message: "Template submitted for approval" });
}

export async function deleteTemplate(req: Request, res: Response): Promise<Response> {
  const tpl = await MessageTemplateModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!tpl) throw errors.notFound("Template");
  await (tpl as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  return ok(res, { deleted: true });
}

/* -------------------------------------------------------------- AutomationRule */

export async function listAutomationRules(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.trigger) filter.trigger = req.query.trigger;
  if (req.query.active !== undefined) filter.active = req.query.active === "true";
  return paginate(req, res, AutomationRuleModel, filter, { defaultSort: "name", populate: ["template"], maxLimit: 200 });
}

export async function createAutomationRule(req: Request, res: Response): Promise<Response> {
  const rule = await AutomationRuleModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId });
  recordAudit(req, { action: "automation_rule.create", resourceType: "message", resourceId: String(rule._id) });
  return created(res, rule, "Automation rule created");
}

export async function getAutomationRule(req: Request, res: Response): Promise<Response> {
  const rule = await AutomationRuleModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).populate("template").lean();
  if (!rule) throw errors.notFound("Automation rule");
  return ok(res, rule);
}

export async function updateAutomationRule(req: Request, res: Response): Promise<Response> {
  const rule = await AutomationRuleModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { ...req.body, updatedBy: req.auth!.userId },
    { new: true },
  ).lean();
  if (!rule) throw errors.notFound("Automation rule");
  return ok(res, rule);
}

export async function toggleAutomationRule(req: Request, res: Response): Promise<Response> {
  const rule = await AutomationRuleModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!rule) throw errors.notFound("Automation rule");
  rule.active = !rule.active;
  rule.updatedBy = req.auth!.userId as never;
  await rule.save();
  recordAudit(req, { action: "automation_rule.toggle", resourceType: "message", resourceId: req.params.id, after: { active: rule.active } });
  return ok(res, rule, { message: rule.active ? "Rule enabled" : "Rule disabled" });
}

export async function automationRuleLogs(req: Request, res: Response): Promise<Response> {
  return paginate(req, res, MessageModel, { automation: req.params.id }, { defaultSort: "createdAt", populate: ["conversation"], maxLimit: 200 });
}

export async function deleteAutomationRule(req: Request, res: Response): Promise<Response> {
  const rule = await AutomationRuleModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!rule) throw errors.notFound("Automation rule");
  await (rule as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  return ok(res, { deleted: true });
}

/* --------------------------------------------------------------- Notification */
// Notifications are per-user: the recipient is always the authenticated user,
// never a path id, so one user can't read another's feed.

export async function listNotifications(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = { recipient: req.auth!.userId };
  if (req.query.read !== undefined) filter.read = req.query.read === "true";
  return paginate(req, res, NotificationModel, filter, { defaultSort: "createdAt", maxLimit: 100 });
}

export async function unreadCount(req: Request, res: Response): Promise<Response> {
  const count = await NotificationModel.countDocuments({ clinicId: req.clinicId, recipient: req.auth!.userId, read: false });
  return ok(res, { count });
}

export async function markNotificationRead(req: Request, res: Response): Promise<Response> {
  const notif = await NotificationModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId, recipient: req.auth!.userId },
    { read: true },
    { new: true },
  ).lean();
  if (!notif) throw errors.notFound("Notification");
  return ok(res, notif);
}

export async function markAllNotificationsRead(req: Request, res: Response): Promise<Response> {
  await NotificationModel.updateMany({ clinicId: req.clinicId, recipient: req.auth!.userId, read: false }, { read: true });
  return ok(res, { read: true });
}
