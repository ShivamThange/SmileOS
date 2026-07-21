import { Router } from "express";
import { ok } from "./shared/envelope";
import { authRouter } from "./modules/auth/auth.routes";

/*
 * API router aggregator (mounted at env.API_PREFIX). Domain module routers are
 * registered here as they are built — auth, clinic, patients, appointments,
 * treatment plans, billing, growth, operations, analytics, portal, public.
 */
export const apiRouter = Router();

apiRouter.get("/", (_req, res) => ok(res, { name: "DentalOS API", version: "v1" }));

apiRouter.use("/auth", authRouter);

// Further domain modules mount below as they land:
// apiRouter.use("/patients", patientRouter);
// ...
