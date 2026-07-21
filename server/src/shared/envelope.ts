import type { Response } from "express";
import type { ErrorCode } from "./errors";

/*
 * Response envelope (spec Part 1). Every endpoint returns this shape — never a
 * bare array — so metadata can be added later without breaking the client.
 */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
  meta?: Record<string, unknown>;
}

export interface Envelope<T> {
  success: boolean;
  data: T | null;
  message?: string;
  pagination?: Pagination;
  error?: ApiError;
}

export function ok<T>(res: Response, data: T, opts: { message?: string; pagination?: Pagination; status?: number } = {}): Response {
  const body: Envelope<T> = { success: true, data, ...(opts.message ? { message: opts.message } : {}), ...(opts.pagination ? { pagination: opts.pagination } : {}) };
  return res.status(opts.status ?? 200).json(body);
}

export function created<T>(res: Response, data: T, message?: string): Response {
  return ok(res, data, { message, status: 201 });
}

export function fail(res: Response, status: number, error: ApiError): Response {
  const body: Envelope<null> = { success: false, data: null, error };
  return res.status(status).json(body);
}
