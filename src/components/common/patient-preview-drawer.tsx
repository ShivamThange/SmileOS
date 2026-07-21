import { Link } from "react-router-dom";
import { Drawer, DrawerCloseButton } from "./drawer";
import { Avatar } from "@/components/ui/avatar";
import { MoneyText } from "./money-text";
import { MedicalAlertBadge } from "./medical-alert-badge";
import { PhoneLink, WhatsAppButton } from "./phone-link";
import { useUIStore } from "@/hooks/use-ui-store";
import { useDeskStore } from "@/hooks/use-desk-store";
import { patients } from "@/lib/mock-data";
import { clinicConfig } from "@/config/clinic";

/**
 * Quick patient preview — opens from tables, the calendar and the command
 * palette. Medical alerts render first, in red, and are impossible to miss
 * (spec §6.6, patient-safety surface).
 */
export function PatientPreviewDrawer() {
  const { previewPatientId, closePatientPreview } = useUIStore();
  const { openSettle, openBooking } = useDeskStore();
  const p = patients.find((x) => x.id === previewPatientId) ?? null;

  return (
    <Drawer open={!!p} onClose={closePatientPreview} width={400}>
      {p && (
        <>
          <div className="flex items-start gap-3 px-[18px] pt-[18px] pb-3.5 border-b border-border">
            <Avatar name={p.name} size={44} />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold tracking-[-0.01em]">{p.name}</div>
              <div className="text-[11.5px] text-muted-2 mt-px flex items-center gap-1.5">
                <span className="font-mono">
                  {p.pno} · {p.agesex}
                </span>
                <PhoneLink
                  phone={p.phone}
                  message={`Hello ${p.name}, this is ${clinicConfig.name}.`}
                />
              </div>
            </div>
            <DrawerCloseButton onClose={closePatientPreview} />
          </div>

          <div className="flex-1 overflow-y-auto px-[18px] py-3.5 flex flex-col gap-3.5">
            <MedicalAlertBadge alert={p.alert} variant="banner" />

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

          {/*
           * Every action here is a verb the desk actually performs, and none of
           * them navigate away — settling and booking open over this drawer.
           */}
          <div className="flex flex-wrap gap-2 px-[18px] py-3.5 border-t border-border">
            <Link
              to={`/app/patients/${p.id}`}
              onClick={closePatientPreview}
              className="flex-1 min-w-[110px] text-center text-[12.5px] font-semibold py-2.5 rounded-md bg-primary text-on-primary hover:bg-primary-hover"
            >
              Open record
            </Link>
            <Link
              to={`/app/clinical/chart/${p.id}`}
              onClick={closePatientPreview}
              className="flex-1 min-w-[110px] text-center text-[12.5px] font-semibold py-2.5 rounded-md border border-primary-tint-border bg-primary-tint text-primary hover:bg-primary-tint-border"
            >
              Chart
            </Link>
            <button
              onClick={() => {
                closePatientPreview();
                openSettle(p.id);
              }}
              className="flex-1 min-w-[96px] text-center text-[12.5px] font-semibold py-2.5 rounded-md border border-border bg-surface hover:bg-bg"
            >
              {p.balancePaise ? "Settle" : "Take payment"}
            </button>
            <button
              onClick={() => {
                closePatientPreview();
                openBooking({ phone: p.phone, patientId: p.id });
              }}
              className="flex-1 min-w-[80px] text-center text-[12.5px] font-semibold py-2.5 rounded-md border border-border bg-surface hover:bg-bg"
            >
              Book
            </button>
            <WhatsAppButton
              phone={p.phone}
              label=""
              message={`Hello ${p.name}, this is ${clinicConfig.name}.`}
              className="w-[42px] py-2.5"
            />
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
