import { ApiError } from "./errors";
import { session } from "./session";
import type { Envelope, Pagination } from "./types";

/*
 * The one HTTP client (spec §6.2). Every component reaches the API through this
 * — nobody builds a URL or calls fetch directly. It owns:
 *   • base URL + versioned prefix
 *   • the access token (Authorization) and clinic context (X-Clinic-Slug) headers
 *   • credentials:'include' so the httpOnly refresh cookie flows
 *   • envelope unwrapping → typed data, or a thrown ApiError with a machine code
 *   • one silent /auth/refresh on a 401, then retry; failing that → login
 *   • a bounded retry of idempotent GETs on transient network failure
 */

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api/v1";

export interface RequestOptions {
  /** Query params; undefined/null values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** JSON request body. */
  body?: unknown;
  /** Extra headers. */
  headers?: Record<string, string>;
  /** Skip attaching the Authorization header (public endpoints). */
  skipAuth?: boolean;
  /** Treat as idempotent → retried on transient network failure. GET defaults true. */
  idempotent?: boolean;
  /** AbortSignal for cancellation (TanStack Query passes this). */
  signal?: AbortSignal;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** The full parsed success envelope, for callers that need pagination/message. */
export interface ApiResult<T> {
  data: T;
  pagination?: Pagination;
  message?: string;
}

// A single in-flight refresh shared across concurrent 401s.
let refreshPromise: Promise<boolean> | null = null;

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = path.startsWith("http") ? path : `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}${url.includes("?") ? "&" : "?"}${s}` : url;
}

async function attemptRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(buildUrl("/auth/refresh"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) return false;
        const env = (await res.json()) as Envelope<{ accessToken: string }>;
        if (env.success && env.data?.accessToken) {
          session.setAccessToken(env.data.accessToken);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        // Cleared on the next tick so all awaiters observe the same result first.
        setTimeout(() => (refreshPromise = null), 0);
      }
    })();
  }
  return refreshPromise;
}

async function doFetch<T>(method: Method, path: string, opts: RequestOptions, isRetry: boolean): Promise<ApiResult<T>> {
  const isIdempotent = opts.idempotent ?? method === "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Clinic-Slug": session.getClinicSlug(),
    ...opts.headers,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const token = session.getAccessToken();
  if (token && !opts.skipAuth) headers["Authorization"] = `Bearer ${token}`;

  const url = buildUrl(path, opts.query);
  const init: RequestInit = {
    method,
    headers,
    credentials: "include",
    signal: opts.signal,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  };

  // ── Network layer: retry idempotent requests on transient failure ──────────
  let res: Response;
  const maxNetworkAttempts = isIdempotent ? 3 : 1;
  let networkAttempt = 0;
  for (;;) {
    try {
      res = await fetch(url, init);
      break;
    } catch (err) {
      networkAttempt += 1;
      if ((err as Error).name === "AbortError") throw err;
      if (networkAttempt >= maxNetworkAttempts) throw ApiError.network();
      await new Promise((r) => setTimeout(r, 150 * networkAttempt));
    }
  }

  // 204 / empty body
  if (res.status === 204) return { data: undefined as T };

  let env: Envelope<T>;
  try {
    env = (await res.json()) as Envelope<T>;
  } catch {
    if (res.ok) return { data: undefined as T };
    throw new ApiError("INTERNAL", `Unexpected response (${res.status})`, res.status);
  }

  if (res.ok && env.success) {
    return { data: env.data as T, pagination: env.pagination, message: env.message };
  }

  const error = env.error ?? { code: "INTERNAL" as const, message: `Request failed (${res.status})` };

  // ── Auth layer: one silent refresh + retry on an expired/again-required token ─
  const isAuthEndpoint = path.startsWith("/auth/");
  if (
    !isRetry &&
    !opts.skipAuth &&
    !isAuthEndpoint &&
    (error.code === "AUTH_EXPIRED" || error.code === "AUTH_REQUIRED")
  ) {
    const refreshed = await attemptRefresh();
    if (refreshed) return doFetch<T>(method, path, opts, true);
    session.handleUnauthorized();
  }

  throw ApiError.fromBody(error, res.status);
}

/** Core request returning the full success envelope (data + pagination + message). */
export function requestWithMeta<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  return doFetch<T>(method, path, opts, false);
}

/** Core request returning just the unwrapped data — the common case. */
async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  return (await doFetch<T>(method, path, opts, false)).data;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts),

  /** Paginated GET — returns data plus the pagination block. */
  getPage: <T>(path: string, opts?: RequestOptions) => requestWithMeta<T>("GET", path, opts),
};

export { BASE as API_BASE };
