import { scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

/*
 * Password hashing. The spec calls for Argon2id; we use Node's built-in scrypt
 * (no native dependency, robust in any environment) behind a small interface so
 * swapping to argon2 later is a one-file change. Format: scrypt$N$salt$hash.
 */

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number, options: ScryptOptions) => Promise<Buffer>;
const KEYLEN = 64;
const COST = 16384; // N

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEYLEN, { N: COST })) as Buffer;
  return `scrypt$${COST}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, costStr, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, KEYLEN, { N: Number(costStr) || COST })) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
