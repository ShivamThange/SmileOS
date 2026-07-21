import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/lib/api";

/*
 * The shared QueryClient (spec §6.1). Retry policy is aware of our typed errors:
 * a 4xx (auth, permission, validation, not-found, conflict) is never worth
 * retrying — only transient network / 5xx are. The api client already retries
 * idempotent GETs at the fetch layer, so this is a small additional cushion.
 */

const RETRYABLE_MAX = 2;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (isApiError(error)) {
          // Retry only network failures and 5xx; never client errors.
          if (error.code === "NETWORK" || error.status >= 500) return failureCount < RETRYABLE_MAX;
          return false;
        }
        return failureCount < RETRYABLE_MAX;
      },
    },
    mutations: {
      // Mutations are not auto-retried — a retried POST can double-write. Opt in
      // per-mutation only where the endpoint is idempotent.
      retry: false,
    },
  },
});
