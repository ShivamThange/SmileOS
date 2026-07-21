/*
 * The API layer's public surface. Import from `@/lib/api`:
 *   import { api, ApiError, isApiError, messageForError, session } from "@/lib/api";
 *
 * Feature endpoint functions live beside their feature (features/<name>/api.ts)
 * and call `api.get/post/…` from here. Nothing else builds URLs or calls fetch.
 */
export { api, requestWithMeta, API_BASE } from "./client";
export type { RequestOptions, ApiResult } from "./client";
export { ApiError, isApiError, messageForCode, messageForError } from "./errors";
export { session } from "./session";
export { API_ERROR_CODES } from "./types";
export type { Envelope, Pagination, ApiErrorBody, ApiErrorCode, ClientErrorCode } from "./types";
