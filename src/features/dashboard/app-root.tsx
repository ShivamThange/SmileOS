import { useSession, rootForRole } from "@/hooks/use-session";
import { MorningBriefScreen } from "./morning-brief-screen";
import { ClinicalDayScreen } from "./clinical-day-screen";
import { DashboardScreen } from "./dashboard-screen";

/*
 * What `/app` is.
 *
 * The router already knows who is signed in and what their role is, so the
 * front door does not need a settings toggle — it simply renders the screen
 * that matches the job. The receptionist opens this two hundred and fifty
 * times a year at 9:15am and gets a briefing; the dentist gets her chair list;
 * the accountant gets the numbers.
 *
 * The financial dashboard is still reachable directly at /app/insight, because
 * "how are we doing" is a real question — just not the one that should greet
 * the person who opens the console most.
 */
export function AppRoot() {
  const { user } = useSession();

  switch (rootForRole(user.role)) {
    case "clinical":
      return <ClinicalDayScreen />;
    case "dashboard":
      return <DashboardScreen />;
    default:
      return <MorningBriefScreen />;
  }
}
