/*
 * API response envelope — mirrors server/src/shared/envelope.ts. Every endpoint
 * returns this shape (never a bare array), so the client can unwrap uniformly
 * and metadata can be added server-side without breaking callers.
 */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  fields?: Record<string, string>;
  meta?: Record<string, unknown>;
}

export interface Envelope<T> {
  success: boolean;
  data: T | null;
  message?: string;
  pagination?: Pagination;
  error?: ApiErrorBody;
}

/*
 * Error codes — mirrors server/src/shared/errors.ts. "Never parse error
 * strings." The client maps these codes to user-facing messages; the strings
 * below are the machine-readable contract, not display copy.
 */
export const API_ERROR_CODES = [
  "AUTH_REQUIRED",
  "AUTH_INVALID",
  "AUTH_EXPIRED",
  "AUTH_OTP_INVALID",
  "AUTH_OTP_EXPIRED",
  "AUTH_LOCKED",
  "AUTH_AUDIENCE",
  "PERM_DENIED",
  "PERM_REAUTH_REQUIRED",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "CONFLICT_SLOT",
  "CONFLICT_STATE",
  "CONFLICT_DUPLICATE",
  "PAYMENT_FAILED",
  "PAYMENT_SIGNATURE",
  "EXTERNAL_UNAVAILABLE",
  "RATE_LIMIT",
  "SERVICE_UNAVAILABLE",
  "INTERNAL",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** A synthetic code the client uses when the network failed before any HTTP
 * response arrived — distinct from any server code so callers can special-case
 * "offline / unreachable" without string-matching. */
export const NETWORK_ERROR_CODE = "NETWORK" as const;
export type ClientErrorCode = ApiErrorCode | typeof NETWORK_ERROR_CODE;
