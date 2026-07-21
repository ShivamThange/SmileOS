import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ConsoleLayout } from "@/components/layouts/console-layout";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
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
const TreatmentPlanScreen = lazy(() => import("@/features/treatment-plan/treatment-plan-screen").then((m) => ({ default: m.TreatmentPlanScreen })));
const CostCalculatorScreen = lazy(() => import("@/features/cost-calculator/cost-calculator-screen").then((m) => ({ default: m.CostCalculatorScreen })));

/** Suspense wrapper for the lazily-loaded standalone surfaces. */
const patientSurface = (el: ReactNode) => (
  <Suspense fallback={<div className="min-h-screen grid place-items-center bg-[#EFEBE3] text-[13px] text-[#8C887E] font-sans">Loading…</div>}>
    {el}
  </Suspense>
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
import { ClinicalQueueScreen } from "@/features/clinical/clinical-queue-screen";
import { PrescriptionsScreen } from "@/features/clinical/prescriptions-screen";
import { WaitlistScreen } from "@/features/appointments/waitlist-screen";
import { CheckinScreen } from "@/features/appointments/checkin-screen";
import { NewPatientScreen } from "@/features/patients/new-patient-screen";
import { SettingsScreen } from "@/features/settings/settings-screen";

export const router = createBrowserRouter([
  { path: "/", element: patientSurface(<SiteScreen />) },
  { path: "/hub", element: patientSurface(<SiteHome />) },
  { path: "/portal", element: patientSurface(<PortalHome />) },
  { path: "/plan", element: patientSurface(<TreatmentPlanScreen />) },
  { path: "/plan/:id", element: patientSurface(<TreatmentPlanScreen />) },
  { path: "/calculator", element: patientSurface(<CostCalculatorScreen />) },

  {
    path: "/app",
    element: <ConsoleLayout />,
    children: [
      { index: true, element: <DashboardScreen /> },

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
      { path: "recalls", element: <RecallsScreen /> },
      { path: "campaigns", element: <CampaignsScreen /> },
      { path: "reviews", element: <ReviewsScreen /> },
      { path: "inbox", element: <InboxScreen /> },

      // Operations
      { path: "lab", element: <LabScreen /> },
      { path: "inventory", element: <InventoryScreen /> },
      { path: "suppliers", element: <SuppliersScreen /> },

      // Team
      { path: "staff", element: <StaffScreen /> },
      { path: "attendance", element: <AttendanceScreen /> },

      // Insight
      { path: "analytics", element: <AnalyticsScreen /> },

      // Settings
      { path: "settings", element: <SettingsScreen /> },
      { path: "settings/*", element: <SettingsScreen /> },

      { path: "*", element: <Navigate to="/app" replace /> },
    ],
  },

  { path: "*", element: <Navigate to="/app" replace /> },
]);
