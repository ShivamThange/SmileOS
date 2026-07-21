import { Router } from "express";
import { ok } from "./shared/envelope";
import { authRouter } from "./modules/auth/auth.routes";
import { clinicRouter } from "./modules/clinic/clinic.routes";
import { procedureRouter } from "./modules/procedure/procedure.routes";
import { patientRouter } from "./modules/patient/patient.routes";
import { appointmentRouter } from "./modules/appointment/appointment.routes";
import { treatmentPlanRouter, planItemRouter, revenueRouter } from "./modules/treatment-plan/treatment-plan.routes";
import { invoiceRouter, paymentRouter, expenseRouter } from "./modules/billing/billing.routes";
import { leadRouter, recallRouter } from "./modules/growth/growth.routes";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { publicRouter } from "./modules/public/public.routes";
import { portalRouter } from "./modules/portal/portal.routes";

/*
 * API router aggregator (mounted at env.API_PREFIX). Domain module routers are
 * registered here as they are built — auth, clinic, patients, appointments,
 * treatment plans, billing, growth, operations, analytics, portal, public.
 */
export const apiRouter = Router();

apiRouter.get("/", (_req, res) => ok(res, { name: "DentalOS API", version: "v1" }));

apiRouter.use("/auth", authRouter);
apiRouter.use("/clinic", clinicRouter);
apiRouter.use("/procedures", procedureRouter);
apiRouter.use("/patients", patientRouter);
apiRouter.use("/appointments", appointmentRouter);
apiRouter.use("/treatment-plans", treatmentPlanRouter);
apiRouter.use("/treatment-plan-items", planItemRouter);
apiRouter.use("/revenue", revenueRouter);
apiRouter.use("/invoices", invoiceRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/expenses", expenseRouter);
apiRouter.use("/leads", leadRouter);
apiRouter.use("/recalls", recallRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/public", publicRouter);
apiRouter.use("/portal", portalRouter);

// Further domain modules mount below as they land.
