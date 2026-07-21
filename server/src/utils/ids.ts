import { randomBytes, randomUUID, createHash } from "node:crypto";

/*
 * ID + code generation (spec Part 1 / Part 3). Sequential human-readable
 * numbers (patient/invoice) are allocated in the service layer via a counter
 * document; these are the primitives.
 */

export function uuid(): string {
  return randomUUID();
}

/** URL-safe opaque token for tokenised links (public plan view, review capture). */
export function opaqueToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

/** A numeric OTP code of the given length. */
export function numericCode(length = 6): string {
  let out = "";
  while (out.length < length) out += (randomBytes(1)[0] % 10).toString();
  return out.slice(0, length);
}

/** SHA-256 hex — used to store OTP/token hashes, never the plaintext. */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Zero-pad a counter into a human-readable sequence, e.g. padSeq("MDC-", 412, 4) → "MDC-0412". */
export function padSeq(prefix: string, n: number, width = 4): string {
  return `${prefix}${String(n).padStart(width, "0")}`;
}
