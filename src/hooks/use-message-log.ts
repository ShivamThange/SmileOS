import { create } from "zustand";
import {
  checkSuppression,
  type MessageChannel,
  type MessageKind,
  type SentMessage,
  type Verdict,
} from "@/lib/messaging";
import { appointments, patients } from "@/lib/mock-data";
import { treatmentPlans } from "@/features/treatment-plan/plans-data";

/*
 * Every outbound message, in one place.
 *
 * Suppression only works if there is exactly one record of what has been sent.
 * The moment recalls keep their own log and recovery keeps another, the "one
 * message a day" rule quietly becomes "one message a day per engine", which is
 * three messages a day.
 *
 * In production this is the communications collection on the server, and the
 * check happens there too — a client-side guard stops honest mistakes, not a
 * misbehaving integration.
 */

let seq = 0;

/** A day of prior traffic, so suppression has something to actually suppress. */
function seedLog(): SentMessage[] {
  const now = Date.now();
  return [
    { id: "m1", patientId: "p5", kind: "recovery", channel: "whatsapp", at: now - 3 * 3_600_000 },
    { id: "m2", patientId: "p6", kind: "recall", channel: "whatsapp", at: now - 20 * 3_600_000 },
    { id: "m3", patientId: "p1", kind: "plan-followup", channel: "whatsapp", at: now - 4 * 86_400_000 },
    { id: "m4", patientId: "p1", kind: "recovery", channel: "whatsapp", at: now - 5 * 86_400_000 },
  ];
}

interface MessageLogState {
  log: SentMessage[];
  /** Patients who asked not to be contacted, and until when. */
  suppressedUntil: Record<string, number>;

  record: (patientId: string, kind: MessageKind, channel?: MessageChannel) => void;
  suppressFor: (patientId: string, days: number) => void;
  check: (patientId: string, kind: MessageKind) => Verdict;
  historyFor: (patientId: string) => SentMessage[];
}

export const useMessageLog = create<MessageLogState>((set, get) => ({
  log: seedLog(),
  suppressedUntil: {},

  record: (patientId, kind, channel = "whatsapp") =>
    set((s) => ({
      log: [
        ...s.log,
        { id: `m_${Date.now().toString(36)}_${seq++}`, patientId, kind, channel, at: Date.now() },
      ],
    })),

  suppressFor: (patientId, days) =>
    set((s) => ({
      suppressedUntil: { ...s.suppressedUntil, [patientId]: Date.now() + days * 86_400_000 },
    })),

  /*
   * The context the rules need is assembled here rather than at every call
   * site, so a new send button can't accidentally skip half of it.
   */
  check: (patientId, kind) => {
    const state = get();
    const patient = patients.find((p) => p.id === patientId);

    return checkSuppression({
      patientId,
      kind,
      log: state.log,
      hoursToNextAppointment: hoursToNextAppointment(patient?.name),
      planConversationOpen: planConversationOpen(patientId),
      beingChasedForMoney: (patient?.balancePaise ?? 0) > 0,
      suppressedUntil: state.suppressedUntil[patientId],
    });
  },

  historyFor: (patientId) =>
    get()
      .log.filter((m) => m.patientId === patientId)
      .sort((a, b) => b.at - a.at),
}));

/**
 * Hours until this patient's next booked appointment.
 *
 * The mock book is a single anchored day and appointments carry a name rather
 * than a patient id, so this matches on name. When the API lands it is a field
 * on the patient record and this function disappears.
 */
function hoursToNextAppointment(patientName?: string): number | undefined {
  if (!patientName) return undefined;
  const appt = appointments.find(
    (a) => a.name === patientName && ["scheduled", "confirmed"].includes(a.status),
  );
  if (!appt) return undefined;
  const nowHour = new Date().getHours() + new Date().getMinutes() / 60;
  const diff = appt.start - nowHour;
  return diff > 0 ? diff : 24 + diff;
}

/** They have a plan out and have been reading it recently. */
function planConversationOpen(patientId: string): boolean {
  const plan = treatmentPlans.find((p) => p.patientId === patientId);
  if (!plan?.engagement.sentOn) return false;
  return plan.engagement.opens > 0;
}
