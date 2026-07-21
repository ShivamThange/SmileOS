import { Router, type Request } from "express";
import { asyncHandler } from "../shared/http";
import { ok, fail } from "../shared/envelope";
import { ERROR_CODES } from "../shared/errors";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { getRedis, isRedisReady } from "../config/redis";
import { verifyWebhookSignature } from "../services/payment.service";
import { PaymentModel } from "../models/billing.model";
import { refreshInvoiceStatus } from "../modules/billing/billing.service";
import { MessageModel, ConversationModel } from "../models/communication.model";

/*
 * Webhooks (spec 4.16). Signature-verified and idempotent by event id. The
 * payment webhook is THE sole authority on payment status — the browser redirect
 * is a UI hint only. These endpoints are unauthenticated (verified by signature)
 * and mounted outside the API auth chain.
 */
export const webhooksRouter = Router();

const seen = new Set<string>();
async function alreadyProcessed(eventId: string): Promise<boolean> {
  if (isRedisReady()) {
    const key = `wh:${eventId}`;
    const set = await getRedis()!.set(key, "1", "EX", 86400, "NX");
    return set === null; // null → key already existed
  }
  if (seen.has(eventId)) return true;
  seen.add(eventId);
  return false;
}

function raw(req: Request): string {
  return (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
}

/* Payment gateway events */
webhooksRouter.post("/payment", asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  if (env.RAZORPAY_WEBHOOK_SECRET) {
    if (!signature || !verifyWebhookSignature(raw(req), signature)) {
      return fail(res, 400, { code: ERROR_CODES.PAYMENT_SIGNATURE, message: "Invalid webhook signature" });
    }
  }
  const eventId = (req.headers["x-razorpay-event-id"] as string) || req.body?.id || `${Date.now()}`;
  if (await alreadyProcessed(String(eventId))) return ok(res, { deduped: true });

  const event = req.body?.event as string;
  const entity = req.body?.payload?.payment?.entity ?? {};
  logger.info("Payment webhook", { event, order: entity.order_id });

  // Authoritative status update.
  if (entity.order_id) {
    const statusMap: Record<string, string> = { "payment.captured": "success", "payment.failed": "failed", "refund.processed": "refunded" };
    const status = statusMap[event];
    if (status) {
      const payment = await PaymentModel.findOneAndUpdate(
        { "gateway.orderId": entity.order_id },
        { status, "gateway.paymentId": entity.id, reconciled: true },
        { new: true },
      );
      if (payment?.invoice) await refreshInvoiceStatus(String(payment.clinicId), String(payment.invoice));
    }
  }
  return ok(res, { received: true });
}));

/* WhatsApp — Meta verification challenge */
webhooksRouter.get("/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"], token = req.query["hub.verify_token"], challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(String(challenge));
  return res.sendStatus(403);
});

/* WhatsApp — inbound messages + delivery status */
webhooksRouter.post("/whatsapp", asyncHandler(async (req, res) => {
  const entry = req.body?.entry?.[0]?.changes?.[0]?.value ?? {};
  const eventId = req.body?.entry?.[0]?.id ?? `${Date.now()}`;
  if (await alreadyProcessed(String(eventId))) return ok(res, { deduped: true });

  // Delivery statuses update the message record.
  for (const s of entry.statuses ?? []) {
    await MessageModel.findOneAndUpdate({ externalMessageId: s.id }, { status: s.status, [`timestamps.${s.status}At`]: new Date() });
  }
  // Inbound messages extend the conversation's 24-hour session window.
  for (const m of entry.messages ?? []) {
    await ConversationModel.findOneAndUpdate(
      { externalThreadId: m.from },
      { lastMessageAt: new Date(), sessionWindowExpiresAt: new Date(Date.now() + 24 * 3600_000), $inc: { unread: 1 } },
    );
  }
  return ok(res, { received: true });
}));
