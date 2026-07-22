import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { isApiError } from "@/lib/api";
import { useLocalToast, LocalToast } from "@/components/common/local-toast";
import { getAvailability, bookAppointment, type DaySlots } from "./api";

/*
 * Online booking (spec 5.3 / T4.2). A patient picks a real open slot — derived
 * from the clinic's working hours and existing appointments — then confirms with
 * their details, and it becomes a real appointment. Warm and low-friction: three
 * steps on one page, no account required. A confirmed slot is the conversion;
 * the site's "request a callback" form remains the softer alternative.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TREATMENTS = ["General check-up", "Pain / emergency", "Cleaning", "Implants", "Braces / aligners", "Smile makeover", "Root canal"];

function fmtDayLabel(date: string): { dow: string; day: string; mon: string } {
  const d = new Date(`${date}T00:00:00`);
  return { dow: WEEKDAYS[d.getDay()], day: String(d.getDate()), mon: MONTHS[d.getMonth()] };
}
function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function BookingScreen() {
  const clinic = useAuth((s) => s.clinic);
  const navigate = useNavigate();
  const { toast, show } = useLocalToast();

  const [days, setDays] = useState<DaySlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", treatment: TREATMENTS[0] });
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{ when: string } | null>(null);

  useEffect(() => {
    let alive = true;
    getAvailability({ days: 21 })
      .then((d) => {
        if (!alive) return;
        setDays(d);
        const firstOpen = d.find((x) => x.count > 0);
        setActiveDate(firstOpen?.date ?? d[0]?.date ?? null);
      })
      .catch(() => alive && setLoadError(true))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const active = useMemo(() => days.find((d) => d.date === activeDate) ?? null, [days, activeDate]);
  const setField = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function confirm() {
    if (busy || !activeDate || !slot) return;
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (name.length < 2 || phone.replace(/\D/g, "").length < 10) {
      show("Please add your name and a 10-digit mobile number.");
      return;
    }
    setBusy(true);
    try {
      const start = new Date(`${activeDate}T${slot}:00`).toISOString();
      await bookAppointment({ name, phone, email: form.email.trim() || undefined, start, treatment: form.treatment });
      const d = new Date(start);
      setConfirmed({ when: `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} · ${to12h(slot)}` });
    } catch (err) {
      const msg = isApiError(err) && err.code === "CONFLICT_SLOT"
        ? "That slot was just taken — please pick another."
        : "Couldn't confirm the booking. Please try another slot or call us.";
      show(msg);
      // A taken slot: refresh availability so the grid reflects reality.
      if (isApiError(err) && err.code === "CONFLICT_SLOT") {
        getAvailability({ days: 21 }).then(setDays).catch(() => undefined);
        setSlot(null);
      }
    } finally {
      setBusy(false);
    }
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-[#F3EFE7] font-sans text-[#26241F] grid place-items-center px-4">
        <div className="max-w-[440px] w-full bg-[#FBF9F4] border border-[#E2DCCF] rounded-3xl p-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-primary text-on-primary grid place-items-center text-2xl">✓</div>
          <h1 className="font-serif text-[26px] font-medium m-0">You're booked in</h1>
          <p className="text-[15px] text-[#3D3A33] mt-2">{confirmed.when}</p>
          <p className="text-[13.5px] text-muted-strong mt-3 leading-relaxed">
            We've held your slot at {clinic?.name ?? "the clinic"}. A confirmation is on its way to your phone. Please arrive 10 minutes early.
          </p>
          <div className="flex flex-col gap-2 mt-6">
            <Link to="/portal/login" className="text-[14px] font-semibold px-5 py-3 rounded-xl bg-primary text-on-primary no-underline">Access your patient portal</Link>
            <Link to="/" className="text-[13px] font-medium text-muted-strong no-underline hover:text-primary">← Back to {clinic?.name ?? "home"}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3EFE7] font-sans text-[#26241F]">
      <header className="sticky top-0 z-30 border-b border-[#E7E0D2]" style={{ background: "rgba(251,249,244,0.92)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-[840px] mx-auto px-6 py-3.5 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 no-underline text-[#26241F]">
            <div className="w-[34px] h-[34px] rounded-[10px] bg-primary text-on-primary grid place-items-center text-base font-bold">{(clinic?.name ?? "D").slice(0, 1)}</div>
            <div className="text-[15px] font-semibold tracking-[-0.01em]">{clinic?.name ?? "DentalOS"}</div>
          </Link>
          <div className="flex-1" />
          <Link to="/portal/login" className="text-[13px] font-medium text-muted-strong no-underline hover:text-primary">Patient login</Link>
        </div>
      </header>

      <div className="max-w-[840px] mx-auto px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="font-serif font-medium m-0 tracking-[-0.015em]" style={{ fontSize: "clamp(26px,3vw,34px)" }}>Book a visit</h1>
          <p className="text-[14.5px] text-muted-strong mt-1.5">Pick a time that suits you — these are real openings. In pain? <Link to="/" className="text-primary font-semibold no-underline">Call us</Link> for a same-day slot.</p>
        </div>

        {/* Step 1 — day */}
        <section>
          <div className="text-[11px] font-bold tracking-[0.07em] text-[#8C887E] mb-2.5">1 · CHOOSE A DAY</div>
          {loading ? (
            <div className="text-[13px] text-muted-2 py-6">Loading available days…</div>
          ) : loadError ? (
            <div className="text-[13px] text-danger py-6">Couldn't load availability. Please call us on 020 4890 1234.</div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => {
                const { dow, day, mon } = fmtDayLabel(d.date);
                const sel = d.date === activeDate;
                const open = d.count > 0;
                return (
                  <button
                    key={d.date}
                    disabled={!open}
                    onClick={() => { setActiveDate(d.date); setSlot(null); }}
                    className="flex-none w-[62px] rounded-xl border-[1.5px] py-2.5 text-center transition-colors disabled:opacity-40"
                    style={{ background: sel ? "#20614E" : "#FBF9F4", color: sel ? "#F7F6F3" : "#26241F", borderColor: sel ? "#20614E" : "#E2DCCF" }}
                  >
                    <div className="text-[11px]" style={{ color: sel ? "#9DC7B7" : "#8C887E" }}>{dow}</div>
                    <div className="text-[17px] font-bold leading-tight">{day}</div>
                    <div className="text-[10px]" style={{ color: sel ? "#9DC7B7" : "#8C887E" }}>{mon}</div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 2 — slot */}
        {active && (
          <section>
            <div className="text-[11px] font-bold tracking-[0.07em] text-[#8C887E] mb-2.5">2 · CHOOSE A TIME</div>
            {active.count === 0 ? (
              <div className="text-[13px] text-muted-2">No openings this day — try another.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {(["morning", "afternoon", "evening"] as const).map((part) =>
                  active.slots[part].length ? (
                    <div key={part}>
                      <div className="text-[11.5px] font-semibold text-muted-strong capitalize mb-1.5">{part}</div>
                      <div className="flex gap-2 flex-wrap">
                        {active.slots[part].map((s) => (
                          <button
                            key={s}
                            onClick={() => setSlot(s)}
                            className="px-3.5 py-2 rounded-lg border-[1.5px] text-[13px] font-semibold transition-colors"
                            style={slot === s ? { background: "#20614E", color: "#F7F6F3", borderColor: "#20614E" } : { background: "#FBF9F4", borderColor: "#D8D1C1" }}
                          >
                            {to12h(s)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </section>
        )}

        {/* Step 3 — details */}
        {slot && (
          <section className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl p-5">
            <div className="text-[11px] font-bold tracking-[0.07em] text-[#8C887E] mb-3">3 · YOUR DETAILS</div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
              <Field label="Your name"><input value={form.name} onChange={setField("name")} placeholder="Full name" className={FIELD} /></Field>
              <Field label="Phone"><input value={form.phone} onChange={setField("phone")} inputMode="tel" placeholder="10-digit mobile" className={FIELD} /></Field>
              <Field label="Email (optional)"><input value={form.email} onChange={setField("email")} placeholder="name@email.com" className={FIELD} /></Field>
              <Field label="What's it about?">
                <select value={form.treatment} onChange={setField("treatment")} className={FIELD}>
                  {TREATMENTS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <div
              onClick={confirm}
              aria-disabled={busy}
              className="mt-4 text-center text-[15px] font-semibold py-[15px] rounded-xl bg-primary text-on-primary cursor-pointer hover:bg-primary-hover aria-disabled:opacity-60"
            >
              {busy ? "Confirming…" : `Confirm ${activeDate ? fmtDayLabel(activeDate).dow : ""} ${to12h(slot)}`}
            </div>
          </section>
        )}
      </div>

      <LocalToast toast={toast} bottom={24} />
    </div>
  );
}

const FIELD = "font-sans text-sm px-3.5 py-3 border-[1.5px] border-[#D8D1C1] rounded-[11px] bg-white outline-none focus:border-primary w-full";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-strong">{label}</span>
      {children}
    </label>
  );
}
