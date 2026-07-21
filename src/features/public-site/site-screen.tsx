import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLocalToast, LocalToast } from "@/components/common/local-toast";
import { clinicConfig } from "@/config/clinic";

/*
 * Public Site — the marketing storefront that earns the call (Site.dc.html).
 * Warm, editorial, honest: prices shown before you sit down, sterilisation you
 * can watch, a nervous-patient walkthrough, real dentists with real
 * qualifications. Every CTA routes to booking, WhatsApp, or the calculator —
 * never a dead end.
 */

/** Hatched photo placeholder — real imagery drops in later. */
function Ph({ className, style, children }: { className?: string; style?: React.CSSProperties; children?: ReactNode }) {
  return (
    <div
      className={`grid place-items-center text-[#A79F8E] text-[11px] tracking-[0.02em] text-center leading-[1.4] ${className ?? ""}`}
      style={{ background: "repeating-linear-gradient(135deg,#E7E0D2 0 10px,#EDE7DB 10px 20px)", ...style }}
    >
      {children}
    </div>
  );
}

const OPEN = { dot: "#4E8A75", label: "Open now · until 8:00 pm" };

const NAV = [
  { label: "Treatments", href: "#treatments" },
  { label: "Our dentists", href: "#doctors" },
  { label: "The clinic", href: "#clinic" },
  { label: "Estimate", to: "/calculator" },
];

const CREDIBILITY = [
  { value: "4.9 ★", label: "612 Google reviews" },
  { value: "14 yrs", label: "serving Aundh & Baner" },
  { value: "3", label: "specialists in-house" },
  { value: "9,000+", label: "patients treated" },
];

const TREATMENTS = [
  { name: "Dental implants", glyph: "⌾", desc: "Permanent replacements for missing teeth that look and work like your own.", from: "₹28,000" },
  { name: "Root canal & crowns", glyph: "◉", desc: "Save a painful tooth and protect it with a natural-looking cap.", from: "₹6,500" },
  { name: "Braces & aligners", glyph: "〰", desc: "Straighten teeth with clear aligners or braces, at any age.", from: "₹45,000" },
  { name: "Smile makeover", glyph: "✦", desc: "Veneers and bonding to even out colour, shape and gaps.", from: "₹8,000/tooth" },
  { name: "Full-mouth rehab", glyph: "▦", desc: "Rebuilding a worn or damaged bite, planned over comfortable stages.", from: "₹80,000" },
  { name: "Cleaning & check-ups", glyph: "❋", desc: "Scaling, polishing and a thorough look — the routine that prevents the rest.", from: "₹1,200" },
];

const STEPS = [
  { n: "1", title: "We listen first", body: "Twenty minutes with the dentist — your history, your worries, what you want. No drill comes near you." },
  { n: "2", title: "We show you everything", body: "X-rays on the big screen, findings explained in plain words, and every option with its price — in writing." },
  { n: "3", title: "You decide, not us", body: "Take the plan home. Discuss it with family. Start when you're ready — or don't. Your teeth, your call." },
];

const DOCTORS = [
  { name: "Dr. Anjali Meher", first: "Dr. Meher", role: "Prosthodontist · Founder", creds: "BDS, MDS · 14 yrs", bio: "Leads implants and full-mouth work. Known for taking the time to explain every option.", img: "Portrait — Dr. Meher" },
  { name: "Dr. Rohan Kulkarni", first: "Dr. Kulkarni", role: "Endodontist", creds: "BDS, MDS · 9 yrs", bio: "Root canals and painful teeth — gentle, and fast without rushing.", img: "Portrait — Dr. Kulkarni" },
  { name: "Dr. Sneha Patil", first: "Dr. Patil", role: "Orthodontist", creds: "BDS, MDS · 7 yrs", bio: "Braces and clear aligners for children and adults alike.", img: "Portrait — Dr. Patil" },
];

const ALL_CASES = [
  { cat: "Implants", title: "Two front teeth replaced", detail: "Implants + zirconia crowns · 3 months", before: "worn / missing", after: "restored smile" },
  { cat: "Smile design", title: "Fluorosis stains corrected", detail: "6 E-max veneers · 2 visits", before: "stained teeth", after: "even, bright" },
  { cat: "Braces", title: "Crowding straightened", detail: "Clear aligners · 14 months", before: "crowded", after: "aligned" },
  { cat: "Implants", title: "Full lower arch rebuilt", detail: "All-on-4 implants · 5 months", before: "loose denture", after: "fixed teeth" },
  { cat: "Smile design", title: "Chipped edges rebuilt", detail: "Composite bonding · 1 visit", before: "chipped", after: "natural" },
];
const CASE_CATS = ["All", "Implants", "Smile design", "Braces"];

const REVIEWS = [
  { text: "I'd put off my implant for two years out of fear. Dr. Meher walked me through every step and it was genuinely painless. The clinic is spotless.", initials: "SD", name: "Sunita D.", meta: "Implant · 2 months ago" },
  { text: "They showed me the sterilised instrument pack before opening it. Small thing, but it told me everything about how they work.", initials: "AK", name: "Amit K.", meta: "Root canal · 3 weeks ago" },
  { text: "Honest pricing with a clear EMI plan. No pressure to do more than I needed. My daughter's braces are coming along beautifully.", initials: "PN", name: "Preeti N.", meta: "Braces · 1 month ago" },
];

const STERILE = [
  "Every instrument scrubbed, ultrasonically cleaned, then autoclaved in a sealed, dated pouch.",
  "Pouches are opened in front of you, at the chair — ask us to show you the indicator strip.",
  "Fresh gloves, mask and barrier film for every patient. Water lines flushed daily.",
  "Digital X-rays at a fraction of the radiation of film — with a lead apron, always.",
];

const LOCATION = [
  { icon: "📍", text: "2nd floor, Westend Centre, ITI Road, Aundh, Pune 411007" },
  { icon: "🅿", text: "Free covered parking in the building" },
  { icon: "🚉", text: "5 minutes from Aundh Gaon bus stop" },
  { icon: "☎", text: "020 4890 1234 · +91 98220 10000" },
];

const HOURS: [string, string, boolean][] = [
  ["Mon – Fri", "9:00 am – 8:00 pm", false],
  ["Saturday", "9:00 am – 6:00 pm", false],
  ["Sunday", "Closed", true],
];

const FAQS: [string, string][] = [
  ["How do I know your instruments are sterile?", "Every instrument is scrubbed, sealed in a dated pouch and autoclaved between patients. You're welcome to watch a pack being opened at your chair — we'd rather you saw it than took our word."],
  ["Do you offer instalments for expensive treatment?", "Yes. For implants, braces and full makeovers we offer 0% EMI over 6–12 months through our finance partner, and longer plans if you need them. We'll show you the monthly figure before you decide anything."],
  ["I'm nervous about the dentist. Can you help?", "Very common, and completely okay. Tell us at the start and we'll go slowly, explain each step, and pause whenever you need. We also offer sedation for longer procedures."],
  ["Do you see emergencies on the same day?", "Yes — if you're in pain, call us and we'll fit you in the same day wherever we possibly can. Don't wait it out."],
];

function scrollToBook() {
  const el = document.getElementById("book");
  if (el) window.scrollTo({ top: el.offsetTop - 60, behavior: "smooth" });
}

export function SiteScreen() {
  const { toast, show } = useLocalToast();
  const [caseFilter, setCaseFilter] = useState("All");
  const [faqOpen, setFaqOpen] = useState(0);
  const whatsapp = () => show("Opening WhatsApp — +91 98220 10000");
  const cases = ALL_CASES.filter((c) => caseFilter === "All" || c.cat === caseFilter).slice(0, 3);

  return (
    <div className="font-sans text-[#26241F] bg-[#F3EFE7] pb-[76px]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#E7E0D2]" style={{ background: "rgba(251,249,244,0.92)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-[1140px] mx-auto px-6 py-[13px] flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
            <div className="w-[34px] h-[34px] rounded-[10px] bg-primary text-on-primary grid place-items-center text-base font-bold">{clinicConfig.shortInitial}</div>
            <div>
              <div className="text-[15px] font-semibold tracking-[-0.01em]">{clinicConfig.name}</div>
              <div className="text-[10.5px] text-[#8C887E] tracking-[0.04em]">AUNDH · PUNE</div>
            </div>
          </div>
          <nav className="flex gap-6 text-[13px] font-medium flex-wrap max-sm:hidden">
            {NAV.map((n) => n.to
              ? <Link key={n.label} to={n.to} className="text-muted-strong hover:text-primary no-underline">{n.label}</Link>
              : <a key={n.label} href={n.href} className="text-muted-strong hover:text-primary no-underline">{n.label}</a>)}
          </nav>
          <div onClick={scrollToBook} className="text-[13px] font-semibold px-5 py-2.5 rounded-[10px] bg-primary text-on-primary cursor-pointer hover:bg-primary-hover">Book a visit</div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#FBF9F4] border-b border-[#E7E0D2]">
        <div className="max-w-[1140px] mx-auto px-6 pt-14 pb-[46px] grid gap-12 items-center" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
          <div className="animate-dc-fade-up max-w-[560px]">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-[#E6EEEA] border border-[#CFE0D8] rounded-full px-3.5 py-1.5">
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: OPEN.dot }} />{OPEN.label}
            </div>
            <h1 className="font-serif font-medium leading-[1.06] tracking-[-0.02em] mt-5" style={{ fontSize: "clamp(38px,4.6vw,56px)" }}>
              Dentistry done <em className="italic text-primary">gently</em>, explained honestly.
            </h1>
            <p className="text-[16.5px] leading-relaxed text-muted-strong mt-[18px]">
              Fourteen years of implants, root canals and smile work in Aundh — with prices you see before you sit
              down, and sterilisation you can watch happen.
            </p>
            <div className="flex gap-3 mt-7 flex-wrap">
              <div onClick={scrollToBook} className="text-[15px] font-semibold px-7 py-[15px] rounded-xl bg-primary text-on-primary cursor-pointer hover:bg-primary-hover" style={{ boxShadow: "0 6px 18px rgba(32,97,78,0.22)" }}>Book a visit</div>
              <div onClick={whatsapp} className="text-[15px] font-semibold px-7 py-[15px] rounded-xl border-[1.5px] border-[#D8D1C1] bg-white cursor-pointer hover:border-primary">WhatsApp us</div>
            </div>
            <div className="flex items-center gap-5 mt-[30px] flex-wrap">
              <div className="flex items-center gap-[9px]">
                <span className="text-[#D9A93B] text-sm tracking-[1px]">★★★★★</span>
                <span className="text-[13px] text-muted-strong"><b className="text-[#26241F]">4.9</b> · 612 Google reviews</span>
              </div>
              <span className="w-px h-4 bg-[#DDD6C7]" />
              <span className="text-[13px] text-muted-strong">Same-day appointments for pain</span>
            </div>
          </div>
          <div className="relative max-w-[460px] justify-self-center w-full">
            <Ph className="rounded-[26px] border border-[#E2DCCF]" style={{ aspectRatio: "4/4.6", boxShadow: "0 24px 60px rgba(38,36,31,0.12)" }}>Photo — Dr. Meher with a patient,<br />natural light, real clinic</Ph>
            <div className="absolute top-[22px] -right-3.5 bg-[#FBF9F4] border border-[#E2DCCF] rounded-xl px-3.5 py-2.5" style={{ boxShadow: "0 10px 26px rgba(38,36,31,0.12)", animation: "dc-float 5s ease-in-out infinite" }}>
              <div className="text-[11px] text-[#8C887E]">Next opening</div>
              <div className="text-[13px] font-semibold text-primary">Today, 5:30 pm</div>
            </div>
            <div className="absolute bottom-[22px] -left-[18px] bg-[#FBF9F4] border border-[#E2DCCF] rounded-xl px-4 py-[13px] flex items-center gap-[11px] max-w-[250px]" style={{ boxShadow: "0 10px 30px rgba(38,36,31,0.14)" }}>
              <div className="w-9 h-9 flex-none rounded-[9px] bg-primary-tint text-primary grid place-items-center text-[17px]">✓</div>
              <div><div className="text-[12.5px] font-semibold">Sterilisation you can see</div><div className="text-[11px] text-[#8C887E] leading-[1.4]">Instruments autoclaved, sealed &amp; dated — opened at your chair</div></div>
            </div>
          </div>
        </div>
        <div className="border-t border-[#E7E0D2]">
          <div className="max-w-[1140px] mx-auto px-6 py-[18px] flex items-center justify-between gap-3.5 flex-wrap">
            {CREDIBILITY.map((c) => (
              <div key={c.label} className="flex items-baseline gap-[9px]">
                <span className="font-serif text-[22px] font-semibold tracking-[-0.01em]">{c.value}</span>
                <span className="text-[12.5px] text-[#8C887E]">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Treatments */}
      <section id="treatments" className="max-w-[1140px] mx-auto px-6 pt-16 pb-5">
        <div className="flex items-end justify-between gap-5 flex-wrap mb-7">
          <div>
            <div className="text-xs font-bold tracking-[0.1em] text-warning">WHAT WE DO</div>
            <h2 className="font-serif font-medium mt-2 tracking-[-0.015em]" style={{ fontSize: "clamp(26px,3vw,34px)" }}>Treatments, without the jargon</h2>
          </div>
          <Link to="/calculator" className="text-[13.5px] font-semibold no-underline">What might it cost? →</Link>
        </div>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))" }}>
          {TREATMENTS.map((t) => (
            <div key={t.name} onClick={() => show(`${t.name} — treatment page opens here`)} className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-[22px] pt-[22px] pb-5 cursor-pointer flex flex-col gap-2.5 min-h-[150px] hover:border-primary hover:shadow-card-hover">
              <div className="flex items-center justify-between">
                <div className="w-[42px] h-[42px] rounded-[11px] bg-primary-tint text-primary grid place-items-center text-[19px]">{t.glyph}</div>
                <span className="text-xs text-[#8C887E]">from <b className="text-[#26241F] text-[13px]">{t.from}</b></span>
              </div>
              <div>
                <div className="text-[16.5px] font-semibold">{t.name}</div>
                <div className="text-[13px] text-muted-strong leading-normal mt-1">{t.desc}</div>
              </div>
              <div className="mt-auto text-[13px] font-semibold text-primary">Learn more →</div>
            </div>
          ))}
        </div>
      </section>

      {/* Calculator band */}
      <section className="max-w-[1140px] mx-auto px-6 py-10">
        <div className="bg-primary text-[#F4F1EA] rounded-3xl grid gap-9 items-center relative overflow-hidden" style={{ padding: "clamp(28px,4vw,48px)", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          <div>
            <div className="text-xs font-bold tracking-[0.1em] text-[#9DC7B7]">NO SURPRISES</div>
            <h2 className="font-serif font-medium mt-2.5 mb-3 tracking-[-0.015em] text-[#FBF9F4]" style={{ fontSize: "clamp(26px,3vw,34px)" }}>Know what it might cost before you even call.</h2>
            <p className="text-[15px] leading-relaxed text-[#CFE0D8] m-0 max-w-[460px]">Answer three questions, get an honest range with monthly instalments — shown straight away, no form to fill first.</p>
            <Link to="/calculator" className="inline-flex items-center gap-2 mt-6 text-[15px] font-semibold px-[26px] py-3.5 rounded-xl bg-[#FBF9F4] text-primary no-underline hover:bg-white">Get an estimate →</Link>
          </div>
          <div className="justify-self-center w-full max-w-[330px]">
            <div className="bg-[#FBF9F4] text-[#26241F] rounded-[18px] px-6 py-[22px]" style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.25)", transform: "rotate(1.5deg)" }}>
              <div className="text-[11px] font-bold tracking-[0.08em] text-primary">YOUR ESTIMATE</div>
              <div className="text-[13px] text-[#8C887E] mt-2">Single implant · Premium tier</div>
              <div className="font-serif text-[30px] font-semibold mt-1.5 mb-0.5 tabular-nums">₹38,000 – ₹52,000</div>
              <div className="text-[12.5px] text-primary font-semibold mt-1.5">or from ₹3,200/month at 0%</div>
              <div className="h-px bg-[#EDE7DB] mt-3.5 mb-2.5" />
              <div className="text-[11.5px] text-[#8C887E] leading-normal">A genuine range — the exact figure is settled by an examination, never by a form.</div>
            </div>
          </div>
        </div>
      </section>

      {/* First visit */}
      <section className="max-w-[1140px] mx-auto px-6 pt-[30px] pb-2.5">
        <div className="text-xs font-bold tracking-[0.1em] text-warning">YOUR FIRST VISIT</div>
        <h2 className="font-serif font-medium mt-2 mb-[26px] tracking-[-0.015em]" style={{ fontSize: "clamp(26px,3vw,34px)" }}>Nervous? Here's exactly how it goes.</h2>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-4 bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl px-[22px] py-5">
              <div className="font-serif text-[26px] font-semibold text-[#C9C1AF] flex-none leading-none">{s.n}</div>
              <div>
                <div className="text-[15px] font-semibold">{s.title}</div>
                <div className="text-[13px] text-muted-strong leading-normal mt-1">{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Doctors */}
      <section id="doctors" className="max-w-[1140px] mx-auto px-6 pt-[54px] pb-5">
        <div className="text-xs font-bold tracking-[0.1em] text-warning">WHO'LL TREAT YOU</div>
        <h2 className="font-serif font-medium mt-2 mb-[26px] tracking-[-0.015em]" style={{ fontSize: "clamp(26px,3vw,34px)" }}>Real dentists, real qualifications</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          {DOCTORS.map((d) => (
            <div key={d.name} className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-[18px] overflow-hidden flex flex-col hover:shadow-raised">
              <Ph style={{ height: 210 }}>{d.img}</Ph>
              <div className="px-5 pt-[18px] pb-5 flex flex-col flex-1">
                <div className="text-[17px] font-semibold">{d.name}</div>
                <div className="text-[12.5px] text-primary font-semibold mt-0.5">{d.role}</div>
                <div className="inline-block text-[11.5px] text-muted-strong bg-[#F3EFE7] border border-[#E2DCCF] rounded-[7px] px-2.5 py-[3px] mt-[9px] w-fit font-mono">{d.creds}</div>
                <div className="text-[13px] text-muted-strong leading-normal mt-2.5">{d.bio}</div>
                <div onClick={() => show(`Booking with ${d.name}`)} className="mt-4 text-[13px] font-semibold text-center py-[11px] rounded-[10px] border-[1.5px] border-[#D8D1C1] bg-white cursor-pointer hover:border-primary hover:text-primary">Book with {d.first}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cases */}
      <section className="max-w-[1140px] mx-auto px-6 pt-11 pb-5">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="text-xs font-bold tracking-[0.1em] text-warning">OUR WORK</div>
            <h2 className="font-serif font-medium mt-2 tracking-[-0.015em]" style={{ fontSize: "clamp(26px,3vw,34px)" }}>Before &amp; after — real patients</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {CASE_CATS.map((c) => {
              const sel = caseFilter === c;
              return (
                <div key={c} onClick={() => setCaseFilter(c)} className="text-[12.5px] font-semibold px-4 py-2 rounded-full cursor-pointer hover:border-primary"
                  style={{ border: `1.5px solid ${sel ? "#20614E" : "#D8D1C1"}`, background: sel ? "#20614E" : "#FBF9F4", color: sel ? "#F7F6F3" : "#57534A" }}>{c}</div>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          {cases.map((cs) => (
            <div key={cs.title} className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-2xl overflow-hidden">
              <div className="grid grid-cols-2 gap-0.5">
                <Ph style={{ height: 130, position: "relative" }}><span className="absolute top-2 left-2 text-[9px] font-bold bg-[#26241F]/60 text-white rounded-[5px] px-[7px] py-0.5">BEFORE</span>{cs.before}</Ph>
                <Ph style={{ height: 130, position: "relative" }}><span className="absolute top-2 left-2 text-[9px] font-bold bg-primary text-white rounded-[5px] px-[7px] py-0.5">AFTER</span>{cs.after}</Ph>
              </div>
              <div className="px-[18px] pt-3.5 pb-4">
                <div className="text-[14.5px] font-semibold">{cs.title}</div>
                <div className="text-[12.5px] text-[#8C887E] mt-[3px]">{cs.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="bg-[#FBF9F4] border-y border-[#E7E0D2] mt-[34px]">
        <div className="max-w-[1140px] mx-auto px-6 py-[54px]">
          <div className="text-xs font-bold tracking-[0.1em] text-warning">IN THEIR WORDS</div>
          <h2 className="font-serif font-medium mt-2 mb-[26px] tracking-[-0.015em]" style={{ fontSize: "clamp(26px,3vw,34px)" }}>What our patients say</h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))" }}>
            {REVIEWS.map((r) => (
              <div key={r.name} className="bg-[#F3EFE7] border border-[#E2DCCF] rounded-[18px] p-6 flex flex-col gap-3.5">
                <div className="font-serif text-[34px] leading-[0.5] text-[#C9C1AF] pt-2.5">"</div>
                <p className="m-0 text-[14.5px] leading-relaxed text-[#3D3A33] font-serif">{r.text}</p>
                <div className="flex items-center gap-[11px] mt-auto pt-1.5">
                  <div className="w-[34px] h-[34px] rounded-full bg-primary-tint text-primary grid place-items-center text-xs font-bold">{r.initials}</div>
                  <div><div className="text-[13px] font-semibold">{r.name}</div><div className="text-[11px] text-[#8C887E]">{r.meta}</div></div>
                  <div className="ml-auto text-[#D9A93B] text-[11px] tracking-[1px]">★★★★★</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-[18px] px-5 py-4 bg-[#F3EFE7] border border-[#E2DCCF] rounded-2xl flex-wrap">
            <Ph className="rounded-[10px]" style={{ width: 120, height: 68, flex: "none" }}>▶ video</Ph>
            <div className="flex-1 min-w-[220px]"><div className="text-sm font-semibold">Watch Sunita's implant story</div><div className="text-[12.5px] text-[#8C887E] mt-0.5">Two minutes, in her own words — filmed at the clinic.</div></div>
            <div onClick={() => show("Video plays here — drop the real file in later")} className="text-[13px] font-semibold px-[18px] py-2.5 rounded-[10px] border-[1.5px] border-[#D8D1C1] bg-[#FBF9F4] cursor-pointer hover:border-primary">Play</div>
          </div>
        </div>
      </section>

      {/* Clinic / sterilisation */}
      <section id="clinic" className="max-w-[1140px] mx-auto px-6 pt-[54px] pb-5">
        <div className="grid gap-9 items-center" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
          <div>
            <div className="text-xs font-bold tracking-[0.1em] text-warning">SEE FOR YOURSELF</div>
            <h2 className="font-serif font-medium mt-2 mb-3 tracking-[-0.015em]" style={{ fontSize: "clamp(26px,3vw,34px)" }}>Clean isn't a claim here. It's a process you can watch.</h2>
            <p className="text-[14.5px] text-muted-strong leading-relaxed m-0 mb-[18px]">We know sterilisation is the first thing you'd ask about — it's the first thing we'd ask too.</p>
            <div className="flex flex-col gap-[11px]">
              {STERILE.map((s) => (
                <div key={s} className="flex gap-3 items-start">
                  <div className="w-[22px] h-[22px] flex-none rounded-md bg-primary-tint text-primary grid place-items-center text-xs font-bold">✓</div>
                  <div className="text-[13.5px] text-[#3D3A33] leading-normal">{s}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-2.5 h-[340px]" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
            <Ph className="rounded-2xl" style={{ gridRow: "span 2" }}>Photo — treatment room,<br />natural light</Ph>
            <Ph className="rounded-2xl">Photo — autoclave &amp;<br />sterilisation bay</Ph>
            <Ph className="rounded-2xl">Photo — sealed<br />instrument packs</Ph>
          </div>
        </div>
      </section>

      {/* Location + hours */}
      <section className="max-w-[1140px] mx-auto px-6 pt-11 pb-2.5 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        <div className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-[18px] overflow-hidden">
          <Ph style={{ height: 170 }}>Map — Westend Centre, Aundh</Ph>
          <div className="px-[22px] py-5">
            <div className="font-serif text-xl font-medium">Finding us</div>
            <div className="flex flex-col gap-2.5 mt-3.5">
              {LOCATION.map((l) => (
                <div key={l.text} className="flex gap-[11px] text-[13.5px]"><span className="text-primary flex-none w-4">{l.icon}</span><span className="text-[#3D3A33] leading-normal">{l.text}</span></div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-[18px] px-6 py-[22px]">
          <div className="font-serif text-xl font-medium">Opening hours</div>
          <div className="flex flex-col mt-2.5">
            {HOURS.map(([day, time, closed], i) => (
              <div key={day} className="flex justify-between py-2 text-[13.5px]" style={{ borderBottom: i < HOURS.length - 1 ? "1px solid #EDE7DB" : "none" }}>
                <span style={{ fontWeight: closed ? 600 : 500, color: "#26241F" }}>{day}</span>
                <span className="tabular-nums" style={{ color: closed ? "#A8342A" : "#3D3A33" }}>{time}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-[9px] mt-4 px-[15px] py-3 bg-[#E6EEEA] border border-[#CFE0D8] rounded-[11px]">
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: OPEN.dot }} />
            <span className="text-[13px] font-semibold text-primary">{OPEN.label}</span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[820px] mx-auto px-6 pt-11 pb-2.5">
        <h2 className="font-serif font-medium m-0 mb-[18px] tracking-[-0.015em]" style={{ fontSize: "clamp(24px,2.6vw,30px)" }}>Questions people ask</h2>
        <div className="flex flex-col gap-2.5">
          {FAQS.map(([q, a], i) => {
            const open = faqOpen === i;
            return (
              <div key={q} onClick={() => setFaqOpen(open ? -1 : i)} className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-xl px-[22px] py-[17px] cursor-pointer hover:border-[#CFC8B8]">
                <div className="flex justify-between items-center gap-3">
                  <span className="text-[15px] font-semibold">{q}</span>
                  <span className="text-lg text-[#8C887E] flex-none transition-transform" style={{ transform: open ? "rotate(45deg)" : "none" }}>＋</span>
                </div>
                {open && <p className="mt-[11px] mb-0 text-[13.5px] leading-relaxed text-muted-strong">{a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Booking */}
      <section id="book" className="max-w-[1140px] mx-auto px-6 pt-11 pb-[50px]">
        <div className="bg-[#FBF9F4] border border-[#E2DCCF] rounded-3xl grid gap-[34px] items-center" style={{ padding: "clamp(26px,4vw,44px)", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          <div>
            <h2 className="font-serif font-medium m-0 tracking-[-0.015em]" style={{ fontSize: "clamp(26px,3vw,34px)" }}>Book a visit</h2>
            <p className="text-[14.5px] text-muted-strong leading-relaxed mt-2.5 max-w-[400px]">Tell us a little and we'll call to confirm a time that suits you. In pain? Call us — same-day appointments are usually available.</p>
            <div className="flex gap-4 mt-5 flex-wrap text-[13.5px] text-[#3D3A33]"><span>☎ 020 4890 1234</span><span>✆ +91 98220 10000</span></div>
          </div>
          <div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
              <Field label="Your name"><input placeholder="Full name" className="font-sans text-sm px-3.5 py-3 border-[1.5px] border-[#D8D1C1] rounded-[11px] bg-white outline-none focus:border-primary" /></Field>
              <Field label="Phone"><input placeholder="10-digit mobile" className="font-sans text-sm px-3.5 py-3 border-[1.5px] border-[#D8D1C1] rounded-[11px] bg-white outline-none focus:border-primary" /></Field>
              <Field label="What's it about?">
                <select className="font-sans text-sm px-3.5 py-3 border-[1.5px] border-[#D8D1C1] rounded-[11px] bg-white outline-none focus:border-primary">
                  <option>General check-up</option><option>Pain / emergency</option><option>Implants</option><option>Braces / aligners</option><option>Smile makeover</option>
                </select>
              </Field>
              <Field label="Preferred day"><input placeholder="e.g. this Saturday" className="font-sans text-sm px-3.5 py-3 border-[1.5px] border-[#D8D1C1] rounded-[11px] bg-white outline-none focus:border-primary" /></Field>
            </div>
            <div onClick={() => show("Thank you — we'll call you shortly to confirm.")} className="mt-4 text-center text-[15px] font-semibold py-[15px] rounded-xl bg-primary text-on-primary cursor-pointer hover:bg-primary-hover">Request my appointment</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E7E0D2]">
        <div className="max-w-[1140px] mx-auto px-6 py-[26px] flex justify-between items-center gap-4 flex-wrap text-[12.5px] text-[#8C887E]">
          <div className="flex items-center gap-[9px]"><div className="w-6 h-6 rounded-[7px] bg-primary text-on-primary grid place-items-center text-xs font-bold">{clinicConfig.shortInitial}</div>{clinicConfig.name} · Westend Centre, ITI Road, Aundh, Pune</div>
          <div>Dental Council of India Reg. · © 2026</div>
        </div>
      </footer>

      {/* Mobile sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex gap-2.5 px-4 py-3 max-w-[560px] mx-auto" style={{ background: "linear-gradient(to top,#F3EFE7 60%,rgba(243,239,231,0))" }}>
        <div onClick={() => show("Calling the clinic — 020 4890 1234")} className="flex-1 text-center text-sm font-semibold py-[13px] rounded-xl border-[1.5px] border-[#D8D1C1] bg-[#FBF9F4] cursor-pointer hover:border-primary" style={{ boxShadow: "0 4px 14px rgba(38,36,31,0.08)" }}>Call now</div>
        <div onClick={whatsapp} className="flex-1 text-center text-sm font-semibold py-[13px] rounded-xl bg-primary text-on-primary cursor-pointer hover:bg-primary-hover" style={{ boxShadow: "0 4px 14px rgba(38,36,31,0.14)" }}>WhatsApp us</div>
      </div>

      <LocalToast toast={toast} bottom={82} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-muted-strong">{label}</label>
      {children}
    </div>
  );
}
