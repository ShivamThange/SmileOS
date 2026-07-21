import type { ApiErrorBody, ClientErrorCode } from "./types";

/*
 * The single error type the client throws. Components catch `ApiError` and
 * switch on `.code` — they never inspect `.message` to decide behaviour (spec
 * §6.2). `.message` is a safe default string; prefer `messageForCode` for copy.
 */
export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly meta?: Record<string, unknown>;

  constructor(code: ClientErrorCode, message: string, status: number, opts: { fields?: Record<string, string>; meta?: Record<string, unknown> } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = opts.fields;
    this.meta = opts.meta;
  }

  static fromBody(body: ApiErrorBody, status: number): ApiError {
    return new ApiError(body.code, body.message, status, { fields: body.fields, meta: body.meta });
  }

  static network(message = "Could not reach the server"): ApiError {
    return new ApiError("NETWORK", message, 0);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/*
 * Default user-facing copy per code. Feature screens can override with more
 * specific wording, but this guarantees no raw/parsed string ever reaches a
 * user. Field-level validation detail lives on `error.fields`, mapped per form.
 */
const CODE_MESSAGES: Record<ClientErrorCode, string> = {
  AUTH_REQUIRED: "Please sign in to continue.",
  AUTH_INVALID: "Your session is no longer valid. Please sign in again.",
  AUTH_EXPIRED: "Your session has expired. Please sign in again.",
  AUTH_OTP_INVALID: "That code isn't right. Check it and try again.",
  AUTH_OTP_EXPIRED: "That code has expired. Request a new one.",
  AUTH_LOCKED: "Too many attempts. This account is locked for a short while.",
  AUTH_AUDIENCE: "This account can't access that area.",
  PERM_DENIED: "You don't have permission to do that.",
  PERM_REAUTH_REQUIRED: "Please confirm your identity to continue.",
  VALIDATION_FAILED: "Some details need fixing.",
  NOT_FOUND: "We couldn't find that.",
  CONFLICT_SLOT: "That time slot is no longer available.",
  CONFLICT_STATE: "That action isn't possible in the current state.",
  CONFLICT_DUPLICATE: "A record with those details already exists.",
  PAYMENT_FAILED: "The payment could not be completed.",
  PAYMENT_SIGNATURE: "We couldn't verify that payment. Please try again.",
  EXTERNAL_UNAVAILABLE: "A connected service is temporarily unavailable.",
  RATE_LIMIT: "Too many requests. Please wait a moment and try again.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable. Please try again shortly.",
  INTERNAL: "Something went wrong on our end. Please try again.",
  NETWORK: "You appear to be offline. Check your connection and try again.",
};

export function messageForCode(code: ClientErrorCode): string {
  return CODE_MESSAGES[code] ?? CODE_MESSAGES.INTERNAL;
}

/** Convenience for catch blocks: the best user-facing message for any thrown value. */
export function messageForError(err: unknown): string {
  if (isApiError(err)) return messageForCode(err.code);
  return CODE_MESSAGES.INTERNAL;
}
