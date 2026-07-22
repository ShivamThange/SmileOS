import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ConsoleLayout } from "@/components/layouts/console-layout";
import { AppRoot } from "@/features/dashboard/app-root";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
import { NotFoundScreen } from "@/features/dashboard/not-found-screen";
import { PatientSurfaceSkeleton } from "@/components/common/skeleton";
import { CalendarScreen } from "@/features/appointments/calendar-screen";
import { RecoveryScreen } from "@/features/revenue/recovery-screen";
import { LeadsScreen } from "@/features/leads/leads-screen";
import { PatientsListScreen } from "@/features/patients/patients-list-screen";
import { PatientRecordScreen } from "@/features/patients/patient-record-screen";

/*
 * The public site, patient portal, cost calculator and treatment-plan present
 * view are standalone entry points that don't share the console shell — they're
 * lazily loaded so a receptionist opening the console never downloads them, and
 * a patient opening /plan never downloads the console.
 */
const SiteHome = lazy(() => import("@/features/public-site/site-home").then((m) => ({ default: m.SiteHome })));
const SiteScreen = lazy(() => import("@/features/public-site/site-screen").then((m) => ({ default: m.SiteScreen })));
const PortalHome = lazy(() => import("@/features/portal/portal-home").then((m) => ({ default: m.PortalHome })));
const PortalPlan = lazy(() => import("@/features/portal/portal-plan").then((m) => ({ default: m.PortalPlan })));
const TreatmentPlanScreen = lazy(() => import("@/features/treatment-plan/treatment-plan-screen").then((m) => ({ default: m.TreatmentPlanScreen })));
const CostCalculatorScreen = lazy(() => import("@/features/cost-calculator/cost-calculator-screen").then((m) => ({ default: m.CostCalculatorScreen })));

/*
 * Suspense wrapper for the lazily-loaded standalone surfaces.
 *
 * The fallback is a skeleton shaped like the thing arriving, not the word
 * "Loading…". The plan link is a patient's first impression of the clinic and
 * it should not open on grey text.
 */
const patientSurface = (el: ReactNode) => (
  <Suspense fallback={<PatientSurfaceSkeleton />}>{el}</Suspense>
);
import { PlansListScreen } from "@/features/treatment-plan/plans-list-screen";
import { PlanBuilderScreen } from "@/features/treatment-plan/plan-builder-screen";
import { InvoicesScreen } from "@/features/revenue/invoices-screen";
import { PaymentsScreen } from "@/features/revenue/payments-screen";
import { PendingPaymentsScreen } from "@/features/revenue/pending-payments-screen";
import { ExpensesScreen } from "@/features/revenue/expenses-screen";
import { RecallsScreen } from "@/features/growth/recalls-screen";
import { CampaignsScreen } from "@/features/growth/campaigns-screen";
import { ReviewsScreen } from "@/features/growth/reviews-screen";
import { InboxScreen } from "@/features/growth/inbox-screen";
import { InventoryScreen } from "@/features/operations/inventory-screen";
import { LabScreen } from "@/features/operations/lab-screen";
import { SuppliersScreen } from "@/features/operations/suppliers-screen";
import { StaffScreen } from "@/features/team/staff-screen";
import { AttendanceScreen } from "@/features/team/attendance-screen";
import { AnalyticsScreen } from "@/features/insight/analytics-screen";
import { LeakReportScreen } from "@/features/insight/leak-report-screen";
import { ClinicalQueueScreen } from "@/features/clinical/clinical-queue-screen";
import { ChartingScreen } from "@/features/clinical/charting-screen";
import { PrescriptionsScreen } from "@/features/clinical/prescriptions-screen";
import { WaitlistScreen } from "@/features/appointments/waitlist-screen";
import { CheckinScreen } from "@/features/appointments/checkin-screen";
import { NewPatientScreen } from "@/features/patients/new-patient-screen";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { LoginScreen } from "@/features/auth/login-screen";
import { PortalLogin } from "@/features/portal/portal-login";
import { RequireFeature, RequirePatient, RequireStaff } from "./guards";

export const router = createBrowserRouter([
  { path: "/", element: patientSurface(<SiteScreen />) },
  { path: "/login", element: <LoginScreen /> },
  { path: "/portal/login", element: <PortalLogin /> },
  { path: "/hub", element: patientSurface(<SiteHome />) },
  { path: "/portal", element: <RequirePatient>{patientSurface(<PortalHome />)}</RequirePatient> },
  { path: "/portal/plan/:id", element: <RequirePatient>{patientSurface(<PortalPlan />)}</RequirePatient> },
  { path: "/plan", element: patientSurface(<TreatmentPlanScreen />) },
  { path: "/plan/:id", element: patientSurface(<TreatmentPlanScreen />) },
  { path: "/calculator", element: patientSurface(<CostCalculatorScreen />) },

  {
    path: "/app",
    element: (
      <RequireStaff>
        <ConsoleLayout />
      </RequireStaff>
    ),
    children: [
      /*
       * The front door resolves by role: the desk gets the morning brief, the
       * clinicians get their chair list, accounts get the numbers. "How are we
       * doing" is a destination rather than the door — /app/insight.
       */
      { index: true, element: <AppRoot /> },

      /*
       * Insight resolves to the narrative screen — five sentences, each ending
       * in an action. The financial dashboard is still here, one level down,
       * because "show me the charts" is a real request; it just isn't the first
       * thing anyone should meet when they click Insight.
       */
      { path: "insight", element: <AnalyticsScreen /> },
      { path: "insight/leak", element: <LeakReportScreen /> },
      { path: "insight/dashboard", element: <DashboardScreen /> },
      // Kept so older links and bookmarks still land somewhere sensible.
      { path: "analytics", element: <Navigate to="/app/insight" replace /> },
      { path: "dashboard", element: <Navigate to="/app/insight/dashboard" replace /> },

      // Schedule
      { path: "calendar", element: <CalendarScreen /> },
      { path: "appointments", element: <CalendarScreen /> },
      { path: "waitlist", element: <WaitlistScreen /> },
      { path: "check-in", element: <CheckinScreen /> },

      // Patients
      { path: "patients", element: <PatientsListScreen /> },
      { path: "patients/new", element: <NewPatientScreen /> },
      { path: "patients/:id", element: <PatientRecordScreen /> },

      // Clinical
      { path: "clinical/queue", element: <ClinicalQueueScreen /> },
      { path: "clinical/chart", element: <ChartingScreen /> },
      { path: "clinical/chart/:patientId", element: <ChartingScreen /> },
      { path: "clinical/prescriptions", element: <PrescriptionsScreen /> },

      // Revenue
      { path: "revenue/unscheduled", element: <RecoveryScreen /> },
      { path: "revenue/pending-payments", element: <PendingPaymentsScreen /> },
      { path: "invoices", element: <InvoicesScreen /> },
      { path: "payments", element: <PaymentsScreen /> },
      { path: "expenses", element: <ExpensesScreen /> },
      { path: "treatment-plans", element: <PlansListScreen /> },
      { path: "treatment-plans/:id", element: <PlanBuilderScreen /> },

      // Growth
      { path: "leads", element: <LeadsScreen /> },
      { path: "leads/:id", element: <LeadsScreen /> },
      { path: "recalls", element: <RequireFeature feature="recallEngine"><RecallsScreen /></RequireFeature> },
      { path: "campaigns", element: <CampaignsScreen /> },
      { path: "reviews", element: <RequireFeature feature="reviewRequests"><ReviewsScreen /></RequireFeature> },
      { path: "inbox", element: <RequireFeature feature="whatsapp"><InboxScreen /></RequireFeature> },

      // Operations
      { path: "lab", element: <RequireFeature feature="labTracking"><LabScreen /></RequireFeature> },
      { path: "inventory", element: <RequireFeature feature="inventory"><InventoryScreen /></RequireFeature> },
      { path: "suppliers", element: <RequireFeature feature={["inventory", "labTracking"]}><SuppliersScreen /></RequireFeature> },

      // Team
      { path: "staff", element: <StaffScreen /> },
      { path: "attendance", element: <AttendanceScreen /> },

      // Settings — the section is part of the URL so it can be linked to.
      { path: "settings", element: <SettingsScreen /> },
      { path: "settings/:section", element: <SettingsScreen /> },

      /*
       * An unmatched path inside the console gets a real 404 rather than a
       * silent redirect. Bouncing someone to the front door without explanation
       * reads as the product having lost their page.
       */
      { path: "*", element: <NotFoundScreen /> },
    ],
  },

  { path: "*", element: <Navigate to="/app" replace /> },
]);
