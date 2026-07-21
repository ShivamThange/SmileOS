import { Router } from "express";
import { ok } from "./shared/envelope";

/*
 * API router aggregator (mounted at env.API_PREFIX). Domain module routers are
 * registered here as they are built — auth, clinic, patients, appointments,
 * treatment plans, billing, growth, operations, analytics, portal, public.
 */
export const apiRouter = Router();

apiRouter.get("/", (_req, res) => ok(res, { name: "DentalOS API", version: "v1" }));

// Domain modules mount below as they land:
// apiRouter.use("/auth", authRouter);
// apiRouter.use("/patients", patientRouter);
// ...
