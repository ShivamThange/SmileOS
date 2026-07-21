import { Router } from "express";
import { ok } from "./shared/envelope";
import { authRouter } from "./modules/auth/auth.routes";
import { clinicRouter } from "./modules/clinic/clinic.routes";
import { patientRouter } from "./modules/patient/patient.routes";

/*
 * API router aggregator (mounted at env.API_PREFIX). Domain module routers are
 * registered here as they are built — auth, clinic, patients, appointments,
 * treatment plans, billing, growth, operations, analytics, portal, public.
 */
export const apiRouter = Router();

apiRouter.get("/", (_req, res) => ok(res, { name: "DentalOS API", version: "v1" }));

apiRouter.use("/auth", authRouter);
apiRouter.use("/clinic", clinicRouter);
apiRouter.use("/patients", patientRouter);

// Further domain modules mount below as they land.
