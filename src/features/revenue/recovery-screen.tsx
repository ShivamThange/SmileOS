import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/ui/card";
import { UrgencyBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { inr, inrFromRupees } from "@/lib/format";
import { recoveryRows as seedRows, patients } from "@/lib/mock-data";
import { useUIStore } from "@/hooks/use-ui-store";
import type { RecoveryRow } from "@/types";

const GRID = "34px 1.55fr 1.5fr 0.85fr 0.95fr 0.85fr 1.35fr 1fr 168px";

const summary = [
  { label: "Advised care unscheduled", value: inrFromRupees(482600), sub: "Across 23 patients" },
  { label: "Recovered · last 30 days", value: inrFromRupees(126400), sub: "9 plans booked" },
  { label: "Recovery rate", value: "31%", sub: "Of value followed up" },
  { label: "Due today", value: "3", sub: `${inrFromRupees(104500)} in today's follow-ups` },
];

const patientById = (id: string) => patients.find((p) => p.id === id)!;

export function RecoveryScreen() {
  const { showToast, openPatientPreview } = useUIStore();
  const [rows, setRows] = useState<RecoveryRow[]>(seedRows);
  const [urg, setUrg] = useState("All");
  const [type, setType] = useState("All");
  const [dueToday, setDueToday] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => {
    const grp = (r: RecoveryRow) => (r.due === "today" || r.due === "overdue" ? 0 : 1);
    return rows
      .filter(
        (r) =>
          (urg === "All" || r.urgency === urg) &&
          (type === "All" || r.type === type) &&
          (!dueToday || r.due === "today" || r.due === "overdue"),
      )
      .slice()
      .sort((a, b) => grp(a) - grp(b) || b.valuePaise - a.valuePaise);
  }, [rows, urg, type, dueToday]);

  const selIds = Object.keys(selected).filter((k) => selected[k]);
  const selValue = rows.filter((r) => selIds.includes(r.id)).reduce((a, r) => a + r.valuePaise, 0);

  const patch = (id: string, upd: Partial<RecoveryRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...upd } : r)));

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="Recovery worklist"
        subtitle="Patients whose advised care never got scheduled. Start at the top, work down."
      />

      <div className="grid grid-cols-4 gap-3.5 max-md:grid-cols-2">
        {summary.map((s) => (
          <Panel key={s.label} className="p-3.5 flex flex-col gap-1">
            <div className="text-[11.5px] font-semibold text-muted">{s.label}</div>
            <div className="text-xl font-bold tnum tracking-[-0.02em]">{s.value}</div>
            <div className="text-[11.5px] text-muted-2">{s.sub}</div>
          </Panel>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <select
          value={urg}
          onChange={(e) => setUrg(e.target.value)}
          className="text-[12.5px] px-2.5 py-1.5 border border-border rounded-md bg-surface text-ink cursor-pointer"
        >
          <option value="All">Urgency · all</option>
          <option value="High">High only</option>
          <option value="Moderate">Moderate</option>
          <option value="Routine">Routine</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="text-[12.5px] px-2.5 py-1.5 border border-border rounded-md bg-surface text-ink cursor-pointer"
        >
          <option value="All">Treatment · all</option>
          <option value="Implants">Implants</option>
          <option value="Endo">Root canal &amp; crowns</option>
          <option value="Prostho">Dentures &amp; rehab</option>
          <option value="Cosmetic">Cosmetic</option>
          <option value="Surgery">Surgery</option>
        </select>
        <button
          onClick={() => setDueToday((d) => !d)}
          className="text-[12.5px] font-semibold px-3 py-1.5 rounded-md border"
          style={{
            background: dueToday ? "var(--primary)" : "var(--surface)",
            color: dueToday ? "var(--on-primary)" : "var(--ink)",
            borderColor: dueToday ? "var(--primary)" : "var(--border)",
          }}
        >
          Due today
        </button>
        <div className="flex-1" />
        <div className="text-xs text-muted">
          Sorted by value · due-today first ·{" "}
          <span className="font-semibold text-ink">{visible.length} plans shown</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div
          className="grid gap-2.5 items-center px-3.5 py-[9px] border-b border-border bg-bg-content text-[10.5px] font-bold tracking-[0.06em] text-muted-2"
          style={{ gridTemplateColumns: GRID }}
        >
          <span />
          <span>PATIENT</span>
          <span>RECOMMENDED</span>
          <span className="text-right">VALUE</span>
          <span>PLANNED</span>
          <span>URGENCY</span>
          <span>LAST CONTACT</span>
          <span>FOLLOW-UP</span>
          <span />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Nothing matches these filters"
            body="Every plan in this view has been actioned. Widen the filters, or come back after tomorrow's diagnoses."
          />
        ) : (
          visible.map((r) => {
            const p = patientById(r.patientId);
            const sel = !!selected[r.id];
            const overdue = r.due === "overdue";
            const today = r.due === "today";
            return (
              <div key={r.id} className="border-b border-border-faint" style={{ opacity: r.declined ? 0.45 : 1 }}>
                <div
                  className="grid gap-2.5 items-center px-3.5 py-[11px] text-[12.5px] hover:bg-bg-content"
                  style={{ gridTemplateColumns: GRID, background: sel ? "#F3F7F5" : "transparent" }}
                >
                  <button
                    onClick={() => setSelected((s) => ({ ...s, [r.id]: !s[r.id] }))}
                    className="w-4 h-4 rounded-sm border-[1.5px] grid place-items-center text-white text-[11px] font-bold"
                    style={{
                      borderColor: sel ? "var(--primary)" : "var(--border-strong)",
                      background: sel ? "var(--primary)" : "var(--surface)",
                    }}
                    aria-label="Select"
                  >
                    {sel ? "✓" : ""}
                  </button>

                  <button className="text-left min-w-0" onClick={() => openPatientPreview(r.patientId)}>
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-2 font-mono">{p.phone}</div>
                  </button>

                  <button
                    className="text-left min-w-0"
                    onClick={() => setExpanded((e) => (e === r.id ? null : r.id))}
                  >
                    <div className="font-medium truncate">{r.proc}</div>
                    <div className="text-[11px] text-muted-2">{r.tooth}</div>
                  </button>

                  <div className="text-right font-bold tnum">{inr(r.valuePaise)}</div>

                  <div>
                    <div className="text-xs">{r.planned}</div>
                    <div className="text-[11px] text-muted-2">{r.ago}</div>
                  </div>

                  <div><UrgencyBadge urgency={r.urgency} /></div>

                  <div className="min-w-0">
                    <div className="text-xs truncate">{r.lastContact}</div>
                    <div className="text-[11px] text-muted-2 truncate">{r.lastSub || "—"}</div>
                  </div>

                  <div
                    className="text-xs"
                    style={{
                      fontWeight: overdue || today ? 700 : 500,
                      color: r.declined
                        ? "var(--muted-2)"
                        : overdue
                          ? "var(--danger)"
                          : today
                            ? "var(--warning)"
                            : "var(--muted)",
                    }}
                  >
                    {r.declined ? "Declined" : overdue ? r.dueText || "Overdue" : today ? "Due today" : r.due}
                  </div>

                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => showToast(`Calling ${p.name} — ${p.phone}`)}
                      className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-[7px] border border-primary-tint-border bg-primary-tint text-primary hover:bg-primary-tint-border"
                    >
                      Call
                    </button>
                    <button
                      onClick={() => showToast(`WhatsApp draft opened — ${r.proc} · ${inr(r.valuePaise)}`)}
                      className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-[7px] border border-border bg-surface hover:bg-bg"
                    >
                      Msg
                    </button>
                    <button
                      onClick={() => showToast(`Booking started for ${p.name} — ${r.proc}`)}
                      className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-[7px] border border-border bg-surface hover:bg-bg"
                    >
                      Book
                    </button>
                  </div>
                </div>

                {expanded === r.id && (
                  <div
                    className="grid grid-cols-[1fr_1fr_auto] gap-4 px-3.5 pt-3 pb-3.5 pl-[58px] bg-bg-content animate-dc-fade"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">
                        CLINICAL FINDING · {r.doctor}
                      </div>
                      <div className="text-[12.5px] leading-snug text-ink">{r.finding}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">
                        WHY THE PATIENT HELD OFF
                      </div>
                      <div className="text-[12.5px] leading-snug text-ink italic">"{r.reason}"</div>
                    </div>
                    <div className="flex flex-col gap-1.5 justify-center">
                      <button
                        onClick={() => {
                          patch(r.id, { lastContact: "Today — logged", lastSub: "Attempt recorded" });
                          showToast(`Contact attempt logged for ${p.name}`);
                        }}
                        className="text-[11.5px] font-semibold px-3 py-1.5 rounded-[7px] border border-border bg-surface hover:bg-bg"
                      >
                        Log attempt
                      </button>
                      <button
                        onClick={() => {
                          patch(r.id, { due: "27 Jul", dueText: undefined });
                          setExpanded(null);
                          showToast("Follow-up moved to 27 Jul");
                        }}
                        className="text-[11.5px] font-semibold px-3 py-1.5 rounded-[7px] border border-border bg-surface hover:bg-bg"
                      >
                        Push a week
                      </button>
                      <button
                        onClick={() => {
                          patch(r.id, { declined: true });
                          setExpanded(null);
                          showToast(`${p.name} marked declined — reason recorded`);
                        }}
                        className="text-[11.5px] font-semibold px-3 py-1.5 rounded-[7px] border border-border bg-surface text-danger hover:bg-danger-bg"
                      >
                        Mark declined
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bulk action bar */}
      {selIds.length > 0 && (
        <div className="sticky bottom-4 self-center flex items-center gap-3.5 bg-ink text-on-primary rounded-lg px-4 py-2.5 shadow-toast animate-dc-toast">
          <span className="text-[12.5px]">
            <b>{selIds.length} selected</b> · {inr(selValue)} in advised care
          </span>
          <button
            onClick={() => {
              showToast(
                `Group message drafted for ${selIds.length} patients — ${inr(selValue)} in advised care`,
              );
              setSelected({});
            }}
            className="text-xs font-semibold px-3.5 py-1.5 rounded-md bg-primary hover:bg-primary-lift"
          >
            Message this group
          </button>
          <button onClick={() => setSelected({})} className="text-xs text-muted-2 hover:text-on-primary">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
