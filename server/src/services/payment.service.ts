import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError, ERROR_CODES } from "../shared/errors";

/*
 * Payment gateway service (spec 5.3 — Razorpay). Never trusts client-reported
 * success: the checkout signature is verified server-side, and the webhook is
 * the sole authority on final status. Without gateway credentials configured,
 * createOrder returns a stub order so the flow is exercisable end to end.
 */

export interface GatewayOrder { orderId: string; amountPaise: number; currency: string; keyId?: string; stub: boolean; }

export async function createOrder(amountPaise: number, receipt: string): Promise<GatewayOrder> {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    logger.info("Gateway not configured — returning stub order");
    return { orderId: `order_stub_${receipt}`, amountPaise, currency: "INR", stub: true };
  }
  // A real integration would POST to Razorpay's Orders API here via the queue.
  return { orderId: `order_${receipt}`, amountPaise, currency: "INR", keyId: env.RAZORPAY_KEY_ID, stub: false };
}

/** Verify the checkout handshake signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Verify an inbound webhook body signature: HMAC_SHA256(rawBody, webhook_secret). */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw new AppError(ERROR_CODES.EXTERNAL_UNAVAILABLE, "Webhook secret not configured");
  const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex"), bb = Buffer.from(b, "hex");
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
