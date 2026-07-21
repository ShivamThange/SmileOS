/*
 * Error codes (spec Part 1) — a fixed enum the frontend maps to messages.
 * "Never parse error strings." Categories: AUTH_*, PERM_*, VALIDATION_*,
 * NOT_FOUND, CONFLICT_*, PAYMENT_*, EXTERNAL_*, RATE_LIMIT, INTERNAL.
 */

export const ERROR_CODES = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_INVALID: "AUTH_INVALID",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  AUTH_OTP_INVALID: "AUTH_OTP_INVALID",
  AUTH_OTP_EXPIRED: "AUTH_OTP_EXPIRED",
  AUTH_LOCKED: "AUTH_LOCKED",
  AUTH_AUDIENCE: "AUTH_AUDIENCE",

  PERM_DENIED: "PERM_DENIED",
  PERM_REAUTH_REQUIRED: "PERM_REAUTH_REQUIRED",

  VALIDATION_FAILED: "VALIDATION_FAILED",

  NOT_FOUND: "NOT_FOUND",

  CONFLICT_SLOT: "CONFLICT_SLOT",
  CONFLICT_STATE: "CONFLICT_STATE",
  CONFLICT_DUPLICATE: "CONFLICT_DUPLICATE",

  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_SIGNATURE: "PAYMENT_SIGNATURE",

  EXTERNAL_UNAVAILABLE: "EXTERNAL_UNAVAILABLE",

  RATE_LIMIT: "RATE_LIMIT",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401, AUTH_INVALID: 401, AUTH_EXPIRED: 401, AUTH_OTP_INVALID: 401,
  AUTH_OTP_EXPIRED: 401, AUTH_LOCKED: 423, AUTH_AUDIENCE: 403,
  PERM_DENIED: 403, PERM_REAUTH_REQUIRED: 403,
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  CONFLICT_SLOT: 409, CONFLICT_STATE: 409, CONFLICT_DUPLICATE: 409,
  PAYMENT_FAILED: 402, PAYMENT_SIGNATURE: 400,
  EXTERNAL_UNAVAILABLE: 502,
  RATE_LIMIT: 429, SERVICE_UNAVAILABLE: 503, INTERNAL: 500,
};

/** Application error carrying a machine-readable code and optional field detail. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly meta?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, opts: { status?: number; fields?: Record<string, string>; meta?: Record<string, unknown> } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = opts.status ?? DEFAULT_STATUS[code] ?? 500;
    this.fields = opts.fields;
    this.meta = opts.meta;
  }
}

/** Convenience constructors for the common cases. */
export const errors = {
  authRequired: () => new AppError(ERROR_CODES.AUTH_REQUIRED, "Authentication required"),
  authInvalid: (msg = "Invalid credentials") => new AppError(ERROR_CODES.AUTH_INVALID, msg),
  forbidden: (msg = "You don't have permission to do that") => new AppError(ERROR_CODES.PERM_DENIED, msg),
  notFound: (what = "Resource") => new AppError(ERROR_CODES.NOT_FOUND, `${what} not found`),
  validation: (fields: Record<string, string>, msg = "Validation failed") => new AppError(ERROR_CODES.VALIDATION_FAILED, msg, { fields }),
  conflictSlot: (meta: Record<string, unknown>) => new AppError(ERROR_CODES.CONFLICT_SLOT, "That slot is already booked", { meta }),
  conflictState: (msg: string) => new AppError(ERROR_CODES.CONFLICT_STATE, msg),
  duplicate: (msg = "Already exists") => new AppError(ERROR_CODES.CONFLICT_DUPLICATE, msg),
  dbUnavailable: () => new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, "The database is temporarily unavailable"),
  internal: (msg = "Something went wrong") => new AppError(ERROR_CODES.INTERNAL, msg),
};
