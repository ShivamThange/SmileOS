import { useMemo, useState } from "react";
import { Drawer, DrawerCloseButton } from "@/components/common/drawer";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MedicalAlertBadge } from "@/components/common/medical-alert-badge";
import { useDeskStore, type TenderMethod } from "@/hooks/use-desk-store";
import { useUIStore } from "@/hooks/use-ui-store";
import { patients, appointments } from "@/lib/mock-data";
import { clinicConfig } from "@/config/clinic";
import { inferFeePaise } from "@/config/procedures";
import { inr } from "@/lib/format";
import { waLink, draftReceipt } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

/*
 * The Settle Sheet.
 *
 * Invoicing and taking payment are two screens but one moment: the patient is
 * standing at the desk with a UPI app already open. So this is a drawer over
 * whatever screen she was on, reachable from a check-in row, the chair queue,
 * a patient record or the palette — never a route change.
 *
 * Three things it takes seriously that most practice software does not:
 *
 *   · Split tenders are the norm, not an edge case. ₹3,000 by UPI and ₹2,000
 *     in cash is one settlement with two tenders, submitted once.
 *   · Families share a payer. A mother settling for three children should be
 *     one payment and one receipt, not three visits to the same screen.
 *   · Typing an amount into a payments app is the most error-prone step in the
 *     whole desk workflow, so the QR carries the amount already.
 */

const METHODS: TenderMethod[] = ["UPI", "Cash", "Card", "Bank transfer"];

/** Stand-in for the clinic's VPA — comes from clinic settings in production. */
const CLINIC_VPA = "meherdental@okhdfcbank";

export function SettleSheet() {
  const { settleOpen, settle, patchSettle, closeSettle, parkSettle, newTender } = useDeskStore();
  const { showToast } = useUIStore();
  const [saved, setSaved] = useState(false);

  const patient = settle ? patients.find((p) => p.id === settle.patientId) ?? null : null;

  /* Today's chair work for this patient, priced from the catalogue. */
  const todayLines = useMemo(() => {
    if (!patient) return [];
    return appointments
      .filter((a) => a.name === patient.name && ["done", "inchair", "arrived"].includes(a.status))
      .map((a) => ({ id: a.id, label: a.proc, paise: inferFeePaise(a.proc) }))
      .filter((l) => l.paise > 0);
  }, [patient]);

  /*
   * Family candidates. Surname matching is a placeholder for a real account
   * object — but the shape of the interaction is the point: other balances the
   * same payer is likely to clear are offered, not hidden.
   */
  const familyCandidates = useMemo(() => {
    if (!patient) return [];
    const surname = patient.name.split(" ").slice(-1)[0].toLowerCase();
    return patients.filter(
      (p) => p.id !== patient.id && p.balancePaise > 0 && p.name.toLowerCase().endsWith(surname),
    );
  }, [patient]);

  if (!settle || !patient) {
    return <Drawer open={false} onClose={closeSettle} width={470}>{null}</Drawer>;
  }

  const alsoPatients = patients.filter((p) => settle.alsoPatientIds.includes(p.id));

  const todayPaise = todayLines.reduce((s, l) => s + l.paise, 0);
  const priorPaise = patient.balancePaise;
  const familyPaise = alsoPatients.reduce((s, p) => s + p.balancePaise, 0);
  const duePaise = todayPaise + priorPaise + familyPaise;

  const enteredPaise = settle.tenders.reduce((s, t) => s + rupeesToPaise(t.amount), 0);
  const remainingPaise = duePaise - enteredPaise;

  const patchTender = (id: string, patch: Partial<{ method: TenderMethod; amount: string }>) =>
    patchSettle({
      tenders: settle.tenders.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });

  const addTender = () =>
    patchSettle({
      tenders: [
        ...settle.tenders,
        { ...newTender(), amount: remainingPaise > 0 ? paiseToRupeeInput(remainingPaise) : "" },
      ],
    });

  const removeTender = (id: string) =>
    patchSettle({ tenders: settle.tenders.filter((t) => t.id !== id) });

  const fillRemainder = (id: string) => {
    const others = settle.tenders
      .filter((t) => t.id !== id)
      .reduce((s, t) => s + rupeesToPaise(t.amount), 0);
    patchTender(id, { amount: paiseToRupeeInput(Math.max(duePaise - others, 0)) });
  };

  const record = () => {
    const methods = settle.tenders
      .filter((t) => rupeesToPaise(t.amount) > 0)
      .map((t) => `${t.method} ${inr(rupeesToPaise(t.amount))}`)
      .join(" + ");
    setSaved(true);
    showToast(
      `${inr(enteredPaise)} recorded for ${patient.name}${methods ? ` — ${methods}` : ""} · receipt queued`,
    );
    setTimeout(() => {
      setSaved(false);
      closeSettle();
    }, 700);
  };

  const upiUri = buildUpiUri(duePaise, patient.pno);

  return (
    <Drawer open={settleOpen} onClose={closeSettle} width={470}>
      {/* Who */}
      <div className="flex items-start gap-3 px-[18px] pt-[18px] pb-3.5 border-b border-border">
        <Avatar name={patient.name} size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">{patient.name}</div>
          <div className="text-[11.5px] text-muted-2 font-mono mt-px">
            {patient.pno} · {patient.phone}
          </div>
        </div>
        <DrawerCloseButton onClose={closeSettle} />
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] py-3.5 flex flex-col gap-3.5">
        <MedicalAlertBadge alert={patient.alert} variant="chip" className="self-start" />

        {/* What is owed */}
        <section className="flex flex-col gap-1.5">
          <SectionLabel>WHAT IS OWED</SectionLabel>
          <div className="rounded-[10px] border border-border overflow-hidden">
            {todayLines.map((l) => (
              <LedgerRow key={l.id} label={l.label} sub="Today" paise={l.paise} />
            ))}
            {priorPaise > 0 && (
              <LedgerRow label="Previous balance" sub={`Since ${patient.lastVisit}`} paise={priorPaise} />
            )}
            {alsoPatients.map((p) => (
              <LedgerRow
                key={p.id}
                label={p.name}
                sub="Same account"
                paise={p.balancePaise}
                onRemove={() =>
                  patchSettle({ alsoPatientIds: settle.alsoPatientIds.filter((id) => id !== p.id) })
                }
              />
            ))}
            {todayLines.length === 0 && priorPaise === 0 && alsoPatients.length === 0 && (
              <div className="px-3 py-4 text-[12.5px] text-muted text-center">
                Nothing outstanding. You can still record an advance below.
              </div>
            )}
            <div className="flex items-center justify-between px-3 py-2.5 bg-bg-content border-t border-border">
              <span className="text-[12.5px] font-semibold">Total due</span>
              <span className="text-[17px] font-bold tnum">{inr(duePaise)}</span>
            </div>
          </div>
        </section>

        {/* Family */}
        {familyCandidates.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <SectionLabel>SAME ACCOUNT</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {familyCandidates.map((p) => {
                const on = settle.alsoPatientIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      patchSettle({
                        alsoPatientIds: on
                          ? settle.alsoPatientIds.filter((id) => id !== p.id)
                          : [...settle.alsoPatientIds, p.id],
                      })
                    }
                    className={cn(
                      "text-[11.5px] font-medium px-2 py-1 rounded-md border transition-colors",
                      on
                        ? "bg-primary-tint border-primary-tint-border text-primary"
                        : "bg-surface border-border text-muted hover:border-border-strong",
                    )}
                  >
                    {on ? "✓ " : "+ "}
                    {p.name} · <span className="tnum">{inr(p.balancePaise)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Tenders */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <SectionLabel>PAYMENT</SectionLabel>
            <button onClick={addTender} className="text-[11.5px] font-semibold text-primary">
              + Split
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {settle.tenders.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5">
                <select
                  value={t.method}
                  onChange={(e) => patchTender(t.id, { method: e.target.value as TenderMethod })}
                  className="text-[12.5px] px-2 py-1.5 border border-border rounded-md bg-bg-content outline-none focus:border-primary w-[112px]"
                >
                  {METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <div className="flex-1 flex items-center gap-1 px-2 py-1.5 border border-border rounded-md bg-bg-content focus-within:border-primary">
                  <span className="text-muted-2 text-[13px]">₹</span>
                  <input
                    value={t.amount}
                    onChange={(e) => patchTender(t.id, { amount: e.target.value })}
                    inputMode="decimal"
                    placeholder="0"
                    className="flex-1 min-w-0 border-none outline-none bg-transparent text-[13px] tnum text-ink placeholder:text-muted-2"
                  />
                  <button
                    onClick={() => fillRemainder(t.id)}
                    title="Fill the remaining amount"
                    className="text-[10.5px] font-semibold text-primary px-1"
                  >
                    all
                  </button>
                </div>
                {settle.tenders.length > 1 && (
                  <button
                    onClick={() => removeTender(t.id)}
                    aria-label="Remove this tender"
                    className="w-[26px] h-[26px] grid place-items-center rounded-[6px] text-muted-2 hover:bg-bg hover:text-danger"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[12px] pt-0.5">
            <span className="text-muted">Entered</span>
            <span className="tnum font-semibold">{inr(enteredPaise)}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted">{remainingPaise >= 0 ? "Still owing" : "Change due"}</span>
            <span
              className="tnum font-semibold"
              style={{ color: remainingPaise > 0 ? "var(--danger)" : "var(--primary)" }}
            >
              {inr(Math.abs(remainingPaise))}
            </span>
          </div>
        </section>

        {/* UPI */}
        <section className="flex flex-col gap-1.5">
          <button
            onClick={() => patchSettle({ showQr: !settle.showQr })}
            className="flex items-center gap-2 text-[12.5px] font-semibold text-primary self-start"
          >
            <Icon name={settle.showQr ? "chevronDown" : "chevronRight"} size={13} />
            Show UPI QR for {inr(duePaise)}
          </button>

          {settle.showQr && (
            <div className="rounded-[10px] border border-border p-3 flex gap-3 items-center animate-dc-row">
              <div
                className="w-[104px] h-[104px] rounded-md border border-dashed border-border-strong grid place-items-center text-center text-[10px] leading-tight text-muted-2 px-2 shrink-0 bg-bg-content"
                aria-label="UPI QR code placeholder"
              >
                QR renders here
                <br />
                once a QR encoder
                <br />
                is added
              </div>
              <div className="min-w-0 flex flex-col gap-1.5">
                <div className="text-[11px] font-bold tracking-[0.06em] text-muted-2">
                  UPI PAYLOAD
                </div>
                <code className="text-[10.5px] font-mono text-muted break-all leading-snug">
                  {upiUri}
                </code>
                <div className="flex gap-1.5">
                  <a
                    href={upiUri}
                    className="text-[11.5px] font-semibold px-2 py-1 rounded-md border border-primary-tint-border bg-primary-tint text-primary"
                  >
                    Open UPI app
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(upiUri);
                      showToast("UPI link copied");
                    }}
                    className="text-[11.5px] font-semibold px-2 py-1 rounded-md border border-border bg-surface text-muted hover:bg-bg"
                  >
                    Copy
                  </button>
                </div>
                <div className="text-[10.5px] text-muted-2 leading-snug">
                  Amount is pre-filled, so nobody types it into a payments app.
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Note */}
        <section className="flex flex-col gap-1.5">
          <SectionLabel>NOTE (OPTIONAL)</SectionLabel>
          <input
            value={settle.note}
            onChange={(e) => patchSettle({ note: e.target.value })}
            placeholder="e.g. balance to be cleared at next visit"
            className="text-[12.5px] px-2.5 py-1.5 border border-border rounded-md bg-bg-content outline-none focus:border-primary"
          />
        </section>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-[18px] py-3.5 border-t border-border">
        <Button
          variant="primary"
          className="flex-1 py-2.5"
          disabled={enteredPaise <= 0 || saved}
          onClick={record}
        >
          {saved ? "✓ Recorded" : `Record ${inr(enteredPaise)}`}
        </Button>
        <a
          href={waLink(
            patient.phone,
            draftReceipt({
              name: patient.name.split(" ")[0],
              amount: inr(enteredPaise),
              clinic: clinicConfig.name,
            }),
          )}
          target="_blank"
          rel="noopener noreferrer"
          title="Send the receipt on WhatsApp"
          className="w-[42px] grid place-items-center rounded-md border border-border bg-surface text-primary hover:bg-bg"
        >
          <Icon name="message" size={15} />
        </a>
        <Button
          variant="secondary"
          className="py-2.5"
          onClick={() => {
            parkSettle(patient.name, `Settling ${inr(duePaise)}`);
            showToast("Settlement parked");
          }}
        >
          Park
        </Button>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">{children}</div>
  );
}

function LedgerRow({
  label,
  sub,
  paise,
  onRemove,
}: {
  label: string;
  sub: string;
  paise: number;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-faint last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium truncate">{label}</div>
        <div className="text-[10.5px] text-muted-2">{sub}</div>
      </div>
      <span className="text-[13px] tnum font-semibold">{inr(paise)}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="w-[20px] h-[20px] grid place-items-center rounded-[5px] text-muted-2 hover:text-danger hover:bg-bg text-[11px]"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** "1,250.50" → 125050 paise. Tolerant of commas, spaces and a stray ₹. */
function rupeesToPaise(input: string): number {
  const n = parseFloat((input ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Paise → a plain rupee string for an input field (no grouping). */
function paiseToRupeeInput(paise: number): string {
  const r = paise / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

/** UPI intent URI with the amount already filled in. */
function buildUpiUri(paise: number, ref: string): string {
  const params = new URLSearchParams({
    pa: CLINIC_VPA,
    pn: clinicConfig.name,
    am: (paise / 100).toFixed(2),
    cu: "INR",
    tn: `${clinicConfig.name} ${ref}`,
  });
  return `upi://pay?${params.toString()}`;
}
