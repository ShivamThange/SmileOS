import { Router } from "express";
import { ok } from "./shared/envelope";
import { authRouter } from "./modules/auth/auth.routes";
import { clinicRouter } from "./modules/clinic/clinic.routes";
import { procedureRouter } from "./modules/procedure/procedure.routes";
import { clinicalRouter } from "./modules/clinical/clinical.routes";
import { patientRouter } from "./modules/patient/patient.routes";
import { appointmentRouter } from "./modules/appointment/appointment.routes";
import { waitlistRouter } from "./modules/appointment/waitlist.routes";
import { treatmentPlanRouter, planItemRouter, revenueRouter } from "./modules/treatment-plan/treatment-plan.routes";
import { invoiceRouter, paymentRouter, expenseRouter } from "./modules/billing/billing.routes";
import { leadRouter, recallRouter } from "./modules/growth/growth.routes";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { analyticsReportsRouter } from "./modules/analytics/reports.routes";
import { auditRouter, complianceRouter } from "./modules/compliance/compliance.routes";
import { publicRouter } from "./modules/public/public.routes";
import { portalRouter } from "./modules/portal/portal.routes";
import { inventoryRouter, supplierRouter, purchaseOrderRouter, labCaseRouter } from "./modules/operations/operations.routes";
import { conversationRouter, templateRouter, automationRuleRouter, notificationRouter } from "./modules/communication/communication.routes";
import { userRouter, attendanceRouter } from "./modules/user/user.routes";
import { contentRouter, publicContentRouter } from "./modules/content/content.routes";
import { campaignRouter, reviewRouter, publicReviewRouter } from "./modules/reputation/reputation.routes";

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
apiRouter.use("/", clinicalRouter);
apiRouter.use("/patients", patientRouter);
apiRouter.use("/appointments", appointmentRouter);
apiRouter.use("/waitlist", waitlistRouter);
apiRouter.use("/treatment-plans", treatmentPlanRouter);
apiRouter.use("/treatment-plan-items", planItemRouter);
apiRouter.use("/revenue", revenueRouter);
apiRouter.use("/invoices", invoiceRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/expenses", expenseRouter);
apiRouter.use("/leads", leadRouter);
apiRouter.use("/recalls", recallRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/analytics", analyticsReportsRouter);
apiRouter.use("/audit-logs", auditRouter);
apiRouter.use("/compliance", complianceRouter);
apiRouter.use("/public", publicRouter);
apiRouter.use("/portal", portalRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/suppliers", supplierRouter);
apiRouter.use("/purchase-orders", purchaseOrderRouter);
apiRouter.use("/lab-cases", labCaseRouter);
apiRouter.use("/conversations", conversationRouter);
apiRouter.use("/templates", templateRouter);
apiRouter.use("/automation-rules", automationRuleRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/attendance", attendanceRouter);
apiRouter.use("/content", contentRouter);
apiRouter.use("/public/content", publicContentRouter);
apiRouter.use("/campaigns", campaignRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/public/reviews", publicReviewRouter);

// Further domain modules mount below as they land.
