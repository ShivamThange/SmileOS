import { create } from "zustand";

/*
 * Desk state — the front-desk surfaces that are deliberately *not* routes.
 *
 * The governing observation: the receptionist is interrupted roughly every
 * ninety seconds. So two rules are baked into this store.
 *
 *   1. Never lose a route to a task. Booking and settling are overlays; the
 *      screen behind them does not change, so she never has to find her way
 *      back to where she was.
 *   2. Resumability is a first-class state, not an error case. Any half-done
 *      task can be parked as a chip in the shell and picked up four minutes
 *      later with everything intact. Several can be parked at once, because
 *      several things are genuinely happening at once.
 */

export type ParkedKind = "booking" | "settle";

export interface ParkedTask {
  id: string;
  kind: ParkedKind;
  /** "Ramesh Iyer · RCT" — enough to know which interruption this was. */
  label: string;
  sub?: string;
  parkedAt: number;
  payload: BookingDraft | SettleDraft;
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

/**
 * A slot dragged out on the calendar and held open while a patient is found.
 *
 * The calendar and the booking bar are one flow, not two features: dragging a
 * block on the grid *is* starting a booking. Holding the exact slot means the
 * receptionist never has to describe back to the system the thing she just drew.
 */
export interface HeldSlot {
  chair: string;
  doctor: string;
  /** Days from today. */
  offset: number;
  /** Decimal hour. */
  start: number;
  minutes: number;
}

export interface BookingDraft {
  /** Set when this draft came back from a parked chip. */
  taskId: string | null;
  phone: string;
  /** Bound existing patient, if the phone number matched one. */
  patientId: string | null;
  /** Inline capture for a caller we've never met. */
  newName: string;
  newSource: string;
  /** The caller's request, in their own words. */
  request: string;
  selectedSlotId: string | null;
  heldSlot?: HeldSlot;
}

export const emptyBooking = (): BookingDraft => ({
  taskId: null,
  phone: "",
  patientId: null,
  newName: "",
  newSource: "Phone",
  request: "",
  selectedSlotId: null,
});

// ---------------------------------------------------------------------------
// Settling
// ---------------------------------------------------------------------------

export type TenderMethod = "UPI" | "Cash" | "Card" | "Bank transfer";

export interface Tender {
  id: string;
  method: TenderMethod;
  /** Rupees as typed; converted to paise on submit. Empty string is allowed. */
  amount: string;
}

export interface SettleDraft {
  taskId: string | null;
  patientId: string;
  /** Patients whose balances are being cleared in this one settlement. */
  alsoPatientIds: string[];
  tenders: Tender[];
  note: string;
  showQr: boolean;
}

export const emptySettle = (patientId: string): SettleDraft => ({
  taskId: null,
  patientId,
  alsoPatientIds: [],
  tenders: [{ id: "t1", method: "UPI", amount: "" }],
  note: "",
  showQr: false,
});

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${seq++}`;

interface DeskState {
  parked: ParkedTask[];
  park: (task: Omit<ParkedTask, "id" | "parkedAt">) => string;
  discard: (id: string) => void;
  resume: (id: string) => void;

  bookingOpen: boolean;
  booking: BookingDraft;
  openBooking: (prefill?: Partial<BookingDraft>) => void;
  patchBooking: (patch: Partial<BookingDraft>) => void;
  closeBooking: () => void;
  parkBooking: (label: string, sub?: string) => void;

  settleOpen: boolean;
  settle: SettleDraft | null;
  openSettle: (patientId: string) => void;
  patchSettle: (patch: Partial<SettleDraft>) => void;
  closeSettle: () => void;
  parkSettle: (label: string, sub?: string) => void;

  newTender: () => Tender;
}

export const useDeskStore = create<DeskState>((set, get) => ({
  parked: [],

  park: (task) => {
    const id = nextId(task.kind);
    set((s) => ({ parked: [...s.parked, { ...task, id, parkedAt: Date.now() }] }));
    return id;
  },

  discard: (id) => set((s) => ({ parked: s.parked.filter((t) => t.id !== id) })),

  resume: (id) => {
    const task = get().parked.find((t) => t.id === id);
    if (!task) return;
    set((s) => ({ parked: s.parked.filter((t) => t.id !== id) }));

    if (task.kind === "booking") {
      set({ booking: { ...(task.payload as BookingDraft), taskId: null }, bookingOpen: true, settleOpen: false });
    } else {
      set({ settle: { ...(task.payload as SettleDraft), taskId: null }, settleOpen: true, bookingOpen: false });
    }
  },

  // --- booking -------------------------------------------------------------

  bookingOpen: false,
  booking: emptyBooking(),

  openBooking: (prefill) =>
    set({ bookingOpen: true, settleOpen: false, booking: { ...emptyBooking(), ...prefill } }),

  patchBooking: (patch) => set((s) => ({ booking: { ...s.booking, ...patch } })),

  closeBooking: () => set({ bookingOpen: false, booking: emptyBooking() }),

  parkBooking: (label, sub) => {
    const draft = get().booking;
    get().park({ kind: "booking", label, sub, payload: { ...draft } });
    set({ bookingOpen: false, booking: emptyBooking() });
  },

  // --- settling ------------------------------------------------------------

  settleOpen: false,
  settle: null,

  openSettle: (patientId) =>
    set({ settleOpen: true, bookingOpen: false, settle: emptySettle(patientId) }),

  patchSettle: (patch) =>
    set((s) => (s.settle ? { settle: { ...s.settle, ...patch } } : {})),

  closeSettle: () => set({ settleOpen: false, settle: null }),

  parkSettle: (label, sub) => {
    const draft = get().settle;
    if (!draft) return;
    get().park({ kind: "settle", label, sub, payload: { ...draft } });
    set({ settleOpen: false, settle: null });
  },

  newTender: () => ({ id: nextId("t"), method: "Cash", amount: "" }),
}));
