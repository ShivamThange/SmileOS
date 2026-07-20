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
      { path: "revenue/pending-payments", element: stub("Pending payments", "Outstanding receivables with ageing buckets — ₹64,200 under 30 days · ₹48,250 older.", "Back to dashboard") },
      { path: "invoices", element: stub("Invoices", "Invoices, payments, instalment schedules and the day's collections will live here. Three bills are awaiting payment.", "Back to dashboard") },
      { path: "payments", element: stub("Payments", "A chronological ledger of money received, daily close-of-day reconciliation, and refunds.", "Back to dashboard") },
      { path: "expenses", element: stub("Expenses", "Track clinic expenses so profitability reports tell the whole story.", "Back to dashboard") },
      { path: "treatment-plans", element: <PlansListScreen /> },
      { path: "treatment-plans/:id", element: <PlanBuilderScreen /> },

      // Growth
      { path: "leads", element: <LeadsScreen /> },
      { path: "leads/:id", element: <LeadsScreen /> },
      { path: "recalls", element: stub("Recalls", "Patients due or overdue for a recall — hygiene, ortho, implant review, post-op. Segment and run bulk WhatsApp campaigns.", "Back to dashboard", "growth") },
      { path: "campaigns", element: stub("Campaigns", "Recall, reactivation, recovery and promotional campaigns with per-recipient outcomes and attributed revenue.", "Back to dashboard", "growth") },
      { path: "reviews", element: stub("Reviews", "Ask a private rating first, route satisfied patients to Google, and catch unhappy ones for service recovery.", "Back to dashboard", "growth") },
      { path: "inbox", element: stub("Unified inbox", "Every WhatsApp, SMS and email conversation in one three-pane view with the linked patient in context.", "Back to dashboard", "growth") },

      // Operations
      { path: "lab", element: stub("Lab tracking", "Lab work in transit and stock levels. Two items are below their reorder point.", "Back to dashboard", "operations") },
      { path: "inventory", element: stub("Inventory", "Item stock, reorder levels, expiry and value, with low-stock and near-expiry alerts.", "Back to dashboard", "operations") },
      { path: "suppliers", element: stub("Suppliers", "Dental supplies, labs and equipment vendors with terms and ratings.", "Back to dashboard", "operations") },

      // Team
      { path: "staff", element: stub("Team", "Doctors, staff, rosters and permissions.", "Back to dashboard", "team") },
      { path: "attendance", element: stub("Attendance", "Staff check-in / check-out log and hours.", "Back to dashboard", "team") },

      // Insight
      { path: "analytics", element: stub("Insight", "Reports with a consistent frame: filters, one chart, the table behind it, and an export.", "Back to dashboard", "insight") },

      // Settings
      { path: "settings", element: stub("Settings", "Clinic details, branding, fees and templates. A rebrand should take an hour, not a week.", "Back to dashboard", "settings") },
      { path: "settings/*", element: stub("Settings", "Clinic details, branding, fees and templates. A rebrand should take an hour, not a week.", "Back to dashboard", "settings") },

      { path: "*", element: <Navigate to="/app" replace /> },
    ],
  },

  { path: "*", element: <Navigate to="/app" replace /> },
]);
