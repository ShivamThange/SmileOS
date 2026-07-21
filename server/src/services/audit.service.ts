import type { Request } from "express";
import { AuditModel } from "../models/audit.model";
import { isDbConnected } from "../config/db";
import { logger } from "../config/logger";

/*
 * Audit service (spec Part 0 rule 2). Fire-and-forget writes an audit entry for
 * a state change. Failures are logged but never block the request — the audit
 * write must not take down the user action, though in production a failed audit
 * write should alert.
 */

export interface AuditInput {
  action: string;
  resourceType: string;
  resourceId?: string;
  patient?: unknown;
  before?: unknown;
  after?: unknown;
  outcome?: "success" | "failure";
}

export function recordAudit(req: Request, input: AuditInput): void {
  if (!isDbConnected() || !req.auth) return;
  void AuditModel.create({
    clinicId: req.auth.clinicId,
    actor: req.auth.userId,
    actorRole: req.auth.role,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    patient: input.patient,
    before: input.before,
    after: input.after,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    outcome: input.outcome ?? "success",
  }).catch((err) => logger.error("Audit write failed", { error: (err as Error).message, action: input.action }));
}
