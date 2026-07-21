import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query";
import { applyCachedBranding } from "@/lib/branding";
import { AppBoot } from "./app-boot";
import { router } from "./router";
import "@/design/tokens.css";

/*
 * Boot (spec §8.1). AppBoot runs the real sequence: silent refresh → fetch
 * user + clinic in parallel → apply brand tokens → hydrate the session, then
 * render. We re-apply the *cached* branding synchronously here, before the
 * first paint, so a returning user never flashes the default palette.
 */
applyCachedBranding();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppBoot>
        <RouterProvider router={router} />
      </AppBoot>
    </QueryClientProvider>
  </StrictMode>,
);
