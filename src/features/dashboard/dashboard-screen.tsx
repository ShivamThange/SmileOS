import { useNavigate } from "react-router-dom";
import { Panel, MicroLabel } from "@/components/ui/card";
import { StatCard } from "@/components/common/stat-card";
import { Meter } from "@/components/common/meter";
import { inrFromRupees } from "@/lib/format";
import { clinicConfig } from "@/config/clinic";
import { collections30 } from "@/lib/mock-data";
import { chartGreens } from "@/design/status";

const MONTH_TARGET = 900000;

const riskCards = [
  { value: 482600, label: "Diagnosed, never scheduled", sub: "23 patients with advised care unscheduled — oldest 38 days", cta: "Open worklist", to: "/app/revenue/unscheduled", divider: true },
  { value: 186000, label: "Overdue to return", sub: "41 patients past their recall date", cta: "See patients", to: "/app/recalls", divider: true },
  { value: 112450, label: "Unpaid bills", sub: "₹64,200 under 30 days · ₹48,250 older", cta: "Open ageing", to: "/app/revenue/pending-payments", divider: false },
];

const inClinic = [
  { name: "Asha Kulkarni", where: "Chair 2 · Dr. Meher", since: "11:30" },
  { name: "Rohit Deshpande", where: "Chair 1 · Dr. Kulkarni", since: "11:15" },
  { name: "Kavita Rane", where: "Waiting · Dr. Patil", since: "11:40" },
];

const revRows: [string, number, number][] = [
  ["Root canal & crowns", 228000, 100],
  ["Implants", 196000, 86],
  ["Ortho & aligners", 147000, 64],
  ["Dentures & rehab", 114000, 50],
  ["Preventive", 73000, 32],
  ["Other", 57000, 25],
];

const docRows: [string, number, number][] = [
  ["Dr. Anjali Meher", 342000, 100],
  ["Dr. Rohan Kulkarni", 288500, 84],
  ["Dr. Sneha Patil", 181800, 53],
];

const leadSegs: [string, number, string][] = [
  ["Google", 42, chartGreens[0]],
  ["Referral", 28, chartGreens[1]],
  ["Walk-in", 19, chartGreens[2]],
  ["Instagram", 11, chartGreens[3]],
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

export function DashboardScreen() {
  const navigate = useNavigate();
  const monthPct = Math.round((684500 / MONTH_TARGET) * 100);
  const maxBar = Math.max(...collections30);

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-4">
      {/* Greeting */}
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="m-0 text-lg font-semibold tracking-[-0.01em]">
            Good morning, {clinicConfig.ownerName.replace("Dr. Anjali ", "Dr. ")}
          </h1>
          <div className="text-[12.5px] text-muted mt-0.5">
            Here is how the practice stands today.
          </div>
        </div>
        <div className="text-xs text-muted-2">Compared with the previous 30 days</div>
      </div>

      {/* Money at risk + Today */}
      <div className="grid grid-cols-[2fr_1fr] gap-3.5 items-stretch max-lg:grid-cols-1">
        <section
          className="rounded-lg p-[18px] flex flex-col justify-between gap-3.5"
          style={{ background: "var(--warning-panel)", border: "1px solid var(--warning-border)" }}
        >
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-warning flex-none" />
              <span className="text-[11px] font-bold tracking-[0.09em] text-warning">
                MONEY AT RISK
              </span>
            </div>
            <div className="text-[22px] font-bold tnum tracking-[-0.02em]">
              {inrFromRupees(781050)}
            </div>
          </div>
          <div className="grid grid-cols-3">
            {riskCards.map((rc) => (
              <button
                key={rc.label}
                onClick={() => navigate(rc.to)}
                className="text-left pr-[18px] mr-[18px] flex flex-col gap-1.5 justify-between hover:opacity-75 transition-opacity"
                style={{ borderRight: rc.divider ? "1px solid var(--warning-border)" : "none" }}
              >
                <div className="text-[32px] font-bold tnum tracking-[-0.025em]">
                  {inrFromRupees(rc.value)}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-[13px] font-semibold text-ink">{rc.label}</div>
                  <div className="text-xs text-muted leading-relaxed">{rc.sub}</div>
                </div>
                <div className="text-[12.5px] font-semibold text-primary mt-2">{rc.cta} →</div>
              </button>
            ))}
          </div>
        </section>

        <Panel className="p-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <MicroLabel>TODAY</MicroLabel>
            <button
              onClick={() => navigate("/app/calendar")}
              className="text-xs font-semibold text-primary"
            >
              Open calendar →
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tnum">18</span>
            <span className="text-[12.5px] text-muted">appointments · 6 done · 1 no-show</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-[11.5px] font-semibold text-muted">In the clinic now</div>
            {inClinic.map((ic) => (
              <div key={ic.name} className="flex items-center gap-2 text-[12.5px]">
                <span className="w-[7px] h-[7px] rounded-full bg-primary flex-none" />
                <span className="font-semibold">{ic.name}</span>
                <span className="text-muted-2 flex-1">{ic.where}</span>
                <span className="text-muted font-mono text-[11px]">{ic.since}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-1.5">
            <div className="flex justify-between text-[11.5px] text-muted">
              <span>Chairs occupied right now</span>
              <span className="font-semibold text-ink">3 of 4</span>
            </div>
            <Meter value={75} height={6} />
          </div>
        </Panel>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-5 gap-3.5 max-lg:grid-cols-2">
        <StatCard label="Collected today" value={inrFromRupees(42300)} delta="+12%" sub="vs last Monday" onClick={() => navigate("/app/payments")} />
        <StatCard label="Collected this month" value={inrFromRupees(684500)} delta={`${monthPct}%`} deltaTone="warn" sub={`of ${inrFromRupees(MONTH_TARGET)} target`} barPct={monthPct} onClick={() => navigate("/app/payments")} />
        <StatCard label="Work performed" value={inrFromRupees(812300)} delta="+9%" sub="vs last month" onClick={() => navigate("/app/analytics")} />
        <StatCard label="New patients" value="34" delta="+6" sub="vs last month" onClick={() => navigate("/app/leads")} />
        <StatCard label="Chair utilisation" value="72%" delta="−3 pts" deltaTone="down" sub="vs last month" onClick={() => navigate("/app/analytics")} />
      </div>

      {/* Collections + revenue mix */}
      <div className="grid grid-cols-[2fr_1fr] gap-3.5 max-lg:grid-cols-1">
        <Panel className="p-4 flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <span className="text-[13px] font-semibold">Collections · last 30 days</span>
            <span className="text-xs text-muted">Daily, ₹ thousands · Sundays closed</span>
          </div>
          <div className="flex items-end gap-1 h-[120px]">
            {collections30.map((v, i) => {
              const d = new Date(2026, 5, 21 + i);
              const tip = `${d.getDate()} ${MONTHS[d.getMonth()]} — ${v === 0 ? "Closed" : inrFromRupees(v * 1000)}`;
              return (
                <div
                  key={i}
                  title={tip}
                  className="flex-1 rounded-t-[3px] hover:bg-primary-hover"
                  style={{
                    height: v === 0 ? "2px" : `${Math.round((v / maxBar) * 100)}%`,
                    minHeight: 2,
                    background: v === 0 ? "var(--track)" : "var(--primary)",
                  }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] text-muted-2 font-mono">
            <span>21 Jun</span>
            <span>5 Jul</span>
            <span>20 Jul</span>
          </div>
        </Panel>

        <Panel className="p-4 flex flex-col gap-[11px]">
          <span className="text-[13px] font-semibold">Revenue by treatment · this month</span>
          {revRows.map(([label, value, w]) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{label}</span>
                <span className="tnum text-muted">{inrFromRupees(value)}</span>
              </div>
              <Meter value={w} opacity={0.35 + (w / 100) * 0.65} />
            </div>
          ))}
        </Panel>
      </div>

      {/* Three-up: doctors / sources / new-vs-returning */}
      <div className="grid grid-cols-3 gap-3.5 max-lg:grid-cols-1">
        <Panel className="p-4 flex flex-col gap-[11px]">
          <span className="text-[13px] font-semibold">Production per doctor</span>
          {docRows.map(([label, value, w]) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{label}</span>
                <span className="tnum text-muted">{inrFromRupees(value)}</span>
              </div>
              <Meter value={w} />
            </div>
          ))}
        </Panel>

        <Panel className="p-4 flex flex-col gap-3">
          <span className="text-[13px] font-semibold">Where new patients came from</span>
          <div className="flex h-2.5 rounded-[5px] overflow-hidden gap-0.5">
            {leadSegs.map(([label, pct, bg]) => (
              <div key={label} title={`${label} — ${pct}%`} style={{ width: `${pct}%`, background: bg }} />
            ))}
          </div>
          <div className="flex flex-col gap-[7px]">
            {leadSegs.map(([label, pct, bg]) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span className="w-[9px] h-[9px] rounded-[3px] flex-none" style={{ background: bg }} />
                <span className="flex-1 font-medium">{label}</span>
                <span className="tnum text-muted">{pct}%</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-4 flex flex-col gap-3">
          <span className="text-[13px] font-semibold">New vs returning · this month</span>
          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl font-bold tnum">34</span>
            <span className="text-[12.5px] text-muted">new patients of 186 seen</span>
          </div>
          <div className="flex h-2.5 rounded-[5px] overflow-hidden gap-0.5">
            <div title="New — 18%" style={{ width: "18%", background: "var(--primary)" }} />
            <div title="Returning — 82%" style={{ width: "82%", background: "#D4E0DA" }} />
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span><b className="text-ink">18%</b> new</span>
            <span><b className="text-ink">82%</b> returning</span>
          </div>
          <div className="text-[11.5px] text-muted-2 mt-auto">
            A healthy recall book keeps this above 75% returning.
          </div>
        </Panel>
      </div>
    </div>
  );
}
