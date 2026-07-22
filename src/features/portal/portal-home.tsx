import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLocalToast, LocalToast } from "@/components/common/local-toast";
import { clinicConfig } from "@/config/clinic";
import { usePatientSession } from "@/hooks/use-patient-session";
import { session } from "@/lib/api";
import { logout as apiLogout } from "@/features/auth/api";
import { inr } from "@/lib/format";
import { usePortalMe, usePortalDashboard, usePortalAppointments } from "./queries";

/*
 * Patient Portal home (spec 4.14) — the at-home experience, now wired to the
 * real `/portal/*` endpoints (identity strictly from the patient token). Next
 * visit, balance, a plan awaiting the patient's unhurried decision, quick tiles
 * and recent visits — all from the patient's own records, never mock data.
 */

interface Sheet { title: string; body: string; cta: string; }

const TABS: [string, string, string][] = [
  ["home", "Home", "⌂"],
  ["records", "Records", "▧"],
  ["messages", "Messages", "✉"],
  ["profile", "Profile", "◐"],
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "•";
}
function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning," : h < 17 ? "Good afternoon," : "Good evening,";
}
function relativeDays(when: Date): string {
  const days = Math.round((new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime() - new Date(new Date().setHours(0, 0, 0, 0)).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
function fmtVisitTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  const time = `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} · ${time}`;
}
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PortalHome() {
  const { toast, show } = useLocalToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState("home");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const openSheet = (title: string, body: string, cta = "Got it") => setSheet({ title, body, cta });

  const sessionPatient = usePatientSession((s) => s.patient);
  const me = usePortalMe();
  const dash = usePortalDashboard();
  const appts = usePortalAppointments();

  const name = me.data?.name ?? sessionPatient?.name ?? "";
  const initials = name ? initialsOf(name) : "•";
  const next = dash.data?.nextVisit ?? null;
  const balancePaise = dash.data?.balancePaise ?? 0;
  const pendingPlan = dash.data?.pendingPlans?.[0] ?? null;
  // Past, completed-or-done visits, most recent first.
  const pastVisits = (appts.data ?? [])
    .filter((a) => new Date(a.start) < new Date())
    .slice(0, 6);

  async function handleSignOut() {
    await apiLogout(); // best-effort server-side revoke
    session.clear();
    usePatientSession.getState().clear();
    navigate("/", { replace: true });
  }

  const tiles = [
    { label: "My records", sub: "X-rays, notes, reports", glyph: "▧", go: () => openSheet("Your records", "Your X-rays, treatment notes and lab reports, all in one place. Tap any image to view it full-screen with zoom.", "Close") },
    { label: "Messages", sub: "Chat with the clinic", glyph: "✉", go: () => openSheet("Messages", "Message the clinic directly — questions about your treatment, timings, or anything at all. We usually reply within a couple of hours during clinic time.", "Close") },
    { label: "Payments", sub: "Bills & receipts", glyph: "₹", go: () => openSheet("Payments", "Every invoice, payment and instalment in one place. Download a receipt any time — useful for insurance or reimbursement.", "Close") },
    { label: "Book a visit", sub: "New appointment", glyph: "🗓", go: () => openSheet("Book a visit", "Tell us what it's about and pick a rough time. We'll confirm the exact slot by WhatsApp within the hour.", "Continue") },
  ];

  return (
    <div className="min-h-screen font-sans text-[#26241F] bg-[#EFEBE3] flex justify-center">
      <div className="w-full max-w-[1080px] bg-[#F3EFE7] min-h-screen flex flex-col relative">
        {/* Header */}
        <div className="px-5 pt-[26px] pb-3.5 flex items-center gap-3 flex-wrap">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-primary text-on-primary grid place-items-center text-base font-bold flex-none">{clinicConfig.shortInitial}</div>
          <div className="flex-1">
            <div className="text-[13px] text-[#8C887E]">{greeting()}</div>
            <div className="text-[17px] font-semibold tracking-[-0.01em]">{name || (me.isLoading ? "…" : "there")}</div>
          </div>
          <div className="flex gap-1.5 bg-[#FBF9F4] border border-[#E2DCCF] rounded-xl p-1 max-sm:hidden">
            {TABS.map(([id, label, glyph]) => {
              const sel = tab === id;
              return (
                <div key={id} onClick={() => { setTab(id); if (id !== "home") show(`${label} — full section opens here`); }}
                  className="flex items-center gap-[7px] px-3.5 py-2 rounded-[9px] cursor-pointer"
                  style={{ background: sel ? "#20614E" : "transparent", color: sel ? "#F7F6F3" : "#8C887E" }}>
                  <span className="text-sm">{glyph}</span>
                  <span className="text-[12.5px]" style={{ fontWeight: sel ? 700 : 500 }}>{label}</span>
                </div>
              );
            })}
          </div>
          <div onClick={() => openSheet("Your profile", "Contact details, medical history and notification settings live here. You can update your phone number and how we reach you.", "Close")}
            className="w-[38px] h-[38px] rounded-full bg-primary-tint text-primary grid place-items-center text-[13px] font-bold cursor-pointer border border-primary-tint-border">{initials}</div>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 pt-1.5 pb-[50px] grid gap-3.5 items-start" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
          {/* Next visit */}
          {next ? (
            <div className="bg-primary text-[#F4F1EA] rounded-[18px] px-[26px] py-[22px] animate-dc-fade-up col-span-full flex flex-col">
              <div className="flex justify-between items-baseline">
                <span className="text-[11.5px] font-semibold tracking-[0.06em] text-[#9DC7B7]">YOUR NEXT VISIT</span>
                <span className="text-[11.5px] text-[#9DC7B7]">{relativeDays(new Date(next.start))}</span>
              </div>
              <div className="font-serif text-[23px] font-medium mt-2 mb-0.5">{fmtVisitTime(next.start)}</div>
              {next.detail && <div className="text-sm text-[#CFE0D8]">{next.detail}</div>}
              <div className="flex gap-[9px] mt-4 flex-wrap">
                <div onClick={() => show(`Opening map — ${clinicConfig.name}`)} className="text-center text-[13px] font-semibold px-[22px] py-2.5 rounded-[10px] bg-white/15 text-[#F4F1EA] cursor-pointer hover:bg-white/25">Directions</div>
                <div onClick={() => openSheet("Reschedule your visit", "We'll show you the clinic's open slots this week and next. Pick one that suits you and we'll confirm by WhatsApp.", "Close")} className="text-center text-[13px] font-semibold px-[22px] py-2.5 rounded-[10px] bg-[#FBF9F4] text-primary cursor-pointer hover:bg-white">Reschedule</div>
              </div>
            </div>
          ) : (
            <div className="bg-primary text-[#F4F1EA] rounded-[18px] px-[26px] py-[22px] animate-dc-fade-up col-span-full">
              <span className="text-[11.5px] font-semibold tracking-[0.06em] text-[#9DC7B7]">NO UPCOMING VISIT</span>
              <div className="font-serif text-[21px] font-medium mt-2">{dash.isLoading ? "Loading…" : "You're all caught up"}</div>
              <div className="text-sm text-[#CFE0D8] mt-0.5">Book whenever you're ready — we'll confirm by WhatsApp.</div>
            </div>
          )}

          {/* Owed — only when there is a real outstanding balance */}
          {balancePaise > 0 && (
            <div className="bg-[#FBF9F4] border border-[#E4C9A0] rounded-2xl px-5 py-[18px] animate-dc-fade-up">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs text-warning font-semibold tracking-[0.04em]">TO PAY</div>
                  <div className="font-serif text-[26px] font-semibold mt-0.5 tabular-nums">{inr(balancePaise)}</div>
                  <div className="text-[12.5px] text-[#8C887E] mt-px">Outstanding balance on your account</div>
                </div>
                <div onClick={() => openSheet(`Pay ${inr(balancePaise)}`, "Pay securely by UPI, card or net-banking. A receipt is sent to you the moment it clears. You can also pay at the desk on your next visit.", "Close")} className="text-sm font-semibold px-[22px] py-3 rounded-[11px] bg-primary text-on-primary cursor-pointer hover:bg-primary-hover">Pay now</div>
              </div>
            </div>
          )}

          {/* Plan awaiting decision — from the patient's real pending plans */}
          {pendingPlan && (
            <div className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-5 py-[18px] animate-dc-fade-up">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#D9A93B]" />
                <span className="text-xs font-semibold text-warning tracking-[0.04em]">AWAITING YOUR DECISION</span>
              </div>
              <div className="text-[15.5px] font-semibold">{pendingPlan.title || "Your treatment plan"}</div>
              <div className="text-[13px] text-muted-strong leading-snug mt-1">Your dentist has prepared a plan for you. Review it whenever you're ready — there's no rush.</div>
              <Link to={`/portal/plan/${pendingPlan.id}`} className="block text-center text-sm font-semibold py-3 rounded-[11px] bg-primary text-on-primary mt-3.5 no-underline hover:bg-primary-hover">View my plan</Link>
            </div>
          )}

          {/* Quick tiles */}
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((t) => (
              <div key={t.label} onClick={t.go} className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-4 pt-4 pb-[18px] cursor-pointer relative hover:border-primary">
                <div className="w-9 h-9 rounded-[10px] bg-primary-tint text-primary grid place-items-center text-[17px]">{t.glyph}</div>
                <div className="text-[14.5px] font-semibold mt-[11px]">{t.label}</div>
                <div className="text-xs text-[#8C887E] mt-px">{t.sub}</div>
              </div>
            ))}
          </div>

          {/* Recent visits — from the patient's real appointment history */}
          <div className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-5 py-4">
            <div className="text-[13px] font-semibold mb-3">Recent visits</div>
            {appts.isLoading ? (
              <div className="text-[13px] text-[#8C887E] py-2">Loading your visits…</div>
            ) : pastVisits.length === 0 ? (
              <div className="text-[13px] text-[#8C887E] py-2">No past visits yet.</div>
            ) : (
              <div className="flex flex-col">
                {pastVisits.map((v, i) => (
                  <div key={v._id} className="flex gap-3 py-2.5" style={{ borderBottom: i < pastVisits.length - 1 ? "1px solid #EDE7DB" : "none" }}>
                    <div className="text-[11px] text-[#8C887E] font-mono w-12 flex-none pt-px">{shortDate(v.start)}</div>
                    <div className="flex-1">
                      <div className="text-[13.5px] font-medium">{v.chiefComplaint || titleCase(v.type || "Visit")}</div>
                      <div className="text-xs text-[#8C887E]">{titleCase(v.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spine back to the storefront — the Portal is one end of the funnel,
             not a dead end; a patient can always step back to the public site. */}
          <div className="col-span-full flex items-center justify-between gap-4 flex-wrap pt-1 text-[12.5px] text-[#8C887E]">
            <Link to="/" className="no-underline text-[#8C887E] hover:text-primary">← {clinicConfig.name} website</Link>
            <button onClick={handleSignOut} className="text-[#8C887E] hover:text-primary">Sign out</button>
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      {sheet && (
        <div className="fixed inset-0 z-[60] bg-[#26241F]/40 flex items-end justify-center animate-dc-fade" onClick={() => setSheet(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[460px] bg-[#FBF9F4] rounded-t-[20px] px-6 pt-6 pb-[30px]" style={{ animation: "dc-sheet .22s cubic-bezier(.2,.8,.2,1)" }}>
            <div className="w-[38px] h-1 rounded-sm bg-[#DBD5C7] mx-auto mb-[18px]" />
            <div className="font-serif text-[22px] font-medium">{sheet.title}</div>
            <p className="text-sm text-muted-strong leading-relaxed my-2.5 mb-5">{sheet.body}</p>
            <div onClick={() => setSheet(null)} className="text-center text-sm font-semibold py-[13px] rounded-xl bg-primary text-on-primary cursor-pointer hover:bg-primary-hover">{sheet.cta}</div>
          </div>
        </div>
      )}

      <LocalToast toast={toast} bottom={88} />
    </div>
  );
}
