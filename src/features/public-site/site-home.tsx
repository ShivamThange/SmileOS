import { Link } from "react-router-dom";
import { clinicConfig } from "@/config/clinic";

/*
 * Entry hub — mirrors the design project's DentalOS.dc.html landing: one
 * identity, three faces. The public Site and patient Portal are designed in
 * the Claude Design project (Site/Calculator/TreatmentPlan/Portal.dc.html) but
 * are out of scope for this Console-first pass, so they link through as
 * "coming next" rather than being invented here.
 */
const groups = [
  {
    label: "THE CONSOLE — staff back-office",
    items: [
      { to: "/app", glyph: "▦", title: "Owner dashboard", desc: "Money at risk first, then the day's picture, charts and chairs.", bg: "#EAF1EE", live: true },
      { to: "/app/revenue/unscheduled", glyph: "☎", title: "Recovery worklist", desc: "Advised care that never got scheduled — a call list, sorted by value.", bg: "#EAF1EE", live: true },
      { to: "/app/calendar", glyph: "▤", title: "Calendar", desc: "Chairs across, time down, drag to move. Waitlist on the side.", bg: "#EAF1EE", live: true },
      { to: "/app/patients/p1", glyph: "◉", title: "Patient record & tooth chart", desc: "Persistent header, unmissable allergies, and the odontogram.", bg: "#EAF1EE", live: true },
      { to: "/app/leads", glyph: "▨", title: "Leads pipeline", desc: "Enquiries you drag from new to converted. Sources & response time.", bg: "#EAF1EE", live: true },
    ],
  },
  {
    label: "THE PATIENT — decisions & self-service",
    items: [
      { to: "/portal", glyph: "⌂", title: "Patient portal", desc: "Next visit, what's owed, plans awaiting a decision — phone-shaped.", bg: "#F0E9DB", live: false },
    ],
  },
];

export function SiteHome() {
  return (
    <div className="min-h-screen bg-bg text-ink flex justify-center px-5">
      <div className="w-full max-w-[1000px] py-[52px] pb-20">
        <div className="flex items-center gap-3 animate-dc-fade-up">
          <div className="w-11 h-11 rounded-lg bg-primary text-on-primary grid place-items-center text-xl font-bold">
            {clinicConfig.shortInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold tracking-[0.1em] text-primary uppercase">
              DentalOS · a working prototype
            </div>
            <h1 className="font-serif text-[30px] font-medium mt-0.5 tracking-[-0.01em] leading-tight">
              {clinicConfig.name}
            </h1>
          </div>
        </div>
        <p className="text-[15px] text-muted-strong leading-relaxed max-w-[600px] mt-[18px]">
          One operating system, three faces — the public site that earns a call, the console
          reception lives in, and the portal a patient carries in their pocket. This pass ships
          the Console in full; every screen below is real and clickable.
        </p>

        {groups.map((g) => (
          <div key={g.label} className="mt-[38px]">
            <div className="text-xs font-bold tracking-[0.08em] text-muted-2 mb-3.5">{g.label}</div>
            <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
              {g.items.map((it) => (
                <Link
                  key={it.title}
                  to={it.to}
                  className="block bg-surface border border-border rounded-xl overflow-hidden no-underline text-inherit hover:border-primary hover:shadow-raised transition-all"
                >
                  <div className="h-28 relative grid place-items-center" style={{ background: it.bg }}>
                    <div className="text-[30px] opacity-90">{it.glyph}</div>
                    <span
                      className="absolute top-2.5 left-3 text-[10px] font-bold tracking-[0.05em] rounded-[5px] px-1.5 py-0.5"
                      style={{ color: it.live ? "#20614E" : "#9A6215", background: it.live ? "#F4F3EF" : "#FAF3E7" }}
                    >
                      {it.live ? "LIVE" : "NEXT"}
                    </span>
                  </div>
                  <div className="px-4 pt-3.5 pb-4">
                    <div className="text-[15px] font-semibold">{it.title}</div>
                    <div className="text-[12.5px] text-muted leading-normal mt-0.5">{it.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-10 px-[22px] py-[18px] bg-surface border border-border rounded-xl text-[12.5px] text-muted leading-relaxed">
          <b className="text-ink">A note on the mock data.</b> Names, ₹ figures, procedures and
          schedules are realistic but invented. Inside the console, press{" "}
          <span className="font-mono bg-bg border border-border rounded-sm px-1.5 py-px">⌘K</span>{" "}
          for the command palette.
        </div>
      </div>
    </div>
  );
}
