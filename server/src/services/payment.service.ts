import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError, ERROR_CODES } from "../shared/errors";

/*
 * Payment gateway service (spec 5.3 — Razorpay). Never trusts client-reported
 * success: the checkout signature is verified server-side, and the webhook is
 * the sole authority on final status. With gateway credentials configured,
 * createOrder calls Razorpay's Orders API for a real order id; without them it
 * falls back to a stub order so the flow stays exercisable end to end locally.
 */

export interface GatewayOrder { orderId: string; amountPaise: number; currency: string; keyId?: string; stub: boolean; }

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";

export async function createOrder(amountPaise: number, receipt: string): Promise<GatewayOrder> {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    logger.info("Gateway not configured — returning stub order");
    return { orderId: `order_stub_${receipt}`, amountPaise, currency: "INR", stub: true };
  }
  // Razorpay receipts are capped at 40 chars; keep it deterministic per invoice.
  const shortReceipt = `rcpt_${receipt}`.slice(0, 40);
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(RAZORPAY_ORDERS_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: shortReceipt, notes: { invoice: receipt } }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error("Razorpay order creation failed", { status: res.status, detail: detail.slice(0, 300) });
    throw new AppError(ERROR_CODES.EXTERNAL_UNAVAILABLE, "Payment gateway could not create the order");
  }
  const order = (await res.json()) as { id: string; amount: number; currency: string };
  logger.info("Razorpay order created", { orderId: order.id, amountPaise: order.amount });
  return { orderId: order.id, amountPaise: order.amount, currency: order.currency || "INR", keyId: env.RAZORPAY_KEY_ID, stub: false };
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
