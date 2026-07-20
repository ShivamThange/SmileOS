import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import "@/design/tokens.css";

/*
 * Boot: in production this runs the §8.1 sequence (silent refresh → fetch
 * user + clinic config in parallel → apply brand tokens before first paint →
 * hydrate permissions → register feature-flag-filtered routes). Here we mount
 * the router directly with the static clinic config.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
