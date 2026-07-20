import { createBrowserRouter, Navigate } from "react-router-dom";
import { ConsoleLayout } from "@/components/layouts/console-layout";
import { PlaceholderScreen } from "@/components/common/placeholder-screen";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
import { CalendarScreen } from "@/features/appointments/calendar-screen";
import { RecoveryScreen } from "@/features/revenue/recovery-screen";
import { LeadsScreen } from "@/features/leads/leads-screen";
import { PatientsListScreen } from "@/features/patients/patients-list-screen";
import { PatientRecordScreen } from "@/features/patients/patient-record-screen";
import { SiteHome } from "@/features/public-site/site-home";
import { SiteScreen } from "@/features/public-site/site-screen";
import { PortalHome } from "@/features/portal/portal-home";
import { TreatmentPlanScreen } from "@/features/treatment-plan/treatment-plan-screen";
import { CostCalculatorScreen } from "@/features/cost-calculator/cost-calculator-screen";
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

/** Placeholder route element — the design's own pattern for undesigned screens. */
const stub = (
  title: string,
  body: string,
  cta = "Back to dashboard",
  icon: Parameters<typeof PlaceholderScreen>[0]["icon"] = "revenue",
) => <PlaceholderScreen icon={icon} title={title} body={body} cta={cta} ctaTo="/app" />;

export const router = createBrowserRouter([
  { path: "/", element: <SiteScreen /> },
  { path: "/hub", element: <SiteHome /> },
  { path: "/portal", element: <PortalHome /> },
  { path: "/plan", element: <TreatmentPlanScreen /> },
  { path: "/plan/:id", element: <TreatmentPlanScreen /> },
  { path: "/calculator", element: <CostCalculatorScreen /> },

  {
    path: "/app",
    element: <ConsoleLayout />,
    children: [
      { index: true, element: <DashboardScreen /> },

      // Schedule
      { path: "calendar", element: <CalendarScreen /> },
      { path: "appointments", element: <CalendarScreen /> },
      { path: "waitlist", element: stub("Waitlist", "Patients waiting for an earlier slot. Slot them into a freed cancellation gap with one action.", "Open calendar", "schedule") },
      { path: "check-in", element: stub("Check-in", "Today's arrivals and one-tap check-in for the front desk.", "Open calendar", "schedule") },

      // Patients
      { path: "patients", element: <PatientsListScreen /> },
      { path: "patients/new", element: stub("New patient", "Create a patient record — the patient number is generated automatically.", "Back to list", "patients") },
      { path: "patients/:id", element: <PatientRecordScreen /> },

      // Clinical
      { path: "clinical/queue", element: stub("Clinical queue", "Today's chairside worklist — checked-in patients in order, with waiting times and incomplete notes to finish.", "Back to dashboard", "clinical") },
      { path: "clinical/prescriptions", element: stub("Prescriptions", "Write, sign and send prescriptions with a drug interaction and allergy cross-check.", "Back to dashboard", "clinical") },

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
      { path: "settings", element: stub("Settings", "Clinic details, branding, fees and templates. A rebrand should take an hour, not a week.", "Back to dashboard", "settings") },
      { path: "settings/*", element: stub("Settings", "Clinic details, branding, fees and templates. A rebrand should take an hour, not a week.", "Back to dashboard", "settings") },

      { path: "*", element: <Navigate to="/app" replace /> },
    ],
  },

  { path: "*", element: <Navigate to="/app" replace /> },
]);
