import { Link } from "react-router-dom";
import { Drawer, DrawerCloseButton } from "./drawer";
import { Avatar } from "@/components/ui/avatar";
import { MoneyText } from "./money-text";
import { useUIStore } from "@/hooks/use-ui-store";
import { patients } from "@/lib/mock-data";

/**
 * Quick patient preview — opens from tables, the calendar and the command
 * palette. Medical alerts render first, in red, and are impossible to miss
 * (spec §6.6, patient-safety surface).
 */
export function PatientPreviewDrawer() {
  const { previewPatientId, closePatientPreview, showToast } = useUIStore();
  const p = patients.find((x) => x.id === previewPatientId) ?? null;

  return (
    <Drawer open={!!p} onClose={closePatientPreview} width={400}>
      {p && (
        <>
          <div className="flex items-start gap-3 px-[18px] pt-[18px] pb-3.5 border-b border-border">
            <Avatar name={p.name} size={44} />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold tracking-[-0.01em]">{p.name}</div>
              <div className="text-[11.5px] text-muted-2 font-mono mt-px">
                {p.pno} · {p.agesex} · {p.phone}
              </div>
            </div>
            <DrawerCloseButton onClose={closePatientPreview} />
          </div>

          <div className="flex-1 overflow-y-auto px-[18px] py-3.5 flex flex-col gap-3.5">
            {p.alert && (
              <div className="flex gap-2.5 items-start bg-danger-bg border border-danger-border rounded-[10px] px-3 py-2.5">
                <span className="text-sm leading-none shrink-0">⚠</span>
                <div>
                  <div className="text-[11px] font-bold tracking-[0.05em] text-danger">
                    MEDICAL ALERT
                  </div>
                  <div className="text-[12.5px] text-ink mt-0.5 leading-snug">{p.alert}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <Fact label="OUTSTANDING">
                <span
                  className="text-[17px] font-bold tnum"
                  style={{ color: p.balancePaise ? "var(--danger)" : "var(--primary)" }}
                >
                  {p.balancePaise ? <MoneyText paise={p.balancePaise} /> : "Nil"}
                </span>
              </Fact>
              <Fact label="LIFETIME VALUE">
                <span className="text-[17px] font-bold tnum">
                  <MoneyText paise={p.ltvPaise} />
                </span>
              </Fact>
              <Fact label="LAST VISIT">
                <span className="text-[13px] font-semibold">{p.lastVisit}</span>
              </Fact>
              <Fact label="NEXT APPOINTMENT">
                <span className="text-[13px] font-semibold">{p.nextVisit}</span>
              </Fact>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-bold tracking-[0.06em] text-muted-2">
                RECENT ACTIVITY
              </div>
              {p.timeline.map((t, i) => (
                <div key={i} className="flex gap-2.5 text-[12.5px]">
                  <span className="font-mono text-[11px] text-muted-2 shrink-0 w-[52px] pt-px">
                    {t.date}
                  </span>
                  <span className="leading-snug">{t.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 px-[18px] py-3.5 border-t border-border">
            <Link
              to={`/app/patients/${p.id}`}
              onClick={closePatientPreview}
              className="flex-1 text-center text-[12.5px] font-semibold py-2.5 rounded-md bg-primary text-on-primary hover:bg-primary-hover"
            >
              Open record
            </Link>
            <button
              onClick={() =>
                showToast(
                  p.balancePaise
                    ? `Collecting from ${p.name}`
                    : "No balance outstanding",
                )
              }
              className="flex-1 text-center text-[12.5px] font-semibold py-2.5 rounded-md border border-border bg-surface hover:bg-bg"
            >
              Take payment
            </button>
            <button
              onClick={() => showToast(`Message thread opened — ${p.name}`)}
              className="flex-1 text-center text-[12.5px] font-semibold py-2.5 rounded-md border border-border bg-surface hover:bg-bg"
            >
              Message
            </button>
          </div>
        </>
      )}
    </Drawer>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-[10px] px-3 py-2.5">
      <div className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
