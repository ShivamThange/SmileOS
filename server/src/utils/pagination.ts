import type { Request } from "express";
import type { Pagination } from "../shared/envelope";

/*
 * Pagination + sort parsing (spec Part 4). Every list endpoint accepts
 * page/limit/sort/order and returns the same pagination block.
 */

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

export function parsePageParams(req: Request, opts: { defaultSort?: string; defaultLimit?: number; maxLimit?: number } = {}): PageParams {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const maxLimit = opts.maxLimit ?? 100;
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(req.query.limit ?? String(opts.defaultLimit ?? 25)), 10) || 25));
  const sortField = String(req.query.sort ?? opts.defaultSort ?? "createdAt");
  const order: 1 | -1 = String(req.query.order ?? "desc").toLowerCase() === "asc" ? 1 : -1;
  return { page, limit, skip: (page - 1) * limit, sort: { [sortField]: order } };
}

export function buildPagination(page: number, limit: number, total: number): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}
