import type { Request, Response } from "express";
import type { Model, FilterQuery } from "mongoose";
import { ok } from "./envelope";
import { parsePageParams, buildPagination } from "../utils/pagination";

/*
 * List helper — runs a tenant-scoped, paginated find and returns the standard
 * envelope with a pagination block. Clinic scoping is injected here so no list
 * endpoint can forget it.
 */
export async function paginate<T>(
  req: Request,
  res: Response,
  modelRef: Model<T>,
  filter: FilterQuery<T>,
  opts: { defaultSort?: string; populate?: string[]; select?: string; maxLimit?: number; transform?: (rows: T[]) => unknown } = {},
): Promise<Response> {
  const { page, limit, skip, sort } = parsePageParams(req, { defaultSort: opts.defaultSort, maxLimit: opts.maxLimit });
  const scoped = { ...filter, clinicId: req.clinicId } as FilterQuery<T>;

  let query = modelRef.find(scoped).sort(sort).skip(skip).limit(limit);
  if (opts.select) query = query.select(opts.select);
  for (const p of opts.populate ?? []) query = query.populate(p);

  const [rows, total] = await Promise.all([query.lean(), modelRef.countDocuments(scoped)]);
  const data = opts.transform ? opts.transform(rows as T[]) : rows;
  return ok(res, data, { pagination: buildPagination(page, limit, total) });
}
